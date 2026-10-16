import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseGiftGenerativeServices } from './gift-generative-access';

test('allows every active approved employee to use generative services', () => {
  assert.equal(canUseGiftGenerativeServices({ employmentStatus: 'active', approvalStatus: 'approved' }), true);
});

test('does not allow inactive or unapproved employees', () => {
  assert.equal(canUseGiftGenerativeServices({ employmentStatus: 'inactive', approvalStatus: 'approved' }), false);
  assert.equal(canUseGiftGenerativeServices({ employmentStatus: 'active', approvalStatus: 'pending' }), false);
  assert.equal(canUseGiftGenerativeServices({ employmentStatus: 'active', approvalStatus: 'rejected' }), false);
  assert.equal(canUseGiftGenerativeServices({ employmentStatus: 'active', approvalStatus: 'suspended' }), false);
});
