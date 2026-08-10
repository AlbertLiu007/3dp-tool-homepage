import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { databasePool } from '@/lib/gift-db';
import { giftPublicUrl, sendWeComApplicationNews } from '@/lib/wecom';

type NotificationPayload = {
  title: string;
  description: string;
  url: string;
};

type NotificationRow = RowDataPacket & {
  id: number;
  recipient_user_ids: unknown;
  payload: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftNotificationRetryTimer: ReturnType<typeof setInterval> | undefined;
}

function ensureNotificationRetryWorker() {
  if (globalThis.unionamGiftNotificationRetryTimer) return;
  const timer = setInterval(() => {
    void deliverPendingGiftWeComNotifications().catch((error) => {
      console.error('[gift-wecom] Notification retry worker failed.', error);
    });
  }, 5 * 60 * 1000);
  timer.unref();
  globalThis.unionamGiftNotificationRetryTimer = timer;
}

function configuredRecipientIds() {
  const configured = process.env.WECOM_NOTIFY_USER_IDS || process.env.GIFT_OPS_ADMIN_USER_IDS || '';
  return [...new Set(configured.split(',').map((value) => value.trim()).filter(Boolean))];
}

function parseJsonValue<T>(value: unknown): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value as T;
}

async function notificationRecipientIds() {
  const configured = configuredRecipientIds();
  if (configured.length) return configured;

  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT wecom_user_id
    FROM gift_employees
    WHERE role = 'admin' AND employment_status = 'active' AND approval_status = 'approved'
    ORDER BY id
  `);
  return [...new Set(rows.map((row) => String(row.wecom_user_id).trim()).filter(Boolean))];
}

async function insertNotification(input: {
  key: string;
  type: 'request_submitted' | 'employee_application';
  requestId?: number;
  employeeId?: number;
  payload: NotificationPayload;
}) {
  const recipientUserIds = await notificationRecipientIds();
  if (!recipientUserIds.length) {
    console.warn('[gift-wecom] No notification recipient is configured; notification was not queued.');
    return false;
  }
  await databasePool().execute<ResultSetHeader>(`
    INSERT IGNORE INTO gift_notification_outbox (
      notification_key, notification_type, request_id, employee_id, recipient_user_ids, payload,
      status, attempt_count, next_attempt_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP(3))
  `, [input.key, input.type, input.requestId ?? null, input.employeeId ?? null, JSON.stringify(recipientUserIds), JSON.stringify(input.payload)]);
  return true;
}

async function buildRequestNotification(requestId: number) {
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT r.id, r.request_no, r.title, r.quantity, r.finish_type, r.paint_color,
      r.business_scene, e.display_name AS requester_name
    FROM gift_print_requests r
    INNER JOIN gift_employees e ON e.id = r.requester_employee_id
    WHERE r.id = ? AND r.request_status <> 'draft'
    LIMIT 1
  `, [requestId]);
  const row = rows[0];
  if (!row) return null;

  const finish = `${String(row.finish_type)}${row.paint_color ? ` ${String(row.paint_color)}` : ''}`;
  const description = [
    `${String(row.requester_name)} 提交了 ${String(row.title)}。`,
    `申请单：${String(row.request_no)} · 数量：${Number(row.quantity)} 件 · 工艺：${finish}`,
    row.business_scene ? `场景：${String(row.business_scene)}` : '',
  ].filter(Boolean).join('\n');
  return {
    key: `gift-request-submitted:${Number(row.id)}`,
    requestId: Number(row.id),
    payload: { title: `新的礼品打印申请：${String(row.request_no)}`, description, url: giftPublicUrl(`/ops?requestId=${Number(row.id)}`).toString() } satisfies NotificationPayload,
  };
}

