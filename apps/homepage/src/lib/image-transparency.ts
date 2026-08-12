import sharp from 'sharp';

const DEFAULT_MAX_INPUT_BYTES = 20 * 1024 * 1024;

type RgbSample = [number, number, number];

type TransparentPngOptions = {
  /**
   * AI image providers sometimes return a correctly cut-out RGBA image. When
   * that happens, keep the provider's alpha channel instead of segmenting the
   * image a second time by color.
   */
  preserveExistingAlpha?: boolean;
};

function hexRgb(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) throw new Error('Monochrome paint color must be a six-digit HEX value.');
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = maximum === r
    ? 60 * (((g - b) / delta) % 6)
    : maximum === g
      ? 60 * (((b - r) / delta) + 2)
      : 60 * (((r - g) / delta) + 4);
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] = section < 1 ? [chroma, intermediate, 0]
    : section < 2 ? [intermediate, chroma, 0]
      : section < 3 ? [0, chroma, intermediate]
        : section < 4 ? [0, intermediate, chroma]
          : section < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];
  const offset = lightness - chroma / 2;
  return [r, g, b].map((channel) => Math.round((channel + offset) * 255));
}

function borderBackgroundSamples(data: Buffer, width: number, height: number) {
  // Four corners are not enough for a photo with a gradient, floor, or cast
  // shadow. Sample the complete border in small patches so the flood fill can
  // follow the actual backdrop without treating the subject as background.
  const patchSize = Math.max(2, Math.min(10, Math.floor(Math.min(width, height) / 32) || 2));
  const step = Math.max(patchSize, Math.floor(Math.max(width, height) / 28));
  const samples: RgbSample[] = [];
  const uniqueSamples = new Set<string>();
  const addSample = (red: number, green: number, blue: number) => {
    const key = `${Math.round(red / 8)},${Math.round(green / 8)},${Math.round(blue / 8)}`;
    if (uniqueSamples.has(key) || samples.length >= 64) return;
    uniqueSamples.add(key);
    samples.push([red, green, blue]);
  };
  const addPatch = (startX: number, startY: number, patchWidth: number, patchHeight: number) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = startY; y < Math.min(height, startY + patchHeight); y += 1) {
      for (let x = startX; x < Math.min(width, startX + patchWidth); x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] === 0) continue;
        red += data[offset];
        green += data[offset + 1];
        blue += data[offset + 2];
        count += 1;
      }
    }
    if (count > 0) addSample(red / count, green / count, blue / count);
  };

  for (let x = 0; x < width; x += step) {
    addPatch(x, 0, patchSize, patchSize);
    addPatch(x, Math.max(0, height - patchSize), patchSize, patchSize);
  }
  for (let y = patchSize; y < height - patchSize; y += step) {
    addPatch(0, y, patchSize, patchSize);
    addPatch(Math.max(0, width - patchSize), y, patchSize, patchSize);
  }
  return samples.length > 0 ? samples : [[255, 255, 255] as RgbSample];
}

