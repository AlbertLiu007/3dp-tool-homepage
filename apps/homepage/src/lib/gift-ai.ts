import { ensureServerStl } from '@/lib/model/server-glb-to-stl';
import { createTransparentPng, createWhiteMattePng } from '@/lib/image-transparency';

type ImageApiItem = {
  b64_json?: string;
  url?: string;
};

type ImageApiResponse = {
  data?: ImageApiItem[];
  error?: { message?: string };
};

type AsyncImageTask = {
  id?: string;
  status?: string;
  content_url?: string;
  error?: { message?: string } | string | null;
};

type TripoEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type TripoTask = {
  task_id?: string;
  status?: string;
  progress?: number;
  output?: {
    model_url?: string;
    rendered_image_url?: string;
  };
  error_code?: number;
  error_message?: string;
  credits_consumed?: number;
};

export type GeneratedGiftImage = {
  dataUrl?: string;
  url?: string;
  model?: string;
  transparentBackground?: boolean;
  transparentBackgroundProcessor?: string;
};

export type WhiteModelJob = {
  id: string;
  status: string;
};

export type WhiteModelQuery = {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  models: { type: string; url: string; previewImageUrl?: string }[];
};

export class GiftAiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly reason: 'configuration' | 'validation' | 'upstream' | 'authentication' | 'approval' | 'quota' = 'upstream',
  ) {
    super(message);
    this.name = 'GiftAiError';
  }
}

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new GiftAiError(`${name} is not configured.`, 503, 'configuration');
  return value;
}

function normalizedBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

const TRANSIENT_UPSTREAM_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ASYNC_IMAGE_POLL_INTERVAL_MS = 2_000;
const ASYNC_IMAGE_POLL_TIMEOUT_MS = 180_000;
const PRINTABILITY_CONSTRAINT = 'Printable geometry requirements: create one complete watertight closed single-shell solid object. Every component must be physically joined to the main body and self-supporting; no floating, suspended, disconnected, intersecting, open, hollow-without-wall, paper-thin, or fragile parts. Use manufacturable thickness and a stable integrated base suitable for resin 3D printing. Do not render any cast shadow, contact shadow, floor shadow, model shadow, or detached shadow; use even neutral studio lighting on a fully transparent background.';

export const IMAGE_GENERATION_MODEL = 'grok-imagine-image';
export const IMAGE_EDIT_MODEL = 'grok-imagine-image-quality';
export const IMAGE_FALLBACK_MODEL = 'gpt-image-2';
export const IMAGE_DOMESTIC_BASE_URL = 'https://api.cdn-krill-ai.com/v1';
export const IMAGE_FALLBACK_BASE_URL = 'https://api.krill-ai.net/v1';

class ImageProviderUnavailableError extends GiftAiError {
  constructor(message: string, status = 502) {
    super(message, status, 'upstream');
    this.name = 'ImageProviderUnavailableError';
  }
}

function canUseImageFallback(error: unknown) {
  return error instanceof ImageProviderUnavailableError;
}

function retryDelay(response: Response | undefined, attempt: number) {
  const retryAfter = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 5000);
  return 700 * (2 ** attempt);
}

async function fetchImageProvider(input: string, initFactory: () => RequestInit, maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetch(input, initFactory());
      if (!TRANSIENT_UPSTREAM_STATUSES.has(response.status) || attempt === maxAttempts - 1) return response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) break;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
  }
  throw new ImageProviderUnavailableError(
    lastError instanceof Error ? `Image provider connection failed: ${lastError.message}` : 'Image provider connection failed after automatic retries.',
  );
}

type ImageOperation = 'generation' | 'edit';

function imageConfiguration() {
  return {
    // The old GPT_IMAGE_BASE_URL pointed to the overseas route. Keep it out of
    // the default path so production always uses the domestic CDN route.
    baseUrl: normalizedBaseUrl(process.env.GPT_IMAGE_DOMESTIC_BASE_URL?.trim() || IMAGE_DOMESTIC_BASE_URL),
    fallbackBaseUrl: normalizedBaseUrl(process.env.GPT_IMAGE_FALLBACK_BASE_URL?.trim() || IMAGE_FALLBACK_BASE_URL),
    apiKey: requiredEnvironmentVariable('GPT_IMAGE_API_KEY'),
    size: process.env.GPT_IMAGE_SIZE?.trim() || '1024x1024',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'high',
  };
}

