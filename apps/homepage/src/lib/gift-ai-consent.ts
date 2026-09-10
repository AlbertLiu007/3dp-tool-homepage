export type GiftAiConsentProvider = 'apimart' | 'tripo';

export const GIFT_AI_CONSENT_HEADER = 'X-UnionAM-AI-Consent';

export function hasGiftAiScenarioConsent(headers: Headers, expectedProvider: GiftAiConsentProvider) {
  return headers.get(GIFT_AI_CONSENT_HEADER)?.trim().toLowerCase() === expectedProvider;
}
