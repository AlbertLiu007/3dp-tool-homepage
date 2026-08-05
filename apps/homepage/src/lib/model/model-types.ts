import type * as THREE from 'three';

export type GiftModelFormat = 'stl' | 'glb' | 'gltf';

export type GiftParsedModel = {
  format: GiftModelFormat;
  object: THREE.Object3D;
};

export type GiftModelMeasurement = {
  dimensionsMm: { x: number; y: number; z: number };
  volumeCm3: number | null;
  surfaceAreaMm2: number | null;
  triangleCount: number;
};

export function normalizeGiftModelFormat(value: string): GiftModelFormat {
  const normalized = value.toLowerCase();
  if (normalized === 'stl' || normalized === 'glb' || normalized === 'gltf') return normalized;
  throw new Error('Unsupported generated model format.');
}
