import type * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

function binaryTriangleCount(buffer: ArrayBuffer) {
  if (buffer.byteLength < 84) return null;
  const count = new DataView(buffer).getUint32(80, true);
  return buffer.byteLength === 84 + count * 50 ? count : null;
}

function scaleBinaryStl(buffer: ArrayBuffer, scale: number, triangleCount: number) {
  const scaled = buffer.slice(0);
  const view = new DataView(scaled);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = 84 + triangle * 50;
    for (const vertexOffset of [12, 24, 36]) {
      for (let coordinate = 0; coordinate < 3; coordinate += 1) {
        const offset = triangleOffset + vertexOffset + coordinate * 4;
        view.setFloat32(offset, view.getFloat32(offset, true) * scale, true);
      }
    }
  }
  return scaled;
}

function exportObjectAsBinaryStl(object: THREE.Object3D, scale: number) {
  const scaledObject = object.clone(true);
  scaledObject.scale.multiplyScalar(scale);
  scaledObject.updateMatrixWorld(true);
  const result = new STLExporter().parse(scaledObject, { binary: true });
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

export function createScaledStlBlob(input: { buffer: ArrayBuffer; object: THREE.Object3D; format: 'stl' | 'glb' | 'gltf'; scale: number }) {
  if (!Number.isFinite(input.scale) || input.scale <= 0) throw new Error('Scale must be a positive number.');
  const triangleCount = input.format === 'stl' ? binaryTriangleCount(input.buffer) : null;
  const output = triangleCount === null
    ? exportObjectAsBinaryStl(input.object, input.scale)
    : scaleBinaryStl(input.buffer, input.scale, triangleCount);
  return new Blob([output], { type: 'model/stl' });
}
