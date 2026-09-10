import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAcceptedUnionAmPrivacyPolicy, UNIONAM_PRIVACY_POLICY_VERSION } from './privacy';

test('accepts only the current UnionAM privacy policy version', () => {
  assert.equal(hasAcceptedUnionAmPrivacyPolicy(UNIONAM_PRIVACY_POLICY_VERSION), true);
  assert.equal(hasAcceptedUnionAmPrivacyPolicy(null), false);
  assert.equal(hasAcceptedUnionAmPrivacyPolicy('2026-09-09'), false);
});
