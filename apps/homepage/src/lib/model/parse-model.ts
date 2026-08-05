import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { createModelMaterial } from './model-scene';
import { normalizeGiftModelFormat, type GiftModelFormat } from './model-types';

export async function parseGiftModelBuffer(buffer: ArrayBuffer, rawFormat: string): Promise<{ format: GiftModelFormat; object: THREE.Object3D }> {
  const format = normalizeGiftModelFormat(rawFormat);
  if (format === 'stl') {
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    return { format, object: new THREE.Mesh(geometry, createModelMaterial('#d9eef5')) };
  }

  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', (gltf) => resolve({ format, object: gltf.scene }), reject);
  });
}
