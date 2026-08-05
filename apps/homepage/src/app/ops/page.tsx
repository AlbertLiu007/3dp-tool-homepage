'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cpu,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { ToolHeader } from '@unionam/shared-ui';
import { useLanguage } from '@/lib/i18n/use-language';
import {
  CompleteModelsPanel,
  CompleteRequestsPanel,
  type OpsGiftModel,
  type OpsPrintRequest,
} from '@/components/gift/ops-library-panels';

type OpsModule = 'dashboard' | 'employees' | 'ai' | 'models' | 'requests' | 'audit';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type EmployeeRole = 'employee' | 'operator' | 'admin';

type OpsEmployee = {
  id: number;
  userId: string;
  name: string;
  departments: number[];
  departmentNames: string[];
  position: string | null;
  role: EmployeeRole;
  employmentStatus: 'active' | 'inactive';
  approvalStatus: ApprovalStatus;
  appliedAt: string | null;
  reviewedAt: string | null;
  approvalNote: string | null;
  applicationReason: string | null;
  quota: { renderDailyLimit: number; editDailyLimit: number; modelDailyLimit: number; maxConcurrentJobs: number; renderUsed: number; editUsed: number; modelUsed: number };
};

type DashboardData = {
  employees: { total: number; pending: number; approved: number; operators: number };
  usage: { renders: number; edits: number; models3d: number; running: number; failed: number };
  models: { total: number; published: number; pending: number };
  requests: { total: number; pending: number; producing: number; delivered: number };
  recentAudit: AuditEvent[];
};

type AiUsage = { requestId: string; employeeName?: string; usageDate: string; usageType: string; status: string; providerJobId: string | null; provider: string | null; model: string | null; error: string | null; durationMs: number | null; createdAt: string | null };
type GiftModelRow = OpsGiftModel;
type PrintRequestRow = OpsPrintRequest;
type AuditEvent = { id: number; actorName: string; action: string; entityType: string; entityId: string; summary: string; requestIp?: string | null; createdAt: string };
type EmployeeDetail = { employee: Record<string, unknown>; approvals: { id: number; fromStatus: string | null; toStatus: string; note: string | null; actorName: string; createdAt: string }[]; usage: AiUsage[] };

const moduleItems: { id: OpsModule; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '运营概览', icon: LayoutDashboard },
  { id: 'employees', label: '员工与权限', icon: Users },
  { id: 'ai', label: 'AI 用量与任务', icon: Cpu },
  { id: 'models', label: '模型库', icon: Boxes },
  { id: 'requests', label: '打印申请', icon: ClipboardList },
  { id: 'audit', label: '操作审计', icon: History },
];

