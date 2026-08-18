import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectGiftImageQuality } from '../src/lib/gift-ai';

async function main() {
  const blank = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' },
  }).png().toBuffer();

  await assert.rejects(() => inspectGiftImageQuality(blank), /quality check/i);

  const paleSubject = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' },
  }).composite([
    { input: await sharp({ create: { width: 260, height: 340, channels: 3, background: '#D6C5B6' } }).png().toBuffer(), left: 126, top: 86 },
    { input: await sharp({ create: { width: 170, height: 60, channels: 3, background: '#7A4B31' } }).png().toBuffer(), left: 171, top: 390 },
  ]).png().toBuffer();

  const metrics = await inspectGiftImageQuality(paleSubject);
  assert.ok(metrics.foregroundRatio > 0.1);
  assert.ok(metrics.contrast > 10);

  const grayBackground = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#E5E7EB' },
  }).composite([
    { input: await sharp({ create: { width: 220, height: 300, channels: 3, background: '#7A4B31' } }).png().toBuffer(), left: 146, top: 106 },
  ]).png().toBuffer();
  await assert.rejects(() => inspectGiftImageQuality(grayBackground), /background/i);

  const touchingEdge = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' },
  }).composite([
    { input: await sharp({ create: { width: 180, height: 360, channels: 3, background: '#7A4B31' } }).png().toBuffer(), left: 0, top: 76 },
  ]).png().toBuffer();
  await assert.rejects(() => inspectGiftImageQuality(touchingEdge), /(boundary|background)/i);

  const inset = await sharp(touchingEdge).resize(460, 460, { fit: 'fill' }).png().toBuffer();
  const safelyReframed = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' },
  }).composite([{ input: inset, left: 26, top: 26 }]).png().toBuffer();
  const reframedMetrics = await inspectGiftImageQuality(safelyReframed);
  assert.equal(reframedMetrics.borderWhiteRatio, 1);
  assert.equal(reframedMetrics.edgeForegroundRatio, 0);
  console.log('Gift image quality regression checks passed.', metrics);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