function backgroundDistance(data: Buffer, offset: number, samples: RgbSample[]) {
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
export async function createTransparentPng(
  input: Buffer,
  maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
  options: TransparentPngOptions = {},
) {
  if (input.byteLength > maxInputBytes) throw new Error(`Image exceeds the ${Math.round(maxInputBytes / 1024 / 1024)}MB safety limit.`);
  let raw: Buffer;
  let width: number;
  let height: number;
  let sourceHasAlpha = false;
  try {
    const metadata = await sharp(input).metadata();
    sourceHasAlpha = metadata.hasAlpha === true;
    const converted = await sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    raw = converted.data;
    width = converted.info.width;
    height = converted.info.height;
    if (converted.info.channels !== 4) throw new Error('Image could not be normalized to RGBA.');
  } catch {
    throw new Error('Image is unreadable or uses an unsupported format.');
  }

  // Do not damage a result that the image model has already cut out. The old
  // implementation ran the color flood-fill on every response, which could
  // erase white highlights, pale geometry, thin legs and low-contrast bases
  // from an otherwise valid transparent PNG.
  if (options.preserveExistingAlpha && sourceHasAlpha) {
    let transparentPixels = 0;
    let subjectPixels = 0;
    let borderPixels = 0;
    let opaqueBorderPixels = 0;
    for (let index = 3; index < raw.length; index += 4) {
      if (raw[index] < 250) transparentPixels += 1;
      if (raw[index] >= 32) subjectPixels += 1;
    }
    for (let x = 0; x < width; x += 1) {
      for (const y of [0, height - 1]) {
        const alpha = raw[(y * width + x) * 4 + 3];
        borderPixels += 1;
        if (alpha >= 32) opaqueBorderPixels += 1;
      }
    }
    for (let y = 1; y < height - 1; y += 1) {
      for (const x of [0, width - 1]) {
        const alpha = raw[(y * width + x) * 4 + 3];
        borderPixels += 1;
        if (alpha >= 32) opaqueBorderPixels += 1;
      }
    }
    const minimumPixels = Math.max(32, Math.floor(width * height * 0.0005));
    const borderIsClean = opaqueBorderPixels <= Math.max(4, Math.floor(borderPixels * 0.002));
    if (borderIsClean && transparentPixels >= Math.max(10, Math.floor(width * height * 0.001)) && subjectPixels >= minimumPixels) {
      return await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    }
  }

  const samples = borderBackgroundSamples(raw, width, height);
  const pixelCount = width * height;
  const backgroundDistances = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    backgroundDistances[index] = backgroundDistance(raw, index * 4, samples);
  }
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  // A wider transition removes the gray/white halo commonly left by product
  // renders, while the flood-fill remains edge-connected so interior white
  // details are not treated as background.
  const maximumDistance = 88;
  const fullyTransparentDistance = 32;
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (visited[index]) return;
    const offset = index * 4;
    const distance = backgroundDistances[index];
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
      const distance = backgroundDistances[index];
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

  // Product silhouettes often contain enclosed background openings between
  // legs, weapons, hair, ornaments, and the base. Edge-only flood fill cannot
  // reach those openings, so they were later recolored as pale black/red/gray
  // patches by the monochrome pass. Remove only sizeable, nearly uniform
  // background-colored components whose surrounding boundary has strong
  // contrast. The contrast gate protects pale blades, highlights, and other
  // legitimate light-colored subject details.
  const interiorVisited = new Uint8Array(pixelCount);
  const enclosedCoreDistance = Math.min(maximumDistance - 16, 72);
  const minimumEnclosedPixels = Math.max(24, Math.floor(pixelCount * 0.00004));
  for (let start = 0; start < pixelCount; start += 1) {
    if (interiorVisited[start] || raw[start * 4 + 3] < 24 || backgroundDistances[start] > enclosedCoreDistance) continue;
    let componentHead = 0;
    let componentTail = 0;
    let distanceTotal = 0;
    let boundaryPixels = 0;
    let strongBoundaryPixels = 0;
    let touchesImageBorder = false;
    interiorVisited[start] = 1;
    queue[componentTail] = start;
    componentTail += 1;

    while (componentHead < componentTail) {
      const index = queue[componentHead];
      componentHead += 1;
      distanceTotal += backgroundDistances[index];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || x + 1 === width || y === 0 || y + 1 === height) touchesImageBorder = true;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0) continue;
        const neighborAlpha = raw[neighbor * 4 + 3];
        if (neighborAlpha >= 24 && backgroundDistances[neighbor] <= enclosedCoreDistance) {
          if (!interiorVisited[neighbor]) {
            interiorVisited[neighbor] = 1;
            queue[componentTail] = neighbor;
            componentTail += 1;
          }
          continue;
        }
        if (neighborAlpha < 24) continue;
        boundaryPixels += 1;
        if (backgroundDistances[neighbor] >= maximumDistance - 8) strongBoundaryPixels += 1;
      }
    }

    const meanDistance = componentTail > 0 ? distanceTotal / componentTail : Number.POSITIVE_INFINITY;
    const strongBoundaryRatio = boundaryPixels > 0 ? strongBoundaryPixels / boundaryPixels : 0;
    const isEnclosedBackground = !touchesImageBorder
      && componentTail >= minimumEnclosedPixels
      && meanDistance <= fullyTransparentDistance
      && strongBoundaryRatio >= 0.08;
    if (!isEnclosedBackground) continue;
    for (let componentIndex = 0; componentIndex < componentTail; componentIndex += 1) {
      raw[queue[componentIndex] * 4 + 3] = 0;
    }
  }

  // Remove the light/dark fringe left by anti-aliased edges. Only pixels
  // directly adjacent to the already removed backdrop are considered, which
  // protects isolated white or black parts inside the subject.
  const softEdgeDistance = maximumDistance + 28;
  const alphaBeforeCleanup = raw.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      if (alphaBeforeCleanup[offset + 3] === 0) continue;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      if (!neighbors.some((neighbor) => neighbor >= 0 && alphaBeforeCleanup[neighbor * 4 + 3] < 16)) continue;
      const distance = backgroundDistances[index];
      if (distance >= softEdgeDistance) continue;
      const opacity = distance <= fullyTransparentDistance
        ? 0
        : (distance - fullyTransparentDistance) / (softEdgeDistance - fullyTransparentDistance);
      raw[offset + 3] = Math.min(raw[offset + 3], Math.round(raw[offset + 3] * opacity));
    }
  }

  const output = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const outputRaw = await sharp(output).ensureAlpha().raw().toBuffer();
  let transparentPixels = 0;
  let subjectPixels = 0;
  for (let index = 3; index < outputRaw.length; index += 4) {
    if (outputRaw[index] < 250) transparentPixels += 1;
    if (outputRaw[index] >= 32) subjectPixels += 1;
  }
  if (transparentPixels < Math.max(10, Math.floor(width * height * 0.001))) {
    throw new Error('Generated image did not contain a removable transparent background.');
  }
  if (subjectPixels < Math.max(32, Math.floor(width * height * 0.002))) {
    throw new Error('Background processing removed almost the entire subject.');
  }
  return output;
}

