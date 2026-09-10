import assert from 'node:assert/strict';
import test from 'node:test';
import { GIFT_AI_CONSENT_HEADER, hasGiftAiScenarioConsent } from './gift-ai-consent';

test('requires provider-specific AI scenario consent', () => {
  assert.equal(hasGiftAiScenarioConsent(new Headers({ [GIFT_AI_CONSENT_HEADER]: 'apimart' }), 'apimart'), true);
  assert.equal(hasGiftAiScenarioConsent(new Headers({ [GIFT_AI_CONSENT_HEADER]: 'tripo' }), 'tripo'), true);
});

test('does not treat privacy-policy acceptance as AI scenario consent', () => {
  const generalPrivacyOnly = new Headers({ 'X-UnionAM-Privacy-Accepted': '2026-09-10' });
  assert.equal(hasGiftAiScenarioConsent(generalPrivacyOnly, 'apimart'), false);
  assert.equal(hasGiftAiScenarioConsent(generalPrivacyOnly, 'tripo'), false);
});

test('does not allow one provider consent to authorize another provider', () => {
  const apimartConsent = new Headers({ [GIFT_AI_CONSENT_HEADER]: 'apimart' });
  assert.equal(hasGiftAiScenarioConsent(apimartConsent, 'tripo'), false);
});
