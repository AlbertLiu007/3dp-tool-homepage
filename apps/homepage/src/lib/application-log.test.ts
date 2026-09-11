import assert from 'node:assert/strict';
import test from 'node:test';
import { LOG_EVENTS, createApplicationLogRecord, sanitizeLogValue, serializeApplicationLog } from './application-log';
import { createTrustedRequestId } from './request-id';

test('application log is single-line JSON with required fields', () => {
  const line = serializeApplicationLog({
    time: '2026-09-11T00:00:00.000Z',
    level: 'info',
    component: 'gift',
    event: 'gift.test',
    result: 'succeeded',
    requestId: '018f-test-request',
    durationMs: 12.4,
  });
  assert.equal(line.includes('\n'), false);
  const record = JSON.parse(line);
  for (const field of ['time', 'level', 'service', 'environment', 'event', 'result', 'request_id', 'duration_ms', 'error_code']) {
    assert.ok(Object.hasOwn(record, field), `missing ${field}`);
  }
  assert.equal(record.service, 'unionam-homepage');
  assert.equal(record.duration_ms, 12);
});

test('recursive sanitizer redacts sensitive fields and content patterns', () => {
  const value = sanitizeLogValue({
    password: 'secret', token: 'token-value', Authorization: 'Bearer abc', cookie: 'session=x',
    nested: { email: 'employee@example.com', phone: '13800138000', access_key: 'key', signature: 'sig' },
    message: 'Bearer abc.def token=raw employee@example.com 13800138000',
    filename: 'customer-model.stl',
  }) as Record<string, unknown>;
  assert.equal(value.password, '[REDACTED]');
  assert.equal(value.filename, '[REDACTED]');
  assert.deepEqual(value.nested, { email: '[REDACTED]', phone: '[REDACTED]', access_key: '[REDACTED]', signature: '[REDACTED]' });
  assert.doesNotMatch(String(value.message), /abc\.def|token=raw|employee@example|13800138000/);
  const nestedArray = sanitizeLogValue([{ safe: 'ok', api_key: 'hidden' }]) as Array<Record<string, unknown>>;
  assert.deepEqual(nestedArray, [{ safe: 'ok', api_key: '[REDACTED]' }]);
});

test('sanitizer limits untrusted strings, object size, array size and recursion', () => {
  const value = sanitizeLogValue({
    long: 'x'.repeat(2000),
    array: Array.from({ length: 100 }, (_, index) => index),
    nested: { one: { two: { three: { four: { five: { six: 'hidden' } } } } } },
  }) as Record<string, unknown>;
  assert.match(String(value.long), /\[TRUNCATED\]$/);
  assert.equal((value.array as unknown[]).length, 50);
  assert.equal((value.nested as { one: { two: { three: { four: { five: unknown } } } } }).one.two.three.four.five, '[MAX_DEPTH]');
});

test('external text cannot inject additional log lines', () => {
  const record = createApplicationLogRecord({
    event: 'audit.test', result: 'succeeded', requestId: 'request-1',
    details: { message: 'first\r\n{"level":"error"}\u0000' },
  });
  assert.equal(String((record.details as Record<string, unknown>).message), 'first\\r\\n{"level":"error"}\\u0000');
  assert.equal(JSON.stringify(record).split('\n').length, 1);
});

test('critical event catalog covers real authentication, audit, task and asset operations', () => {
  assert.deepEqual([
    LOG_EVENTS.weComLoginSucceeded,
    LOG_EVENTS.accessDenied,
    LOG_EVENTS.employeeApprovalChanged,
    LOG_EVENTS.quoteSettingsUpdated,
    LOG_EVENTS.printRequestCreated,
    LOG_EVENTS.aiJobCreated,
    LOG_EVENTS.aiProviderAttemptStarted,
    LOG_EVENTS.notificationFailed,
    LOG_EVENTS.ossAssetRead,
  ], [
    'auth.wecom_login.succeeded',
    'security.access_denied',
    'audit.employee_approval.changed',
    'audit.quote_settings.updated',
    'audit.print_request.created',
    'task.ai.created',
    'task.ai_provider_attempt.started',
    'task.wecom_notification.failed',
    'audit.oss_asset.read',
  ]);
});

test('trusted request IDs never reuse the public value', () => {
  const attackerControlled = 'public-forged-request-id';
  const first = createTrustedRequestId(attackerControlled);
  const second = createTrustedRequestId(attackerControlled);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(first, attackerControlled);
  assert.notEqual(first, second);
});