const statusLabels: Record<ApprovalStatus, string> = { pending: '待审核', approved: '已批准', rejected: '已拒绝', suspended: '已暂停' };
const requestStatusLabels: Record<string, string> = { draft: '草稿', submitted: '待审核', reviewing: '审核中', approved: '已批准', rejected: '已拒绝', queued: '待排产', printing: '打印中', ready: '待领取', completed: '已完成', cancelled: '已取消' };
const aiTypeLabels: Record<string, string> = { render: '礼品渲染图', image_edit: '图片编辑', image_to_3d: '3D 模型生成' };

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function StatusBadge({ status }: { status: string }) {
  const success = ['approved', 'published', 'succeeded', 'completed', 'ready'].includes(status);
  const warning = ['pending', 'submitted', 'reviewing', 'queued', 'running', 'reserved', 'printing', 'review'].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${success ? 'bg-emerald-100 text-emerald-800' : warning ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{statusLabels[status as ApprovalStatus] || requestStatusLabels[status] || status}</span>;
}

function LoadingBlock() {
  return <div className="grid min-h-64 place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-[#0b4f9c]" /></div>;
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm font-bold text-slate-500"><Clock3 className="mx-auto mb-3 h-8 w-8 text-slate-300" />{text}</div>;
}

function ErrorBlock({ message }: { message: string | null }) {
  return message ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div> : null;
}

function DashboardPanel({ data }: { data: DashboardData | null }) {
  if (!data) return <LoadingBlock />;
  const cards = [
    { label: '在职员工', value: data.employees.total, detail: `${data.employees.pending} 人待审核`, icon: Users, color: 'bg-blue-50 text-blue-700' },
    { label: '今日 AI 调用', value: data.usage.renders + data.usage.edits + data.usage.models3d, detail: `${data.usage.running} 个任务运行中`, icon: Cpu, color: 'bg-cyan-50 text-cyan-700' },
    { label: '模型库', value: data.models.total, detail: `${data.models.published} 个已上线`, icon: Boxes, color: 'bg-violet-50 text-violet-700' },
    { label: '打印申请', value: data.requests.total, detail: `${data.requests.pending} 个待处理`, icon: ClipboardList, color: 'bg-amber-50 text-amber-700' },
  ];
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div><p className="mt-5 text-xs font-black text-slate-500">{card.label}</p><div className="mt-1 text-3xl font-black text-slate-950">{card.value}</div><p className="mt-2 text-xs font-medium text-slate-400">{card.detail}</p></div>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">今日 AI 使用结构</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{[['渲染图', data.usage.renders], ['图片编辑', data.usage.edits], ['3D 模型', data.usage.models3d]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-4"><div className="text-2xl font-black text-[#0b4f9c]">{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{label}</div></div>)}</div><div className="mt-5 rounded-lg border border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">失败或释放任务：{data.usage.failed} · 运营管理员：{data.employees.operators}</div></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">最近操作</h2><div className="mt-4 space-y-4">{data.recentAudit.length ? data.recentAudit.map((item) => <div key={item.id} className="border-l-2 border-cyan-200 pl-3"><p className="text-xs font-bold text-slate-700">{item.summary}</p><p className="mt-1 text-[11px] text-slate-400">{item.actorName} · {dateTime(item.createdAt)}</p></div>) : <p className="text-xs text-slate-400">暂无操作记录</p>}</div></div></div></div>;
}

function EmployeeCard({ employee, currentUser, csrfToken, onUpdated, onDetail }: { employee: OpsEmployee; currentUser: OpsEmployee; csrfToken: string; onUpdated: (value: OpsEmployee) => void; onDetail: (employee: OpsEmployee) => void }) {
  const [form, setForm] = useState({ role: employee.role, note: employee.approvalNote || '', renderDailyLimit: employee.quota.renderDailyLimit, editDailyLimit: employee.quota.editDailyLimit, modelDailyLimit: employee.quota.modelDailyLimit, maxConcurrentJobs: employee.quota.maxConcurrentJobs });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(approvalStatus: ApprovalStatus) {
    const sensitive = approvalStatus !== employee.approvalStatus || form.role !== employee.role;
    if (sensitive && !window.confirm(`确认将 ${employee.name} 设置为“${statusLabels[approvalStatus]} / ${form.role}”吗？`)) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/gift/ops/employees/${employee.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ ...form, approvalStatus }) });
      const payload = await response.json() as { employee?: OpsEmployee; message?: string };
      if (!response.ok || !payload.employee) throw new Error(payload.message || '保存失败');
      onUpdated(payload.employee);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : '保存失败'); } finally { setSaving(false); }
  }
  const fieldClass = 'mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{employee.name}</h2><StatusBadge status={employee.approvalStatus} />{employee.role !== 'employee' ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-800">{employee.role}</span> : null}</div><p className="mt-2 text-xs font-medium text-slate-500">{employee.departmentNames.join('、') || `部门 ID：${employee.departments.join('、') || '未返回'}`} · {employee.position || '未填写职位'}</p><p className="mt-1 text-xs text-slate-400">申请：{dateTime(employee.appliedAt)} · 登录账号：{employee.userId}</p></div><button type="button" onClick={() => onDetail(employee)} className="text-xs font-black text-[#0b4f9c]">查看详情与记录</button></div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-600"><strong>申请用途：</strong>{employee.applicationReason || '员工尚未填写申请用途'}</div><div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-5"><label className="text-xs font-black text-slate-600">角色<select disabled={currentUser.role !== 'admin'} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as EmployeeRole })} className={fieldClass}><option value="employee">普通员工</option><option value="operator">运营员</option><option value="admin">管理员</option></select></label>{([['图片/日', 'renderDailyLimit'], ['编辑/日', 'editDailyLimit'], ['3D/日', 'modelDailyLimit'], ['并发任务', 'maxConcurrentJobs']] as const).map(([label, key]) => <label key={key} className="text-xs font-black text-slate-600">{label}<input type="number" min={key === 'maxConcurrentJobs' ? 1 : 0} max={key === 'maxConcurrentJobs' ? 10 : 1000} value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} className={fieldClass} /></label>)}</div><label className="mt-4 block text-xs font-black text-slate-600">审核备注<input value={form.note} maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} className={fieldClass} placeholder="选填" /></label><ErrorBlock message={error} /><div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void save('approved')} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0b4f9c] px-4 text-xs font-black text-white disabled:opacity-50"><UserCheck className="h-4 w-4" />批准并保存</button><button disabled={saving} onClick={() => void save('rejected')} className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-xs font-black text-red-700 disabled:opacity-50"><UserX className="h-4 w-4" />拒绝</button><button disabled={saving} onClick={() => void save('suspended')} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-50"><ShieldAlert className="h-4 w-4" />暂停</button></div></article>;
}

