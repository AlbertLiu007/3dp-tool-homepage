'use client';

import { Download, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as THREE from 'three';
import { GiftModelViewer } from './gift-model-viewer';
import { disposeObjectResources } from '@/lib/model/model-scene';
import { measureGiftModel } from '@/lib/model/model-measure';
import { parseGiftModelBuffer } from '@/lib/model/parse-model';
import type { GiftModelMeasurement } from '@/lib/model/model-types';

export type GeneratedGiftModel = {
  jobId: string;
  modelUrl: string;
  modelType: 'stl' | 'glb' | 'gltf';
  previewImageUrl?: string;
  draftRequestId?: number;
  modelAssetId?: number;
  previewAssetId?: number;
};

const modalCopy = {
  zh: {
    title: '白膜 3D 模型预览', downloading: '正在加载模型', parsing: '正在本机解析模型', ready: '已完成本机解析', failed: '模型解析失败，请下载后检查。',
    close: '关闭', download: '下载 STL 模型', fileName: '文件名', fileSize: '文件大小', dimensions: '长 × 宽 × 高', volume: '体积', surfaceArea: '表面积', triangles: '三角面片',
    lightFixed: '固定侧光', lightFollow: '跟随视角光', lightFixedShort: '固定光', lightFollowShort: '跟随光', showGrid: '显示网格', hideGrid: '隐藏网格', gridOn: '网格开', gridOff: '网格关', rotatePan: '旋转/平移', rotate: '旋转', pan: '平移', resetView: '重置视角',
  },
  en: {
    title: 'White 3D model preview', downloading: 'Loading model', parsing: 'Parsing model locally', ready: 'Local parsing complete', failed: 'Model parsing failed. Download the file to inspect it.',
    close: 'Close', download: 'Download STL model', fileName: 'File Name', fileSize: 'File Size', dimensions: 'L × W × H', volume: 'Volume', surfaceArea: 'Surface Area', triangles: 'Triangles',
    lightFixed: 'Fixed side light', lightFollow: 'Camera-following light', lightFixedShort: 'Fixed', lightFollowShort: 'Follow', showGrid: 'Show Grid', hideGrid: 'Hide Grid', gridOn: 'Grid On', gridOff: 'Grid Off', rotatePan: 'Rotate/Pan', rotate: 'Rotate', pan: 'Pan', resetView: 'Reset View',
  },
};

function formatNumber(value: number | null | undefined, language: 'zh' | 'en', digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes < 0 || !Number.isFinite(bytes)) return '--';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

type DownloadProgress = {
  loaded: number;
  total: number | null;
};

async function readResponseBuffer(response: Response, onProgress: (progress: DownloadProgress) => void) {
  const contentLength = Number(response.headers.get('content-length'));
  const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
  onProgress({ loaded: 0, total });

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress({ loaded: buffer.byteLength, total: total ?? buffer.byteLength });
    return buffer;
  }

  const reader = response.body.getReader();
  let target = total ? new Uint8Array(total) : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReportedAt = 0;
  let lastReportedPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    if (target && loaded + value.byteLength <= target.byteLength) {
      target.set(value, loaded);
    } else {
      if (target) {
        chunks.push(target.slice(0, loaded));
        target = null;
      }
      chunks.push(value);
    }
    loaded += value.byteLength;

    const percent = total ? Math.min(100, Math.floor((loaded / total) * 100)) : -1;
    const now = performance.now();
    if (now - lastReportedAt >= 100 || percent !== lastReportedPercent) {
      onProgress({ loaded, total });
      lastReportedAt = now;
      lastReportedPercent = percent;
    }
  }

  onProgress({ loaded, total: total ?? loaded });
  if (target) return loaded === target.byteLength ? target.buffer : target.slice(0, loaded).buffer;

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export function GiftModelModal({ language, model, onClose }: { language: 'zh' | 'en'; model: GeneratedGiftModel; onClose: () => void }) {
  const labels = modalCopy[language];
  const [mounted, setMounted] = useState(false);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [measurement, setMeasurement] = useState<GiftModelMeasurement | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadPhase, setLoadPhase] = useState<'downloading' | 'parsing'>('downloading');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ loaded: 0, total: null });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    let parsedObject: THREE.Object3D | null = null;
    setStatus('loading');
    setLoadPhase('downloading');
    setDownloadProgress({ loaded: 0, total: null });
    setFileSize(null);
    setMeasurement(null);
    setObject(null);
    void fetch(model.modelUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load model.');
        const buffer = await readResponseBuffer(response, setDownloadProgress);
        setFileSize(buffer.byteLength);
        setLoadPhase('parsing');
        const parsed = await parseGiftModelBuffer(buffer, model.modelType);
        parsedObject = parsed.object;
        setObject(parsed.object);
        setMeasurement(measureGiftModel(parsed.object));
        setStatus('ready');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('failed');
      });
    return () => {
      controller.abort();
      if (parsedObject) disposeObjectResources(parsedObject);
    };
  }, [model]);

  if (!mounted) return null;

  const downloadPercent = downloadProgress.total
    ? Math.min(100, Math.round((downloadProgress.loaded / downloadProgress.total) * 100))
    : null;
  const loadingLabel = loadPhase === 'downloading' ? labels.downloading : labels.parsing;
  const displayedFileSize = fileSize ?? downloadProgress.total;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-2 pb-2 pt-[6.5rem] backdrop-blur-sm sm:px-3 sm:pb-3 md:px-6 md:pb-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={labels.title} className="flex h-[calc(100dvh-7rem)] max-h-[900px] w-full max-w-[1180px] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-5"><div><h2 className="text-base font-black text-slate-950">{labels.title}</h2><p className="text-[11px] font-bold text-slate-400">{model.modelType.toUpperCase()} · UnionAM</p></div><button type="button" onClick={onClose} title={labels.close} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button></div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-b-xl border-slate-200 bg-white">
          <div className="relative min-h-[280px] flex-1 shrink border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#eef4f7)] sm:min-h-[320px]">
            {object ? <GiftModelViewer object={object} color="#cdeef6" labels={labels} /> : null}
            {status !== 'ready' ? <div className="absolute inset-0 grid place-items-center p-4"><div className={`w-full max-w-sm rounded-lg border bg-white/95 px-5 py-4 text-sm font-bold shadow-sm ${status === 'failed' ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-700'}`}>{status === 'loading' ? <><div className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-cyan-700" /><span>{loadingLabel}{loadPhase === 'downloading' && downloadPercent !== null ? ` ${downloadPercent}%` : ''}</span></div>{loadPhase === 'downloading' ? <><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-cyan-600 transition-[width] duration-150" style={{ width: `${downloadPercent ?? 0}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{downloadPercent !== null ? `${downloadPercent}%` : '--%'}</span><span>{formatFileSize(downloadProgress.loaded)} / {formatFileSize(downloadProgress.total)}</span></div></> : <div className="mt-2 text-xs text-slate-500">{formatFileSize(fileSize)}</div>}</> : labels.failed}</div></div> : null}
            <div className="absolute left-4 top-4 rounded-md border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">{status === 'loading' ? loadingLabel : status === 'ready' ? labels.ready : labels.failed}</div>
          </div>
          <div className="shrink-0 border-b border-slate-100 px-4 py-3"><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-500">{labels.fileName}</div><div className="mt-1 truncate text-sm font-black text-slate-950">unionam-gift.{model.modelType}</div></div><div className="shrink-0 text-right"><div className="text-xs font-bold text-slate-500">{labels.fileSize}</div><div className="mt-1 text-sm font-black text-slate-950">{formatFileSize(displayedFileSize)}</div></div></div></div>
          <div className="grid shrink-0 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr] xl:p-4"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{labels.dimensions}</div><div className="mt-1.5 text-base font-black xl:text-lg">{measurement ? `${formatNumber(measurement.dimensionsMm.x, language)} × ${formatNumber(measurement.dimensionsMm.y, language)} × ${formatNumber(measurement.dimensionsMm.z, language)} mm` : '--'}</div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{labels.volume}</div><div className="mt-1.5 text-base font-black xl:text-lg">{measurement?.volumeCm3 ? `${formatNumber(measurement.volumeCm3, language, 2)} cm³` : '--'}</div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{labels.surfaceArea}</div><div className="mt-1.5 text-base font-black xl:text-lg">{measurement?.surfaceAreaMm2 ? `${formatNumber(measurement.surfaceAreaMm2, language, 0)} mm²` : '--'}</div></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{labels.triangles}</div><div className="mt-1.5 text-base font-black xl:text-lg">{measurement ? measurement.triangleCount.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '--'}</div></div></div>
          <div className="flex shrink-0 justify-end border-t border-slate-100 p-3 md:p-4"><a href={model.modelUrl} download={`unionam-gift.${model.modelType}`} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0b4f9c] px-4 text-sm font-black text-white transition hover:bg-[#083f7e]"><Download className="h-4 w-4" />{labels.download}</a></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