/**
 * Applies one paint hue to every visible subject pixel while preserving alpha,
 * geometry detail, neutral-light shadows, and highlights. This deterministic
 * pass prevents an image model from leaking original accent colors into a
 * single-color spray-paint preview.
 */
export async function createMonochromePaintPng(input: Buffer, paintColor: string, maxInputBytes = DEFAULT_MAX_INPUT_BYTES) {
  const transparent = await createTransparentPng(input, maxInputBytes, { preserveExistingAlpha: true });
  const targetRgb = hexRgb(paintColor);
  const target = rgbToHsl(targetRgb.red, targetRgb.green, targetRgb.blue);
  const converted = await sharp(transparent).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (converted.info.channels !== 4) throw new Error('Image could not be normalized to RGBA.');
  const raw = converted.data;
  for (let offset = 0; offset < raw.length; offset += 4) {
    if (raw[offset + 3] === 0) continue;
    const sourceLightness = (0.2126 * raw[offset] + 0.7152 * raw[offset + 1] + 0.0722 * raw[offset + 2]) / 255;
    const detailOffset = (sourceLightness - 0.5) * 0.58;
    const lightness = Math.min(0.92, Math.max(0.06, target.lightness + detailOffset));
    const [red, green, blue] = hslToRgb(target.hue, target.saturation, lightness);
    raw[offset] = red;
    raw[offset + 1] = green;
    raw[offset + 2] = blue;
  }
  return sharp(raw, { raw: { width: converted.info.width, height: converted.info.height, channels: 4 } }).png().toBuffer();
}

/**
 * Creates the white-background derivative used by image-to-3D providers.
 * This flattens a subject cutout to an opaque white PNG so provider-side alpha
 * handling cannot change the image appearance or the 3D input.
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

/**
 * Creates the dedicated image-to-3D input: an opaque pure-white background
 * with the subject converted to neutral matte gray while retaining its
 * luminance detail. This is local image processing and does not call an AI
 * provider or consume image-generation quota.
 */
export async function create3dPrintInputPng(input: Buffer, maxInputBytes = DEFAULT_MAX_INPUT_BYTES) {
  const transparent = await createTransparentPng(input, maxInputBytes, { preserveExistingAlpha: true });
  const converted = await sharp(transparent)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (converted.info.channels !== 4) throw new Error('Image could not be normalized to RGBA.');

  const raw = converted.data;
  for (let offset = 0; offset < raw.length; offset += 4) {
    if (raw[offset + 3] === 0) continue;
    const luminance = 0.2126 * raw[offset] + 0.7152 * raw[offset + 1] + 0.0722 * raw[offset + 2];
    // Keep enough contrast for relief and edges, but stay inside a neutral
    // matte-gray range so the 3D model provider does not infer a texture.
    const gray = Math.min(220, Math.max(72, Math.round(148 + (luminance - 128) * 0.72)));
    raw[offset] = gray;
    raw[offset + 1] = gray;
    raw[offset + 2] = gray;
  }

  const graySubject = await sharp(raw, {
    raw: { width: converted.info.width, height: converted.info.height, channels: 4 },
  }).png().toBuffer();
  return createWhiteMattePng(graySubject, maxInputBytes);
}
