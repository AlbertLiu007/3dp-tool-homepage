import { randomBytes } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { databasePool, GiftAccessError, requireGiftEmployeeAccess, type GiftEmployeeAccess } from '@/lib/gift-db';
import type { GiftSession } from '@/lib/gift-auth';

const requestTypes = new Set(['catalog_gift', 'ai_gift', 'business_sample']);
const finishTypes = new Set(['white', 'paint', 'bronze', 'other']);
const cancellableStatuses = new Set(['submitted', 'reviewing', 'approved', 'queued']);

export type GiftAiDraftInput = {
  draftRequestId?: unknown;
  title?: unknown;
  businessScene?: unknown;
  finishType?: unknown;
  paintColor?: unknown;
  requestNotes?: unknown;
  specifications?: unknown;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function text(value: unknown, max: number, required = false) {
  const result = typeof value === 'string' ? value.trim().slice(0, max) : '';
  if (required && !result) throw new GiftAccessError('Required request information is missing.', 400, 'validation');
  return result || null;
}

function positiveInteger(value: unknown, fallback = 1, max = 10000) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new GiftAccessError('Request quantity is invalid.', 400, 'validation');
  return number;
}

function dateOnly(value: unknown) {
  if (!value) return null;
  const result = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(new Date(`${result}T00:00:00Z`).getTime())) {
    throw new GiftAccessError('Requested completion date is invalid.', 400, 'validation');
  }
  return result;
}

function normalizeModel(row: RowDataPacket) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    titleZh: String(row.title_zh),
    titleEn: row.title_en ? String(row.title_en) : null,
    descriptionZh: row.description_zh ? String(row.description_zh) : null,
    descriptionEn: row.description_en ? String(row.description_en) : null,
    category: String(row.category),
    categoryNameZh: String(row.category_name_zh || row.category),
    categoryNameEn: row.category_name_en ? String(row.category_name_en) : null,
    useCase: row.use_case ? String(row.use_case) : null,
    tags: parseJson<string[]>(row.tags, []),
    supportedFinishes: parseJson<string[]>(row.supported_finishes, []),
    modelFormat: row.model_format ? String(row.model_format) : null,
    previewAssetId: row.preview_asset_id ? Number(row.preview_asset_id) : null,
    modelAssetId: row.model_asset_id ? Number(row.model_asset_id) : null,
    dimensions: row.dimension_x_mm === null ? null : {
      x: Number(row.dimension_x_mm), y: Number(row.dimension_y_mm), z: Number(row.dimension_z_mm),
    },
  };
}

export async function listPublishedGiftModels(session: GiftSession) {
  await requireGiftEmployeeAccess(session);
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT m.*, c.name_zh AS category_name_zh, c.name_en AS category_name_en
    FROM gift_models m
    INNER JOIN gift_model_categories c ON c.slug = m.category AND c.category_status = 'active'
    WHERE m.publication_status = 'published'
    ORDER BY c.sort_order, m.updated_at DESC
  `);
  const [categoryRows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT slug, name_zh, name_en, description_zh, description_en
    FROM gift_model_categories WHERE category_status = 'active' ORDER BY sort_order, id
  `);
  return {
    models: rows.map(normalizeModel),
    categories: categoryRows.map((row) => ({
      slug: String(row.slug), nameZh: String(row.name_zh), nameEn: row.name_en ? String(row.name_en) : null,
      descriptionZh: row.description_zh ? String(row.description_zh) : null,
      descriptionEn: row.description_en ? String(row.description_en) : null,
    })),
  };
}

