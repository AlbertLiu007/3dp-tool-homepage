import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectGiftImageQuality } from '../src/lib/gift-ai';
import { createTransparentPng, createWhiteMattePng } from '../src/lib/image-transparency';

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
  // Border whiteness is evaluated before explicit edge contact, so a subject
  // that reaches the canvas is classified as a background failure.
  await assert.rejects(() => inspectGiftImageQuality(touchingEdge), /background/i);

  const inset = await sharp(touchingEdge).resize(460, 460, { fit: 'fill' }).png().toBuffer();
  const safelyReframed = await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#FFFFFF' },
  }).composite([{ input: inset, left: 26, top: 26 }]).png().toBuffer();
  const reframedMetrics = await inspectGiftImageQuality(safelyReframed);
  assert.equal(reframedMetrics.borderWhiteRatio, 1);
  assert.equal(reframedMetrics.edgeForegroundRatio, 0);

  // Image providers sometimes return a valid cutout whose transparent pixels
  // retain dark RGB values and a tiny non-zero alpha. Before normalization,
  // flattening that image produces a gray border and fails the pure-white
  // background check. The preserved-alpha path must discard that invisible
  // residue without changing the opaque subject.
  const hazyCutout = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 24 / 255 } },
  }).composite([
    { input: await sharp({ create: { width: 220, height: 300, channels: 4, background: '#7A4B31FF' } }).png().toBuffer(), left: 146, top: 106 },
  ]).png().toBuffer();
  const hazyWhiteMatte = await createWhiteMattePng(hazyCutout);
  await assert.rejects(() => inspectGiftImageQuality(hazyWhiteMatte), /background/i);

  const cleanedCutout = await createTransparentPng(hazyCutout, undefined, { preserveExistingAlpha: true });
  const cleanedWhiteMatte = await createWhiteMattePng(cleanedCutout);
  const cleanedMetrics = await inspectGiftImageQuality(cleanedWhiteMatte);
  assert.equal(cleanedMetrics.borderWhiteRatio, 1);
  assert.equal(cleanedMetrics.edgeForegroundRatio, 0);

  console.log('Gift image quality regression checks passed.', metrics);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
