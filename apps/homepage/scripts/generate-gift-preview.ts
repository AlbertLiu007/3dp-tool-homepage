import { readFile, writeFile } from 'node:fs/promises';
import { createGiftPreviewGlb } from '../src/lib/model/create-preview-glb';

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) throw new Error('Usage: tsx scripts/generate-gift-preview.ts <source.stl> <preview.glb>');

async function main() {
  const preview = await createGiftPreviewGlb(await readFile(sourcePath), 'stl');
  if (!preview) throw new Error('The source format does not support preview conversion.');
  await writeFile(targetPath, preview);
  console.log(`Wrote ${targetPath} (${(preview.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

void main();
