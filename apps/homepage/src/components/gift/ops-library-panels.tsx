'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, ChevronRight, Download, Edit3, Eye, FileBox, FolderTree, LoaderCircle, PackageCheck, Plus, Trash2, UploadCloud, X } from 'lucide-react';

export type OpsModelAsset = {
  assetId: number; role: string; version: number; current: boolean; filename: string; extension: string | null;
  size: number | null; status: string; uploaderName: string | null; createdAt: string;
};

export type OpsGiftModel = {
  id: number; slug: string; title_zh: string; title_en?: string | null; description_zh?: string | null; description_en?: string | null;
  category: string; use_case?: string | null; publication_status: string; source_type: string; updated_at: string;
  tags: string[]; supported_finishes: string[]; model_asset_id: number | null; preview_asset_id: number | null; assets?: OpsModelAsset[];
};

export type OpsPrintRequest = {
  id: number; request_no: string; title: string; requester_name: string; request_type: string; quantity: number;
  request_status: string; requested_completion_date: string | null; finish_type: string; created_at: string;
};

type Category = { id: number; slug: string; nameZh: string; nameEn: string | null; descriptionZh: string | null; sortOrder: number; status: string; modelCount: number };
type RequestDetail = {
  request: {
    id: number; requestNo: string; requesterName: string | null; requestType: string; modelTitle: string | null; title: string;
    customerCompany: string | null; businessScene: string | null; quantity: number; finishType: string; paintColor: string | null;
    requestedCompletionDate: string | null; pickupLocation: string | null; requestNotes: string | null; priority: string; status: string;
    assigneeEmployeeId: number | null; assigneeName: string | null; productionBatchNo: string | null; scheduledStartAt: string | null; scheduledCompleteAt: string | null;
    deliveryMethod: string | null; deliveryRecipient: string | null; deliveryNotes: string | null; createdAt: string;
  };
  events: { id: number; type: string; fromStatus: string | null; toStatus: string | null; comment: string | null; actorName: string; createdAt: string }[];
  attachments: { id: number; assetId: number; role: string; filename: string; size: number | null; visibleToRequester: boolean; uploaderName: string | null; createdAt: string }[];
};

const field = 'mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500';
const area = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500';
const requestLabels: Record<string, string> = { submitted: '待审核', reviewing: '审核中', approved: '已批准', rejected: '已拒绝', queued: '已排产', printing: '打印中', ready: '待领取', completed: '已完成', cancelled: '已取消' };
const nextActions: Record<string, { status: string; label: string }[]> = {
  submitted: [{ status: 'reviewing', label: '开始审核' }, { status: 'rejected', label: '拒绝申请' }],
  reviewing: [{ status: 'approved', label: '批准申请' }, { status: 'rejected', label: '拒绝申请' }],
  approved: [{ status: 'queued', label: '确认排产' }],
  queued: [{ status: 'printing', label: '开始打印' }],
  printing: [{ status: 'ready', label: '标记待领取' }],
  ready: [{ status: 'completed', label: '确认交付完成' }],
};

