export const UNIONAM_PRIVACY_POLICY_VERSION = '2026-09-10';
export const UNIONAM_PRIVACY_POLICY_ACCEPTED_KEY = 'unionam_privacy_policy_version';

export function hasAcceptedUnionAmPrivacyPolicy(value: string | null) {
  return value === UNIONAM_PRIVACY_POLICY_VERSION;
}

export function readUnionAmPrivacyPolicyAcceptance() {
  if (typeof window === 'undefined') return false;
  return hasAcceptedUnionAmPrivacyPolicy(window.localStorage.getItem(UNIONAM_PRIVACY_POLICY_ACCEPTED_KEY));
}

export function acceptUnionAmPrivacyPolicy() {
  window.localStorage.setItem(UNIONAM_PRIVACY_POLICY_ACCEPTED_KEY, UNIONAM_PRIVACY_POLICY_VERSION);
}