function EmployeeDetailModal({ employee, detail, onClose }: { employee: OpsEmployee; detail: EmployeeDetail | null; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><h2 className="text-xl font-black">{employee.name}</h2><p className="mt-1 text-xs text-slate-500">员工详情、审核记录与最近 AI 使用</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div>{!detail ? <LoadingBlock /> : <div className="space-y-6 p-6"><div><h3 className="text-sm font-black">审核历史</h3><div className="mt-3 space-y-3">{detail.approvals.length ? detail.approvals.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black">{item.fromStatus || '首次申请'} → {statusLabels[item.toStatus as ApprovalStatus] || item.toStatus}</span><span className="text-[11px] text-slate-400">{dateTime(item.createdAt)}</span></div><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.note || '无备注'}</p></div>) : <p className="text-xs text-slate-400">暂无审核记录</p>}</div></div><div><h3 className="text-sm font-black">最近 AI 使用</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-400"><tr><th className="pb-2">类型</th><th className="pb-2">状态</th><th className="pb-2">时间</th></tr></thead><tbody>{detail.usage.map((item, index) => <tr key={`${item.requestId}-${index}`} className="border-t border-slate-100"><td className="py-3 font-bold">{aiTypeLabels[item.usageType] || item.usageType}</td><td><StatusBadge status={item.status} /></td><td className="text-slate-500">{dateTime(item.createdAt)}</td></tr>)}</tbody></table></div></div></div>}</div></div>;
}

function EmployeesPanel({ employees, currentUser, csrfToken, onReload }: { employees: OpsEmployee[]; currentUser: OpsEmployee; csrfToken: string; onReload: () => void }) {
  const [filter, setFilter] = useState<'all' | ApprovalStatus>('pending');
  const [search, setSearch] = useState('');
  const [detailEmployee, setDetailEmployee] = useState<OpsEmployee | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const visible = useMemo(() => employees.filter((employee) => (filter === 'all' || employee.approvalStatus === filter) && (!search.trim() || `${employee.name} ${employee.userId} ${employee.position || ''} ${employee.departmentNames.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))), [employees, filter, search]);
  async function openDetail(employee: OpsEmployee) { setDetailEmployee(employee); setDetail(null); const response = await fetch(`/api/gift/ops/employees/${employee.id}`, { cache: 'no-store', credentials: 'same-origin' }); if (response.ok) setDetail(await response.json() as EmployeeDetail); }
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{(['pending', 'approved', 'suspended', 'rejected', 'all'] as const).map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-full border px-4 py-2 text-xs font-black ${filter === status ? 'border-[#0b4f9c] bg-[#0b4f9c] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{status === 'all' ? '全部' : statusLabels[status]}</button>)}</div><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、部门或 UserId" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label></div>{visible.length ? <div className="mt-5 grid gap-5 xl:grid-cols-2">{visible.map((employee) => <EmployeeCard key={employee.id} employee={employee} currentUser={currentUser} csrfToken={csrfToken} onUpdated={onReload} onDetail={(item) => void openDetail(item)} />)}</div> : <div className="mt-5"><EmptyBlock text="当前没有符合条件的员工" /></div>}{detailEmployee ? <EmployeeDetailModal employee={detailEmployee} detail={detail} onClose={() => setDetailEmployee(null)} /> : null}</div>;
}

function AiPanel({ usage, csrfToken, onReload }: { usage: AiUsage[]; csrfToken: string; onReload: () => void }) {
  async function release(item: AiUsage) { if (!window.confirm(`确认释放 ${item.employeeName || ''} 的任务并返还额度吗？`)) return; await fetch(`/api/gift/ops/ai-usage/${item.requestId}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ action: 'release', note: '运营后台手动释放异常任务' }) }); onReload(); }
  return usage.length ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['员工', '类型', '状态', '供应商任务', '耗时', '提交时间', '操作'].map((item) => <th key={item} className="px-4 py-3 font-black">{item}</th>)}</tr></thead><tbody>{usage.map((item) => <tr key={item.requestId} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{item.employeeName || '—'}</td><td className="px-4 py-3">{aiTypeLabels[item.usageType] || item.usageType}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="max-w-48 truncate px-4 py-3 font-mono text-[11px] text-slate-500">{item.providerJobId || '同步任务'}</td><td className="px-4 py-3">{item.durationMs ? `${Math.round(item.durationMs / 1000)} 秒` : '—'}</td><td className="px-4 py-3 text-slate-500">{dateTime(item.createdAt)}</td><td className="px-4 py-3">{['reserved', 'running'].includes(item.status) ? <button onClick={() => void release(item)} className="font-black text-red-600">释放任务</button> : '—'}</td></tr>)}</tbody></table></div></div> : <EmptyBlock text="暂无 AI 使用记录" />;
}

