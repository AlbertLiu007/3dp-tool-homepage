import * as THREE from 'three';
import type { GiftModelMeasurement } from './model-types';

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const volumeCross = new THREE.Vector3();
const areaEdgeA = new THREE.Vector3();
const areaEdgeB = new THREE.Vector3();

function readTriangleVertex(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, vertexIndex: number, matrix: THREE.Matrix4, target: THREE.Vector3) {
  return target.fromBufferAttribute(position, vertexIndex).applyMatrix4(matrix);
}

function measureGeometry(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) return { triangles: 0, volume: 0, surfaceArea: 0 };
  const matrix = mesh.matrixWorld;
  const index = geometry.index;
  let triangles = 0;
  let volume = 0;
  let surfaceArea = 0;
  const addTriangle = (i0: number, i1: number, i2: number) => {
    readTriangleVertex(position, i0, matrix, a);
    readTriangleVertex(position, i1, matrix, b);
    readTriangleVertex(position, i2, matrix, c);
    surfaceArea += areaEdgeA.copy(b).sub(a).cross(areaEdgeB.copy(c).sub(a)).length() / 2;
    volume += a.dot(volumeCross.copy(b).cross(c)) / 6;
    triangles += 1;
  };
  if (index) {
    for (let indexOffset = 0; indexOffset < index.count; indexOffset += 3) addTriangle(index.getX(indexOffset), index.getX(indexOffset + 1), index.getX(indexOffset + 2));
  } else {
    for (let positionOffset = 0; positionOffset < position.count; positionOffset += 3) addTriangle(positionOffset, positionOffset + 1, positionOffset + 2);
  }
  return { triangles, volume, surfaceArea };
}

export function measureGiftModel(object: THREE.Object3D): GiftModelMeasurement {
  object.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(object).getSize(size);
  let triangleCount = 0;
  let signedVolume = 0;
  let surfaceAreaMm2 = 0;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const measured = measureGeometry(child);
    triangleCount += measured.triangles;
    signedVolume += measured.volume;
    surfaceAreaMm2 += measured.surfaceArea;
  });
  const volumeMm3 = Math.abs(signedVolume);
  return {
    dimensionsMm: { x: size.x, y: size.y, z: size.z },
    volumeCm3: Number.isFinite(volumeMm3) && volumeMm3 > 0 ? volumeMm3 / 1000 : null,
    surfaceAreaMm2: Number.isFinite(surfaceAreaMm2) && surfaceAreaMm2 > 0 ? surfaceAreaMm2 : null,
    triangleCount: Math.round(triangleCount),
  };
}
