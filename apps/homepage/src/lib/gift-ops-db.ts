import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  databasePool,
  GiftAccessError,
  type GiftApprovalStatus,
  type GiftEmployeeAccess,
  type GiftEmployeeRole,
} from '@/lib/gift-db';
import { getGiftPrintRequestDetail } from '@/lib/gift-library-db';

type AuditInput = {
  actorId: number;
  action: string;
  entityType: string;
  entityId: string | number;
  summary: string;
  payload?: unknown;
  requestIp?: string;
};

export async function recordGiftOpsAudit(input: AuditInput) {
  await databasePool().execute<ResultSetHeader>(`
    INSERT INTO gift_ops_audit_events (
      actor_employee_id, action_type, entity_type, entity_id, summary_text, event_payload, request_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    input.actorId || null,
    input.action.slice(0, 64),
    input.entityType.slice(0, 32),
    String(input.entityId).slice(0, 128),
    input.summary.slice(0, 500),
    input.payload === undefined ? null : JSON.stringify(input.payload),
    input.requestIp?.slice(0, 64) || null,
  ]);
}

export async function getGiftOpsDashboard() {
  const pool = databasePool();
  const [[employeeRows], [usageRows], [modelRows], [requestRows], [recentRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total,
        SUM(approval_status = 'pending') AS pending,
        SUM(approval_status = 'approved') AS approved,
        SUM(role IN ('operator', 'admin')) AS operators
      FROM gift_employees WHERE employment_status = 'active'
    `),
    pool.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(usage_type = 'render' AND usage_status != 'refunded'), 0) AS renders,
        COALESCE(SUM(usage_type = 'image_edit' AND usage_status != 'refunded'), 0) AS edits,
        COALESCE(SUM(usage_type = 'image_to_3d' AND usage_status != 'refunded'), 0) AS models3d,
        COALESCE(SUM(usage_status IN ('reserved', 'running')), 0) AS running,
        COALESCE(SUM(usage_status = 'refunded'), 0) AS failed
      FROM gift_ai_usage_events WHERE usage_date = CURRENT_DATE
    `),
    pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total,
        SUM(publication_status = 'published') AS published,
        SUM(publication_status IN ('draft', 'review')) AS pending
      FROM gift_models
    `),
    pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total,
        SUM(request_status IN ('submitted', 'reviewing')) AS pending,
        SUM(request_status IN ('queued', 'printing')) AS producing,
        SUM(request_status IN ('ready', 'completed')) AS delivered
      FROM gift_print_requests
    `),
    pool.query<RowDataPacket[]>(`
      SELECT a.id, a.action_type, a.entity_type, a.entity_id, a.summary_text, a.created_at,
        actor.display_name AS actor_name
      FROM gift_ops_audit_events a
      LEFT JOIN gift_employees actor ON actor.id = a.actor_employee_id
      ORDER BY a.created_at DESC LIMIT 8
    `),
  ]);
  const employees = employeeRows[0] || {};
  const usage = usageRows[0] || {};
  const models = modelRows[0] || {};
  const requests = requestRows[0] || {};
  return {
    employees: { total: Number(employees.total || 0), pending: Number(employees.pending || 0), approved: Number(employees.approved || 0), operators: Number(employees.operators || 0) },
    usage: { renders: Number(usage.renders || 0), edits: Number(usage.edits || 0), models3d: Number(usage.models3d || 0), running: Number(usage.running || 0), failed: Number(usage.failed || 0) },
    models: { total: Number(models.total || 0), published: Number(models.published || 0), pending: Number(models.pending || 0) },
    requests: { total: Number(requests.total || 0), pending: Number(requests.pending || 0), producing: Number(requests.producing || 0), delivered: Number(requests.delivered || 0) },
    recentAudit: recentRows.map((row) => ({ id: Number(row.id), action: String(row.action_type), entityType: String(row.entity_type), entityId: String(row.entity_id), summary: String(row.summary_text), actorName: row.actor_name ? String(row.actor_name) : '系统', createdAt: new Date(row.created_at).toISOString() })),
  };
}

export async function getGiftEmployeeOpsDetail(employeeId: number) {
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new GiftAccessError('Employee ID is invalid.', 400, 'not_found');
  const pool = databasePool();
  const [[employeeRows], [approvalRows], [usageRows]] = await Promise.all([
    pool.execute<RowDataPacket[]>(`
      SELECT e.id, e.wecom_user_id, e.display_name, e.department_ids, e.department_names,
        e.position_name, e.role, e.employment_status, e.approval_status, e.application_reason,
        e.applied_at, e.reviewed_at, e.approval_note, e.last_login_at, e.created_at
      FROM gift_employees e WHERE e.id = ? LIMIT 1
    `, [employeeId]),
    pool.execute<RowDataPacket[]>(`
      SELECT a.id, a.from_status, a.to_status, a.note_text, a.created_at,
        actor.display_name AS actor_name
      FROM gift_employee_approval_events a
      LEFT JOIN gift_employees actor ON actor.id = a.actor_employee_id
      WHERE a.employee_id = ? ORDER BY a.created_at DESC LIMIT 100
    `, [employeeId]),
    pool.execute<RowDataPacket[]>(`
      SELECT usage_date, usage_type, usage_status, provider_job_id, error_message, duration_ms, created_at, completed_at
      FROM gift_ai_usage_events WHERE employee_id = ? ORDER BY created_at DESC LIMIT 50
    `, [employeeId]),
  ]);
  if (!employeeRows[0]) throw new GiftAccessError('Employee was not found.', 404, 'not_found');
  return {
    employee: employeeRows[0],
    approvals: approvalRows.map((row) => ({ id: Number(row.id), fromStatus: row.from_status, toStatus: row.to_status, note: row.note_text, actorName: row.actor_name || '系统', createdAt: new Date(row.created_at).toISOString() })),
    usage: usageRows.map(normalizeUsageRow),
  };
}

function normalizeUsageRow(row: RowDataPacket) {
  return {
    requestId: row.request_uid ? String(row.request_uid) : undefined,
    employeeId: row.employee_id ? Number(row.employee_id) : undefined,
    employeeName: row.employee_name ? String(row.employee_name) : undefined,
    usageDate: String(row.usage_date),
    usageType: String(row.usage_type),
    status: String(row.usage_status),
    providerJobId: row.provider_job_id ? String(row.provider_job_id) : null,
    provider: row.provider_name ? String(row.provider_name) : null,
    model: row.model_name ? String(row.model_name) : null,
    error: row.error_message ? String(row.error_message) : null,
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export async function listGiftOpsAiUsage(filters: { status?: string; type?: string; search?: string }) {
  const where: string[] = [];
  const parameters: (string | number | null)[] = [];
  if (filters.status && ['reserved', 'running', 'succeeded', 'refunded'].includes(filters.status)) {
    where.push('u.usage_status = ?'); parameters.push(filters.status);
  }
  if (filters.type && ['render', 'image_edit', 'image_to_3d'].includes(filters.type)) {
    where.push('u.usage_type = ?'); parameters.push(filters.type);
  }
  if (filters.search) {
    where.push('(e.display_name LIKE ? OR e.wecom_user_id LIKE ? OR u.provider_job_id LIKE ?)');
    const pattern = `%${filters.search.slice(0, 100)}%`; parameters.push(pattern, pattern, pattern);
  }
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT u.*, e.display_name AS employee_name
    FROM gift_ai_usage_events u
    INNER JOIN gift_employees e ON e.id = u.employee_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY u.created_at DESC LIMIT 500
  `, parameters);
  return rows.map(normalizeUsageRow);
}