function ModelsPanel({ models, csrfToken, onReload }: { models: GiftModelRow[]; csrfToken: string; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: '', titleZh: '', category: 'business', descriptionZh: '', publicationStatus: 'draft', tags: '', supportedFinishes: 'paint,bronze' });
  async function create() { const response = await fetch('/api/gift/ops/models', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ ...form, tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean), supportedFinishes: form.supportedFinishes.split(',').map((value) => value.trim()).filter(Boolean) }) }); if (response.ok) { setCreating(false); onReload(); } }
  async function changeStatus(model: GiftModelRow, publicationStatus: string) { if (!window.confirm(`确认将“${model.title_zh}”设置为 ${publicationStatus} 吗？`)) return; await fetch(`/api/gift/ops/models/${model.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ publicationStatus }) }); onReload(); }
  async function upload(model: GiftModelRow, kind: 'model_file' | 'model_preview', file: File | undefined) { if (!file) return; const data = new FormData(); data.set('modelId', String(model.id)); data.set('kind', kind); data.set('file', file); const response = await fetch('/api/gift/ops/assets/upload', { method: 'POST', credentials: 'same-origin', headers: { 'x-unionam-csrf': csrfToken }, body: data }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { message?: string }; window.alert(payload.message || '上传失败'); return; } onReload(); }
  return <div><div className="flex justify-end"><button onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0b4f9c] px-4 text-xs font-black text-white"><Plus className="h-4 w-4" />新建模型记录</button></div>{models.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{models.map((model) => <article key={model.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-cyan-700">{model.category}</p><h3 className="mt-2 text-base font-black">{model.title_zh}</h3><p className="mt-1 font-mono text-[11px] text-slate-400">{model.slug}</p></div><StatusBadge status={model.publication_status} /></div><div className="mt-3 flex gap-3 text-[11px] font-bold text-slate-500">{model.model_asset_id ? <a href={`/api/gift/ops/assets/${model.model_asset_id}`} target="_blank" rel="noreferrer" className="text-[#0b4f9c]">查看模型文件</a> : <span>未上传模型</span>}{model.preview_asset_id ? <a href={`/api/gift/ops/assets/${model.preview_asset_id}`} target="_blank" rel="noreferrer" className="text-[#0b4f9c]">查看缩略图</a> : <span>未上传缩略图</span>}</div><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs font-black"><label className="cursor-pointer rounded-md bg-cyan-50 px-3 py-2 text-cyan-800">上传模型<input type="file" accept=".stl,.obj,.3mf,.glb,.gltf" className="sr-only" onChange={(event) => { void upload(model, 'model_file', event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="cursor-pointer rounded-md bg-blue-50 px-3 py-2 text-blue-800">上传缩略图<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void upload(model, 'model_preview', event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div><div className="mt-3 flex gap-3 text-xs font-black"><button onClick={() => void changeStatus(model, 'published')} className="text-emerald-700">上线</button><button onClick={() => void changeStatus(model, 'review')} className="text-amber-700">送审</button><button onClick={() => void changeStatus(model, 'archived')} className="text-slate-500">归档</button></div></article>)}</div> : <div className="mt-4"><EmptyBlock text="模型库暂无记录" /></div>}{creating ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><form onSubmit={(event) => { event.preventDefault(); void create(); }} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">新建模型记录</h2><button type="button" onClick={() => setCreating(false)}><X /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{[['中文标题', 'titleZh'], ['Slug', 'slug'], ['分类', 'category'], ['标签（逗号分隔）', 'tags'], ['支持工艺', 'supportedFinishes']] .map(([label, key]) => <label key={key} className="text-xs font-black text-slate-600">{label}<input required={['titleZh', 'slug', 'category'].includes(key)} value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>)}<label className="text-xs font-black text-slate-600">发布状态<select value={form.publicationStatus} onChange={(event) => setForm({ ...form, publicationStatus: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option value="draft">草稿</option><option value="review">送审</option><option value="published">直接上线</option></select></label></div><label className="mt-4 block text-xs font-black text-slate-600">描述<textarea value={form.descriptionZh} onChange={(event) => setForm({ ...form, descriptionZh: event.target.value })} rows={4} className="mt-1.5 w-full rounded-md border border-slate-200 p-3 text-sm" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="h-10 rounded-md border border-slate-200 px-4 text-xs font-black">取消</button><button type="submit" className="h-10 rounded-md bg-[#0b4f9c] px-4 text-xs font-black text-white">创建</button></div></form></div> : null}</div>;
}

function RequestsPanel({ requests, csrfToken, onReload }: { requests: PrintRequestRow[]; csrfToken: string; onReload: () => void }) {
  async function update(item: PrintRequestRow, status: string) { if (!window.confirm(`确认将申请 ${item.request_no} 更新为“${requestStatusLabels[status]}”吗？`)) return; await fetch(`/api/gift/ops/requests/${item.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-unionam-csrf': csrfToken }, body: JSON.stringify({ status, comment: '运营后台状态更新' }) }); onReload(); }
  return requests.length ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['申请单', '申请人', '内容', '数量/工艺', '期望完成', '状态', '更新状态'].map((item) => <th key={item} className="px-4 py-3 font-black">{item}</th>)}</tr></thead><tbody>{requests.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-mono text-[11px]">{item.request_no}</td><td className="px-4 py-3 font-black">{item.requester_name}</td><td className="max-w-64 px-4 py-3"><div className="truncate font-bold">{item.title}</div><div className="mt-1 text-slate-400">{item.request_type}</div></td><td className="px-4 py-3">{item.quantity} 件 · {item.finish_type}</td><td className="px-4 py-3">{item.requested_completion_date || '未指定'}</td><td className="px-4 py-3"><StatusBadge status={item.request_status} /></td><td className="px-4 py-3"><select value={item.request_status} onChange={(event) => void update(item, event.target.value)} className="h-9 rounded-md border border-slate-200 px-2 font-bold">{Object.entries(requestStatusLabels).filter(([key]) => key !== 'draft').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td></tr>)}</tbody></table></div></div> : <EmptyBlock text="暂无打印申请" />;
}

function AuditPanel({ events }: { events: AuditEvent[] }) {
  return events.length ? <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="space-y-5">{events.map((item) => <div key={item.id} className="flex gap-4"><div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-50 text-cyan-700"><Activity className="h-4 w-4" /></div><div className="min-w-0 flex-1 border-b border-slate-100 pb-5"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-bold text-slate-800">{item.summary}</p><span className="text-[11px] text-slate-400">{dateTime(item.createdAt)}</span></div><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.entityType} #{item.entityId}{item.requestIp ? ` · ${item.requestIp}` : ''}</p></div></div>)}</div></div> : <EmptyBlock text="暂无审计记录" />;
}

export default function GiftOpsPage() {
  const { language, setLanguage, t: headerLabels } = useLanguage();
  const [sessionState, setSessionState] = useState<'loading' | 'guest' | 'forbidden' | 'ready'>('loading');
  const [currentUser, setCurrentUser] = useState<OpsEmployee | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [module, setModule] = useState<OpsModule>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState<OpsEmployee[]>([]);
  const [usage, setUsage] = useState<AiUsage[]>([]);
  const [models, setModels] = useState<GiftModelRow[]>([]);
  const [requests, setRequests] = useState<PrintRequestRow[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const navItems = [{ label: headerLabels.navQuote, href: 'https://unionam.com/quote' }, { label: headerLabels.navConverter, href: 'https://unionam.com/converter' }, { label: headerLabels.navGift, href: 'https://unionam.com/gift' }];

  const loadModule = useCallback(async (target: OpsModule) => {
    setLoading(true); setError(null);
    const endpoints: Record<OpsModule, string> = { dashboard: '/api/gift/ops/dashboard', employees: '/api/gift/ops/employees', ai: '/api/gift/ops/ai-usage', models: '/api/gift/ops/models', requests: '/api/gift/ops/requests', audit: '/api/gift/ops/audit' };
    try {
      const response = await fetch(endpoints[target], { cache: 'no-store', credentials: 'same-origin' });
      const payload = await response.json() as Record<string, unknown> & { message?: string };
      if (!response.ok) throw new Error(payload.message || '数据加载失败');
      if (target === 'dashboard') setDashboard(payload.dashboard as DashboardData);
      if (target === 'employees') setEmployees(payload.employees as OpsEmployee[]);
      if (target === 'ai') setUsage(payload.usage as AiUsage[]);
      if (target === 'models') setModels(payload.models as GiftModelRow[]);
      if (target === 'requests') setRequests(payload.requests as PrintRequestRow[]);
      if (target === 'audit') setAudit(payload.audit as AuditEvent[]);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '数据加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch('/api/gift/auth/session', { cache: 'no-store', credentials: 'same-origin' }).then(async (response) => { const payload = await response.json() as { authenticated?: boolean; user?: OpsEmployee; csrfToken?: string }; if (!response.ok || !payload.authenticated || !payload.user) return setSessionState('guest'); if (!['operator', 'admin'].includes(payload.user.role) || payload.user.approvalStatus !== 'approved') return setSessionState('forbidden'); setCurrentUser(payload.user); setCsrfToken(payload.csrfToken || ''); setSessionState('ready'); }).catch(() => setSessionState('guest')); }, []);
  useEffect(() => { if (sessionState === 'ready') void loadModule(module); }, [sessionState, module, loadModule]);
  async function logout() { await fetch('/api/gift/auth/logout', { method: 'POST', credentials: 'same-origin' }); window.location.reload(); }

  return <main className="min-h-screen bg-slate-100 text-slate-950"><ToolHeader language={language} labels={headerLabels} logoSrc="/brand/unionam-logo.png" navItems={navItems} onLanguageChange={setLanguage} />{sessionState === 'loading' ? <LoadingBlock /> : null}{sessionState === 'guest' ? <section className="mx-auto grid min-h-[520px] max-w-xl place-items-center px-5"><div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"><LogIn className="mx-auto h-10 w-10 text-[#0b4f9c]" /><h1 className="mt-5 text-2xl font-black">礼品站运营后台</h1><p className="mt-3 text-sm font-medium text-slate-500">仅允许已授权的企业微信管理员和运营员进入。</p><a href={`${process.env.NODE_ENV === 'production' ? 'https://unionam.com' : ''}/api/gift/auth/wecom/start?return_to=ops`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#0b4f9c] px-5 text-sm font-black text-white"><LogIn className="h-4 w-4" />企业微信登录</a>{process.env.NODE_ENV !== 'production' ? <button onClick={async () => { await fetch('/api/gift/auth/dev-login', { method: 'POST' }); window.location.reload(); }} className="mx-auto mt-3 block text-xs font-bold text-slate-400">本地开发：模拟管理员登录</button> : null}</div></section> : null}{sessionState === 'forbidden' ? <section className="mx-auto grid min-h-[520px] max-w-xl place-items-center px-5"><div className="w-full rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm"><ShieldAlert className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-5 text-2xl font-black">暂无运营后台权限</h1><p className="mt-3 text-sm text-slate-500">请联系管理员授予 operator 或 admin 角色。</p></div></section> : null}{sessionState === 'ready' && currentUser ? <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div><div className="flex items-center gap-2 text-xs font-black text-cyan-700"><ShieldCheck className="h-4 w-4" />UnionAM Gift Operations</div><div className="mt-1 text-sm font-bold text-slate-600">{currentUser.name} · {currentUser.role}</div></div><div className="flex gap-2"><button onClick={() => void loadModule(module)} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新</button><button onClick={() => void logout()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-500"><LogOut className="h-4 w-4" />退出</button></div></div><div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="h-fit rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-24">{moduleItems.map((item) => <button key={item.id} onClick={() => setModule(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-black transition ${module === item.id ? 'bg-[#0b4f9c] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-[#0b4f9c]'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}</aside><section className="min-w-0"><div className="mb-5"><div className="flex items-center gap-2 text-xs font-black text-cyan-700"><BadgeCheck className="h-4 w-4" />{moduleItems.find((item) => item.id === module)?.label}</div><h1 className="mt-2 text-3xl font-black">{module === 'dashboard' ? '礼品站运营概览' : moduleItems.find((item) => item.id === module)?.label}</h1></div><ErrorBlock message={error} />{loading && !error ? <LoadingBlock /> : null}{!loading && !error && module === 'dashboard' ? <DashboardPanel data={dashboard} /> : null}{!loading && !error && module === 'employees' ? <EmployeesPanel employees={employees} currentUser={currentUser} csrfToken={csrfToken} onReload={() => void loadModule('employees')} /> : null}{!loading && !error && module === 'ai' ? <AiPanel usage={usage} csrfToken={csrfToken} onReload={() => void loadModule('ai')} /> : null}{!loading && !error && module === 'models' ? <CompleteModelsPanel models={models} csrfToken={csrfToken} onReload={() => void loadModule('models')} /> : null}{!loading && !error && module === 'requests' ? <CompleteRequestsPanel requests={requests} csrfToken={csrfToken} onReload={() => void loadModule('requests')} /> : null}{!loading && !error && module === 'audit' ? <AuditPanel events={audit} /> : null}</section></div></div> : null}</main>;
}
