export const INTERNAL_REQUEST_ID_HEADER = 'x-unionam-request-id';

export function createTrustedRequestId(_untrustedRequestId?: string | null) {
  return crypto.randomUUID();
}
