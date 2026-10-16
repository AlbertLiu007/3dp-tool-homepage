export type GiftGenerativeAccessSubject = {
  name: string;
  employmentStatus: 'active' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
};

const GIFT_GENERATIVE_SERVICE_ALLOWLIST = new Set(['刘子朔', '马海洋']);

export function isGiftGenerativeServiceAllowlisted(employee: Pick<GiftGenerativeAccessSubject, 'name'>) {
  return GIFT_GENERATIVE_SERVICE_ALLOWLIST.has(employee.name.trim());
}

/**
 * Production generative access requires both an approved, active employee and
 * an explicit allowlist entry. Quotas are enforced independently when a
 * render, edit, or model job is reserved.
 */
export function canUseGiftGenerativeServices(employee: GiftGenerativeAccessSubject) {
  return employee.employmentStatus === 'active'
    && employee.approvalStatus === 'approved'
    && isGiftGenerativeServiceAllowlisted(employee);
}