function imageProviderBaseUrls(configuration: ReturnType<typeof imageConfiguration>) {
  return [configuration.baseUrl, configuration.fallbackBaseUrl]
    .filter((value, index, values) => values.indexOf(value) === index);
}

function imageModels(operation: ImageOperation) {
  return {
    primary: operation === 'generation'
      ? process.env.GPT_IMAGE_GENERATION_MODEL?.trim() || IMAGE_GENERATION_MODEL
      : process.env.GPT_IMAGE_EDIT_MODEL?.trim() || IMAGE_EDIT_MODEL,
    // Keep the fallback deliberately fixed. An old environment override must not
    // reintroduce the retired Wan models or cause an unexpected paid route.
    fallback: IMAGE_FALLBACK_MODEL,
  };
}

export const TRIPO_3D_MODEL = 'v3.1-20260211';
export const TRIPO_3D_FACE_LIMIT = 1_500_000;
export const TRIPO_3D_MAX_CREDITS = 20;

function tripoConfiguration() {
  const apiKey = process.env.TRIPO_3D_API_KEY?.trim() || process.env.TRIPO_API_KEY?.trim();
  if (!apiKey) throw new GiftAiError('TRIPO_3D_API_KEY is not configured.', 503, 'configuration');
  const configuredModel = process.env.TRIPO_3D_MODEL?.trim() || TRIPO_3D_MODEL;
  const configuredFaceLimit = Number(process.env.TRIPO_3D_FACE_LIMIT || TRIPO_3D_FACE_LIMIT);
  const configuredGeometryQuality = process.env.TRIPO_3D_GEOMETRY_QUALITY?.trim() || 'standard';
  if (configuredModel !== TRIPO_3D_MODEL || configuredFaceLimit !== TRIPO_3D_FACE_LIMIT || configuredGeometryQuality !== 'standard') {
    throw new GiftAiError(
      `The Tripo cost guard requires ${TRIPO_3D_MODEL}, ${TRIPO_3D_FACE_LIMIT} faces, standard geometry, and no textures.`,
      503,
      'configuration',
    );
  }
  return {
    baseUrl: normalizedBaseUrl(process.env.TRIPO_3D_BASE_URL?.trim() || 'https://openapi.tripo3d.ai/v3'),
    apiKey,
    model: TRIPO_3D_MODEL,
    faceLimit: TRIPO_3D_FACE_LIMIT,
    geometryQuality: 'standard' as const,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: T | undefined;
  try {
    payload = JSON.parse(text) as T;
  } catch {
    // The upstream response is intentionally not reflected verbatim to the browser.
  }

  if (!response.ok) {
    const errorPayload = payload as (ImageApiResponse & { message?: string }) | undefined;
    const message = errorPayload?.error?.message || errorPayload?.message;
    throw new GiftAiError(message || `Upstream request failed with HTTP ${response.status}.`);
  }
  if (!payload) throw new GiftAiError('Upstream returned an invalid JSON response.');
  return payload;
}

async function readImageResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: T | undefined;
  try {
    payload = JSON.parse(text) as T;
  } catch {
    // Do not fall back for a malformed successful response: this is a provider
    // response-shape problem, not evidence that the model is unavailable.
  }

  if (!response.ok) {
    const errorPayload = payload as (ImageApiResponse & { message?: string }) | undefined;
    const message = errorPayload?.error?.message || errorPayload?.message || `Image provider request failed with HTTP ${response.status}.`;
    if (TRANSIENT_UPSTREAM_STATUSES.has(response.status)) throw new ImageProviderUnavailableError(message, response.status);
    throw new GiftAiError(message, response.status, response.status === 401 || response.status === 403 ? 'authentication' : 'upstream');
  }
  if (!payload) throw new GiftAiError('Image provider returned an invalid JSON response.');
  return payload;
}

