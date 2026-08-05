'use client';

import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import type { GiftViewerLabels } from './gift-model-viewer-client';

const DynamicGiftModelViewer = dynamic(
  () => import('./gift-model-viewer-client').then((module) => module.GiftModelViewerClient),
  { ssr: false, loading: () => <div className="absolute inset-0" /> },
);

export function GiftModelViewer(props: { object: THREE.Object3D | null; color?: string; labels: GiftViewerLabels }) {
  return <DynamicGiftModelViewer {...props} />;
}