function formatSize(value: number | null) {
  if (value === null) return '-';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function payload(response: Response) {
  const result = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(result.message || '操作失败');
  return result;
}

export function CompleteModelsPanel({ models, csrfToken, onReload }: { models: OpsGiftModel[]; csrfToken: string; onReload: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<OpsGiftModel | null>(null);
  const [creating, setCreating] = useState(false);
  const [categoryMode, setCategoryMode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ slug: '', titleZh: '', titleEn: '', descriptionZh: '', descriptionEn: '', category: '', useCase: '', tags: '', supportedFinishes: 'paint,bronze' });
  const [categoryForm, setCategoryForm] = useState({ slug: '', nameZh: '', nameEn: '', descriptionZh: '', sortOrder: 100 });

  async function loadCategories() {
    const response = await fetch('/api/gift/ops/categories', { cache: 'no-store' });
    if (response.ok) setCategories(((await response.json()) as { categories: Category[] }).categories);
  }
  useEffect(() => { void loadCategories(); }, []);

  function openCreate() {
    setEditing(null); setCreating(true); setError('');
    setForm({ slug: '', titleZh: '', titleEn: '', descriptionZh: '', descriptionEn: '', category: categories.find((item) => item.status === 'active')?.slug || '', useCase: '', tags: '', supportedFinishes: 'paint,bronze' });
  }
  function openEdit(model: OpsGiftModel) {
    setCreating(false); setEditing(model); setError('');
    setForm({ slug: model.slug, titleZh: model.title_zh, titleEn: model.title_en || '', descriptionZh: model.description_zh || '', descriptionEn: model.description_en || '', category: model.category, useCase: model.use_case || '', tags: model.tags.join(','), supportedFinishes: model.supported_finishes.join(',') });
  }
  async function saveModel() {
    setBusy(true); setError('');
    try {
      const body = { ...form, tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean), supportedFinishes: form.supportedFinishes.split(',').map((item) => item.trim()).filter(Boolean) };
      await payload(await fetch(editing ? `/api/gift/ops/models/${editing.id}` : '/api/gift/ops/models', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify(body) }));
      setEditing(null); setCreating(false); onReload();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : '保存失败'); } finally { setBusy(false); }
  }
  async function setStatus(model: OpsGiftModel, publicationStatus: string) {
    if (!window.confirm(`确认将“${model.title_zh}”设置为 ${publicationStatus}？`)) return;
    try {
      await payload(await fetch(`/api/gift/ops/models/${model.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ publicationStatus }) }));
      onReload();
    } catch (statusError) { window.alert(statusError instanceof Error ? statusError.message : '操作失败'); }
  }
  async function upload(model: OpsGiftModel, kind: string, file?: File) {
    if (!file) return;
    const data = new FormData(); data.set('modelId', String(model.id)); data.set('kind', kind); data.set('file', file);
    try { await payload(await fetch('/api/gift/ops/assets/upload', { method: 'POST', headers: { 'x-unionam-csrf': csrfToken }, body: data })); onReload(); }
    catch (uploadError) { window.alert(uploadError instanceof Error ? uploadError.message : '上传失败'); }
  }
  async function removeAsset(model: OpsGiftModel, asset: OpsModelAsset) {
    if (!window.confirm(`确认删除 ${asset.filename}？历史记录仍会保留。`)) return;
    try { await payload(await fetch(`/api/gift/ops/models/${model.id}/assets/${asset.assetId}`, { method: 'DELETE', headers: { 'x-unionam-csrf': csrfToken } })); onReload(); }
    catch (deleteError) { window.alert(deleteError instanceof Error ? deleteError.message : '删除失败'); }
  }
  async function createCategory() {
    try {
      await payload(await fetch('/api/gift/ops/categories', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify(categoryForm) }));
      setCategoryForm({ slug: '', nameZh: '', nameEn: '', descriptionZh: '', sortOrder: 100 }); await loadCategories();
    } catch (categoryError) { window.alert(categoryError instanceof Error ? categoryError.message : '创建失败'); }
  }
  async function toggleCategory(category: Category) {
    try {
      await payload(await fetch(`/api/gift/ops/categories/${category.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ status: category.status === 'active' ? 'inactive' : 'active' }) }));
      await loadCategories();
    } catch (categoryError) { window.alert(categoryError instanceof Error ? categoryError.message : '更新失败'); }
  }
  async function editCategory(category: Category) {
    const nameZh = window.prompt('分类中文名', category.nameZh);
    if (nameZh === null || !nameZh.trim()) return;
    const nameEn = window.prompt('分类英文名', category.nameEn || '') ?? category.nameEn;
    const sortText = window.prompt('排序数字（越小越靠前）', String(category.sortOrder));
    if (sortText === null || !Number.isInteger(Number(sortText))) return window.alert('排序必须为整数');
    try {
      await payload(await fetch(`/api/gift/ops/categories/${category.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ nameZh, nameEn, sortOrder: Number(sortText) }) }));
      await loadCategories();
    } catch (categoryError) { window.alert(categoryError instanceof Error ? categoryError.message : '更新失败'); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div className="flex gap-2"><button onClick={() => setCategoryMode(false)} className={`rounded-md px-4 py-2 text-xs font-black ${!categoryMode ? 'bg-[#0b4f9c] text-white' : 'border border-slate-200 bg-white'}`}><FileBox className="mr-2 inline h-4 w-4" />模型</button><button onClick={() => setCategoryMode(true)} className={`rounded-md px-4 py-2 text-xs font-black ${categoryMode ? 'bg-[#0b4f9c] text-white' : 'border border-slate-200 bg-white'}`}><FolderTree className="mr-2 inline h-4 w-4" />分类</button></div>{!categoryMode ? <button onClick={openCreate} className="rounded-md bg-[#0b4f9c] px-4 py-2 text-xs font-black text-white"><Plus className="mr-2 inline h-4 w-4" />新增模型</button> : null}</div>
    {categoryMode ? <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-black">新增分类</h3><label className="mt-4 block text-xs font-bold">标识<input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} className={field} placeholder="exhibition" /></label><label className="mt-3 block text-xs font-bold">中文名<input value={categoryForm.nameZh} onChange={(e) => setCategoryForm({ ...categoryForm, nameZh: e.target.value })} className={field} /></label><label className="mt-3 block text-xs font-bold">英文名<input value={categoryForm.nameEn} onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })} className={field} /></label><label className="mt-3 block text-xs font-bold">说明<textarea value={categoryForm.descriptionZh} onChange={(e) => setCategoryForm({ ...categoryForm, descriptionZh: e.target.value })} className={area} rows={3} /></label><button onClick={() => void createCategory()} className="mt-4 rounded-md bg-[#0b4f9c] px-4 py-2 text-xs font-black text-white">创建分类</button></div><div className="rounded-xl border border-slate-200 bg-white p-5"><div className="space-y-3">{categories.map((category) => <div key={category.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-4"><div><div className="font-black">{category.nameZh}<span className="ml-2 font-mono text-xs text-slate-400">{category.slug}</span></div><div className="mt-1 text-xs text-slate-500">{category.modelCount} 个模型 · 排序 {category.sortOrder}</div></div><div className="flex gap-2"><button onClick={() => void editCategory(category)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black">编辑</button><button onClick={() => void toggleCategory(category)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-black">{category.status === 'active' ? '停用' : '启用'}</button></div></div>)}</div></div></div> : null}
    {!categoryMode ? <div className="grid gap-4 xl:grid-cols-2">{models.map((model) => <article key={model.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="grid sm:grid-cols-[180px_1fr]"><div className="grid min-h-44 place-items-center bg-slate-100">{model.preview_asset_id ? <img src={`/api/gift/ops/assets/${model.preview_asset_id}`} alt="" className="h-full max-h-52 w-full object-contain" /> : <FileBox className="h-10 w-10 text-slate-300" />}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-cyan-700">{categories.find((item) => item.slug === model.category)?.nameZh || model.category}</div><h3 className="mt-1 text-lg font-black">{model.title_zh}</h3><div className="mt-1 font-mono text-[11px] text-slate-400">{model.slug}</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black">{model.publication_status}</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => openEdit(model)} className="rounded-md border px-3 py-2 text-xs font-black"><Edit3 className="mr-1 inline h-3.5 w-3.5" />编辑</button><label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-black"><UploadCloud className="mr-1 inline h-3.5 w-3.5" />模型<input type="file" accept=".stl,.obj,.3mf,.glb,.gltf" className="sr-only" onChange={(e) => void upload(model, 'model_file', e.target.files?.[0])} /></label><label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-black"><UploadCloud className="mr-1 inline h-3.5 w-3.5" />缩略图<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void upload(model, 'model_preview', e.target.files?.[0])} /></label></div><div className="mt-3 flex flex-wrap gap-2">{model.publication_status === 'draft' ? <button onClick={() => void setStatus(model, 'review')} className="rounded-md bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">提交审核</button> : null}{model.publication_status !== 'published' ? <button onClick={() => void setStatus(model, 'published')} className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">上架</button> : <button onClick={() => void setStatus(model, 'archived')} className="rounded-md bg-slate-100 px-3 py-2 text-xs font-black"><Archive className="mr-1 inline h-3.5 w-3.5" />下架归档</button>}</div></div></div><div className="border-t border-slate-100 p-4"><div className="mb-2 text-xs font-black text-slate-600">文件版本</div><div className="space-y-2">{(model.assets || []).map((asset) => <div key={asset.assetId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs"><div><span className="font-black">{asset.role === 'model_file' ? '模型' : '缩略图'} v{asset.version}</span><span className="ml-2 text-slate-500">{asset.filename} · {formatSize(asset.size)}</span>{asset.current ? <span className="ml-2 text-emerald-700">当前</span> : null}</div><div className="flex gap-2"><a href={`/api/gift/ops/assets/${asset.assetId}`} target="_blank" rel="noreferrer" className="text-[#0b4f9c]"><Eye className="h-4 w-4" /></a><button onClick={() => void removeAsset(model, asset)} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div></div></article>)}</div> : null}
    {(creating || editing) ? <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-black">{editing ? '编辑模型' : '新增模型'}</h2><button onClick={() => { setEditing(null); setCreating(false); }}><X /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold">Slug<input disabled={Boolean(editing)} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={field} /></label><label className="text-xs font-bold">分类<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>{categories.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.slug}>{item.nameZh}</option>)}</select></label><label className="text-xs font-bold">中文标题<input value={form.titleZh} onChange={(e) => setForm({ ...form, titleZh: e.target.value })} className={field} /></label><label className="text-xs font-bold">英文标题<input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={field} /></label><label className="text-xs font-bold md:col-span-2">中文说明<textarea rows={4} value={form.descriptionZh} onChange={(e) => setForm({ ...form, descriptionZh: e.target.value })} className={area} /></label><label className="text-xs font-bold md:col-span-2">英文说明<textarea rows={3} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className={area} /></label><label className="text-xs font-bold">适用场景<input value={form.useCase} onChange={(e) => setForm({ ...form, useCase: e.target.value })} className={field} /></label><label className="text-xs font-bold">标签（逗号分隔）<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={field} /></label><label className="text-xs font-bold md:col-span-2">支持工艺（paint,bronze,white）<input value={form.supportedFinishes} onChange={(e) => setForm({ ...form, supportedFinishes: e.target.value })} className={field} /></label></div>{error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}<button disabled={busy} onClick={() => void saveModel()} className="mt-5 rounded-md bg-[#0b4f9c] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> : null}保存</button></div></div> : null}
  </div>;
}

export function CompleteRequestsPanel({ requests, csrfToken, onReload }: { requests: OpsPrintRequest[]; csrfToken: string; onReload: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [operators, setOperators] = useState<{ id: number; name: string; role: string }[]>([]);
  const [form, setForm] = useState({ assigneeEmployeeId: '', productionBatchNo: '', scheduledStartAt: '', scheduledCompleteAt: '', deliveryMethod: 'pickup', deliveryRecipient: '', deliveryNotes: '', comment: '' });
  const visible = useMemo(() => requests.filter((item) => (filter === 'all' || item.request_status === filter) && `${item.request_no} ${item.title} ${item.requester_name}`.toLowerCase().includes(search.toLowerCase())), [requests, filter, search]);

  useEffect(() => { fetch('/api/gift/ops/employees?status=approved').then((r) => r.json()).then((data: { employees?: { id: number; name: string; role: string }[] }) => setOperators((data.employees || []).filter((item) => ['operator', 'admin'].includes(item.role)))).catch(() => undefined); }, []);
  async function open(id: number) {
    setSelectedId(id); setLoading(true);
    try {
      const response = await fetch(`/api/gift/ops/requests/${id}`, { cache: 'no-store' });
      const data = await payload(response) as RequestDetail; setDetail(data);
      setForm({ assigneeEmployeeId: data.request.assigneeEmployeeId ? String(data.request.assigneeEmployeeId) : '', productionBatchNo: data.request.productionBatchNo || '', scheduledStartAt: data.request.scheduledStartAt?.slice(0, 16) || '', scheduledCompleteAt: data.request.scheduledCompleteAt?.slice(0, 16) || '', deliveryMethod: data.request.deliveryMethod || 'pickup', deliveryRecipient: data.request.deliveryRecipient || '', deliveryNotes: data.request.deliveryNotes || '', comment: '' });
    } catch (error) { window.alert(error instanceof Error ? error.message : '加载失败'); setSelectedId(null); } finally { setLoading(false); }
  }
  async function update(status: string) {
    if (!detail || !window.confirm(`确认将申请更新为“${requestLabels[status] || status}”？`)) return;
    try {
      await payload(await fetch(`/api/gift/ops/requests/${detail.request.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ ...form, assigneeEmployeeId: form.assigneeEmployeeId ? Number(form.assigneeEmployeeId) : undefined, status }) }));
      await open(detail.request.id); onReload();
    } catch (error) { window.alert(error instanceof Error ? error.message : '更新失败'); }
  }
  async function upload(file?: File, role = 'production', visibleToRequester = true) {
    if (!file || !detail) return;
    const data = new FormData(); data.set('file', file); data.set('role', role); data.set('visibleToRequester', String(visibleToRequester));
    try { await payload(await fetch(`/api/gift/ops/requests/${detail.request.id}/attachments`, { method: 'POST', headers: { 'x-unionam-csrf': csrfToken }, body: data })); await open(detail.request.id); }
    catch (error) { window.alert(error instanceof Error ? error.message : '上传失败'); }
  }

  return <div><div className="flex flex-wrap gap-3">{['all', 'submitted', 'reviewing', 'approved', 'queued', 'printing', 'ready', 'completed', 'rejected', 'cancelled'].map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-3 py-2 text-xs font-black ${filter === status ? 'bg-[#0b4f9c] text-white' : 'border bg-white'}`}>{status === 'all' ? '全部' : requestLabels[status]}</button>)}<input value={search} onChange={(e) => setSearch(e.target.value)} className="ml-auto h-10 rounded-md border px-3 text-sm" placeholder="搜索申请单" /></div><div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y">{visible.map((item) => <button key={item.id} onClick={() => void open(item.id)} className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 md:grid-cols-[150px_1fr_130px_120px_30px]"><span className="font-mono text-xs font-black text-[#0b4f9c]">{item.request_no}</span><span><strong className="block text-sm">{item.title}</strong><small className="text-slate-500">{item.requester_name} · {item.quantity} 件</small></span><span className="text-xs">{requestLabels[item.request_status]}</span><span className="text-xs text-slate-500">{dateTime(item.created_at)}</span><ChevronRight className="h-4 w-4" /></button>)}</div></div>
    {selectedId ? <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45"><div className="h-full w-full max-w-3xl overflow-y-auto bg-slate-100 p-6 shadow-2xl">{loading || !detail ? <div className="grid h-full place-items-center"><LoaderCircle className="animate-spin" /></div> : <><div className="flex justify-between"><div><div className="font-mono text-xs font-black text-cyan-700">{detail.request.requestNo}</div><h2 className="mt-1 text-2xl font-black">{detail.request.title}</h2><div className="mt-1 text-sm text-slate-500">{detail.request.requesterName} · {requestLabels[detail.request.status]}</div></div><button onClick={() => { setSelectedId(null); setDetail(null); }}><X /></button></div><div className="mt-5 grid gap-4 rounded-xl bg-white p-5 sm:grid-cols-2"><Info label="申请类型" value={detail.request.requestType} /><Info label="模型" value={detail.request.modelTitle || '员工附件/AI 模型'} /><Info label="客户/场景" value={[detail.request.customerCompany, detail.request.businessScene].filter(Boolean).join(' · ') || '-'} /><Info label="数量/工艺" value={`${detail.request.quantity} 件 · ${detail.request.finishType}${detail.request.paintColor ? ` ${detail.request.paintColor}` : ''}`} /><Info label="期望完成" value={detail.request.requestedCompletionDate || '-'} /><Info label="领取地点" value={detail.request.pickupLocation || '-'} /><div className="sm:col-span-2"><Info label="申请说明" value={detail.request.requestNotes || '-'} /></div></div><div className="mt-5 rounded-xl bg-white p-5"><h3 className="font-black">审核、排产与交付</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">负责人<select value={form.assigneeEmployeeId} onChange={(e) => setForm({ ...form, assigneeEmployeeId: e.target.value })} className={field}><option value="">请选择</option>{operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold">生产批次<input value={form.productionBatchNo} onChange={(e) => setForm({ ...form, productionBatchNo: e.target.value })} className={field} /></label><label className="text-xs font-bold">计划开始<input type="datetime-local" value={form.scheduledStartAt} onChange={(e) => setForm({ ...form, scheduledStartAt: e.target.value })} className={field} /></label><label className="text-xs font-bold">计划完成<input type="datetime-local" value={form.scheduledCompleteAt} onChange={(e) => setForm({ ...form, scheduledCompleteAt: e.target.value })} className={field} /></label><label className="text-xs font-bold">交付方式<select value={form.deliveryMethod} onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value })} className={field}><option value="pickup">现场领取</option><option value="internal_delivery">内部配送</option><option value="express">快递</option></select></label><label className="text-xs font-bold">领取/签收人<input value={form.deliveryRecipient} onChange={(e) => setForm({ ...form, deliveryRecipient: e.target.value })} className={field} /></label><label className="text-xs font-bold sm:col-span-2">操作备注<textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={area} rows={2} /></label><label className="text-xs font-bold sm:col-span-2">交付说明<textarea value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} className={area} rows={2} /></label></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void update(detail.request.status)} className="rounded-md border px-4 py-2 text-xs font-black">保存信息</button>{(nextActions[detail.request.status] || []).map((action) => <button key={action.status} onClick={() => void update(action.status)} className={`rounded-md px-4 py-2 text-xs font-black text-white ${action.status === 'rejected' ? 'bg-red-600' : 'bg-[#0b4f9c]'}`}>{action.label}</button>)}</div></div><div className="mt-5 rounded-xl bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-black">附件</h3><div className="flex gap-2"><label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-black"><UploadCloud className="mr-1 inline h-4 w-4" />生产附件<input type="file" className="sr-only" onChange={(e) => void upload(e.target.files?.[0], 'production', false)} /></label><label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-black"><UploadCloud className="mr-1 inline h-4 w-4" />交付附件<input type="file" className="sr-only" onChange={(e) => void upload(e.target.files?.[0], 'delivery', true)} /></label></div></div><div className="mt-3 space-y-2">{detail.attachments.map((file) => <div key={file.id} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-xs"><div><strong>{file.filename}</strong><span className="ml-2 text-slate-500">{file.role} · {formatSize(file.size)}{file.visibleToRequester ? ' · 员工可见' : ' · 仅后台'}</span></div><a href={`/api/gift/ops/assets/${file.assetId}`} target="_blank" rel="noreferrer" className="text-[#0b4f9c]"><Download className="h-4 w-4" /></a></div>)}</div></div><div className="mt-5 rounded-xl bg-white p-5"><h3 className="font-black">处理时间线</h3><div className="mt-4 space-y-4">{detail.events.map((event) => <div key={event.id} className="border-l-2 border-cyan-200 pl-4"><div className="text-sm font-black">{event.toStatus ? requestLabels[event.toStatus] : event.type}</div><div className="mt-1 text-xs text-slate-500">{event.actorName} · {dateTime(event.createdAt)}</div>{event.comment ? <div className="mt-1 text-xs text-slate-600">{event.comment}</div> : null}</div>)}</div></div></>}</div></div> : null}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-black text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>;
}
