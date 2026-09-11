export type ApplicationLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ApplicationLogInput = {
  level?: ApplicationLogLevel;
  component?: 'homepage' | 'gift' | 'gift-ops' | 'background';
  event: string;
  result: string;
  requestId: string;
  durationMs?: number;
  errorCode?: string | null;
  details?: unknown;
  time?: string;
};

export type ApplicationLogRecord = {
  time: string;
  level: ApplicationLogLevel;
  service: string;
  environment: string;
  component: string;
  event: string;
  result: string;
  request_id: string;
  duration_ms: number;
  error_code: string | null;
  details?: unknown;
};

export const APPLICATION_LOG_SERVICE = 'unionam-homepage';
export const DEFAULT_APPLICATION_LOG_PATH = `/var/log/unionam/${APPLICATION_LOG_SERVICE}/application.jsonl`;

const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_DEPTH = 6;
const REDACTED = '[REDACTED]';

const sensitiveField = /(?:^|[_-])(?:password|passwd|pwd|token|authorization|cookie|secret|phone|mobile|email|access[_-]?key|api[_-]?key|signature|signed[_-]?url|session|csrf|otp|verification[_-]?code|filename|file[_-]?name|object[_-]?key|request[_-]?body|body|prompt|image|file[_-]?content|model[_-]?content|environment[_-]?variables?|process[_-]?env|env)(?:$|[_-])/i;

export const LOG_EVENTS = {
  httpRequestAccepted: 'http.request.accepted',
  accessDenied: 'security.access_denied',
  weComLoginSucceeded: 'auth.wecom_login.succeeded',
  weComLoginFailed: 'auth.wecom_login.failed',
  employeeApplicationSubmitted: 'audit.employee_application.submitted',
  employeeApprovalChanged: 'audit.employee_approval.changed',
  quoteSettingsUpdated: 'audit.quote_settings.updated',
  printRequestCreated: 'audit.print_request.created',
  printRequestSubmitted: 'audit.print_request.submitted',
  printRequestUpdated: 'audit.print_request.updated',
  printRequestCancelled: 'audit.print_request.cancelled',
  aiJobCreated: 'task.ai.created',
  aiJobStarted: 'task.ai.started',
  aiJobCompleted: 'task.ai.completed',
  aiJobFailed: 'task.ai.failed',
  aiJobCancelled: 'task.ai.cancelled',
  aiProviderAttemptStarted: 'task.ai_provider_attempt.started',
  aiProviderAttemptCompleted: 'task.ai_provider_attempt.completed',
  aiProviderAttemptFailed: 'task.ai_provider_attempt.failed',
  notificationCreated: 'task.wecom_notification.created',
  notificationStarted: 'task.wecom_notification.started',
  notificationCompleted: 'task.wecom_notification.completed',
  notificationFailed: 'task.wecom_notification.failed',
  ossAssetRead: 'audit.oss_asset.read',
} as const;

function sanitizeString(value: string) {
  const escaped = value
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(?:password|passwd|token|authorization|cookie|secret|access[_-]?key|api[_-]?key|signature|otp|verification[_-]?code)=([^\s&]+)/gi, (match) => `${match.slice(0, match.indexOf('=') + 1)}[REDACTED]`)
    .replace(/https?:\/\/[^\s?]+\?[^\s]+/gi, '[REDACTED_URL]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, REDACTED);
  return escaped.length <= MAX_STRING_LENGTH ? escaped : `${escaped.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`;
}

export function isSensitiveLogField(key: string) {
  return sensitiveField.test(key);
}

export function sanitizeLogValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return '[UNSUPPORTED]';
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (value instanceof Error) {
    return { type: sanitizeString(value.name || 'Error'), message: sanitizeString(value.message || 'Unknown error') };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeLogValue(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      const safeKey = sanitizeString(key);
      result[safeKey] = isSensitiveLogField(key) ? REDACTED : sanitizeLogValue(item, depth + 1, seen);
    }
    return result;
  }
  return sanitizeString(String(value));
}

function safeToken(value: string, fallback: string) {
  const normalized = sanitizeString(value).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
  return normalized || fallback;
}

export function createApplicationLogRecord(input: ApplicationLogInput): ApplicationLogRecord {
  const record: ApplicationLogRecord = {
    time: input.time || new Date().toISOString(),
    level: input.level || 'info',
    service: APPLICATION_LOG_SERVICE,
    environment: safeToken(process.env.NODE_ENV || 'development', 'development'),
    component: input.component || 'homepage',
    event: safeToken(input.event, 'application.event'),
    result: safeToken(input.result, 'unknown'),
    request_id: safeToken(input.requestId, 'unknown'),
    duration_ms: Math.max(0, Math.round(Number(input.durationMs) || 0)),
    error_code: input.errorCode ? safeToken(input.errorCode, 'unknown') : null,
  };
  if (input.details !== undefined) record.details = sanitizeLogValue(input.details);
  return record;
}

export function serializeApplicationLog(input: ApplicationLogInput) {
  try {
    return JSON.stringify(createApplicationLogRecord(input));
  } catch {
    return JSON.stringify(createApplicationLogRecord({
      event: 'application.log_serialization_failed',
      result: 'failed',
      requestId: input.requestId || 'unknown',
      level: 'error',
      errorCode: 'log_serialization',
    }));
  }
}
