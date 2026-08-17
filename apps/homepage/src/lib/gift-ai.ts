import { ensureServerStl } from '@/lib/model/server-glb-to-stl';
import { create3dPrintInputPng, createMonochromePaintPng, createTransparentPng, createWhiteMattePng } from '@/lib/image-transparency';
import { finishGiftAiProviderAttempt, startGiftAiProviderAttempt } from '@/lib/gift-db';
import sharp from 'sharp';

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

type ApimartTask = {
  id?: string;
  task_id?: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: { message?: string } | string | null;
  result?: {
    images?: Array<{ url?: string | string[] }>;
  };
};

type ApimartResponse = {
  code?: number;
  message?: string;
  data?: ApimartTask | ApimartTask[];
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
  whiteBackground?: boolean;
  whiteBackgroundProcessor?: string;
  transparentBackground?: boolean;
  transparentBackgroundProcessor?: string;
  providerJobId?: string;
  quality?: {
    foregroundRatio: number;
    contrast: number;
    borderWhiteRatio: number;
    edgeForegroundRatio: number;
  };
};

export type GiftImageInvocationContext = {
  requestId?: string;
  stage?: string;
  slot?: number;
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
const APIMART_TASK_POLL_INTERVAL_MS = 3_000;
const APIMART_TASK_MAX_POLLS = 100;
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
export const APIMART_IMAGE_MODEL = 'gpt-image-2';
export const APIMART_IMAGE_BASE_URL = 'https://api.aishuch.com/v1';
export const APIMART_IMAGE_RESOLUTION = '1k';
const ALLOWED_IMAGE_MODELS = new Set([IMAGE_GENERATION_MODEL, IMAGE_EDIT_MODEL, IMAGE_FALLBACK_MODEL]);
const IMAGE_CIRCUIT_FAILURE_THRESHOLD = 3;
const IMAGE_CIRCUIT_OPEN_MS = 5 * 60_000;

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftImageCircuits: Map<string, { failures: number; openUntil: number }> | undefined;
}

function imageCircuits() {
  if (!globalThis.unionamGiftImageCircuits) globalThis.unionamGiftImageCircuits = new Map();
  return globalThis.unionamGiftImageCircuits;
}

function circuitKey(operation: ImageOperation, model: string, baseUrl: string) {
  return `${operation}:${model}:${baseUrl}`;
}

function circuitOpen(key: string) {
  const circuit = imageCircuits().get(key);
  if (!circuit) return false;
  if (circuit.openUntil <= Date.now()) {
    imageCircuits().delete(key);
    return false;
  }
  return true;
}

function recordCircuitSuccess(key: string) {
  imageCircuits().delete(key);
}

function recordCircuitFailure(key: string) {
  const current = imageCircuits().get(key) || { failures: 0, openUntil: 0 };
  const failures = current.failures + 1;
  imageCircuits().set(key, {
    failures,
    openUntil: failures >= IMAGE_CIRCUIT_FAILURE_THRESHOLD ? Date.now() + IMAGE_CIRCUIT_OPEN_MS : 0,
  });
}

class ImageProviderUnavailableError extends GiftAiError {
  constructor(message: string, status = 502, readonly safeToFallback = false) {
    super(message, status, 'upstream');
    this.name = 'ImageProviderUnavailableError';
  }
}

class ImageProviderRejectedError extends GiftAiError {
  constructor(message: string, status = 502) {
    super(message, status, 'upstream');
    this.name = 'ImageProviderRejectedError';
  }
}

class ImageTaskFailedError extends GiftAiError {
  constructor(message: string) {
    super(message, 502, 'upstream');
    this.name = 'ImageTaskFailedError';
  }
}

class ImageQualityRejectedError extends GiftAiError {
  constructor(message = 'Generated image did not pass the product-image quality check.') {
    super(message, 502, 'upstream');
    this.name = 'ImageQualityRejectedError';
  }
}

