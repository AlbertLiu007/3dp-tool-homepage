import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { headers } from 'next/headers';
import {
  DEFAULT_APPLICATION_LOG_PATH,
  LOG_EVENTS,
  serializeApplicationLog,
  type ApplicationLogInput,
} from '@/lib/application-log';
import { INTERNAL_REQUEST_ID_HEADER } from '@/lib/request-id';

function currentRequestId() {
  try {
    return headers().get(INTERNAL_REQUEST_ID_HEADER) || randomUUID();
  } catch {
    return randomUUID();
  }
}

function configuredLogPath() {
  const configured = process.env.UNIONAM_APPLICATION_LOG_PATH?.trim();
  return configured && path.isAbsolute(configured) ? configured : DEFAULT_APPLICATION_LOG_PATH;
}

function appendToApplicationLog(line: string) {
  const logPath = configuredLogPath();
  void mkdir(path.dirname(logPath), { recursive: true })
    .then(() => appendFile(logPath, `${line}\n`, { encoding: 'utf8', mode: 0o640 }))
    .catch(() => undefined);
}

export function logApplicationEvent(input: Omit<ApplicationLogInput, 'requestId'> & { requestId?: string }) {
  try {
    const line = serializeApplicationLog({ ...input, requestId: input.requestId || currentRequestId() });
    if (input.level === 'error') console.error(line);
    else if (input.level === 'warn') console.warn(line);
    else console.log(line);
    appendToApplicationLog(line);
  } catch {
    // Application logging is deliberately fail-open and must never interrupt business operations.
  }
}

export function logAccessDenied(input: { component: 'gift' | 'gift-ops'; status: number; errorCode: string; durationMs?: number }) {
  logApplicationEvent({
    level: 'warn',
    component: input.component,
    event: LOG_EVENTS.accessDenied,
    result: 'denied',
    durationMs: input.durationMs,
    errorCode: input.errorCode,
    details: { status: input.status },
  });
}

export function logGiftOpsAuditEvent(input: {
  action: string;
  actorId: number;
  entityType: string;
  entityId: string | number;
  result?: string;
}) {
  logApplicationEvent({
    component: 'gift-ops',
    event: `audit.${input.action}`,
    result: input.result || 'succeeded',
    details: { actor_id: input.actorId, entity_type: input.entityType, entity_id: String(input.entityId) },
  });
}