export async function refundGiftOpsAiUsage(actor: GiftEmployeeAccess, requestUid: string, note: string, ip?: string) {
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM gift_ai_usage_events WHERE request_uid = ? FOR UPDATE', [requestUid]);
    const usage = rows[0];
    if (!usage) throw new GiftAccessError('AI usage event was not found.', 404, 'not_found');
    if (!['reserved', 'running'].includes(String(usage.usage_status))) throw new GiftAccessError('Only running AI jobs can be released.', 409, 'quota');
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_ai_daily_usage
      SET used_count = GREATEST(used_count - 1, 0), in_flight_count = GREATEST(in_flight_count - 1, 0)
      WHERE employee_id = ? AND usage_date = ? AND usage_type = ?
    `, [usage.employee_id, usage.usage_date, usage.usage_type]);
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_ai_usage_events SET usage_status = 'refunded', error_message = ?, completed_at = CURRENT_TIMESTAMP(3),
        duration_ms = TIMESTAMPDIFF(MICROSECOND, created_at, CURRENT_TIMESTAMP(3)) DIV 1000
      WHERE id = ?
    `, [(note.trim() || 'Released by Ops').slice(0, 500), usage.id]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_ops_audit_events (actor_employee_id, action_type, entity_type, entity_id, summary_text, event_payload, request_ip)
      VALUES (?, 'ai_job_released', 'ai_usage', ?, ?, ?, ?)
    `, [actor.id, requestUid, `${actor.name} 释放了 AI 任务 ${requestUid}`, JSON.stringify({ note }), ip || null]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const modelStatuses = new Set(['draft', 'review', 'published', 'archived']);

export async function listGiftOpsModels(search?: string) {
  const parameters: (string | number | null)[] = [];
  const where = search ? 'WHERE m.title_zh LIKE ? OR m.slug LIKE ? OR m.category LIKE ?' : '';
  if (search) { const pattern = `%${search.slice(0, 100)}%`; parameters.push(pattern, pattern, pattern); }
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT m.*, owner.display_name AS owner_name, creator.display_name AS creator_name
    FROM gift_models m
    LEFT JOIN gift_employees owner ON owner.id = m.owner_employee_id
    LEFT JOIN gift_employees creator ON creator.id = m.created_by_employee_id
    ${where} ORDER BY m.sort_order ASC, m.updated_at DESC, m.id ASC LIMIT 500
  `, parameters);
  const modelIds = rows.map((row) => Number(row.id));
  const assetRows = modelIds.length ? await databasePool().query<RowDataPacket[]>(`
    SELECT l.id AS link_id, l.model_id, l.asset_id, l.asset_role, l.version_number, l.is_current, l.created_at,
      a.original_filename, a.content_type, a.file_extension, a.size_bytes, a.asset_status,
      uploader.display_name AS uploader_name
    FROM gift_model_asset_links l
    INNER JOIN gift_assets a ON a.id = l.asset_id
    LEFT JOIN gift_employees uploader ON uploader.id = l.uploaded_by_employee_id
    WHERE l.model_id IN (${modelIds.map(() => '?').join(',')})
    ORDER BY l.model_id, l.asset_role, l.version_number DESC
  `, modelIds) : [[]];
  const assetsByModel = new Map<number, unknown[]>();
  for (const asset of assetRows[0]) {
    const modelId = Number(asset.model_id);
    const items = assetsByModel.get(modelId) || [];
    items.push({
      linkId: Number(asset.link_id), assetId: Number(asset.asset_id), role: String(asset.asset_role),
      version: Number(asset.version_number), current: Boolean(asset.is_current), filename: String(asset.original_filename || '文件'),
      contentType: asset.content_type ? String(asset.content_type) : null, extension: asset.file_extension ? String(asset.file_extension) : null,
      size: asset.size_bytes === null ? null : Number(asset.size_bytes), status: String(asset.asset_status),
      uploaderName: asset.uploader_name ? String(asset.uploader_name) : null, createdAt: new Date(asset.created_at).toISOString(),
    });
    assetsByModel.set(modelId, items);
  }
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    tags: parseJson(row.tags, []),
    supported_finishes: parseJson(row.supported_finishes, []),
    assets: assetsByModel.get(Number(row.id)) || [],
  }));
}

