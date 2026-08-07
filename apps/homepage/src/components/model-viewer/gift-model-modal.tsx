'use client';

import { Download, LoaderCircle, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as THREE from 'three';
import { GiftModelViewer } from './gift-model-viewer';
import { disposeObjectResources } from '@/lib/model/model-scene';
import { measureGiftModel } from '@/lib/model/model-measure';
import { parseGiftModelBuffer } from '@/lib/model/parse-model';
import { createScaledStlBlob } from '@/lib/model/export-scaled-stl';
import type { GiftModelMeasurement } from '@/lib/model/model-types';

export type GeneratedGiftModel = {
  jobId: string;
  modelUrl: string;
  modelType: 'stl' | 'glb' | 'gltf';
  fileName?: string;
  previewImageUrl?: string;
  draftRequestId?: number;
  modelAssetId?: number;
  previewAssetId?: number;
  previewModelAssetId?: number;
  previewModelUrl?: string;
  previewModelType?: 'glb' | 'gltf';
};

const modalCopy = {
  zh: {
    title: '白膜 3D 模型预览', downloading: '正在加载模型', parsing: '正在本机解析模型', ready: '已完成本机解析', failed: '模型解析失败，请下载后检查。', previewLoaded: '预览模型已加载', sourceLoading: '源模型', sourceParsing: '正在解析源模型', sourceReady: '高质量模型已加载', sourceFailed: '预览模型已加载',
    close: '关闭', download: '下载 STL 模型', fileName: '文件名', fileSize: '文件大小', dimensions: '长 × 宽 × 高', volume: '体积', surfaceArea: '表面积', triangles: '三角面片',
    scale: '等比缩放', saveScale: '保存缩放', savingScale: '保存中…', scaleFailed: '缩放保存失败，请重试。', saveBeforeDownload: '请先保存当前缩放比例', scaleInvalid: '请输入 10–99999 的整数',
    lightFixed: '固定侧光', lightFollow: '跟随视角光', lightFixedShort: '固定光', lightFollowShort: '跟随光', showGrid: '显示网格', hideGrid: '隐藏网格', gridOn: '网格开', gridOff: '网格关', rotatePan: '旋转/平移', rotate: '旋转', pan: '平移', resetView: '重置视角',
  },
  en: {
    title: 'White 3D model preview', downloading: 'Loading model', parsing: 'Parsing model locally', ready: 'Local parsing complete', failed: 'Model parsing failed. Download the file to inspect it.', previewLoaded: 'Preview loaded', sourceLoading: 'Source model', sourceParsing: 'Parsing source model', sourceReady: 'High-quality model loaded', sourceFailed: 'Preview loaded',
    close: 'Close', download: 'Download STL model', fileName: 'File Name', fileSize: 'File Size', dimensions: 'L × W × H', volume: 'Volume', surfaceArea: 'Surface Area', triangles: 'Triangles',
    scale: 'Uniform scale', saveScale: 'Save scale', savingScale: 'Saving…', scaleFailed: 'Unable to save the scaled STL. Please retry.', saveBeforeDownload: 'Save the current scale before downloading', scaleInvalid: 'Enter an integer from 10 to 99999',
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

// Keep one in-flight/completed buffer per exact model URL so the library card,
// request thumbnail, and AI result preview can share the same model download.
const modelBufferCache = new Map<string, Promise<ArrayBuffer>>();
const persistentPreviewDatabase = 'unionam-gift-model-preview-v1';
const persistentPreviewStore = 'buffers';

function openPreviewDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(persistentPreviewDatabase, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(persistentPreviewStore)) request.result.createObjectStore(persistentPreviewStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersistentPreview(key: string) {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const database = await openPreviewDatabase();
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const transaction = database.transaction(persistentPreviewStore, 'readonly');
      const request = transaction.objectStore(persistentPreviewStore).get(key);
      request.onsuccess = () => resolve(request.result instanceof ArrayBuffer ? request.result : null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  } catch {
    return null;
  }
}

async function writePersistentPreview(key: string, buffer: ArrayBuffer) {
  if (typeof indexedDB === 'undefined' || buffer.byteLength > 30 * 1024 * 1024) return;
  try {
    const database = await openPreviewDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(persistentPreviewStore, 'readwrite');
      transaction.objectStore(persistentPreviewStore).put(buffer, key);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Browser storage may be disabled or full. HTTP loading remains available.
  }
}

function loadModelBuffer(modelUrl: string, signal: AbortSignal, onProgress: (progress: DownloadProgress) => void, persistent = false) {
  const isStaticModel = modelUrl.startsWith('/gift-models/');
  const cachedBuffer = modelBufferCache.get(modelUrl);
  if (cachedBuffer) {
    return cachedBuffer.then((buffer) => {
      onProgress({ loaded: buffer.byteLength, total: buffer.byteLength });
      return buffer;
    });
  }

  const request = (async () => {
    if (persistent) {
      const stored = await readPersistentPreview(modelUrl);
      if (stored) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        onProgress({ loaded: stored.byteLength, total: stored.byteLength });
        return stored;
      }
    }
    const response = await fetch(modelUrl, {
      credentials: 'same-origin',
      cache: isStaticModel || persistent ? 'force-cache' : 'no-store',
      signal,
    });
    if (!response.ok) throw new Error('Unable to load model.');
    const buffer = await readResponseBuffer(response, onProgress);
    if (persistent) void writePersistentPreview(modelUrl, buffer.slice(0));
    return buffer;
  })();

  modelBufferCache.set(modelUrl, request);
  request.catch(() => {
    if (modelBufferCache.get(modelUrl) === request) modelBufferCache.delete(modelUrl);
  });
  return request;
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
  const [sourcePhase, setSourcePhase] = useState<'idle' | 'downloading' | 'parsing' | 'ready' | 'failed'>('idle');
  const [sourceProgress, setSourceProgress] = useState<DownloadProgress>({ loaded: 0, total: null });
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null);
  const [scalePercent, setScalePercent] = useState(100);
  const [scaleInput, setScaleInput] = useState('100');
  const [scaleInputError, setScaleInputError] = useState(false);
  const [savedScalePercent, setSavedScalePercent] = useState(100);
  const [scaledDownloadUrl, setScaledDownloadUrl] = useState<string | null>(null);
  const [scaleSaving, setScaleSaving] = useState(false);
  const [scaleError, setScaleError] = useState(false);
  const scaledDownloadUrlRef = useRef<string | null>(null);

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
    const activeObjects: THREE.Object3D[] = [];
    const viewerModelUrl = model.previewModelUrl || model.modelUrl;
    const viewerModelType = model.previewModelType || model.modelType;
    const usingLightweightPreview = viewerModelUrl !== model.modelUrl;
    setStatus('loading');
    setLoadPhase('downloading');
    setDownloadProgress({ loaded: 0, total: null });
    setSourcePhase('idle');
    setSourceProgress({ loaded: 0, total: null });
    setFileSize(null);
    setMeasurement(null);
    setObject(null);
    setSourceBuffer(null);
    setScalePercent(100);
    setScaleInput('100');
    setScaleInputError(false);
    setSavedScalePercent(100);
    setScaleError(false);
    if (scaledDownloadUrlRef.current) URL.revokeObjectURL(scaledDownloadUrlRef.current);
    scaledDownloadUrlRef.current = null;
    setScaledDownloadUrl(null);
    void loadModelBuffer(viewerModelUrl, controller.signal, setDownloadProgress, usingLightweightPreview || viewerModelUrl.startsWith('/gift-models/'))
      .then(async (buffer) => {
        setFileSize(buffer.byteLength);
        if (!usingLightweightPreview) setSourceBuffer(buffer);
        setLoadPhase('parsing');
        const parsed = await parseGiftModelBuffer(buffer, viewerModelType);
        if (controller.signal.aborted) {
          disposeObjectResources(parsed.object);
          return;
        }
        activeObjects.push(parsed.object);
        setObject(parsed.object);
        setMeasurement(measureGiftModel(parsed.object));
        setStatus('ready');

        // Render the lightweight preview first, then load and replace it with
        // the original high-quality source model in the background.
        if (usingLightweightPreview) {
          setSourcePhase('downloading');
          setSourceProgress({ loaded: 0, total: null });
          void loadModelBuffer(model.modelUrl, controller.signal, setSourceProgress)
            .then(async (sourceBufferValue) => {
              if (controller.signal.aborted) return;
              setSourcePhase('parsing');
              const sourceParsed = await parseGiftModelBuffer(sourceBufferValue, model.modelType);
              if (controller.signal.aborted) {
                disposeObjectResources(sourceParsed.object);
                return;
              }
              const previousObject = activeObjects.pop();
              if (previousObject) disposeObjectResources(previousObject);
              activeObjects.push(sourceParsed.object);
              setSourceBuffer(sourceBufferValue);
              setFileSize(sourceBufferValue.byteLength);
              setObject(sourceParsed.object);
              setMeasurement(measureGiftModel(sourceParsed.object));
              setSourcePhase('ready');
            })
            .catch((sourceError) => {
              if (sourceError instanceof DOMException && sourceError.name === 'AbortError') return;
              setSourcePhase('failed');
            });
        } else {
          setSourcePhase('ready');
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('failed');
      });
    return () => {
      controller.abort();
      for (const activeObject of activeObjects) disposeObjectResources(activeObject);
      activeObjects.length = 0;
    };
  }, [model]);

  useEffect(() => () => {
    if (scaledDownloadUrlRef.current) URL.revokeObjectURL(scaledDownloadUrlRef.current);
  }, []);

  function isValidScaleInput(value: string) {
    if (!/^\d+$/.test(value)) return false;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 10 && parsed <= 99999;
  }

  function commitScaleInput(value = scaleInput) {
    if (!isValidScaleInput(value)) {
      setScaleInputError(true);
      return;
    }
    const parsed = Number(value);
    setScalePercent(parsed);
    setScaleInput(String(parsed));
    setScaleInputError(false);
  }

  async function saveScale() {
    if (status !== 'ready' || scaleSaving) return;
    setScaleSaving(true);
    setScaleError(false);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 30));
      let nextUrl: string | null = null;
      if (scalePercent !== 100) {
        let originalBuffer = sourceBuffer;
        let originalObject = object;
        let temporaryObject: THREE.Object3D | null = null;
        if (!originalBuffer || !originalObject) {
          originalBuffer = await loadModelBuffer(model.modelUrl, new AbortController().signal, () => undefined);
          const parsed = await parseGiftModelBuffer(originalBuffer, model.modelType);
          temporaryObject = parsed.object;
          originalObject = parsed.object;
        }
        if (!originalObject) throw new Error('Original model is unavailable.');
        const blob = createScaledStlBlob({ buffer: originalBuffer, object: originalObject, format: model.modelType, scale: scalePercent / 100 });
        if (temporaryObject) disposeObjectResources(temporaryObject);
        nextUrl = URL.createObjectURL(blob);
      }
      if (scaledDownloadUrlRef.current) URL.revokeObjectURL(scaledDownloadUrlRef.current);
      scaledDownloadUrlRef.current = nextUrl;
      setScaledDownloadUrl(nextUrl);
      setSavedScalePercent(scalePercent);
    } catch {
      setScaleError(true);
    } finally {
      setScaleSaving(false);
    }
  }

  if (!mounted) return null;

  const downloadPercent = downloadProgress.total
    ? Math.min(100, Math.round((downloadProgress.loaded / downloadProgress.total) * 100))
    : null;
  const loadingLabel = loadPhase === 'downloading' ? labels.downloading : labels.parsing;
  const displayedFileSize = fileSize ?? downloadProgress.total;
  const scale = scalePercent / 100;
  const scaledMeasurement = measurement ? {
    dimensionsMm: {
      x: measurement.dimensionsMm.x * scale,
      y: measurement.dimensionsMm.y * scale,
      z: measurement.dimensionsMm.z * scale,
    },
    volumeCm3: measurement.volumeCm3 === null ? null : measurement.volumeCm3 * scale ** 3,
    surfaceAreaMm2: measurement.surfaceAreaMm2 === null ? null : measurement.surfaceAreaMm2 * scale ** 2,
    triangleCount: measurement.triangleCount,
  } : null;
  const scalePending = scalePercent !== savedScalePercent;
  const downloadUrl = scaledDownloadUrl || model.modelUrl;
  const downloadReady = status === 'ready' && Boolean(downloadUrl);
  const stlFileName = (model.fileName || 'unionam-gift.stl').replace(/\.[^.]+$/, '.stl');
  const downloadName = scalePercent === 100 ? stlFileName : stlFileName.replace(/\.stl$/i, `-${scalePercent}pct.stl`);
  const previewImageUrl = model.previewImageUrl || (model.previewAssetId ? `/api/gift/assets/${model.previewAssetId}` : null);
  const usingLightweightPreview = Boolean(model.previewModelUrl && model.previewModelUrl !== model.modelUrl);
  const sourcePercent = sourceProgress.total
    ? Math.min(100, Math.round((sourceProgress.loaded / sourceProgress.total) * 100))
    : null;
  const sourceStatusText = !usingLightweightPreview
    ? (status === 'ready' ? labels.sourceReady : loadingLabel)
    : sourcePhase === 'ready'
      ? labels.sourceReady
      : sourcePhase === 'parsing'
        ? labels.sourceParsing
        : sourcePhase === 'failed'
          ? labels.sourceFailed
          : `${labels.previewLoaded} · ${labels.sourceLoading}${sourcePercent !== null ? ` ${sourcePercent}%` : ''}`;
  const sourceStatusActive = usingLightweightPreview && sourcePhase !== 'ready' && sourcePhase !== 'failed';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-sm md:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={labels.title} className="flex aspect-square w-[min(94vw,88dvh,960px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative z-10 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <strong className="truncate text-sm font-black text-slate-950">{stlFileName}</strong>
            <span className="shrink-0 text-[11px] font-bold text-slate-400">{labels.fileSize}：{formatFileSize(displayedFileSize)}</span>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className={`hidden min-w-0 items-center gap-1.5 text-[10px] font-medium sm:flex ${sourceStatusActive ? 'text-slate-400' : 'text-slate-300'}`} aria-live="polite" title={sourceStatusText}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sourceStatusActive ? 'animate-pulse bg-slate-300' : sourcePhase === 'failed' ? 'bg-slate-300' : 'bg-emerald-300'}`} />
              <span className="max-w-52 truncate">{sourceStatusText}</span>
            </div>
            <a href={downloadReady && !scalePending ? downloadUrl : undefined} onClick={(event) => { if (!downloadReady || scalePending) event.preventDefault(); }} download={downloadName} title={scalePending ? labels.saveBeforeDownload : labels.download} aria-disabled={!downloadReady || scalePending} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-black text-white transition ${!downloadReady || scalePending ? 'cursor-not-allowed bg-slate-300' : 'bg-[#0b4f9c] hover:bg-[#083f7e]'}`}><Download className="h-3.5 w-3.5" />{labels.download}</a>
          </div>
          <button type="button" onClick={onClose} title={labels.close} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-b-xl bg-white">
          <div className="relative min-h-0 flex-1 bg-[linear-gradient(180deg,#f8fafc,#eef4f7)]">
            {object ? <GiftModelViewer object={object} color="#cdeef6" labels={labels} /> : previewImageUrl ? <div className="absolute inset-0 grid place-items-center p-6"><img src={previewImageUrl} alt={labels.title} className="h-full w-full object-contain" /></div> : null}
            {status !== 'ready' ? <div className="absolute inset-0 grid place-items-center p-4"><div className={`w-full max-w-sm rounded-lg border bg-white/95 px-5 py-4 text-sm font-bold shadow-sm ${status === 'failed' ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-700'}`}>{status === 'loading' ? <><div className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-cyan-700" /><span>{loadingLabel}{loadPhase === 'downloading' && downloadPercent !== null ? ` ${downloadPercent}%` : ''}</span></div>{loadPhase === 'downloading' ? <><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-cyan-600 transition-[width] duration-150" style={{ width: `${downloadPercent ?? 0}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{downloadPercent !== null ? `${downloadPercent}%` : '--%'}</span><span>{formatFileSize(downloadProgress.loaded)} / {formatFileSize(downloadProgress.total)}</span></div></> : <div className="mt-2 text-xs text-slate-500">{formatFileSize(fileSize)}</div>}</> : labels.failed}</div></div> : null}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-600">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 font-bold"><span className="text-slate-400">{labels.dimensions}：</span><strong className="whitespace-nowrap text-slate-900">{scaledMeasurement ? `${formatNumber(scaledMeasurement.dimensionsMm.x, language)} × ${formatNumber(scaledMeasurement.dimensionsMm.y, language)} × ${formatNumber(scaledMeasurement.dimensionsMm.z, language)} mm` : '--'}</strong></div>
              <div className="flex shrink-0 items-center gap-2">
                <label className={`inline-flex h-8 shrink-0 items-center rounded-md border bg-slate-50 pl-2 font-bold ${scaleInputError ? 'border-red-300 text-red-600' : 'border-slate-200 text-slate-500'}`}><span className="mr-2 whitespace-nowrap">{labels.scale}</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={scaleInput} disabled={status !== 'ready' || scaleSaving} onFocus={(event) => event.currentTarget.select()} onBlur={() => commitScaleInput()} onKeyDown={(event) => { if (event.key === 'Enter') commitScaleInput(); }} onChange={(event) => { const nextValue = event.target.value.replace(/\D/g, ''); setScaleInput(nextValue); setScaleInputError(false); if (isValidScaleInput(nextValue)) setScalePercent(Number(nextValue)); }} aria-invalid={scaleInputError} aria-label={`${labels.scale} %`} className="h-full w-20 border-l border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-black text-slate-900 outline-none focus:bg-cyan-50" /><span className="px-2">%</span></label>
                <button type="button" disabled={status !== 'ready' || scaleSaving || !scalePending || !isValidScaleInput(scaleInput)} onClick={() => void saveScale()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#0b4f9c] px-2.5 font-black text-white transition hover:bg-[#083f7e] disabled:cursor-not-allowed disabled:opacity-40">{scaleSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{scaleSaving ? labels.savingScale : labels.saveScale}</button>
              </div>
            </div>
            {scaleInputError ? <div className="mt-1 text-right text-[10px] font-bold text-red-600">{labels.scaleInvalid}</div> : null}
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
              <div className="min-w-0"><span className="text-slate-400">{labels.volume}：</span><strong className="whitespace-nowrap text-slate-900">{scaledMeasurement?.volumeCm3 !== null && scaledMeasurement?.volumeCm3 !== undefined ? `${formatNumber(scaledMeasurement.volumeCm3, language, 2)} cm³` : '--'}</strong></div>
              <div className="min-w-0 text-center"><span className="text-slate-400">{labels.surfaceArea}：</span><strong className="whitespace-nowrap text-slate-900">{scaledMeasurement?.surfaceAreaMm2 !== null && scaledMeasurement?.surfaceAreaMm2 !== undefined ? `${formatNumber(scaledMeasurement.surfaceAreaMm2, language, 0)} mm²` : '--'}</strong></div>
              <div className="min-w-0 text-right"><span className="text-slate-400">{labels.triangles}：</span><strong className="whitespace-nowrap text-slate-900">{scaledMeasurement ? scaledMeasurement.triangleCount.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '--'}</strong></div>
            </div>
            {scaleError ? <div className="mt-1 text-[10px] font-bold text-red-600">{labels.scaleFailed}</div> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