async function buildEmployeeApplicationNotification(employeeId: number) {
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT id, display_name, department_names, position_name, application_reason, applied_at
    FROM gift_employees
    WHERE id = ? AND approval_status = 'pending' AND employment_status = 'active'
    LIMIT 1
  `, [employeeId]);
  const row = rows[0];
  if (!row) return null;

  const departmentNames = parseJsonValue<unknown>(row.department_names);
  const departments = Array.isArray(departmentNames) ? departmentNames.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  const appliedAt = row.applied_at ? new Date(row.applied_at).getTime() : Date.now();
  return {
    key: `gift-employee-application:${Number(row.id)}:${appliedAt}`,
    employeeId: Number(row.id),
    payload: {
      title: `新的 UnionAM 礼品站员工申请：${String(row.display_name)}`,
      description: [
        `${String(row.display_name)} 申请进入礼品站。`,
        departments.length ? `部门：${departments.join('、')}` : '',
        row.position_name ? `职位：${String(row.position_name)}` : '',
        row.application_reason ? `申请说明：${String(row.application_reason)}` : '',
      ].filter(Boolean).join('\n'),
      url: giftPublicUrl(`/ops?employeeId=${Number(row.id)}`).toString(),
    } satisfies NotificationPayload,
  };
}

export async function queueGiftRequestSubmittedNotification(requestId: number) {
  try {
    const notification = await buildRequestNotification(requestId);
    if (!notification) return;
    if (await insertNotification({ ...notification, type: 'request_submitted' })) {
      ensureNotificationRetryWorker();
      await deliverPendingGiftWeComNotifications(5);
    }
  } catch (error) {
    console.error('[gift-wecom] Failed to queue or deliver request notification.', error);
  }
}

export async function queueGiftEmployeeApplicationNotification(employeeId: number) {
  try {
    const notification = await buildEmployeeApplicationNotification(employeeId);
    if (!notification) return;
    if (await insertNotification({ ...notification, type: 'employee_application' })) {
      ensureNotificationRetryWorker();
      await deliverPendingGiftWeComNotifications(5);
    }
  } catch (error) {
    console.error('[gift-wecom] Failed to queue or deliver employee application notification.', error);
  }
}

export async function deliverPendingGiftWeComNotifications(limit = 5) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  await databasePool().execute<ResultSetHeader>(`
    UPDATE gift_notification_outbox
    SET status = 'failed', next_attempt_at = CURRENT_TIMESTAMP(3),
      last_error = COALESCE(last_error, 'Delivery worker was interrupted.'), updated_at = CURRENT_TIMESTAMP(3)
    WHERE status = 'sending' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE)
  `);
  const [rows] = await databasePool().execute<NotificationRow[]>(`
    SELECT id, recipient_user_ids, payload
    FROM gift_notification_outbox
    WHERE status IN ('pending', 'failed')
      AND attempt_count < 5
      AND next_attempt_at <= CURRENT_TIMESTAMP(3)
    ORDER BY created_at
    LIMIT ${safeLimit}
  `);

  for (const row of rows) {
    const [claim] = await databasePool().execute<ResultSetHeader>(`
      UPDATE gift_notification_outbox
      SET status = 'sending', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ? AND status IN ('pending', 'failed') AND attempt_count < 5
    `, [row.id]);
    if (claim.affectedRows !== 1) continue;

    try {
      const recipients = parseJsonValue<unknown>(row.recipient_user_ids);
      const payload = parseJsonValue<NotificationPayload>(row.payload);
      if (!Array.isArray(recipients) || !recipients.every((item) => typeof item === 'string')) throw new Error('Notification recipients are invalid.');
      await sendWeComApplicationNews({ userIds: recipients, ...payload });
      await databasePool().execute<ResultSetHeader>(`
        UPDATE gift_notification_outbox
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3), last_error = NULL
        WHERE id = ?
      `, [row.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WeCom notification error.';
      await databasePool().execute<ResultSetHeader>(`
        UPDATE gift_notification_outbox
        SET status = 'failed', next_attempt_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 5 MINUTE),
          last_error = ?, updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `, [message.slice(0, 2000), row.id]);
      console.error(`[gift-wecom] Notification ${row.id} failed.`, error);
    }
  }
}