export async function listGiftOpsCategories() {
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT c.*, COUNT(m.id) AS model_count
    FROM gift_model_categories c LEFT JOIN gift_models m ON m.category = c.slug
    GROUP BY c.id ORDER BY c.sort_order, c.id
  `);
  return rows.map((row) => ({
    id: Number(row.id), slug: String(row.slug), nameZh: String(row.name_zh), nameEn: row.name_en ? String(row.name_en) : null,
    descriptionZh: row.description_zh ? String(row.description_zh) : null, descriptionEn: row.description_en ? String(row.description_en) : null,
    sortOrder: Number(row.sort_order), status: String(row.category_status), modelCount: Number(row.model_count),
  }));
}

export async function createGiftOpsCategory(actor: GiftEmployeeAccess, input: Record<string, unknown>, ip?: string) {
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const nameZh = typeof input.nameZh === 'string' ? input.nameZh.trim().slice(0, 128) : '';
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) || !nameZh) throw new GiftAccessError('Category slug and Chinese name are required.', 400, 'validation');
  const [result] = await databasePool().execute<ResultSetHeader>(`
    INSERT INTO gift_model_categories (slug, name_zh, name_en, description_zh, description_en, sort_order, created_by_employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [slug, nameZh, stringOrNull(input.nameEn), stringOrNull(input.descriptionZh), stringOrNull(input.descriptionEn), Number(input.sortOrder) || 0, actor.id]);
  await recordGiftOpsAudit({ actorId: actor.id, action: 'category_created', entityType: 'model_category', entityId: result.insertId, summary: `${actor.name} 创建了模型分类 ${nameZh}`, payload: { slug }, requestIp: ip });
  return { id: Number(result.insertId) };
}