function normalizeRequest(row: RowDataPacket) {
  return {
    id: Number(row.id),
    requestNo: String(row.request_no),
    requesterEmployeeId: Number(row.requester_employee_id),
    requesterName: row.requester_name ? String(row.requester_name) : null,
    requestType: String(row.request_type),
    modelId: row.model_id ? Number(row.model_id) : null,
    modelTitle: row.model_title ? String(row.model_title) : null,
    title: String(row.title),
    customerCompany: row.customer_company ? String(row.customer_company) : null,
    businessScene: row.business_scene ? String(row.business_scene) : null,
    quantity: Number(row.quantity),
    finishType: String(row.finish_type),
    paintColor: row.paint_color ? String(row.paint_color) : null,
    requestedCompletionDate: row.requested_completion_date ? String(row.requested_completion_date).slice(0, 10) : null,
    pickupLocation: row.pickup_location ? String(row.pickup_location) : null,
    requestNotes: row.request_notes ? String(row.request_notes) : null,
    specifications: parseJson<Record<string, unknown> | null>(row.specifications, null),
    priority: String(row.priority),
    status: String(row.request_status),
    assigneeEmployeeId: row.assigned_to_employee_id ? Number(row.assigned_to_employee_id) : null,
    assigneeName: row.assignee_name ? String(row.assignee_name) : null,
    productionBatchNo: row.production_batch_no ? String(row.production_batch_no) : null,
    scheduledStartAt: row.scheduled_start_at ? new Date(row.scheduled_start_at).toISOString() : null,
    scheduledCompleteAt: row.scheduled_complete_at ? new Date(row.scheduled_complete_at).toISOString() : null,
    deliveryMethod: row.delivery_method ? String(row.delivery_method) : null,
    deliveryRecipient: row.delivery_recipient ? String(row.delivery_recipient) : null,
    deliveryNotes: row.delivery_notes ? String(row.delivery_notes) : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const requestSelect = `
  SELECT r.*, requester.display_name AS requester_name, assignee.display_name AS assignee_name,
    m.title_zh AS model_title
  FROM gift_print_requests r
  INNER JOIN gift_employees requester ON requester.id = r.requester_employee_id
  LEFT JOIN gift_employees assignee ON assignee.id = r.assigned_to_employee_id
  LEFT JOIN gift_models m ON m.id = r.model_id
`;

function giftRequestNumber() {
  return `UG${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizedDraftFinish(input: GiftAiDraftInput) {
  const finishType = typeof input.finishType === 'string' && finishTypes.has(input.finishType) ? input.finishType : 'white';
  const paintColor = finishType === 'paint' && typeof input.paintColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(input.paintColor)
    ? input.paintColor.toUpperCase()
    : null;
  return { finishType, paintColor };
}

export async function ensureGiftAiDraft(session: GiftSession, input: GiftAiDraftInput = {}) {
  const employee = await requireGiftEmployeeAccess(session, { approved: true });
  const requestedDraftId = input.draftRequestId === undefined || input.draftRequestId === null || input.draftRequestId === ''
    ? null
    : Number(input.draftRequestId);
  if (requestedDraftId !== null && (!Number.isInteger(requestedDraftId) || requestedDraftId <= 0)) {
    throw new GiftAccessError('Draft request ID is invalid.', 400, 'validation');
  }
  const title = text(input.title, 255) || 'AI 礼品设计草稿';
  const businessScene = text(input.businessScene, 128);
  const requestNotes = text(input.requestNotes, 5000);
  const specifications = input.specifications && typeof input.specifications === 'object' ? JSON.stringify(input.specifications) : null;
  const { finishType, paintColor } = normalizedDraftFinish(input);
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    if (requestedDraftId !== null) {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT id, request_no FROM gift_print_requests
        WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' AND request_status = 'draft'
        FOR UPDATE
      `, [requestedDraftId, employee.id]);
      if (!rows[0]) throw new GiftAccessError('AI gift draft was not found.', 404, 'not_found');
      await connection.execute<ResultSetHeader>(`
        UPDATE gift_print_requests
        SET title = ?, business_scene = COALESCE(?, business_scene), finish_type = ?, paint_color = ?,
          request_notes = COALESCE(?, request_notes), specifications = COALESCE(?, specifications),
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `, [title, businessScene, finishType, paintColor, requestNotes, specifications, requestedDraftId]);
      await connection.commit();
      return { id: requestedDraftId, requestNo: String(rows[0].request_no) };
    }

    const requestNo = giftRequestNumber();
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_print_requests (
        request_no, requester_employee_id, request_type, title, business_scene, quantity, finish_type,
        paint_color, pickup_location, request_notes, specifications, priority, request_status
      ) VALUES (?, ?, 'ai_gift', ?, ?, 1, ?, ?, '上海总部前台', ?, ?, 'normal', 'draft')
    `, [requestNo, employee.id, title, businessScene, finishType, paintColor, requestNotes, specifications]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, to_status, comment_text)
      VALUES (?, ?, 'created', 'draft', '系统创建 AI 礼品设计草稿')
    `, [result.insertId, employee.id]);
    await connection.commit();
    return { id: Number(result.insertId), requestNo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function submitGiftAiDraft(session: GiftSession, draftRequestId: number, input: Record<string, unknown>) {
  const employee = await requireGiftEmployeeAccess(session, { approved: true });
  if (!Number.isInteger(draftRequestId) || draftRequestId <= 0) throw new GiftAccessError('Draft request ID is invalid.', 400, 'validation');
  const finishType = typeof input.finishType === 'string' && finishTypes.has(input.finishType) ? input.finishType : 'white';
  const paintColor = finishType === 'paint' && typeof input.paintColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(input.paintColor)
    ? input.paintColor.toUpperCase()
    : null;
  if (finishType === 'paint' && !paintColor) throw new GiftAccessError('Paint color is required.', 400, 'validation');
  const title = text(input.title, 255, true);
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(`
      SELECT id, request_no FROM gift_print_requests
      WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' AND request_status = 'draft'
      FOR UPDATE
    `, [draftRequestId, employee.id]);
    if (!rows[0]) throw new GiftAccessError('AI gift draft was not found.', 404, 'not_found');
    const [assetRows] = await connection.execute<RowDataPacket[]>(`
      SELECT a.id FROM gift_request_attachments ra
      INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
      WHERE ra.request_id = ? AND a.asset_kind = 'model_file'
      ORDER BY ra.created_at DESC LIMIT 1
    `, [draftRequestId]);
    if (!assetRows[0]) throw new GiftAccessError('Generate a 3D model before submitting the print request.', 409, 'validation');
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_print_requests SET title = ?, customer_company = ?, business_scene = ?, quantity = ?,
        finish_type = ?, paint_color = ?, requested_completion_date = ?, pickup_location = ?, request_notes = ?,
        specifications = ?, source_asset_id = ?, request_status = 'submitted', submitted_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
    `, [
      title, text(input.customerCompany, 255), text(input.businessScene, 128), positiveInteger(input.quantity),
      finishType, paintColor, dateOnly(input.requestedCompletionDate), text(input.pickupLocation, 255) || '上海总部前台',
      text(input.requestNotes, 5000), input.specifications && typeof input.specifications === 'object' ? JSON.stringify(input.specifications) : null,
      assetRows[0].id, draftRequestId,
    ]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, from_status, to_status, comment_text)
      VALUES (?, ?, 'status_changed', 'draft', 'submitted', '员工提交 AI 礼品打印申请')
    `, [draftRequestId, employee.id]);
    await connection.commit();
    return { id: draftRequestId, requestNo: String(rows[0].request_no) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createGiftPrintRequest(session: GiftSession, input: Record<string, unknown>) {
  const employee = await requireGiftEmployeeAccess(session);
  const requestType = typeof input.requestType === 'string' && requestTypes.has(input.requestType) ? input.requestType : null;
  if (!requestType) throw new GiftAccessError('Request type is invalid.', 400, 'validation');
  const finishType = typeof input.finishType === 'string' && finishTypes.has(input.finishType) ? input.finishType : 'white';
  const paintColor = finishType === 'paint' && typeof input.paintColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(input.paintColor) ? input.paintColor.toUpperCase() : null;
  if (finishType === 'paint' && !paintColor) throw new GiftAccessError('Paint color is required.', 400, 'validation');
  const modelId = input.modelId === null || input.modelId === undefined ? null : Number(input.modelId);
  if (modelId !== null && (!Number.isInteger(modelId) || modelId <= 0)) throw new GiftAccessError('Model ID is invalid.', 400, 'validation');
  if (requestType === 'catalog_gift' && !modelId) throw new GiftAccessError('A catalog model is required.', 400, 'validation');
  if (modelId) {
    const [modelRows] = await databasePool().execute<RowDataPacket[]>('SELECT id FROM gift_models WHERE id = ? AND publication_status = \'published\' LIMIT 1', [modelId]);
    if (!modelRows[0]) throw new GiftAccessError('The selected model is unavailable.', 409, 'validation');
  }
  const requestNo = giftRequestNumber();
  const title = text(input.title, 255, true);
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_print_requests (
        request_no, requester_employee_id, request_type, model_id, title, customer_company, business_scene,
        quantity, finish_type, paint_color, requested_completion_date, pickup_location, request_notes,
        specifications, priority, request_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
    `, [
      requestNo, employee.id, requestType, modelId, title, text(input.customerCompany, 255), text(input.businessScene, 128),
      positiveInteger(input.quantity), finishType, paintColor, dateOnly(input.requestedCompletionDate),
      text(input.pickupLocation, 255) || '上海总部前台', text(input.requestNotes, 5000),
      input.specifications && typeof input.specifications === 'object' ? JSON.stringify(input.specifications) : null,
      ['low', 'normal', 'high', 'urgent'].includes(String(input.priority)) ? String(input.priority) : 'normal',
    ]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, to_status, comment_text)
      VALUES (?, ?, 'created', 'submitted', ?)
    `, [result.insertId, employee.id, '员工提交打印申请']);
    await connection.commit();
    return { id: Number(result.insertId), requestNo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listMyGiftPrintRequests(session: GiftSession) {
  const employee = await requireGiftEmployeeAccess(session);
  const [rows] = await databasePool().execute<RowDataPacket[]>(`${requestSelect} WHERE r.requester_employee_id = ? ORDER BY r.created_at DESC LIMIT 200`, [employee.id]);
  return rows.map(normalizeRequest);
}

export async function getGiftPrintRequestDetail(employee: GiftEmployeeAccess, requestId: number, operator = false) {
  if (!Number.isInteger(requestId) || requestId <= 0) throw new GiftAccessError('Request ID is invalid.', 400, 'validation');
  const parameters = operator ? [requestId] : [requestId, employee.id];
  const ownership = operator ? '' : 'AND r.requester_employee_id = ?';
  const [[requestRows], [eventRows], [attachmentRows]] = await Promise.all([
    databasePool().execute<RowDataPacket[]>(`${requestSelect} WHERE r.id = ? ${ownership} LIMIT 1`, parameters),
    databasePool().execute<RowDataPacket[]>(`
      SELECT e.id, e.event_type, e.from_status, e.to_status, e.comment_text, e.event_payload, e.created_at,
        actor.display_name AS actor_name
      FROM gift_request_events e LEFT JOIN gift_employees actor ON actor.id = e.actor_employee_id
      INNER JOIN gift_print_requests r ON r.id = e.request_id
      WHERE e.request_id = ? ${operator ? '' : 'AND r.requester_employee_id = ?'} ORDER BY e.created_at
    `, parameters),
    databasePool().execute<RowDataPacket[]>(`
      SELECT ra.id, ra.asset_id, ra.attachment_role, ra.visible_to_requester, ra.created_at,
        a.original_filename, a.content_type, a.file_extension, a.size_bytes,
        uploader.display_name AS uploader_name
      FROM gift_request_attachments ra
      INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
      INNER JOIN gift_print_requests r ON r.id = ra.request_id
      LEFT JOIN gift_employees uploader ON uploader.id = ra.uploaded_by_employee_id
      WHERE ra.request_id = ? ${operator ? '' : 'AND r.requester_employee_id = ? AND ra.visible_to_requester = 1'}
      ORDER BY ra.created_at
    `, parameters),
  ]);
  if (!requestRows[0]) throw new GiftAccessError('Print request was not found.', 404, 'not_found');
  return {
    request: normalizeRequest(requestRows[0]),
    events: eventRows.map((row) => ({
      id: Number(row.id), type: String(row.event_type), fromStatus: row.from_status ? String(row.from_status) : null,
      toStatus: row.to_status ? String(row.to_status) : null, comment: row.comment_text ? String(row.comment_text) : null,
      payload: parseJson(row.event_payload, null), actorName: row.actor_name ? String(row.actor_name) : '系统',
      createdAt: new Date(row.created_at).toISOString(),
    })),
    attachments: attachmentRows.map((row) => ({
      id: Number(row.id), assetId: Number(row.asset_id), role: String(row.attachment_role), filename: String(row.original_filename || '附件'),
      contentType: row.content_type ? String(row.content_type) : null, extension: row.file_extension ? String(row.file_extension) : null,
      size: row.size_bytes === null ? null : Number(row.size_bytes), visibleToRequester: Boolean(row.visible_to_requester),
      uploaderName: row.uploader_name ? String(row.uploader_name) : null, createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

export async function getMyGiftPrintRequestDetail(session: GiftSession, requestId: number) {
  const employee = await requireGiftEmployeeAccess(session);
  return getGiftPrintRequestDetail(employee, requestId, false);
}

export async function cancelMyGiftPrintRequest(session: GiftSession, requestId: number, reason: string) {
  const employee = await requireGiftEmployeeAccess(session);
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT request_status FROM gift_print_requests WHERE id = ? AND requester_employee_id = ? FOR UPDATE', [requestId, employee.id]);
    const current = rows[0];
    if (!current) throw new GiftAccessError('Print request was not found.', 404, 'not_found');
    if (!cancellableStatuses.has(String(current.request_status))) throw new GiftAccessError('This request can no longer be cancelled.', 409, 'validation');
    await connection.execute<ResultSetHeader>('UPDATE gift_print_requests SET request_status = \'cancelled\' WHERE id = ?', [requestId]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, from_status, to_status, comment_text)
      VALUES (?, ?, 'cancelled', ?, 'cancelled', ?)
    `, [requestId, employee.id, current.request_status, (reason.trim() || '员工取消申请').slice(0, 500)]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function canAccessGiftAsset(employee: GiftEmployeeAccess, assetId: number) {
  if (['operator', 'admin'].includes(employee.role)) return true;
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT a.id FROM gift_assets a
    WHERE a.id = ? AND a.asset_status = 'active' AND (
      EXISTS (SELECT 1 FROM gift_models m WHERE m.publication_status = 'published' AND (m.model_asset_id = a.id OR m.preview_asset_id = a.id))
      OR EXISTS (
        SELECT 1 FROM gift_request_attachments ra
        INNER JOIN gift_print_requests r ON r.id = ra.request_id
        WHERE ra.asset_id = a.id AND r.requester_employee_id = ? AND ra.visible_to_requester = 1
      )
    ) LIMIT 1
  `, [assetId, employee.id]);
  return Boolean(rows[0]);
}
