import sharp from 'sharp';

const DEFAULT_MAX_INPUT_BYTES = 20 * 1024 * 1024;

function cornerBackgroundSamples(data: Buffer, width: number, height: number) {
  const patchSize = Math.max(2, Math.min(8, width, height));
  const corners = [
    [0, 0],
    [Math.max(0, width - patchSize), 0],
    [0, Math.max(0, height - patchSize)],
    [Math.max(0, width - patchSize), Math.max(0, height - patchSize)],
  ];
  const samples: number[][] = [];
  const uniqueSamples = new Set<string>();
  const addSample = (red: number, green: number, blue: number) => {
    const key = `${Math.round(red / 4)},${Math.round(green / 4)},${Math.round(blue / 4)}`;
    if (uniqueSamples.has(key)) return;
    uniqueSamples.add(key);
    samples.push([red, green, blue]);
  };
  corners.forEach(([startX, startY]) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = startY; y < Math.min(height, startY + patchSize); y += 1) {
      for (let x = startX; x < Math.min(width, startX + patchSize); x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] === 0) continue;
        red += data[offset];
        green += data[offset + 1];
        blue += data[offset + 2];
        count += 1;
      }
    }
    if (count > 0) addSample(red / count, green / count, blue / count);
    const points = [0, Math.floor((patchSize - 1) / 2), patchSize - 1];
    for (const pointY of points) {
      for (const pointX of points) {
        const x = Math.min(width - 1, startX + pointX);
        const y = Math.min(height - 1, startY + pointY);
        const offset = (y * width + x) * 4;
        if (data[offset + 3] !== 0) addSample(data[offset], data[offset + 1], data[offset + 2]);
      }
    }
  });
  return samples.length > 0 ? samples : [[255, 255, 255]];
}

function backgroundDistance(data: Buffer, offset: number, samples: number[][]) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const red = data[offset] - sample[0];
    const green = data[offset + 1] - sample[1];
    const blue = data[offset + 2] - sample[2];
    minimum = Math.min(minimum, Math.sqrt(red * red + green * green + blue * blue));
  }
  return minimum;
}

/** Converts an image to PNG and removes the edge-connected background locally. */
export async function createTransparentPng(input: Buffer, maxInputBytes = DEFAULT_MAX_INPUT_BYTES) {
  if (input.byteLength > maxInputBytes) throw new Error(`Image exceeds the ${Math.round(maxInputBytes / 1024 / 1024)}MB safety limit.`);
  let raw: Buffer;
  let width: number;
  let height: number;
  try {
    const converted = await sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    raw = converted.data;
    width = converted.info.width;
    height = converted.info.height;
    if (converted.info.channels !== 4) throw new Error('Image could not be normalized to RGBA.');
  } catch {
    throw new Error('Image is unreadable or uses an unsupported format.');
  }

  const samples = cornerBackgroundSamples(raw, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const maximumDistance = 56;
  const fullyTransparentDistance = 20;
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (visited[index]) return;
    const offset = index * 4;
    const distance = backgroundDistance(raw, offset, samples);
    if (raw[offset + 3] !== 0 && distance > maximumDistance) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * 4;
    if (raw[offset + 3] !== 0) {
      const distance = backgroundDistance(raw, offset, samples);
      const opacity = distance <= fullyTransparentDistance
        ? 0
        : Math.min(1, (distance - fullyTransparentDistance) / (maximumDistance - fullyTransparentDistance));
      raw[offset + 3] = Math.round(raw[offset + 3] * opacity);
    }
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const output = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const outputRaw = await sharp(output).ensureAlpha().raw().toBuffer();
  let transparentPixels = 0;
  for (let index = 3; index < outputRaw.length; index += 4) {
    if (outputRaw[index] < 250) transparentPixels += 1;
  }
  if (transparentPixels < Math.max(10, Math.floor(width * height * 0.001))) {
    throw new Error('Generated image did not contain a removable transparent background.');
  }
  return output;
}

/**
 * Creates the white-background derivative used by image-to-3D providers.
 * Transparent assets remain the source of truth for the UI and image editing;
 * this derivative prevents provider-side alpha handling from changing 3D input.
 */
export async function createWhiteMattePng(input: Buffer, maxInputBytes = DEFAULT_MAX_INPUT_BYTES) {
  if (input.byteLength > maxInputBytes) throw new Error(`Image exceeds the ${Math.round(maxInputBytes / 1024 / 1024)}MB safety limit.`);
  try {
    return await sharp(input)
      .toColourspace('srgb')
      .ensureAlpha()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  } catch {
    throw new Error('Image is unreadable or uses an unsupported format.');
  }
}