export async function updateGiftOpsCategory(actor: GiftEmployeeAccess, categoryId: number, input: Record<string, unknown>, ip?: string) {
  const [rows] = await databasePool().execute<RowDataPacket[]>('SELECT * FROM gift_model_categories WHERE id = ? LIMIT 1', [categoryId]);
  const current = rows[0];
  if (!current) throw new GiftAccessError('Category was not found.', 404, 'not_found');
  const status = ['active', 'inactive'].includes(String(input.status)) ? String(input.status) : String(current.category_status);
  if (status === 'inactive') {
    const [published] = await databasePool().execute<RowDataPacket[]>('SELECT id FROM gift_models WHERE category = ? AND publication_status = \'published\' LIMIT 1', [current.slug]);
    if (published[0]) throw new GiftAccessError('A category containing published models cannot be disabled.', 409, 'validation');
  }
  await databasePool().execute<ResultSetHeader>(`
    UPDATE gift_model_categories SET name_zh = ?, name_en = ?, description_zh = ?, description_en = ?, sort_order = ?, category_status = ? WHERE id = ?
  `, [
    stringOrNull(input.nameZh) || current.name_zh,
    input.nameEn === undefined ? current.name_en : stringOrNull(input.nameEn),
    input.descriptionZh === undefined ? current.description_zh : stringOrNull(input.descriptionZh),
    input.descriptionEn === undefined ? current.description_en : stringOrNull(input.descriptionEn),
    Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : current.sort_order,
    status, categoryId,
  ]);
  await recordGiftOpsAudit({ actorId: actor.id, action: 'category_updated', entityType: 'model_category', entityId: categoryId, summary: `${actor.name} 更新了模型分类 ${current.name_zh}`, payload: { status }, requestIp: ip });
}

function parseJson(value: unknown, fallback: unknown) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { return fallback; }
}

