type ImageApiItem = {
  b64_json?: string;
  url?: string;
};

type ImageApiResponse = {
  data?: ImageApiItem[];
  error?: { message?: string };
};

type HunyuanSubmitResponse = {
  id?: string;
  request_id?: string;
  status?: string;
  error?: { message?: string };
};

type HunyuanQueryItem = {
  type?: string;
  url?: string;
  preview_image_url?: string;
};

type HunyuanQueryResponse = HunyuanSubmitResponse & {
  data?: HunyuanQueryItem[];
  error_message?: string;
};

export type GeneratedGiftImage = {
  dataUrl?: string;
  url?: string;
};

export type WhiteModelJob = {
  id: string;
  status: string;
};

export type WhiteModelQuery = {
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  models: { type: string; url: string; previewImageUrl?: string }[];
};

export class GiftAiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly reason: 'configuration' | 'validation' | 'upstream' = 'upstream',
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

function imageConfiguration() {
  return {
    baseUrl: normalizedBaseUrl(requiredEnvironmentVariable('GPT_IMAGE_BASE_URL')),
    apiKey: requiredEnvironmentVariable('GPT_IMAGE_API_KEY'),
    model: process.env.GPT_IMAGE_MODEL?.trim() || 'wan2.7-image-pro',
    size: process.env.GPT_IMAGE_SIZE?.trim() || '1024x1024',
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'high',
  };
}

function hunyuanConfiguration() {
  const faceCount = Number(process.env.HUNYUAN_3D_FACE_COUNT || '300000');
  return {
    baseUrl: normalizedBaseUrl(process.env.HUNYUAN_3D_BASE_URL?.trim() || 'https://tokenhub.tencentmaas.com/v1/api/3d'),
    apiKey: requiredEnvironmentVariable('HUNYUAN_3D_API_KEY'),
    model: process.env.HUNYUAN_3D_MODEL?.trim() || 'hy-3d-3.1',
    resultFormat: process.env.HUNYUAN_3D_RESULT_FORMAT?.trim() || 'STL',
    faceCount: Number.isInteger(faceCount) && faceCount >= 3000 && faceCount <= 1_500_000 ? faceCount : 300000,
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
    const message = (payload as ImageApiResponse | undefined)?.error?.message;
    throw new GiftAiError(message || `Upstream request failed with HTTP ${response.status}.`);
  }
  if (!payload) throw new GiftAiError('Upstream returned an invalid JSON response.');
  return payload;
}

async function normalizeImage(payload: ImageApiResponse): Promise<GeneratedGiftImage> {
  const image = payload.data?.[0];
  if (image?.b64_json) return { dataUrl: `data:image/png;base64,${image.b64_json}` };
  if (image?.url) {
    const response = await fetch(image.url, { cache: 'no-store' });
    if (!response.ok) throw new GiftAiError('Image provider returned an unreadable image URL.');
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    if (!contentType.startsWith('image/')) throw new GiftAiError('Image provider URL did not return an image.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 15 * 1024 * 1024) throw new GiftAiError('Generated image exceeds the 15MB safety limit.');
    return { dataUrl: `data:${contentType};base64,${buffer.toString('base64')}` };
  }
  throw new GiftAiError(payload.error?.message || 'Image provider did not return an image.');
}

async function requestGeneratedImage(prompt: string) {
  const configuration = imageConfiguration();
  const response = await fetch(`${configuration.baseUrl}/images/generations`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: configuration.model,
      prompt,
      size: configuration.size,
      quality: configuration.quality,
      n: 1,
    }),
  });
  return normalizeImage(await readJsonResponse<ImageApiResponse>(response));
}

export async function generateGiftImages(prompt: string, count = 3) {
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 3);
  return Promise.all(Array.from({ length: safeCount }, () => requestGeneratedImage(prompt)));
}

export async function editGiftImage(input: { image: File; mask?: File; prompt: string }) {
  const configuration = imageConfiguration();
  const formData = new FormData();
  formData.set('model', configuration.model);
  formData.set('prompt', input.prompt);
  formData.set('size', configuration.size);
  formData.set('quality', configuration.quality);
  formData.set('image', input.image, input.image.name || 'gift-render.png');
  if (input.mask) formData.set('mask', input.mask, input.mask.name || 'mask.png');

  const response = await fetch(`${configuration.baseUrl}/images/edits`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      Accept: 'application/json',
    },
    body: formData,
  });
  return normalizeImage(await readJsonResponse<ImageApiResponse>(response));
}

export async function submitWhiteModel(image: File): Promise<WhiteModelJob> {
  const configuration = hunyuanConfiguration();
  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString('base64');
  const response = await fetch(`${configuration.baseUrl}/submit`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: configuration.model,
      image_base64: imageBase64,
      generate_type: 'Geometry',
      enable_pbr: false,
      result_format: configuration.resultFormat,
      face_count: configuration.faceCount,
    }),
  });
  const payload = await readJsonResponse<HunyuanSubmitResponse>(response);
  if (!payload.id) throw new GiftAiError(payload.error?.message || 'Hunyuan did not return a job ID.');
  return { id: payload.id, status: payload.status || 'queued' };
}

function normalizeHunyuanStatus(status: string | undefined): WhiteModelQuery['status'] {
  const normalized = status?.toLowerCase();
  if (normalized === 'completed' || normalized === 'done') return 'completed';
  if (normalized === 'failed' || normalized === 'fail') return 'failed';
  if (normalized === 'in_progress' || normalized === 'run' || normalized === 'running') return 'in_progress';
  return 'queued';
}

export async function queryWhiteModel(id: string): Promise<WhiteModelQuery> {
  const configuration = hunyuanConfiguration();
  const response = await fetch(`${configuration.baseUrl}/query`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ model: configuration.model, id }),
  });
  const payload = await readJsonResponse<HunyuanQueryResponse>(response);
  const status = normalizeHunyuanStatus(payload.status);
  if (status === 'failed') throw new GiftAiError(payload.error_message || payload.error?.message || 'Hunyuan model generation failed.');

  return {
    status,
    models: (payload.data || []).flatMap((item) => item.type && item.url ? [{
      type: item.type,
      url: item.url,
      previewImageUrl: item.preview_image_url,
    }] : []),
  };
}
