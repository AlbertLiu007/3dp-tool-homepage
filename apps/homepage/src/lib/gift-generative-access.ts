export type GiftGenerativeAccessSubject = {
  employmentStatus: 'active' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
};

/**
 * Generative access is controlled by the employee review state. Quotas are
 * enforced independently when a render, edit, or model job is reserved.
 */
export function canUseGiftGenerativeServices(employee: GiftGenerativeAccessSubject) {
  return employee.employmentStatus === 'active' && employee.approvalStatus === 'approved';
}