export async function createGiftOpsModel(actor: GiftEmployeeAccess, input: Record<string, unknown>, ip?: string) {
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const title = typeof input.titleZh === 'string' ? input.titleZh.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  if (!/^[a-z0-9][a-z0-9-]{1,126}[a-z0-9]$/.test(slug) || !title || !category) throw new GiftAccessError('Model slug, title, and category are required.', 400, 'not_found');
  const [categoryRows] = await databasePool().execute<RowDataPacket[]>('SELECT id FROM gift_model_categories WHERE slug = ? AND category_status = \'active\' LIMIT 1', [category]);
  if (!categoryRows[0]) throw new GiftAccessError('The selected model category is unavailable.', 409, 'validation');
  const status = typeof input.publicationStatus === 'string' && modelStatuses.has(input.publicationStatus) ? input.publicationStatus : 'draft';
  if (status === 'published') throw new GiftAccessError('Upload a model file and preview before publishing.', 409, 'validation');
  const tags = Array.isArray(input.tags) ? input.tags.filter((item) => typeof item === 'string').slice(0, 30) : [];
  const finishes = Array.isArray(input.supportedFinishes) ? input.supportedFinishes.filter((item) => typeof item === 'string').slice(0, 10) : [];
  const [result] = await databasePool().execute<ResultSetHeader>(`
    INSERT INTO gift_models (
      slug, source_type, title_zh, title_en, description_zh, description_en, category, use_case,
      tags, supported_finishes, publication_status, sort_order, created_by_employee_id,
      approved_by_employee_id, approved_at
    ) VALUES (?, 'catalog', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [slug, title, stringOrNull(input.titleEn), stringOrNull(input.descriptionZh), stringOrNull(input.descriptionEn), category, Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0, stringOrNull(input.useCase), JSON.stringify(tags), JSON.stringify(finishes), status, actor.id, status === 'published' ? actor.id : null, status === 'published' ? new Date() : null]);
  await recordGiftOpsAudit({ actorId: actor.id, action: 'model_created', entityType: 'model', entityId: result.insertId, summary: `${actor.name} 创建了模型 ${title}`, payload: { slug, status }, requestIp: ip });
  return { id: Number(result.insertId) };
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 5000) : null;
}

export async function updateGiftOpsModel(actor: GiftEmployeeAccess, modelId: number, input: Record<string, unknown>, ip?: string) {
  const [rows] = await databasePool().execute<RowDataPacket[]>('SELECT * FROM gift_models WHERE id = ? LIMIT 1', [modelId]);
  const current = rows[0];
  if (!current) throw new GiftAccessError('Model was not found.', 404, 'not_found');
  const status = typeof input.publicationStatus === 'string' && modelStatuses.has(input.publicationStatus) ? input.publicationStatus : current.publication_status;
  const category = stringOrNull(input.category) || current.category;
  const [categoryRows] = await databasePool().execute<RowDataPacket[]>('SELECT id FROM gift_model_categories WHERE slug = ? AND category_status = \'active\' LIMIT 1', [category]);
  if (!categoryRows[0]) throw new GiftAccessError('The selected model category is unavailable.', 409, 'validation');
  if (status === 'published' && (!current.model_asset_id || !current.preview_asset_id)) {
    throw new GiftAccessError('A model file and preview are required before publishing.', 409, 'validation');
  }
  await databasePool().execute<ResultSetHeader>(`
    UPDATE gift_models SET title_zh = ?, title_en = ?, description_zh = ?, description_en = ?, category = ?, sort_order = ?, use_case = ?,
      tags = ?, supported_finishes = ?, publication_status = ?,
      approved_by_employee_id = IF(? = 'published', ?, approved_by_employee_id),
      approved_at = IF(? = 'published', COALESCE(approved_at, CURRENT_TIMESTAMP(3)), approved_at)
    WHERE id = ?
  `, [
    stringOrNull(input.titleZh) || current.title_zh,
    input.titleEn === undefined ? current.title_en : stringOrNull(input.titleEn),
    input.descriptionZh === undefined ? current.description_zh : stringOrNull(input.descriptionZh),
    input.descriptionEn === undefined ? current.description_en : stringOrNull(input.descriptionEn),
    category,
    Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : current.sort_order,
    input.useCase === undefined ? current.use_case : stringOrNull(input.useCase),
    JSON.stringify(Array.isArray(input.tags) ? input.tags : parseJson(current.tags, [])),
    JSON.stringify(Array.isArray(input.supportedFinishes) ? input.supportedFinishes : parseJson(current.supported_finishes, [])),
    status, status, actor.id, status, modelId,
  ]);
  await recordGiftOpsAudit({ actorId: actor.id, action: 'model_updated', entityType: 'model', entityId: modelId, summary: `${actor.name} 更新了模型 ${current.title_zh}`, payload: { fromStatus: current.publication_status, toStatus: status }, requestIp: ip });
}

export async function listGiftOpsPrintRequests(status?: string) {
  const parameters: (string | number | null)[] = [];
  const allowed = ['submitted', 'reviewing', 'approved', 'rejected', 'queued', 'printing', 'ready', 'completed', 'cancelled'];
  const hasStatusFilter = Boolean(status && allowed.includes(status));
  const where = hasStatusFilter ? 'WHERE r.request_status = ?' : "WHERE r.request_status <> 'draft'";
  if (hasStatusFilter && status) parameters.push(status);
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT r.*, requester.display_name AS requester_name, assignee.display_name AS assignee_name, m.title_zh AS model_title
    FROM gift_print_requests r
    INNER JOIN gift_employees requester ON requester.id = r.requester_employee_id
    LEFT JOIN gift_employees assignee ON assignee.id = r.assigned_to_employee_id
    LEFT JOIN gift_models m ON m.id = r.model_id
    ${where} ORDER BY r.created_at DESC LIMIT 500
  `, parameters);
  return rows.map((row) => ({ ...row, id: Number(row.id), quantity: Number(row.quantity), specifications: parseJson(row.specifications, null) }));
}