function canUseImageFallback(error: unknown) {
  if (error instanceof ImageProviderUnavailableError) return error.safeToFallback;
  if (error instanceof ImageProviderRejectedError) return error.status < 500 && ![401, 403, 408, 425, 429].includes(error.status);
  return false;
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
type GiftImageProvider = 'apimart' | 'krill';

function configuredGiftImageProvider(): GiftImageProvider {
  const provider = process.env.GIFT_IMAGE_PROVIDER?.trim().toLowerCase() || 'apimart';
  if (provider !== 'apimart' && provider !== 'krill') {
    throw new GiftAiError('GIFT_IMAGE_PROVIDER must be either apimart or krill.', 503, 'configuration');
  }
  return provider;
}

function imageConfiguration() {
  const explicitBaseUrl = process.env.GPT_IMAGE_BASE_URL?.trim();
  const domesticBaseUrl = process.env.GPT_IMAGE_DOMESTIC_BASE_URL?.trim();
  const baseUrl = normalizedBaseUrl(
    explicitBaseUrl || domesticBaseUrl || IMAGE_DOMESTIC_BASE_URL,
  );

  return {
    baseUrl,
    fallbackBaseUrl: normalizedBaseUrl(
      process.env.GPT_IMAGE_FALLBACK_BASE_URL?.trim() || baseUrl || IMAGE_FALLBACK_BASE_URL,
    ),
    apiKey: requiredEnvironmentVariable('GPT_IMAGE_API_KEY'),
    size: process.env.GPT_IMAGE_SIZE?.trim() || '1024x1024',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'high',
  };
}

function apimartImageConfiguration() {
  const apiKey = process.env.APIMART_IMAGE_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: normalizedBaseUrl(process.env.APIMART_IMAGE_BASE_URL?.trim() || APIMART_IMAGE_BASE_URL),
    model: APIMART_IMAGE_MODEL,
    size: process.env.APIMART_IMAGE_SIZE?.trim() || '1:1',
    resolution: APIMART_IMAGE_RESOLUTION,
  };
}

function imageProviderAttempts(operation: ImageOperation, configuration: ReturnType<typeof imageConfiguration>) {
  const models = imageModels(operation);
  return [
    { model: models.primary, baseUrl: configuration.baseUrl, role: 'primary' as const },
    { model: models.fallback, baseUrl: configuration.fallbackBaseUrl, role: 'fallback' as const },
  ].filter((attempt, index, attempts) => attempts.findIndex(
    (candidate) => candidate.model === attempt.model && candidate.baseUrl === attempt.baseUrl,
  ) === index);
}

function imageModels(operation: ImageOperation) {
  if (process.env.GPT_IMAGE_MODEL?.trim()) {
    throw new GiftAiError('GPT_IMAGE_MODEL is retired. Configure explicit generation, edit, and fallback models.', 503, 'configuration');
  }
  const models = {
    primary: operation === 'generation'
      ? process.env.GPT_IMAGE_GENERATION_MODEL?.trim() || IMAGE_GENERATION_MODEL
      : process.env.GPT_IMAGE_EDIT_MODEL?.trim() || IMAGE_EDIT_MODEL,
    fallback: process.env.GPT_IMAGE_FALLBACK_MODEL?.trim() || IMAGE_FALLBACK_MODEL,
  };
  for (const model of [models.primary, models.fallback]) {
    if (!ALLOWED_IMAGE_MODELS.has(model)) {
      throw new GiftAiError(`Unsupported production image model: ${model}.`, 503, 'configuration');
    }
  }
  if (models.primary === models.fallback) {
    throw new GiftAiError('The image fallback model must differ from the primary model.', 503, 'configuration');
  }
  return models;
}

export function configuredImageGenerationModel() {
  return configuredGiftImageProvider() === 'apimart' ? APIMART_IMAGE_MODEL : imageModels('generation').primary;
}

export function configuredImageGenerationProvider() {
  return configuredGiftImageProvider() === 'apimart' ? 'apimart' : 'krill-ai';
}

export function configuredImageEditModel() {
  return configuredGiftImageProvider() === 'apimart' ? APIMART_IMAGE_MODEL : imageModels('edit').primary;
}

