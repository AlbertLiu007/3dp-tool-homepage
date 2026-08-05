import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { GiftSession } from '@/lib/gift-auth';
import type { VerifiedWeComEmployee } from '@/lib/wecom';

export type GiftApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type GiftEmployeeRole = 'employee' | 'operator' | 'admin';
export type GiftAiUsageType = 'render' | 'image_edit' | 'image_to_3d';

export type GiftQuota = {
  renderDailyLimit: number;
  editDailyLimit: number;
  modelDailyLimit: number;
  maxConcurrentJobs: number;
  renderUsed: number;
  editUsed: number;
  modelUsed: number;
};

export type GiftEmployeeAccess = {
  id: number;
  userId: string;
  name: string;
  departments: number[];
  departmentNames: string[];
  position: string | null;
  role: GiftEmployeeRole;
  employmentStatus: 'active' | 'inactive';
  approvalStatus: GiftApprovalStatus;
  appliedAt: string | null;
  reviewedAt: string | null;
  approvalNote: string | null;
  applicationReason: string | null;
  quota: GiftQuota;
};

export class GiftAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'configuration' | 'authentication' | 'approval' | 'quota' | 'forbidden' | 'not_found' | 'validation',
  ) {
    super(message);
    this.name = 'GiftAccessError';
  }
}

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftDatabasePool: Pool | undefined;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new GiftAccessError(`${name} is not configured.`, 503, 'configuration');
  return value;
}

export function databasePool() {
  if (globalThis.unionamGiftDatabasePool) return globalThis.unionamGiftDatabasePool;

  const database = required('GIFT_DB_NAME');
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new GiftAccessError('GIFT_DB_NAME is invalid.', 503, 'configuration');
  const password = readFileSync(path.resolve(required('GIFT_DB_PASSWORD_FILE')), 'utf8');
  if (!password) throw new GiftAccessError('The gift database password file is empty.', 503, 'configuration');
  const ssl = process.env.GIFT_DB_SSL === 'true'
    ? { ca: readFileSync(path.resolve(required('GIFT_DB_SSL_CA_FILE')), 'utf8'), rejectUnauthorized: true }
    : undefined;

  globalThis.unionamGiftDatabasePool = mysql.createPool({
    host: required('GIFT_DB_HOST'),
    port: Number(process.env.GIFT_DB_PORT || 3306),
    user: required('GIFT_DB_USER'),
    password,
    database,
    ssl,
    charset: 'utf8mb4',
    connectionLimit: 8,
    maxIdle: 4,
    idleTimeout: 60_000,
    queueLimit: 20,
    enableKeepAlive: true,
    connectTimeout: 10_000,
  });
  return globalThis.unionamGiftDatabasePool;
}

function parseDepartments(value: unknown) {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
}