export async function getGiftOpsPrintRequestDetail(actor: GiftEmployeeAccess, requestId: number) {
  return getGiftPrintRequestDetail(actor, requestId, true);
}

const requestTransitions: Record<string, Set<string>> = {
  submitted: new Set(['reviewing', 'rejected', 'cancelled']),
  reviewing: new Set(['approved', 'rejected', 'cancelled']),
  approved: new Set(['queued', 'cancelled']),
  queued: new Set(['printing', 'cancelled']),
  printing: new Set(['ready']),
  ready: new Set(['completed']),
  rejected: new Set(),
  completed: new Set(),
  cancelled: new Set(),
};

export async function updateGiftOpsPrintRequest(actor: GiftEmployeeAccess, requestId: number, input: Record<string, unknown>, ip?: string) {
  const allowed = new Set(['submitted', 'reviewing', 'approved', 'rejected', 'queued', 'printing', 'ready', 'completed', 'cancelled']);
  const status = typeof input.status === 'string' && allowed.has(input.status) ? input.status : null;
  if (!status) throw new GiftAccessError('Print request status is invalid.', 400, 'not_found');
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM gift_print_requests WHERE id = ? FOR UPDATE', [requestId]);
    const current = rows[0];
    if (!current) throw new GiftAccessError('Print request was not found.', 404, 'not_found');
    if (status !== current.request_status && !requestTransitions[String(current.request_status)]?.has(status)) {
      throw new GiftAccessError(`Cannot move a request from ${current.request_status} to ${status}.`, 409, 'validation');
    }
    const assigneeId = Number.isInteger(input.assigneeEmployeeId) ? Number(input.assigneeEmployeeId) : current.assigned_to_employee_id;
    if (assigneeId) {
      const [assigneeRows] = await connection.execute<RowDataPacket[]>(`
        SELECT id FROM gift_employees
        WHERE id = ? AND employment_status = 'active' AND approval_status = 'approved' AND role IN ('operator', 'admin')
        LIMIT 1
      `, [assigneeId]);
      if (!assigneeRows[0]) throw new GiftAccessError('The selected assignee is not an active operator.', 409, 'validation');
    }
    const batchNo = input.productionBatchNo === undefined ? current.production_batch_no : stringOrNull(input.productionBatchNo)?.slice(0, 64);
    const scheduledStartAt = input.scheduledStartAt === undefined ? current.scheduled_start_at : validDateTime(input.scheduledStartAt);
    const scheduledCompleteAt = input.scheduledCompleteAt === undefined ? current.scheduled_complete_at : validDateTime(input.scheduledCompleteAt);
    if (scheduledStartAt && scheduledCompleteAt && new Date(scheduledCompleteAt).getTime() < new Date(scheduledStartAt).getTime()) {
      throw new GiftAccessError('Scheduled completion cannot be earlier than the start time.', 400, 'validation');
    }
    if (status === 'queued' && (!assigneeId || !batchNo || !scheduledCompleteAt)) {
      throw new GiftAccessError('Assignee, production batch, and scheduled completion are required before queueing.', 400, 'validation');
    }
    const deliveryMethod = input.deliveryMethod === undefined ? current.delivery_method : stringOrNull(input.deliveryMethod)?.slice(0, 24);
    const deliveryRecipient = input.deliveryRecipient === undefined ? current.delivery_recipient : stringOrNull(input.deliveryRecipient)?.slice(0, 128);
    const deliveryNotes = input.deliveryNotes === undefined ? current.delivery_notes : stringOrNull(input.deliveryNotes)?.slice(0, 500);
    if (status === 'completed' && !deliveryRecipient) throw new GiftAccessError('Delivery recipient is required before completion.', 400, 'validation');
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_print_requests SET request_status = ?, assigned_to_employee_id = ?, production_batch_no = ?,
        scheduled_start_at = ?, scheduled_complete_at = ?, delivery_method = ?, delivery_recipient = ?, delivery_notes = ?,
        reviewed_by_employee_id = IF(? IN ('reviewing', 'approved', 'rejected'), ?, reviewed_by_employee_id),
        reviewed_at = IF(? IN ('reviewing', 'approved', 'rejected'), CURRENT_TIMESTAMP(3), reviewed_at),
        delivered_at = IF(? = 'ready', COALESCE(delivered_at, CURRENT_TIMESTAMP(3)), delivered_at),
        completed_at = IF(? = 'completed', COALESCE(completed_at, CURRENT_TIMESTAMP(3)), completed_at)
      WHERE id = ?
    `, [status, assigneeId || null, batchNo || null, scheduledStartAt || null, scheduledCompleteAt || null,
      deliveryMethod || null, deliveryRecipient || null, deliveryNotes || null,
      status, actor.id, status, status, status, requestId]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, from_status, to_status, comment_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [requestId, actor.id, status === current.request_status ? 'updated' : 'status_changed', current.request_status, status, stringOrNull(input.comment)]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_ops_audit_events (actor_employee_id, action_type, entity_type, entity_id, summary_text, event_payload, request_ip)
      VALUES (?, 'print_request_updated', 'print_request', ?, ?, ?, ?)
    `, [actor.id, String(requestId), `${actor.name} 将打印申请 ${current.request_no} 更新为 ${status}`, JSON.stringify({ fromStatus: current.request_status, toStatus: status }), ip || null]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function validDateTime(value: unknown) {
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new GiftAccessError('Schedule date is invalid.', 400, 'validation');
  return date;
}

export async function listGiftOpsAudit(search?: string) {
  const parameters: (string | number | null)[] = [];
  const where = search ? 'WHERE a.summary_text LIKE ? OR actor.display_name LIKE ? OR a.entity_id LIKE ?' : '';
  if (search) { const pattern = `%${search.slice(0, 100)}%`; parameters.push(pattern, pattern, pattern); }
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT a.*, actor.display_name AS actor_name FROM gift_ops_audit_events a
    LEFT JOIN gift_employees actor ON actor.id = a.actor_employee_id
    ${where} ORDER BY a.created_at DESC LIMIT 500
  `, parameters);
  return rows.map((row) => ({ id: Number(row.id), actorName: row.actor_name || '系统', action: row.action_type, entityType: row.entity_type, entityId: row.entity_id, summary: row.summary_text, payload: parseJson(row.event_payload, null), requestIp: row.request_ip, createdAt: new Date(row.created_at).toISOString() }));
}