export function configuredImageEditProvider() {
  return configuredGiftImageProvider() === 'apimart' ? 'apimart' : 'krill-ai';
}

export function configuredImageFallbackModel() {
  return imageModels('generation').fallback;
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
    // Only a response that clearly rejects before task acceptance is safe to
    // reroute. A 5xx/timeout response to a billable POST is ambiguous: the
    // provider may have accepted the job before the relay failed.
    if (TRANSIENT_UPSTREAM_STATUSES.has(response.status)) throw new ImageProviderUnavailableError(message, response.status, false);
    if (response.status === 401 || response.status === 403) throw new GiftAiError(message, response.status, 'authentication');
    throw new ImageProviderRejectedError(message, response.status);
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

type ImageNormalizationOptions = {
  monochromeColor?: string;
  whiteBackground?: boolean;
};

export async function inspectGiftImageQuality(png: Buffer) {
  const sampled = await sharp(png)
    .toColourspace('srgb')
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(128, 128, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const pixels = sampled.length / 3;
  let foreground = 0;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  let borderPixels = 0;
  let borderWhitePixels = 0;
  let edgeForegroundPixels = 0;
  const width = 128;
  const height = 128;
  const borderDepth = 5;
  for (let offset = 0; offset < sampled.length; offset += 3) {
    const red = sampled[offset];
    const green = sampled[offset + 1];
    const blue = sampled[offset + 2];
    const distanceFromWhite = Math.sqrt(((255 - red) ** 2) + ((255 - green) ** 2) + ((255 - blue) ** 2));
    if (distanceFromWhite >= 28) foreground += 1;
    const pixel = offset / 3;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const border = x < borderDepth || y < borderDepth || x >= width - borderDepth || y >= height - borderDepth;
    if (border) {
      borderPixels += 1;
      if (distanceFromWhite < 20) borderWhitePixels += 1;
      if (distanceFromWhite >= 38) edgeForegroundPixels += 1;
    }
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += luminance;
    luminanceSquaredSum += luminance * luminance;
  }
  const mean = luminanceSum / pixels;
  const contrast = Math.sqrt(Math.max(0, luminanceSquaredSum / pixels - mean * mean));
  const foregroundRatio = foreground / pixels;
  const borderWhiteRatio = borderWhitePixels / borderPixels;
  const edgeForegroundRatio = edgeForegroundPixels / borderPixels;
  // This is deliberately conservative: it only rejects blank/nearly erased
  // results. Transparent and pale products may have low contrast, but must
  // still retain enough visible geometry to be selectable by a customer.
  if (foregroundRatio < 0.008 || (foregroundRatio < 0.025 && contrast < 9)) {
    throw new ImageQualityRejectedError();
  }
  if (foregroundRatio > 0.82) throw new ImageQualityRejectedError('Generated image subject is cropped or the background is not isolated.');
  if (borderWhiteRatio < 0.93) throw new ImageQualityRejectedError('Generated image background is not uniformly pure white.');
  if (edgeForegroundRatio > 0.045) throw new ImageQualityRejectedError('Generated image subject touches or crosses the image boundary.');
  return {
    foregroundRatio: Number(foregroundRatio.toFixed(4)),
    contrast: Number(contrast.toFixed(2)),
    borderWhiteRatio: Number(borderWhiteRatio.toFixed(4)),
    edgeForegroundRatio: Number(edgeForegroundRatio.toFixed(4)),
  };
}

async function normalizedImageBuffer(buffer: Buffer, model: string, options: ImageNormalizationOptions = {}): Promise<GeneratedGiftImage> {
  try {
    // Provider-generated images already receive a strict white-background
    // prompt. Preserve those pixels and only flatten alpha here: re-segmenting
    // a pale, silver, glass, or highlight-heavy subject can erase valid parts.
    const whiteBackground = options.whiteBackground ?? true;
    let png: Buffer;
    let whiteBackgroundProcessor: string | undefined;
    if (whiteBackground) {
      png = await createWhiteMattePng(buffer, MAX_IMAGE_BYTES);
      whiteBackgroundProcessor = 'sharp-white-flatten-preserve-v2';
    } else {
      png = options.monochromeColor
        ? await createMonochromePaintPng(buffer, options.monochromeColor, MAX_IMAGE_BYTES)
        : await createTransparentPng(buffer, MAX_IMAGE_BYTES, { preserveExistingAlpha: true });
    }
    let quality;
    if (whiteBackground) {
      try {
        quality = await inspectGiftImageQuality(png);
      } catch (error) {
        if (!(error instanceof ImageQualityRejectedError)) throw error;
        const isolated = await createTransparentPng(buffer, MAX_IMAGE_BYTES, { preserveExistingAlpha: true });
        const corrected = await createWhiteMattePng(isolated, MAX_IMAGE_BYTES);
        quality = await inspectGiftImageQuality(corrected);
        png = corrected;
        whiteBackgroundProcessor = 'sharp-adaptive-cutout-white-v2';
      }
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
      quality,
    };
  } catch (error) {
    if (error instanceof ImageQualityRejectedError) throw error;
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

async function normalizeImage(payload: ImageApiResponse, baseUrl: string, apiKey: string, model: string, options: ImageNormalizationOptions = {}): Promise<GeneratedGiftImage> {
  const image = payload.data?.[0];
  if (image?.b64_json) return normalizedImageBuffer(Buffer.from(image.b64_json, 'base64'), model, options);
  if (image?.url) {
    return downloadAndNormalizeImage(providerImageUrl(baseUrl, image.url), model, options, apiKey);
  }
  throw new GiftAiError(payload.error?.message || 'Image provider did not return an image.');
}

async function downloadAndNormalizeImage(url: string, model: string, options: ImageNormalizationOptions, apiKey?: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new GiftAiError('Generated image exceeds the image safety limit.');
  return normalizedImageBuffer(buffer, model, options);
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

function apimartTaskItem(payload: ApimartResponse) {
  return Array.isArray(payload.data) ? payload.data[0] : payload.data;
}

function apimartTaskId(payload: ApimartResponse) {
  const item = apimartTaskItem(payload);
  return item?.task_id || item?.id;
}

function apimartTaskStatus(payload: ApimartResponse) {
  return String(apimartTaskItem(payload)?.status || '').toLowerCase();
}

function apimartTaskError(payload: ApimartResponse) {
  const error = apimartTaskItem(payload)?.error || payload.error;
  if (typeof error === 'string') return error;
  return error?.message || apimartTaskItem(payload)?.message || payload.message || 'APIMart image task failed.';
}

function apimartTaskImageUrl(payload: ApimartResponse) {
  const imageUrl = apimartTaskItem(payload)?.result?.images?.[0]?.url;
  return Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
}

async function readApimartResponse(response: Response): Promise<ApimartResponse> {
  const text = await response.text();
  let payload: ApimartResponse | undefined;
  try {
    payload = JSON.parse(text) as ApimartResponse;
  } catch {
    // Keep provider details out of the browser response.
  }
  const code = Number(payload?.code);
  const effectiveStatus = Number.isFinite(code) && code >= 400 ? code : response.status;
  if (!response.ok || effectiveStatus >= 400) {
    const message = payload?.message || (typeof payload?.error === 'string' ? payload.error : payload?.error?.message) || `APIMart request failed with HTTP ${effectiveStatus}.`;
    if (TRANSIENT_UPSTREAM_STATUSES.has(effectiveStatus)) throw new ImageProviderUnavailableError(message, effectiveStatus, false);
    if (effectiveStatus === 401 || effectiveStatus === 403) throw new GiftAiError(message, effectiveStatus, 'authentication');
    throw new ImageProviderRejectedError(message, effectiveStatus);
  }
  if (!payload) throw new GiftAiError('APIMart returned an invalid JSON response.');
  return payload;
}

function generationPrompt(prompt: string) {
  return /SLA engineering constraints/i.test(prompt) ? prompt : `${prompt}\n${PRINTABILITY_CONSTRAINT}`;
}

async function queryApimartTask(
  configuration: NonNullable<ReturnType<typeof apimartImageConfiguration>>,
  taskId: string,
) {
  const response = await fetchImageProvider(`${configuration.baseUrl}/tasks/${encodeURIComponent(taskId)}`, () => ({
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(IMAGE_TASK_QUERY_TIMEOUT_MS),
  }));
  return readApimartResponse(response);
}

async function resolveApimartTask(
  configuration: NonNullable<ReturnType<typeof apimartImageConfiguration>>,
  initialPayload: ApimartResponse,
  taskId: string,
  monochromeColor?: string,
) {
  let payload = initialPayload;
  let consecutiveQueryFailures = 0;
  for (let attempt = 0; attempt < APIMART_TASK_MAX_POLLS; attempt += 1) {
    const status = apimartTaskStatus(payload);
    if (COMPLETED_IMAGE_TASK_STATUSES.has(status)) {
      const imageUrl = apimartTaskImageUrl(payload);
      if (!imageUrl) throw new GiftAiError('APIMart completed the image task without returning an image URL.');
      const image = await downloadAndNormalizeImage(
        providerImageUrl(configuration.baseUrl, imageUrl),
        configuration.model,
        { monochromeColor, whiteBackground: true },
      );
      return { ...image, providerJobId: taskId };
    }
    if (FAILED_IMAGE_TASK_STATUSES.has(status)) throw new ImageTaskFailedError(apimartTaskError(payload));
    if (attempt >= APIMART_TASK_MAX_POLLS - 1) break;
    await new Promise((resolve) => setTimeout(resolve, APIMART_TASK_POLL_INTERVAL_MS));
    try {
      payload = await queryApimartTask(configuration, taskId);
      consecutiveQueryFailures = 0;
    } catch (error) {
      consecutiveQueryFailures += 1;
      if (consecutiveQueryFailures >= 5) {
        throw new GiftAiError(
          error instanceof Error ? error.message : 'APIMart image task status could not be queried.',
          error instanceof GiftAiError ? error.status : 502,
          'upstream',
        );
      }
    }
  }
  throw new GiftAiError('APIMart image task did not finish within five minutes.', 504, 'upstream');
}

async function requestApimartGeneratedImage(
  prompt: string,
  monochromeColor?: string,
  context: GiftImageInvocationContext = {},
  operation: ImageOperation = 'generation',
  imageUrls?: string[],
) {
  const configuration = apimartImageConfiguration();
  if (!configuration) throw new GiftAiError('APIMART_IMAGE_API_KEY is not configured.', 503, 'configuration');
  const attempt = await startGiftAiProviderAttempt({
    requestId: context.requestId,
    operation,
    stage: context.stage || (operation === 'edit' ? 'image_edit' : 'render'),
    slot: context.slot,
    role: 'primary',
    provider: 'apimart',
    model: configuration.model,
    baseHost: new URL(configuration.baseUrl).host,
  });
  let acceptedBillable = false;
  let providerJobId: string | undefined;
  let httpStatus: number | undefined;
  try {
    // Submission is billable and intentionally not retried. A network timeout
    // can happen after the upstream accepted the task, so another provider must
    // not be charged unless APIMart explicitly rejected the request.
    const response = await fetchImageProvider(`${configuration.baseUrl}/images/generations`, () => ({
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: configuration.model,
        prompt: generationPrompt(prompt),
        n: 1,
        size: configuration.size,
        resolution: configuration.resolution,
        official_fallback: false,
        ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    }), 1);
    httpStatus = response.status;
    const payload = await readApimartResponse(response);
    const taskId = apimartTaskId(payload);
    if (!taskId) throw new GiftAiError('APIMart image generation did not return a task ID.');
    providerJobId = taskId;
    acceptedBillable = true;
    await finishGiftAiProviderAttempt(attempt, {
      status: 'accepted', httpStatus, providerJobId, acceptedBillable: true,
    });
    const image = await resolveApimartTask(configuration, payload, taskId, monochromeColor);
    await finishGiftAiProviderAttempt(attempt, {
      status: 'succeeded', httpStatus, providerJobId, acceptedBillable: true,
    });
    return image;
  } catch (error) {
    await finishGiftAiProviderAttempt(attempt, {
      status: 'failed',
      httpStatus: httpStatus || (error instanceof GiftAiError ? error.status : undefined),
      providerJobId,
      acceptedBillable,
      error,
    });
    throw error;
  }
}

async function imageFileDataUrl(file: File) {
  const type = file.type?.startsWith('image/') ? file.type : 'image/png';
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new GiftAiError('Reference image exceeds the image safety limit.', 400, 'validation');
  return `data:${type};base64,${buffer.toString('base64')}`;
}

async function requestApimartEditedImage(
  input: { image: File; mask?: File; prompt: string; monochromeColor?: string; whiteBackground?: boolean },
  context: GiftImageInvocationContext,
) {
  const imageUrls = [await imageFileDataUrl(input.image)];
  let maskInstruction = '';
  if (input.mask) {
    imageUrls.push(await imageFileDataUrl(input.mask));
    maskInstruction = ' The first reference image is the source image. The second reference image is an edit mask: change only the white mask area and preserve the black mask area exactly.';
  }
  const prompt = `${input.prompt}${maskInstruction}\n${input.whiteBackground ? WHITE_MATTE_PRINTABILITY_CONSTRAINT : PRINTABILITY_CONSTRAINT}`;
  return requestApimartGeneratedImage(prompt, input.monochromeColor, context, 'edit', imageUrls);
}

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
  options: ImageNormalizationOptions,
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
  options: ImageNormalizationOptions,
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
        const image = await downloadImageTaskContent(baseUrl, taskId, configuration.apiKey, model, options);
        return { ...image, providerJobId: taskId };
      } catch (error) {
        if (error instanceof ImageQualityRejectedError) throw error;
        throw new GiftAiError(
          error instanceof Error ? error.message : 'Image edit task result could not be downloaded.',
          error instanceof GiftAiError ? error.status : 502,
          'upstream',
        );
      }
    }
    if (FAILED_IMAGE_TASK_STATUSES.has(status)) {
      throw new ImageTaskFailedError(imageTaskError(task));
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
  context: GiftImageInvocationContext,
  role: 'primary' | 'fallback',
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

  const attempt = await startGiftAiProviderAttempt({
    requestId: context.requestId,
    operation: 'edit',
    stage: context.stage || 'image_edit',
    slot: context.slot,
    role,
    provider: 'krill-ai',
    model,
    baseHost: new URL(baseUrl).host,
  });
  let response: Response;
  let acceptedBillable = false;
  let providerJobId: string | undefined;
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
    await finishGiftAiProviderAttempt(attempt, { status: 'failed', acceptedBillable, error });
    // A timed-out POST may already have created a billable task. Do not submit
    // another model request when task acceptance is ambiguous.
    throw new GiftAiError(
      error instanceof Error ? `Image edit task submission failed: ${error.message}` : 'Image edit task submission failed.',
      502,
      'upstream',
    );
  }
  try {
    if (useAsyncResult) {
      const payload = await readImageResponse<ImageTaskResponse>(response);
      const taskId = imageTaskId(payload);
      if (!taskId) throw new GiftAiError('Image edit task did not return an image ID.');
      providerJobId = taskId;
      acceptedBillable = true;
      await finishGiftAiProviderAttempt(attempt, { status: 'accepted', httpStatus: response.status, providerJobId, acceptedBillable: true });
      const image = await resolveImageTask(baseUrl, taskId, configuration, model, input);
      await finishGiftAiProviderAttempt(attempt, { status: 'succeeded', httpStatus: response.status, providerJobId, acceptedBillable: true });
      return image;
    }
    const payload = await readImageResponse<ImageApiResponse>(response);
    acceptedBillable = response.ok;
    const image = await normalizeImage(payload, baseUrl, configuration.apiKey, model, { ...input, whiteBackground: true });
    await finishGiftAiProviderAttempt(attempt, { status: 'succeeded', httpStatus: response.status, acceptedBillable });
    return image;
  } catch (error) {
    await finishGiftAiProviderAttempt(attempt, {
      status: 'failed', httpStatus: response.status, providerJobId, acceptedBillable, error,
    });
    throw error;
  }
}

async function requestKrillGeneratedImage(prompt: string, monochromeColor?: string, context: GiftImageInvocationContext = {}) {
  const configuration = imageConfiguration();
  let lastError: unknown;
  let primaryError: unknown;
  for (const [index, { model, baseUrl, role }] of imageProviderAttempts('generation', configuration).entries()) {
    const key = circuitKey('generation', model, baseUrl);
    if (circuitOpen(key)) {
      const skipped = await startGiftAiProviderAttempt({ requestId: context.requestId, operation: 'generation', stage: context.stage || 'render', slot: context.slot, role, provider: 'krill-ai', model, baseHost: new URL(baseUrl).host });
      await finishGiftAiProviderAttempt(skipped, { status: 'skipped', error: 'Provider circuit is temporarily open.' });
      continue;
    }
    const attempt = await startGiftAiProviderAttempt({ requestId: context.requestId, operation: 'generation', stage: context.stage || 'render', slot: context.slot, role, provider: 'krill-ai', model, baseHost: new URL(baseUrl).host });
    let acceptedBillable = false;
    let providerJobId: string | undefined;
    let httpStatus: number | undefined;
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
          prompt: generationPrompt(prompt),
          size: configuration.size,
          quality: configuration.quality,
          response_format: usesAsyncImageResult(model) ? 'url' : 'b64_json',
          n: 1,
          ...(usesAsyncImageResult(model) ? { async: true } : {}),
        }),
      }), 1);
      httpStatus = response.status;
      if (usesAsyncImageResult(model)) {
        const payload = await readImageResponse<ImageTaskResponse>(response);
        const taskId = imageTaskId(payload);
        if (!taskId) throw new GiftAiError('Image generation task did not return an image ID.');
        providerJobId = taskId;
        acceptedBillable = true;
        await finishGiftAiProviderAttempt(attempt, { status: 'accepted', httpStatus, providerJobId, acceptedBillable: true });
        const image = await resolveImageTask(baseUrl, taskId, configuration, model, { monochromeColor, whiteBackground: true });
        await finishGiftAiProviderAttempt(attempt, { status: 'succeeded', httpStatus, providerJobId, acceptedBillable: true });
        recordCircuitSuccess(key);
        return image;
      }
      const image = await normalizeImage(await readImageResponse<ImageApiResponse>(response), baseUrl, configuration.apiKey, model, { monochromeColor, whiteBackground: true });
      acceptedBillable = response.ok;
      await finishGiftAiProviderAttempt(attempt, { status: 'succeeded', httpStatus, acceptedBillable });
      recordCircuitSuccess(key);
      return image;
    } catch (error) {
      await finishGiftAiProviderAttempt(attempt, { status: 'failed', httpStatus: httpStatus || (error instanceof GiftAiError ? error.status : undefined), providerJobId, acceptedBillable, error });
      if (error instanceof ImageProviderUnavailableError || error instanceof ImageProviderRejectedError) recordCircuitFailure(key);
      if (index === 0) primaryError = error;
      lastError = error;
      if (!canUseImageFallback(error)) throw error;
    }
  }
  if (lastError instanceof GiftAiError && lastError.reason === 'authentication' && primaryError instanceof Error) throw primaryError;
  throw lastError instanceof Error ? lastError : new GiftAiError('Image generation failed.');
}

