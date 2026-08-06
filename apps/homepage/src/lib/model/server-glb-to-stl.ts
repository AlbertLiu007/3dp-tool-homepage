import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
const MAX_TRIANGLES = 1_500_000;
const DEFAULT_LONGEST_SIDE_MM = 100;
const CACHE_VERSION = 'glb-stl-v1';
const CACHE_DIRECTORY = join(tmpdir(), 'unionam-gift-models');

type StlArtifact = {
  path: string;
  size: number;
  triangleCount: number;
};

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftStlConversions: Map<string, Promise<StlArtifact>> | undefined;
}

function targetLongestSideMm() {
  const configured = Number(process.env.GIFT_3D_DEFAULT_LONGEST_MM || DEFAULT_LONGEST_SIDE_MM);
  return Number.isFinite(configured) && configured >= 10 && configured <= 1000 ? configured : DEFAULT_LONGEST_SIDE_MM;
}

function cachedArtifactPath(cacheKey: string) {
  const digest = createHash('sha256')
    .update(`${CACHE_VERSION}:${targetLongestSideMm()}:${cacheKey}`)
    .digest('hex');
  return join(CACHE_DIRECTORY, `${digest}.stl`);
}

function triangleCountFromSize(size: number) {
  if (size < 84 || (size - 84) % 50 !== 0) throw new Error('The cached STL file is invalid.');
  return (size - 84) / 50;
}

async function existingArtifact(path: string): Promise<StlArtifact | null> {
  try {
    const file = await stat(path);
    const triangleCount = triangleCountFromSize(file.size);
    if (triangleCount < 1 || triangleCount > MAX_TRIANGLES) return null;
    return { path, size: file.size, triangleCount };
  } catch {
    return null;
  }
}

async function parseGlb(buffer: ArrayBuffer) {
  await MeshoptDecoder.ready;
  return new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parse(buffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function preparePrintableScene(scene: THREE.Group) {
  scene.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(scene);
  if (initialBounds.isEmpty()) throw new Error('The generated GLB does not contain printable geometry.');

  // glTF uses Y-up while slicers conventionally use Z-up.
  scene.rotation.x += Math.PI / 2;
  scene.updateMatrixWorld(true);

  const rotatedBounds = new THREE.Box3().setFromObject(scene);
  const size = rotatedBounds.getSize(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longestSide) || longestSide <= 0) throw new Error('The generated GLB has invalid dimensions.');

  const scale = targetLongestSideMm() / longestSide;
  scene.scale.multiplyScalar(scale);
  scene.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(scene);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.y -= center.y;
  scene.position.z -= scaledBounds.min.z;
  scene.updateMatrixWorld(true);
}

function exportBinaryStl(scene: THREE.Group) {
  const exported = new STLExporter().parse(scene, { binary: true });
  const bytes = Buffer.from(exported.buffer, exported.byteOffset, exported.byteLength);
  const triangleCount = bytes.readUInt32LE(80);
  if (triangleCount < 1) throw new Error('The generated model has no triangle faces.');
  if (triangleCount > MAX_TRIANGLES) throw new Error(`The generated model exceeds the ${MAX_TRIANGLES.toLocaleString('en-US')} face limit.`);
  if (bytes.byteLength !== 84 + triangleCount * 50) throw new Error('The generated STL is incomplete.');
  return { bytes, triangleCount };
}

async function downloadGlb(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Unable to download the generated GLB (HTTP ${response.status}).`);
  const advertisedSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertisedSize) && advertisedSize > MAX_SOURCE_BYTES) throw new Error('The generated GLB exceeds the 200MB conversion limit.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SOURCE_BYTES) throw new Error('The generated GLB has an invalid file size.');
  return buffer;
}

async function convertAndCache(cacheKey: string, glbUrl: string): Promise<StlArtifact> {
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  const path = cachedArtifactPath(cacheKey);
  const cached = await existingArtifact(path);
  if (cached) return cached;

  const glb = await downloadGlb(glbUrl);
  const scene = await parseGlb(glb);
  try {
    preparePrintableScene(scene);
    const { bytes, triangleCount } = exportBinaryStl(scene);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, path);
    return { path, size: bytes.byteLength, triangleCount };
  } finally {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}

export async function ensureServerStl(cacheKey: string, glbUrl: string) {
  const path = cachedArtifactPath(cacheKey);
  const cached = await existingArtifact(path);
  if (cached) return cached;

  const conversions = globalThis.unionamGiftStlConversions ??= new Map<string, Promise<StlArtifact>>();
  const active = conversions.get(path);
  if (active) return active;

  const conversion = convertAndCache(cacheKey, glbUrl).finally(() => conversions.delete(path));
  conversions.set(path, conversion);
  return conversion;
}

export async function readServerStl(artifact: StlArtifact) {
  const bytes = await readFile(artifact.path);
  if (bytes.byteLength !== artifact.size) throw new Error('The cached STL file changed unexpectedly.');
  return bytes;
}
