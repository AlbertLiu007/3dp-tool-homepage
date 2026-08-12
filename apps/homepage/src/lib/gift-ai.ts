import { ensureServerStl } from '@/lib/model/server-glb-to-stl';
import { create3dPrintInputPng, createMonochromePaintPng, createTransparentPng, createWhiteMattePng } from '@/lib/image-transparency';

type ImageApiItem = {
  b64_json?: string;
  url?: string;
};

type ImageTaskItem = ImageApiItem & {
  id?: string;
  image_id?: string;
  status?: string;
  state?: string;
  content_url?: string;
};

type ImageApiResponse = {
  data?: ImageApiItem[];
  error?: { message?: string };
};

type ImageTaskResponse = {
  data?: ImageTaskItem[] | ImageTaskItem;
  error?: { message?: string } | string | null;
  id?: string;
  image_id?: string;
  status?: string;
  state?: string;
  message?: string;
  content_url?: string;
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
  whiteBackground?: boolean;
  whiteBackgroundProcessor?: string;
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
const IMAGE_EDIT_REQUEST_TIMEOUT_MS = 180_000;
const IMAGE_TASK_QUERY_TIMEOUT_MS = 30_000;
const IMAGE_TASK_CONTENT_TIMEOUT_MS = 120_000;
const IMAGE_TASK_POLL_INTERVAL_MS = 2_000;
const IMAGE_TASK_MAX_POLLS = 90;
const SLA_PRINTABILITY_CONSTRAINT = [
  'SLA resin 3D printing design constraints for a production-ready gift render.',
  'Positive requirements: create one complete, physically connected, watertight closed single-shell solid object with a stable integrated base; every figure, ornament, weapon, accessory, ring, cable, leaf, gear, and decorative element must be joined to the main body or base and must be self-supporting.',
  'Use a nominal wall thickness of 1.5 mm for shell-like areas and never create any wall, rod, blade, edge, connector, relief, or isolated detail below 0.5 mm; use rounded internal corners and fillets instead of sharp internal corners; use manufacturable transitions and avoid abrupt stress concentrations.',
  'Design unsupported surfaces and overhangs for SLA printing with a maximum unsupported angle of 45 degrees from vertical, preferably using sloped transitions, fillets, ribs, or a connected base; keep thin details short, reinforced, and connected.',
  'Use a clear silhouette, accessible drainage and cleaning paths, and a stable flat or integrated base suitable for resin printing. Prefer a solid form. Never create an inaccessible sealed hollow cavity; if a hollow cavity is essential, add functional drain and vent holes with a continuous resin drainage path and keep the object as one connected shell.',
  'Negative requirements: no floating or suspended parts, disconnected parts, intersecting self-collisions, open surfaces, non-manifold geometry, zero-thickness sheets, paper-thin walls, long fragile bridges, sharp knife edges, sharp internal corners, unsupported large horizontal spans, tiny unprintable text, ultra-fine burrs, inaccessible sealed cavities without drain holes, loose particles, supports shown in the render, or details that depend only on texture or color.',
  'The render must communicate printable geometry rather than a fantasy concept: use the requested surface finish; when no finish is specified, use a neutral matte-gray SLA resin appearance. Always use a uniform pure white background, even neutral studio lighting, and no floor, cast shadow, contact shadow, model shadow, detached shadow, checkerboard, gray patch, halo, extra object, packaging, hands, text, logo, or watermark.',
].join(' ');
const PRINTABILITY_CONSTRAINT = SLA_PRINTABILITY_CONSTRAINT;
const WHITE_MATTE_PRINTABILITY_CONSTRAINT = [
  'Preserve the unchanged subject geometry, pose, proportions, silhouette, camera angle, framing, and every connected part while preparing it for SLA resin 3D printing.',
  SLA_PRINTABILITY_CONSTRAINT,
  'Do not redesign, simplify, add, remove, split, recolor, or structurally modify the subject during this white-background preparation.',
].join(' ');

export const IMAGE_GENERATION_MODEL = 'grok-imagine-image-quality';
export const IMAGE_EDIT_MODEL = 'grok-imagine-image-quality';
export const IMAGE_FALLBACK_MODEL = 'grok-imagine-image';
export const IMAGE_DOMESTIC_BASE_URL = 'https://api.cdn-krill-ai.com/v1';
export const IMAGE_FALLBACK_BASE_URL = IMAGE_DOMESTIC_BASE_URL;

class ImageProviderUnavailableError extends GiftAiError {
  constructor(message: string, status = 502) {
    super(message, status, 'upstream');
    this.name = 'ImageProviderUnavailableError';
  }
}

function canUseImageFallback(error: unknown) {
  return error instanceof ImageProviderUnavailableError
    || (error instanceof GiftAiError && error.reason === 'authentication');
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
  const explicitLocalBaseUrl = process.env.GPT_IMAGE_BASE_URL?.trim();
  const domesticBaseUrl = process.env.GPT_IMAGE_DOMESTIC_BASE_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = normalizedBaseUrl(
    !isProduction && explicitLocalBaseUrl
      ? explicitLocalBaseUrl
      : domesticBaseUrl || IMAGE_DOMESTIC_BASE_URL,
  );

  return {
    // Keep the production default on the domestic CDN route. For local
    // development, an explicit GPT_IMAGE_BASE_URL is allowed to select the
    // reachable route configured by the developer; this avoids waiting for a
    // blocked route before the configured local provider is tried.
    baseUrl,
    fallbackBaseUrl: normalizedBaseUrl(
      !isProduction
        ? process.env.GPT_IMAGE_FALLBACK_BASE_URL?.trim() || IMAGE_FALLBACK_BASE_URL
        : baseUrl,
    ),
    apiKey: requiredEnvironmentVariable('GPT_IMAGE_API_KEY'),
    size: process.env.GPT_IMAGE_SIZE?.trim() || '1024x1024',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'high',
  };
}

function imageProviderAttempts(operation: ImageOperation, configuration: ReturnType<typeof imageConfiguration>) {
  const models = imageModels(operation);
  return [
    { model: models.primary, baseUrl: configuration.baseUrl },
    { model: models.fallback, baseUrl: configuration.fallbackBaseUrl },
  ].filter((attempt, index, attempts) => attempts.findIndex(
    (candidate) => candidate.model === attempt.model && candidate.baseUrl === attempt.baseUrl,
  ) === index);
}

function imageModels(operation: ImageOperation) {
  return {
    // Product routing is fixed here. Legacy deployment variables must not
    // silently route production traffic away from the configured Grok models.
    primary: operation === 'generation' ? IMAGE_GENERATION_MODEL : IMAGE_EDIT_MODEL,
    // Keep the fallback deliberately fixed. An old environment override must not
    // reintroduce GPT or the retired Wan models.
    fallback: IMAGE_FALLBACK_MODEL,
  };
}

function usesAsyncImageResult(model: string) {
  return model === 'grok-imagine-image-quality' || model === 'grok-imagine-image';
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

async function normalizedImageBuffer(buffer: Buffer, model: string, options: { monochromeColor?: string; whiteBackground?: boolean } = {}): Promise<GeneratedGiftImage> {
  try {
    // Every new generation/edit result is normalized to an opaque pure-white
    // background. First remove the edge-connected backdrop locally, then
    // flatten to white. This avoids preserving gray studios, floors, and
    // cast shadows returned by an upstream image model.
    const whiteBackground = options.whiteBackground ?? true;
    let png: Buffer;
    let whiteBackgroundProcessor: string | undefined;
    if (whiteBackground) {
      try {
        const subject = options.monochromeColor
          ? await createMonochromePaintPng(buffer, options.monochromeColor, MAX_IMAGE_BYTES)
          : await createTransparentPng(buffer, MAX_IMAGE_BYTES, { preserveExistingAlpha: true });
        png = await createWhiteMattePng(subject, MAX_IMAGE_BYTES);
        whiteBackgroundProcessor = 'sharp-adaptive-cutout-white-v1';
      } catch {
        // The upstream request has already completed and may be billable. If
        // conservative local segmentation cannot isolate the subject, retain
        // the provider result and at least normalize alpha to opaque white.
        // The prompt already requires a pure-white studio background, so a
        // local segmentation miss must not discard a successfully generated
        // image or trigger another paid model call.
        png = await createWhiteMattePng(buffer, MAX_IMAGE_BYTES);
        whiteBackgroundProcessor = 'sharp-white-flatten-fallback-v1';
      }
    } else {
      png = options.monochromeColor
        ? await createMonochromePaintPng(buffer, options.monochromeColor, MAX_IMAGE_BYTES)
        : await createTransparentPng(buffer, MAX_IMAGE_BYTES, { preserveExistingAlpha: true });
    }
    return {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      model,
      whiteBackground,
      whiteBackgroundProcessor,
      transparentBackground: !whiteBackground,
      transparentBackgroundProcessor: whiteBackground
        ? undefined
        : options.monochromeColor
          ? 'sharp-alpha-preserving-monochrome-paint-v1'
          : 'sharp-alpha-preserving-adaptive-border-v5',
    };
  } catch (error) {
    throw new GiftAiError(error instanceof Error ? error.message : 'Image provider returned an unreadable image.');
  }
}

function providerImageUrl(baseUrl: string, value: string) {
  try {
    return new URL(value, `${baseUrl}/`).toString();
  } catch {
    throw new GiftAiError('Image provider returned an invalid image URL.');
  }
}

async function normalizeImage(payload: ImageApiResponse, baseUrl: string, apiKey: string, model: string, options: { monochromeColor?: string; whiteBackground?: boolean } = {}): Promise<GeneratedGiftImage> {
  const image = payload.data?.[0];
  if (image?.b64_json) return normalizedImageBuffer(Buffer.from(image.b64_json, 'base64'), model, options);
  if (image?.url) {
    let response: Response;
    try {
      response = await fetch(providerImageUrl(baseUrl, image.url), {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/*',
        },
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
    return normalizedImageBuffer(Buffer.from(await response.arrayBuffer()), model, options);
  }
  throw new GiftAiError(payload.error?.message || 'Image provider did not return an image.');
}

function imageTaskItem(payload: ImageTaskResponse) {
  return Array.isArray(payload.data) ? payload.data[0] : payload.data;
}

function imageTaskId(payload: ImageTaskResponse) {
  const item = imageTaskItem(payload);
  return payload.id || payload.image_id || item?.id || item?.image_id;
}

function imageTaskStatus(payload: ImageTaskResponse) {
  const item = imageTaskItem(payload);
  return String(payload.status || payload.state || item?.status || item?.state || '').toLowerCase();
}

function imageTaskError(payload: ImageTaskResponse) {
  const error = payload.error;
  if (typeof error === 'string') return error;
  return error?.message || payload.message || 'Image edit task failed.';
}

function imageResultResponse(payload: ImageTaskResponse): ImageApiResponse {
  const items = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : undefined;
  const error = typeof payload.error === 'string'
    ? { message: payload.error }
    : payload.error || undefined;
  return { data: items, error };
}

const COMPLETED_IMAGE_TASK_STATUSES = new Set(['completed', 'succeeded', 'success', 'done']);
const FAILED_IMAGE_TASK_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled']);

async function queryImageTask(baseUrl: string, taskId: string, apiKey: string) {
  const response = await fetchImageProvider(`${baseUrl}/images/${encodeURIComponent(taskId)}`, () => ({
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(IMAGE_TASK_QUERY_TIMEOUT_MS),
  }));
  return readImageResponse<ImageTaskResponse>(response);
}

async function downloadImageTaskContent(
  baseUrl: string,
  taskId: string,
  apiKey: string,
  model: string,
  options: { monochromeColor?: string; whiteBackground?: boolean },
) {
  const response = await fetchImageProvider(`${baseUrl}/images/${encodeURIComponent(taskId)}/content`, () => ({
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'image/*',
    },
    signal: AbortSignal.timeout(IMAGE_TASK_CONTENT_TIMEOUT_MS),
  }));
  if (!response.ok) {
    await readImageResponse<ImageTaskResponse>(response);
    throw new GiftAiError('Image task content download failed.');
  }
  const contentType = response.headers.get('content-type')?.split(';')[0] || '';
  if (!contentType.startsWith('image/')) throw new GiftAiError('Image task content endpoint did not return an image.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new GiftAiError('Generated image exceeds the image safety limit.');
  return normalizedImageBuffer(buffer, model, options);
}

async function resolveImageTask(
  baseUrl: string,
  taskId: string,
  configuration: ReturnType<typeof imageConfiguration>,
  model: string,
  options: { monochromeColor?: string; whiteBackground?: boolean },
) {
  let consecutiveQueryFailures = 0;
  for (let attempt = 0; attempt < IMAGE_TASK_MAX_POLLS; attempt += 1) {
    let task: ImageTaskResponse;
    try {
      task = await queryImageTask(baseUrl, taskId, configuration.apiKey);
      consecutiveQueryFailures = 0;
    } catch (error) {
      consecutiveQueryFailures += 1;
      // A task has already been accepted and may be billable. Keep polling
      // through short-lived route/DNS/TLS failures instead of immediately
      // reporting a false generation failure to the user.
      if (consecutiveQueryFailures >= 5) {
        throw new GiftAiError(
          error instanceof Error ? error.message : 'Image edit task status could not be queried.',
          error instanceof GiftAiError ? error.status : 502,
          'upstream',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, IMAGE_TASK_POLL_INTERVAL_MS));
      continue;
    }
    const status = imageTaskStatus(task);
    if (COMPLETED_IMAGE_TASK_STATUSES.has(status)) {
      try {
        return await downloadImageTaskContent(baseUrl, taskId, configuration.apiKey, model, options);
      } catch (error) {
        throw new GiftAiError(
          error instanceof Error ? error.message : 'Image edit task result could not be downloaded.',
          error instanceof GiftAiError ? error.status : 502,
          'upstream',
        );
      }
    }
    if (FAILED_IMAGE_TASK_STATUSES.has(status)) {
      // The provider has already accepted this task. Do not submit a second
      // billable task just because the accepted task later reports failure.
      throw new GiftAiError(imageTaskError(task), 502, 'upstream');
    }
    if (attempt < IMAGE_TASK_MAX_POLLS - 1) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_TASK_POLL_INTERVAL_MS));
    }
  }
  throw new GiftAiError('Image edit task did not finish within three minutes.', 504, 'upstream');
}

async function requestEditedImage(
  baseUrl: string,
  model: string,
  configuration: ReturnType<typeof imageConfiguration>,
  input: { image: File; mask?: File; prompt: string; monochromeColor?: string; whiteBackground?: boolean },
) {
  const formData = new FormData();
  formData.set('model', model);
  formData.set('prompt', `${input.prompt}\n${input.whiteBackground ? WHITE_MATTE_PRINTABILITY_CONSTRAINT : PRINTABILITY_CONSTRAINT}`);
  formData.set('size', configuration.size);
  formData.set('quality', configuration.quality);
  const useAsyncResult = usesAsyncImageResult(model);
  formData.set('response_format', useAsyncResult ? 'url' : 'b64_json');
  formData.set('n', '1');
  if (useAsyncResult) formData.set('async', 'true');
  // The Grok relay's async edit contract expects image[] even for one image.
  // Using image here can return a misleading model/channel error before the
  // task is created.
  formData.append(useAsyncResult ? 'image[]' : 'image', input.image, input.image.name || 'gift-render.png');
  if (input.mask) formData.set('mask', input.mask, input.mask.name || 'mask.png');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        Accept: 'application/json',
      },
      body: formData,
      signal: AbortSignal.timeout(IMAGE_EDIT_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A timed-out POST may already have created a billable task. Do not submit
    // another model request when task acceptance is ambiguous.
    throw new GiftAiError(
      error instanceof Error ? `Image edit task submission failed: ${error.message}` : 'Image edit task submission failed.',
      502,
      'upstream',
    );
  }
  if (useAsyncResult) {
    const payload = await readImageResponse<ImageTaskResponse>(response);
    const taskId = imageTaskId(payload);
    if (!taskId) throw new GiftAiError('Image edit task did not return an image ID.');
    return resolveImageTask(baseUrl, taskId, configuration, model, input);
  }
  const payload = await readImageResponse<ImageApiResponse>(response);
  return normalizeImage(payload, baseUrl, configuration.apiKey, model, { ...input, whiteBackground: true });
}

async function requestGeneratedImage(prompt: string, monochromeColor?: string) {
  const configuration = imageConfiguration();
  let lastError: unknown;
  let primaryError: unknown;
  for (const [index, { model, baseUrl }] of imageProviderAttempts('generation', configuration).entries()) {
    try {
      // Generation is a billable POST. Do not retry an ambiguous POST;
      // move to the fallback only when the provider explicitly rejects it.
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
          response_format: usesAsyncImageResult(model) ? 'url' : 'b64_json',
          n: 1,
          ...(usesAsyncImageResult(model) ? { async: true } : {}),
        }),
      }), 1);
      if (usesAsyncImageResult(model)) {
        const payload = await readImageResponse<ImageTaskResponse>(response);
        const taskId = imageTaskId(payload);
        if (!taskId) throw new GiftAiError('Image generation task did not return an image ID.');
        return await resolveImageTask(baseUrl, taskId, configuration, model, { monochromeColor, whiteBackground: true });
      }
      return await normalizeImage(await readImageResponse<ImageApiResponse>(response), baseUrl, configuration.apiKey, model, { monochromeColor, whiteBackground: true });
    } catch (error) {
      if (index === 0) primaryError = error;
      lastError = error;
      if (!canUseImageFallback(error)) throw error;
    }
  }
  if (lastError instanceof GiftAiError && lastError.reason === 'authentication' && primaryError instanceof Error) throw primaryError;
  throw lastError instanceof Error ? lastError : new GiftAiError('Image generation failed.');
}

export async function generateGiftImages(prompt: string, count = 3, monochromeColor?: string) {
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 3);
  return Promise.all(Array.from({ length: safeCount }, () => requestGeneratedImage(prompt, monochromeColor)));
}

export async function editGiftImage(input: { image: File; mask?: File; prompt: string; monochromeColor?: string; whiteBackground?: boolean }) {
  const configuration = imageConfiguration();
  let lastError: unknown;
  let primaryError: unknown;
  for (const [index, { model, baseUrl }] of imageProviderAttempts('edit', configuration).entries()) {
    try {
      return await requestEditedImage(baseUrl, model, configuration, input);
    } catch (error) {
      if (index === 0) primaryError = error;
      lastError = error;
      if (!canUseImageFallback(error)) throw error;
    }
  }
  if (lastError instanceof GiftAiError && lastError.reason === 'authentication' && primaryError instanceof Error) throw primaryError;
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
  // Tripo receives a dedicated deterministic reference: white background and
  // a neutral matte-gray subject. The UI keeps the original high-quality
  // render for display and editing; this derivative is used only for 3D input.
  const printInput = await create3dPrintInputPng(Buffer.from(await image.arrayBuffer()), MAX_IMAGE_BYTES);
  const upload = new FormData();
  upload.set('file', new Blob([printInput], { type: 'image/png' }), 'gift-3d-print-input-gray.png');
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