async function readTripoResponse<T>(response: Response): Promise<T> {
  const payload = await readJsonResponse<TripoEnvelope<T>>(response);
  if (payload.code !== 0) throw new GiftAiError(payload.message || `Tripo request failed with code ${payload.code ?? 'unknown'}.`);
  if (!payload.data) throw new GiftAiError('Tripo returned an empty response.');
  return payload.data;
}

async function normalizedImageBuffer(buffer: Buffer, model: string): Promise<GeneratedGiftImage> {
  try {
    const png = await createTransparentPng(buffer, MAX_IMAGE_BYTES);
    return {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      model,
      transparentBackground: true,
      transparentBackgroundProcessor: 'sharp-edge-flood-fill-v2',
    };
  } catch (error) {
    throw new GiftAiError(error instanceof Error ? error.message : 'Image provider returned an unreadable image.');
  }
}

async function normalizeImage(payload: ImageApiResponse, apiKey: string, model: string): Promise<GeneratedGiftImage> {
  const image = payload.data?.[0];
  if (image?.b64_json) return normalizedImageBuffer(Buffer.from(image.b64_json, 'base64'), model);
  if (image?.url) {
    let response: Response;
    try {
      response = await fetch(image.url, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new ImageProviderUnavailableError(
        error instanceof Error ? `Image result download failed: ${error.message}` : 'Image result download failed.',
      );
    }
    if (!response.ok) throw new GiftAiError('Image provider returned an unreadable image URL.');
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    if (!contentType.startsWith('image/')) throw new GiftAiError('Image provider URL did not return an image.');
    return normalizedImageBuffer(Buffer.from(await response.arrayBuffer()), model);
  }
  throw new GiftAiError(payload.error?.message || 'Image provider did not return an image.');
}

function asyncTaskError(task: AsyncImageTask) {
  return typeof task.error === 'string' ? task.error : task.error?.message;
}

async function requestAsyncEditedImage(
  baseUrl: string,
  model: string,
  configuration: ReturnType<typeof imageConfiguration>,
  input: { image: File; mask?: File; prompt: string },
) {
  let creationResponse: Response;
  try {
    const formData = new FormData();
    formData.set('model', model);
    formData.set('prompt', `${input.prompt}\n${PRINTABILITY_CONSTRAINT}`);
    formData.set('size', configuration.size);
    formData.set('quality', configuration.quality);
    formData.set('response_format', 'url');
    formData.set('n', '1');
    formData.set('async', 'true');
    formData.append('image[]', input.image, input.image.name || 'gift-render.png');
    if (input.mask) formData.set('mask', input.mask, input.mask.name || 'mask.png');
    creationResponse = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        Accept: 'application/json',
      },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    // A timed-out POST may already have created a billable task. Do not submit
    // another model request when task acceptance is ambiguous.
    throw new GiftAiError(
      error instanceof Error ? `Image edit task submission failed: ${error.message}` : 'Image edit task submission failed.',
    );
  }

  const created = await readImageResponse<AsyncImageTask>(creationResponse);
  if (!created.id) throw new GiftAiError(asyncTaskError(created) || 'Image provider did not return an asynchronous task ID.');
  const taskId = created.id;
  const deadline = Date.now() + ASYNC_IMAGE_POLL_TIMEOUT_MS;

  try {
    let task = created;
    while (Date.now() < deadline) {
      const status = task.status?.toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const contentUrl = task.content_url
          ? new URL(task.content_url, `${baseUrl}/`).toString()
          : `${baseUrl}/images/${encodeURIComponent(taskId)}/content`;
        const contentResponse = await fetchImageProvider(contentUrl, () => ({
          method: 'GET',
          cache: 'no-store',
          redirect: 'follow',
          headers: {
            Authorization: `Bearer ${configuration.apiKey}`,
            Accept: 'image/*',
          },
          signal: AbortSignal.timeout(120_000),
        }));
        if (!contentResponse.ok) throw new GiftAiError(`Image result download failed with HTTP ${contentResponse.status}.`);
        const contentType = contentResponse.headers.get('content-type')?.split(';')[0] || '';
        if (!contentType.startsWith('image/')) throw new GiftAiError('Image result endpoint did not return an image.');
        return normalizedImageBuffer(Buffer.from(await contentResponse.arrayBuffer()), model);
      }
      if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'error') {
        throw new GiftAiError(asyncTaskError(task) || 'Image editing task failed.');
      }
      await new Promise((resolve) => setTimeout(resolve, ASYNC_IMAGE_POLL_INTERVAL_MS));
      const queryResponse = await fetchImageProvider(`${baseUrl}/images/${encodeURIComponent(taskId)}`, () => ({
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      }));
      task = await readImageResponse<AsyncImageTask>(queryResponse);
    }
    throw new GiftAiError('Image editing task timed out before completion.', 504);
  } catch (error) {
    // The provider accepted this task. Never switch models after this point,
    // otherwise one user action can create multiple paid editing tasks.
    if (error instanceof GiftAiError && !(error instanceof ImageProviderUnavailableError)) throw error;
    throw new GiftAiError(error instanceof Error ? error.message : 'Image editing task could not be completed.');
  }
}

