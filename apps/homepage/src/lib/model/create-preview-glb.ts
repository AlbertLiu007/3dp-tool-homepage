import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const TARGET_TRIANGLES = 140_000;

function aligned(value: number, boundary = 4) {
  return (value + boundary - 1) & ~(boundary - 1);
}

function jsonChunk(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const padded = new Uint8Array(aligned(encoded.byteLength, 4));
  padded.set(encoded);
  padded.fill(0x20, encoded.byteLength);
  return padded;
}

function binaryGlb(positions: Float32Array, normals: Float32Array, indices: Uint32Array) {
  const positionBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
  const normalBytes = new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength);
  const indexBytes = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
  const positionOffset = 0;
  const normalOffset = aligned(positionBytes.byteLength);
  const indexOffset = aligned(normalOffset + normalBytes.byteLength);
  const bin = new Uint8Array(aligned(indexOffset + indexBytes.byteLength));
  bin.set(positionBytes, positionOffset);
  bin.set(normalBytes, normalOffset);
  bin.set(indexBytes, indexOffset);

  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }

  const json = jsonChunk({
    asset: { version: '2.0', generator: 'UnionAM preview pipeline' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: 'UnionAM white preview', pbrMetallicRoughness: { baseColorFactor: [0.82, 0.93, 0.96, 1], metallicFactor: 0.08, roughnessFactor: 0.42 } }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: normalOffset, byteLength: normalBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexBytes.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
  });
  const header = new ArrayBuffer(12);
  const headerView = new DataView(header);
  headerView.setUint32(0, 0x46546c67, true);
  headerView.setUint32(4, 2, true);
  headerView.setUint32(8, 12 + 8 + json.byteLength + 8 + bin.byteLength, true);
  const jsonHeader = new ArrayBuffer(8);
  const jsonHeaderView = new DataView(jsonHeader);
  jsonHeaderView.setUint32(0, json.byteLength, true);
  jsonHeaderView.setUint32(4, 0x4e4f534a, true);
  const binHeader = new ArrayBuffer(8);
  const binHeaderView = new DataView(binHeader);
  binHeaderView.setUint32(0, bin.byteLength, true);
  binHeaderView.setUint32(4, 0x004e4942, true);
  return Buffer.concat([Buffer.from(header), Buffer.from(jsonHeader), Buffer.from(json), Buffer.from(binHeader), Buffer.from(bin)]);
}

function toArrayBuffer(buffer: Buffer) {
  // Copy into an owned ArrayBuffer so Three.js' loader type stays compatible
  // with projects compiled using SharedArrayBuffer-aware TypeScript libs.
  return new Uint8Array(buffer).slice().buffer;
}

function compactPositions(positions: Float32Array, remap: Uint32Array) {
  let highest = 0;
  for (const value of remap) highest = Math.max(highest, value);
  const uniqueCount = highest + 1;
  const compact = new Float32Array(uniqueCount * 3);
  for (let source = 0; source < remap.length; source += 1) {
    const target = remap[source] * 3;
    compact[target] = positions[source * 3];
    compact[target + 1] = positions[source * 3 + 1];
    compact[target + 2] = positions[source * 3 + 2];
  }
  return compact;
}

function computeNormals(positions: Float32Array, indices: Uint32Array) {
  const normals = new Float32Array(positions.length);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset] * 3;
    const b = indices[offset + 1] * 3;
    const c = indices[offset + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const vertex of [a, b, c]) {
      normals[vertex] += nx;
      normals[vertex + 1] += ny;
      normals[vertex + 2] += nz;
    }
  }
  for (let offset = 0; offset < normals.length; offset += 3) {
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
    normals[offset] /= length;
    normals[offset + 1] /= length;
    normals[offset + 2] /= length;
  }
  return normals;
}

export async function createGiftPreviewGlb(source: Buffer, format: string) {
  if (format.toLowerCase() !== 'stl' || source.byteLength === 0 || source.byteLength > MAX_SOURCE_BYTES) return null;
  await MeshoptSimplifier.ready;
  const geometry = new STLLoader().parse(toArrayBuffer(source));
  const sourcePositions = geometry.getAttribute('position').array as Float32Array;
  if (sourcePositions.length < 9 || sourcePositions.length % 9 !== 0) throw new Error('The source STL does not contain triangle geometry.');
  const remap = MeshoptSimplifier.generatePositionRemap(sourcePositions, 3);
  const positions = compactPositions(sourcePositions, remap);
  let indices = remap;
  const targetIndexCount = Math.min(indices.length, Math.floor(TARGET_TRIANGLES) * 3);
  if (indices.length > targetIndexCount) {
    try {
      [indices] = MeshoptSimplifier.simplify(indices, positions, 3, targetIndexCount - (targetIndexCount % 3), 0.02, ['LockBorder']);
    } catch {
      [indices] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, targetIndexCount - (targetIndexCount % 3), 0.02);
    }
  }
  const [vertexRemap, vertexCount] = MeshoptSimplifier.compactMesh(indices);
  const compactedPositions = new Float32Array(vertexCount * 3);
  for (let old = 0; old < positions.length / 3; old += 1) {
    const next = vertexRemap[old];
    if (next === 0xffffffff || next === undefined) continue;
    compactedPositions[next * 3] = positions[old * 3];
    compactedPositions[next * 3 + 1] = positions[old * 3 + 1];
    compactedPositions[next * 3 + 2] = positions[old * 3 + 2];
  }
  const normals = computeNormals(compactedPositions, indices);
  geometry.dispose();
  return binaryGlb(compactedPositions, normals, indices);
}