async function requestGeneratedImage(prompt: string, monochromeColor?: string, context: GiftImageInvocationContext = {}) {
  if (configuredGiftImageProvider() === 'krill') return requestKrillGeneratedImage(prompt, monochromeColor, context);
  const configuration = apimartImageConfiguration();
  if (!configuration) throw new GiftAiError('APIMART_IMAGE_API_KEY is not configured.', 503, 'configuration');
  const key = circuitKey('generation', configuration.model, configuration.baseUrl);
  if (circuitOpen(key)) {
    const skipped = await startGiftAiProviderAttempt({
      requestId: context.requestId,
      operation: 'generation',
      stage: context.stage || 'render',
      slot: context.slot,
      role: 'primary',
      provider: 'apimart',
      model: configuration.model,
      baseHost: new URL(configuration.baseUrl).host,
    });
    await finishGiftAiProviderAttempt(skipped, { status: 'skipped', error: 'Provider circuit is temporarily open.' });
    throw new ImageProviderUnavailableError('APIMart image generation is temporarily paused after repeated failures.', 503, false);
  }
  try {
    const image = await requestApimartGeneratedImage(prompt, monochromeColor, context);
    recordCircuitSuccess(key);
    return image;
  } catch (error) {
    if (error instanceof ImageProviderUnavailableError || error instanceof ImageProviderRejectedError) recordCircuitFailure(key);
    throw error;
  }
}