async function requestGeneratedImage(prompt: string) {
  const configuration = imageConfiguration();
  const models = imageModels('generation');
  let lastError: unknown;
  for (const model of [models.primary, models.fallback].filter((value, index, values) => values.indexOf(value) === index)) {
    for (const baseUrl of imageProviderBaseUrls(configuration)) {
      try {
        // Generation is a billable POST. Do not retry an ambiguous POST;
        // move to the next configured model/route instead of risking a
        // duplicate paid task.
        const response = await fetchImageProvider(`${baseUrl}/images/generations`, () => ({
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${configuration.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt: `${prompt}\n${PRINTABILITY_CONSTRAINT}`,
            size: configuration.size,
            quality: configuration.quality,
            response_format: 'b64_json',
            n: 1,
          }),
        }), 1);
        return await normalizeImage(await readImageResponse<ImageApiResponse>(response), configuration.apiKey, model);
      } catch (error) {
        lastError = error;
        if (!canUseImageFallback(error)) throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new GiftAiError('Image generation failed.');
}

export async function generateGiftImages(prompt: string, count = 3) {
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 3);
  return Promise.all(Array.from({ length: safeCount }, () => requestGeneratedImage(prompt)));
}

export async function editGiftImage(input: { image: File; mask?: File; prompt: string }) {
  const configuration = imageConfiguration();
  const models = imageModels('edit');
  let lastError: unknown;
  for (const model of [models.primary, models.fallback].filter((value, index, values) => values.indexOf(value) === index)) {
    for (const baseUrl of imageProviderBaseUrls(configuration)) {
      try {
        return await requestAsyncEditedImage(baseUrl, model, configuration, input);
      } catch (error) {
        lastError = error;
        if (!canUseImageFallback(error)) throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new GiftAiError('Image editing failed.');
}

type TripoJobReference = {
  stage: 'generation' | 'conversion';
  generationTaskId: string;
  conversionTaskId?: string;
};

const TRIPO_TASK_ID = /^[A-Za-z0-9_-]{8,100}$/;

function generationJobId(taskId: string) {
  return `tripo:g:${taskId}`;
}

function parseTripoJobId(id: string): TripoJobReference {
  const parts = id.split(':');
  if (parts.length === 3 && parts[0] === 'tripo' && parts[1] === 'g' && TRIPO_TASK_ID.test(parts[2])) {
    return { stage: 'generation', generationTaskId: parts[2] };
  }
  if (parts.length === 4 && parts[0] === 'tripo' && parts[1] === 'c' && TRIPO_TASK_ID.test(parts[2]) && TRIPO_TASK_ID.test(parts[3])) {
    return { stage: 'conversion', generationTaskId: parts[2], conversionTaskId: parts[3] };
  }
  throw new GiftAiError('The Tripo model job ID is invalid.', 400, 'validation');
}

async function queryTripoTask(taskId: string) {
  const configuration = tripoConfiguration();
  const response = await fetch(`${configuration.baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      Accept: 'application/json',
    },
  });
  return readTripoResponse<TripoTask>(response);
}

export async function submitWhiteModel(image: File): Promise<WhiteModelJob> {
  const configuration = tripoConfiguration();
  const whiteMatte = await createWhiteMattePng(Buffer.from(await image.arrayBuffer()), MAX_IMAGE_BYTES);
  const upload = new FormData();
  upload.set('file', new Blob([whiteMatte], { type: 'image/png' }), 'gift-white-matte.png');
  const uploadResponse = await fetch(`${configuration.baseUrl}/files`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      Accept: 'application/json',
    },
    body: upload,
  });
  const uploaded = await readTripoResponse<{ file_token?: string }>(uploadResponse);
  if (!uploaded.file_token) throw new GiftAiError('Tripo did not return an image file token.');

  const generationResponse = await fetch(`${configuration.baseUrl}/generation/image-to-model`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      input: uploaded.file_token,
      model: configuration.model,
      texture: false,
      pbr: false,
      export_uv: false,
      face_limit: configuration.faceLimit,
      geometry_quality: configuration.geometryQuality,
      auto_size: false,
    }),
  });
  const generated = await readTripoResponse<{ task_id?: string }>(generationResponse);
  if (!generated.task_id || !TRIPO_TASK_ID.test(generated.task_id)) throw new GiftAiError('Tripo did not return a generation task ID.');
  return { id: generationJobId(generated.task_id), status: 'queued' };
}

function normalizeTripoStatus(status: string | undefined): WhiteModelQuery['status'] {
  const normalized = status?.toLowerCase();
  if (normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'banned') return 'failed';
  if (normalized === 'running') return 'in_progress';
  return 'queued';
}

export async function queryWhiteModel(id: string): Promise<WhiteModelQuery> {
  const reference = parseTripoJobId(id);
  const taskId = reference.stage === 'conversion' ? reference.conversionTaskId! : reference.generationTaskId;
  const task = await queryTripoTask(taskId);
  const status = normalizeTripoStatus(task.status);
  const reportedProgress = Number(task.progress);
  const progress = status === 'completed'
    ? 100
    : Number.isFinite(reportedProgress) ? Math.min(99, Math.max(0, Math.round(reportedProgress))) : 0;

  if (status === 'failed') return { id, status, progress, models: [] };
  if (status !== 'completed') return { id, status, progress, models: [] };

  if (reference.stage === 'generation') {
    if (typeof task.credits_consumed === 'number' && task.credits_consumed > TRIPO_3D_MAX_CREDITS) {
      throw new GiftAiError(
        `Tripo reported ${task.credits_consumed} credits for a task guarded at ${TRIPO_3D_MAX_CREDITS}. Further processing was stopped.`,
        502,
        'quota',
      );
    }
    if (!task.output?.model_url) throw new GiftAiError(task.error_message || 'Tripo completed generation without a GLB model URL.');
    try {
      await ensureServerStl(id, task.output.model_url);
    } catch (error) {
      throw new GiftAiError(error instanceof Error ? `Server GLB-to-STL conversion failed: ${error.message}` : 'Server GLB-to-STL conversion failed.');
    }
    return {
      id,
      status: 'completed',
      progress: 100,
      models: [
        { type: 'stl', url: task.output.model_url, previewImageUrl: task.output.rendered_image_url },
        { type: 'glb', url: task.output.model_url, previewImageUrl: task.output.rendered_image_url },
      ],
    };
  }

  if (!task.output?.model_url) throw new GiftAiError(task.error_message || 'Tripo completed the STL conversion without a model URL.');
  const generationTask = await queryTripoTask(reference.generationTaskId).catch(() => undefined);
  return {
    id,
    status: 'completed',
    progress: 100,
    models: [{
      type: 'stl',
      url: task.output.model_url,
      previewImageUrl: generationTask?.output?.rendered_image_url,
    }],
  };
}