function adminUserIds() {
  return new Set((process.env.GIFT_OPS_ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
}

export function isBootstrapGiftAdmin(userId: string) {
  return adminUserIds().has(userId);
}

function parseStrings(value: unknown) {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function accessFromRow(row: RowDataPacket): GiftEmployeeAccess {
  return {
    id: Number(row.id),
    userId: String(row.wecom_user_id),
    name: String(row.display_name),
    departments: parseDepartments(row.department_ids),
    departmentNames: parseStrings(row.department_names),
    position: row.position_name ? String(row.position_name) : null,
    role: row.role as GiftEmployeeRole,
    employmentStatus: row.employment_status as 'active' | 'inactive',
    approvalStatus: row.approval_status as GiftApprovalStatus,
    appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    approvalNote: row.approval_note ? String(row.approval_note) : null,
    applicationReason: row.application_reason ? String(row.application_reason) : null,
    quota: {
      renderDailyLimit: Number(row.render_daily_limit ?? 10),
      editDailyLimit: Number(row.edit_daily_limit ?? 10),
      modelDailyLimit: Number(row.model_daily_limit ?? 3),
      maxConcurrentJobs: Number(row.max_concurrent_jobs ?? 1),
      renderUsed: Number(row.render_used ?? 0),
      editUsed: Number(row.edit_used ?? 0),
      modelUsed: Number(row.model_used ?? 0),
    },
  };
}

const employeeAccessSelect = `
  SELECT e.*,
    COALESCE(q.render_daily_limit, 10) AS render_daily_limit,
    COALESCE(q.edit_daily_limit, 10) AS edit_daily_limit,
    COALESCE(q.model_daily_limit, 3) AS model_daily_limit,
    COALESCE(q.max_concurrent_jobs, 1) AS max_concurrent_jobs,
    COALESCE(SUM(CASE WHEN d.usage_type = 'render' THEN d.used_count ELSE 0 END), 0) AS render_used,
    COALESCE(SUM(CASE WHEN d.usage_type = 'image_edit' THEN d.used_count ELSE 0 END), 0) AS edit_used,
    COALESCE(SUM(CASE WHEN d.usage_type = 'image_to_3d' THEN d.used_count ELSE 0 END), 0) AS model_used
  FROM gift_employees e
  LEFT JOIN gift_ai_quota_policies q ON q.employee_id = e.id
  LEFT JOIN gift_ai_daily_usage d ON d.employee_id = e.id AND d.usage_date = CURRENT_DATE
`;

export async function registerVerifiedGiftEmployee(employee: VerifiedWeComEmployee) {
  const isAdmin = adminUserIds().has(employee.userId);
  const pool = databasePool();
  await pool.execute<ResultSetHeader>(`
    INSERT INTO gift_employees (
      corp_id, wecom_user_id, display_name, department_ids, department_names, position_name, role,
      employment_status, approval_status, applied_at, reviewed_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP(3), ?, CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      display_name = VALUES(display_name),
      department_ids = VALUES(department_ids),
      department_names = VALUES(department_names),
      position_name = VALUES(position_name),
      employment_status = 'active',
      last_login_at = CURRENT_TIMESTAMP(3),
      role = IF(VALUES(role) = 'admin', 'admin', role),
      approval_status = IF(VALUES(role) = 'admin', 'approved', approval_status),
      reviewed_at = IF(VALUES(role) = 'admin', COALESCE(reviewed_at, CURRENT_TIMESTAMP(3)), reviewed_at)
  `, [
    employee.corpId,
    employee.userId,
    employee.name,
    JSON.stringify(employee.departments),
    JSON.stringify(employee.departmentNames),
    employee.position,
    isAdmin ? 'admin' : 'employee',
    isAdmin ? 'approved' : 'pending',
    isAdmin ? new Date() : null,
  ]);
  const access = await getGiftEmployeeAccess({
    userId: employee.userId,
    name: employee.name,
    departments: employee.departments,
    corpId: employee.corpId,
    issuedAt: 0,
    expiresAt: Number.MAX_SAFE_INTEGER,
  });
  if (!access) throw new GiftAccessError('Employee registration could not be loaded.', 500, 'configuration');
  return access;
}

export async function getGiftEmployeeAccess(session: GiftSession) {
  if (process.env.NODE_ENV !== 'production' && session.userId === 'local-development-employee') {
    return {
      id: 0,
      userId: session.userId,
      name: session.name,
      departments: session.departments,
      departmentNames: ['本地开发部门'],
      position: 'Local developer',
      role: 'admin',
      employmentStatus: 'active',
      approvalStatus: 'approved',
      appliedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      approvalNote: null,
      applicationReason: '本地开发与页面验证',
      quota: { renderDailyLimit: 10, editDailyLimit: 10, modelDailyLimit: 3, maxConcurrentJobs: 1, renderUsed: 0, editUsed: 0, modelUsed: 0 },
    } satisfies GiftEmployeeAccess;
  }

  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    ${employeeAccessSelect}
    WHERE e.corp_id = ? AND e.wecom_user_id = ?
    GROUP BY e.id, q.employee_id
    LIMIT 1
  `, [session.corpId, session.userId]);
  return rows[0] ? accessFromRow(rows[0]) : null;
}

export async function requireGiftEmployeeAccess(session: GiftSession, options: { approved?: boolean; operator?: boolean } = {}) {
  const employee = await getGiftEmployeeAccess(session);
  if (!employee || employee.employmentStatus !== 'active') {
    throw new GiftAccessError('The employee account is not active.', 403, 'approval');
  }
  if (options.approved && employee.approvalStatus !== 'approved') {
    throw new GiftAccessError(`AI access is ${employee.approvalStatus}.`, 403, 'approval');
  }
  if (options.operator && !['operator', 'admin'].includes(employee.role)) {
    throw new GiftAccessError('Operator access is required.', 403, 'forbidden');
  }
  return employee;
}

export async function submitGiftEmployeeApplication(session: GiftSession, reason: string) {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5 || trimmedReason.length > 500) {
    throw new GiftAccessError('Application reason must contain 5 to 500 characters.', 400, 'approval');
  }
  const employee = await getGiftEmployeeAccess(session);
  if (!employee || employee.employmentStatus !== 'active') throw new GiftAccessError('The employee account is not active.', 403, 'approval');
  if (employee.approvalStatus === 'suspended') throw new GiftAccessError('A suspended employee cannot submit a new application.', 409, 'approval');
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT approval_status FROM gift_employees WHERE id = ? FOR UPDATE', [employee.id]);
    const fromStatus = rows[0]?.approval_status as GiftApprovalStatus | undefined;
    if (!fromStatus) throw new GiftAccessError('Employee was not found.', 404, 'not_found');
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_employees SET application_reason = ?, approval_status = 'pending', applied_at = CURRENT_TIMESTAMP(3),
        reviewed_at = NULL, reviewed_by_employee_id = NULL, approval_note = NULL
      WHERE id = ?
    `, [trimmedReason, employee.id]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_employee_approval_events (employee_id, actor_employee_id, from_status, to_status, note_text)
      VALUES (?, ?, ?, 'pending', ?)
    `, [employee.id, employee.id, fromStatus, trimmedReason]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGiftEmployeeAccess(session);
}

export async function listGiftEmployees(session: GiftSession, status?: GiftApprovalStatus) {
  await requireGiftEmployeeAccess(session, { approved: true, operator: true });
  const where = status ? 'WHERE e.approval_status = ?' : '';
  const parameters = status ? [status] : [];
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    ${employeeAccessSelect}
    ${where}
    GROUP BY e.id, q.employee_id
    ORDER BY FIELD(e.approval_status, 'pending', 'approved', 'suspended', 'rejected'), e.applied_at DESC
    LIMIT 500
  `, parameters);
  return rows.map(accessFromRow);
}

type EmployeeReviewInput = {
  approvalStatus: GiftApprovalStatus;
  note?: string;
  renderDailyLimit?: number;
  editDailyLimit?: number;
  modelDailyLimit?: number;
  maxConcurrentJobs?: number;
  role?: GiftEmployeeRole;
  requestIp?: string;
};

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new GiftAccessError('Quota value is invalid.', 400, 'quota');
  return value;
}

export async function reviewGiftEmployee(session: GiftSession, employeeId: number, input: EmployeeReviewInput) {
  const actor = await requireGiftEmployeeAccess(session, { approved: true, operator: true });
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new GiftAccessError('Employee ID is invalid.', 400, 'not_found');
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [employeeRows] = await connection.execute<RowDataPacket[]>('SELECT id, wecom_user_id, display_name, role, approval_status FROM gift_employees WHERE id = ? FOR UPDATE', [employeeId]);
    const target = employeeRows[0];
    if (!target) throw new GiftAccessError('Employee was not found.', 404, 'not_found');
    if (target.role === 'admin' && actor.role !== 'admin') throw new GiftAccessError('Only an administrator can review another administrator.', 403, 'forbidden');
    if (input.role && input.role !== target.role) {
      if (actor.role !== 'admin') throw new GiftAccessError('Only an administrator can change operator roles.', 403, 'forbidden');
      if (isBootstrapGiftAdmin(String(target.wecom_user_id)) && input.role !== 'admin') {
        throw new GiftAccessError('The bootstrap administrator cannot be demoted while configured in the environment.', 409, 'forbidden');
      }
      if (target.role === 'admin' && input.role !== 'admin') {
        const [adminRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM gift_employees WHERE role = 'admin' AND employment_status = 'active' FOR UPDATE");
        if (adminRows.length <= 1) throw new GiftAccessError('At least one active administrator is required.', 409, 'forbidden');
      }
    }

    const note = input.note?.trim().slice(0, 500) || null;
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_employees
      SET approval_status = ?, role = ?, reviewed_at = CURRENT_TIMESTAMP(3), reviewed_by_employee_id = ?, approval_note = ?
      WHERE id = ?
    `, [input.approvalStatus, input.role || target.role, actor.id, note, employeeId]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_employee_approval_events (employee_id, actor_employee_id, from_status, to_status, note_text)
      VALUES (?, ?, ?, ?, ?)
    `, [employeeId, actor.id, target.approval_status, input.approvalStatus, note]);

    const renderLimit = boundedInteger(input.renderDailyLimit, 10, 0, 1000);
    const editLimit = boundedInteger(input.editDailyLimit, 10, 0, 1000);
    const modelLimit = boundedInteger(input.modelDailyLimit, 3, 0, 1000);
    const concurrency = boundedInteger(input.maxConcurrentJobs, 1, 1, 10);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_ai_quota_policies (
        employee_id, render_daily_limit, edit_daily_limit, model_daily_limit, max_concurrent_jobs, updated_by_employee_id
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        render_daily_limit = VALUES(render_daily_limit),
        edit_daily_limit = VALUES(edit_daily_limit),
        model_daily_limit = VALUES(model_daily_limit),
        max_concurrent_jobs = VALUES(max_concurrent_jobs),
        updated_by_employee_id = VALUES(updated_by_employee_id)
    `, [employeeId, renderLimit, editLimit, modelLimit, concurrency, actor.id]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_ops_audit_events (
        actor_employee_id, action_type, entity_type, entity_id, summary_text, event_payload, request_ip
      ) VALUES (?, 'employee_reviewed', 'employee', ?, ?, ?, ?)
    `, [
      actor.id,
      String(employeeId),
      `${actor.name} 将 ${target.display_name} 的状态设置为 ${input.approvalStatus}`,
      JSON.stringify({ fromStatus: target.approval_status, toStatus: input.approvalStatus, fromRole: target.role, toRole: input.role || target.role, renderLimit, editLimit, modelLimit, concurrency }),
      input.requestIp || null,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const [rows] = await databasePool().execute<RowDataPacket[]>(`${employeeAccessSelect} WHERE e.id = ? GROUP BY e.id, q.employee_id`, [employeeId]);
  return accessFromRow(rows[0]);
}

function limitForType(row: RowDataPacket, usageType: GiftAiUsageType) {
  if (usageType === 'render') return Number(row.render_daily_limit);
  if (usageType === 'image_edit') return Number(row.edit_daily_limit);
  return Number(row.model_daily_limit);
}

export async function reserveGiftAiUsage(session: GiftSession, usageType: GiftAiUsageType, requestedId?: string, metadata?: { provider?: string; model?: string }) {
  const requestId = requestedId || randomUUID();
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new GiftAccessError('The idempotency key is invalid.', 400, 'quota');
  if (process.env.NODE_ENV !== 'production' && session.userId === 'local-development-employee') return { requestId: `dev-${requestId}` };
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [employeeRows] = await connection.execute<RowDataPacket[]>(`
      SELECT id, employment_status, approval_status FROM gift_employees
      WHERE corp_id = ? AND wecom_user_id = ? FOR UPDATE
    `, [session.corpId, session.userId]);
    const employee = employeeRows[0];
    if (!employee || employee.employment_status !== 'active' || employee.approval_status !== 'approved') {
      throw new GiftAccessError('AI access has not been approved.', 403, 'approval');
    }
    const [duplicateRows] = await connection.execute<RowDataPacket[]>('SELECT id FROM gift_ai_usage_events WHERE request_uid = ? LIMIT 1 FOR UPDATE', [requestId]);
    if (duplicateRows.length > 0) throw new GiftAccessError('This AI request has already been submitted.', 409, 'quota');
    await connection.execute<ResultSetHeader>('INSERT IGNORE INTO gift_ai_quota_policies (employee_id) VALUES (?)', [employee.id]);
    await connection.execute<ResultSetHeader>(`
      INSERT IGNORE INTO gift_ai_daily_usage (employee_id, usage_date, usage_type)
      VALUES (?, CURRENT_DATE, 'render'), (?, CURRENT_DATE, 'image_edit'), (?, CURRENT_DATE, 'image_to_3d')
    `, [employee.id, employee.id, employee.id]);
    const [staleRows] = await connection.execute<RowDataPacket[]>(`
      SELECT id, usage_date, usage_type FROM gift_ai_usage_events
      WHERE employee_id = ? AND usage_status IN ('reserved', 'running')
        AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 HOUR)
      FOR UPDATE
    `, [employee.id]);
    for (const stale of staleRows) {
      await connection.execute<ResultSetHeader>(`
        UPDATE gift_ai_daily_usage
        SET used_count = GREATEST(used_count - 1, 0), in_flight_count = GREATEST(in_flight_count - 1, 0)
        WHERE employee_id = ? AND usage_date = ? AND usage_type = ?
      `, [employee.id, stale.usage_date, stale.usage_type]);
      await connection.execute<ResultSetHeader>(`
        UPDATE gift_ai_usage_events
        SET usage_status = 'refunded', error_message = 'Automatically expired after 2 hours.', completed_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `, [stale.id]);
    }
    const [policyRows] = await connection.execute<RowDataPacket[]>('SELECT * FROM gift_ai_quota_policies WHERE employee_id = ? FOR UPDATE', [employee.id]);
    const [usageRows] = await connection.execute<RowDataPacket[]>('SELECT * FROM gift_ai_daily_usage WHERE employee_id = ? AND usage_date = CURRENT_DATE FOR UPDATE', [employee.id]);
    const policy = policyRows[0];
    const current = usageRows.find((row) => row.usage_type === usageType);
    if (!current || Number(current.used_count) >= limitForType(policy, usageType)) {
      throw new GiftAccessError('The daily AI quota has been reached.', 429, 'quota');
    }
    const inFlight = usageRows.reduce((sum, row) => sum + Number(row.in_flight_count), 0);
    if (inFlight >= Number(policy.max_concurrent_jobs)) {
      throw new GiftAccessError('Another AI job is already running.', 409, 'quota');
    }
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_ai_daily_usage
      SET used_count = used_count + 1, in_flight_count = in_flight_count + 1
      WHERE employee_id = ? AND usage_date = CURRENT_DATE AND usage_type = ?
    `, [employee.id, usageType]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_ai_usage_events (request_uid, employee_id, usage_date, usage_type, provider_name, model_name)
      VALUES (?, ?, CURRENT_DATE, ?, ?, ?)
    `, [requestId, employee.id, usageType, metadata?.provider?.slice(0, 64) || null, metadata?.model?.slice(0, 128) || null]);
    await connection.commit();
    return { requestId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markGiftAiUsageRunning(requestId: string, providerJobId: string) {
  if (requestId.startsWith('dev-')) return;
  await databasePool().execute<ResultSetHeader>(`
    UPDATE gift_ai_usage_events SET usage_status = 'running', provider_job_id = ?
    WHERE request_uid = ? AND usage_status = 'reserved'
  `, [providerJobId, requestId]);
}

export async function settleGiftAiUsage(requestId: string, outcome: 'succeeded' | 'refunded', error?: unknown) {
  if (requestId.startsWith('dev-')) return;
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM gift_ai_usage_events WHERE request_uid = ? FOR UPDATE', [requestId]);
    const usage = rows[0];
    if (!usage || ['succeeded', 'refunded'].includes(usage.usage_status)) {
      await connection.commit();
      return;
    }
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_ai_daily_usage
      SET used_count = GREATEST(used_count - ?, 0), in_flight_count = GREATEST(in_flight_count - 1, 0)
      WHERE employee_id = ? AND usage_date = ? AND usage_type = ?
    `, [outcome === 'refunded' ? 1 : 0, usage.employee_id, usage.usage_date, usage.usage_type]);
    const message = error instanceof Error ? error.message.slice(0, 500) : null;
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_ai_usage_events
      SET usage_status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP(3),
        duration_ms = TIMESTAMPDIFF(MICROSECOND, created_at, CURRENT_TIMESTAMP(3)) DIV 1000
      WHERE id = ?
    `, [outcome, message, usage.id]);
    await connection.commit();
  } catch (settleError) {
    await connection.rollback();
    throw settleError;
  } finally {
    connection.release();
  }
}

export async function getOwnedGiftAiJob(session: GiftSession, providerJobId: string) {
  if (process.env.NODE_ENV !== 'production' && session.userId === 'local-development-employee') return { requestId: 'dev-owned-job', status: 'running' };
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT u.request_uid, u.usage_status
    FROM gift_ai_usage_events u
    INNER JOIN gift_employees e ON e.id = u.employee_id
    WHERE e.corp_id = ? AND e.wecom_user_id = ? AND u.provider_job_id = ? AND u.usage_type = 'image_to_3d'
    LIMIT 1
  `, [session.corpId, session.userId, providerJobId]);
  if (!rows[0]) throw new GiftAccessError('The model job was not found.', 404, 'not_found');
  return { requestId: String(rows[0].request_uid), status: String(rows[0].usage_status) };
}