export async function generateGiftImages(prompt: string, count = 3, monochromeColor?: string, context: GiftImageInvocationContext = {}) {
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 3);
  return Promise.all(Array.from({ length: safeCount }, (_, index) => requestGeneratedImage(prompt, monochromeColor, { ...context, slot: context.slot ?? index })));
}

export function publicGiftImageError(error: unknown) {
  if (error instanceof ImageQualityRejectedError) return { code: 'quality', message: 'Generated image did not pass quality inspection.' };
  if (error instanceof ImageTaskFailedError) return { code: 'provider_failed', message: 'Image generation was not completed by the provider.' };
  if (error instanceof GiftAiError && error.status === 504) return { code: 'timeout', message: 'Image generation timed out.' };
  if (error instanceof GiftAiError && error.reason === 'configuration') return { code: 'configuration', message: error.message };
  return { code: 'upstream', message: 'Image generation is temporarily unavailable.' };
}

export async function editGiftImage(input: { image: File; mask?: File; prompt: string; monochromeColor?: string; whiteBackground?: boolean }, context: GiftImageInvocationContext = {}) {
  if (configuredGiftImageProvider() === 'apimart') {
    const configuration = apimartImageConfiguration();
    if (!configuration) throw new GiftAiError('APIMART_IMAGE_API_KEY is not configured.', 503, 'configuration');
    const key = circuitKey('edit', configuration.model, configuration.baseUrl);
    if (circuitOpen(key)) throw new ImageProviderUnavailableError('APIMart image editing is temporarily paused after repeated failures.', 503, false);
    try {
      const image = await requestApimartEditedImage(input, context);
      recordCircuitSuccess(key);
      return image;
    } catch (error) {
      if (error instanceof ImageProviderUnavailableError || error instanceof ImageProviderRejectedError) recordCircuitFailure(key);
      throw error;
    }
  }
  const configuration = imageConfiguration();
  let lastError: unknown;
  let primaryError: unknown;
  for (const [index, { model, baseUrl, role }] of imageProviderAttempts('edit', configuration).entries()) {
    const key = circuitKey('edit', model, baseUrl);
    if (circuitOpen(key)) {
      const skipped = await startGiftAiProviderAttempt({ requestId: context.requestId, operation: 'edit', stage: context.stage || 'image_edit', slot: context.slot, role, provider: 'krill-ai', model, baseHost: new URL(baseUrl).host });
      await finishGiftAiProviderAttempt(skipped, { status: 'skipped', error: 'Provider circuit is temporarily open.' });
      continue;
    }
    try {
      const image = await requestEditedImage(baseUrl, model, configuration, input, context, role);
      recordCircuitSuccess(key);
      return image;
    } catch (error) {
      if (error instanceof ImageProviderUnavailableError || error instanceof ImageProviderRejectedError) recordCircuitFailure(key);
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
