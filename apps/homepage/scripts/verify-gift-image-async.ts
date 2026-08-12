import { loadEnvConfig } from '@next/env';
import sharp from 'sharp';

async function main() {
  loadEnvConfig(process.cwd());
  const { editGiftImage } = await import('../src/lib/gift-ai');
  const source = await sharp({
    create: { width: 256, height: 256, channels: 4, background: { r: 238, g: 238, b: 238, alpha: 1 } },
  }).composite([{
    input: Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="72" fill="#C42C36"/></svg>'),
  }]).png().toBuffer();
  const image = new File([source], 'synthetic-circle.png', { type: 'image/png' });
  const result = await editGiftImage({
    image,
    prompt: 'Keep the red circular object unchanged and place it on a uniform pure white background.',
    whiteBackground: true,
  });

  console.log(JSON.stringify({
    model: result.model,
    hasDataUrl: typeof result.dataUrl === 'string',
    dataUrlLength: result.dataUrl?.length || 0,
    whiteBackground: result.whiteBackground,
    whiteBackgroundProcessor: result.whiteBackgroundProcessor,
    transparentBackground: result.transparentBackground,
    processor: result.transparentBackgroundProcessor,
  }, null, 2));
}

void main();
