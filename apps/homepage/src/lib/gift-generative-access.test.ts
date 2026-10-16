import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseGiftGenerativeServices, isGiftGenerativeServiceAllowlisted } from './gift-generative-access';

test('allows Liu Zishuo and Ma Haiyang after employee approval', () => {
  assert.equal(canUseGiftGenerativeServices({ name: '刘子朔', employmentStatus: 'active', approvalStatus: 'approved' }), true);
  assert.equal(canUseGiftGenerativeServices({ name: ' 马海洋 ', employmentStatus: 'active', approvalStatus: 'approved' }), true);
});

test('keeps other approved employees outside the generative service allowlist', () => {
  assert.equal(isGiftGenerativeServiceAllowlisted({ name: '其他员工' }), false);
  assert.equal(canUseGiftGenerativeServices({ name: '其他员工', employmentStatus: 'active', approvalStatus: 'approved' }), false);
});

test('does not allow inactive or unapproved allowlisted employees', () => {
  assert.equal(canUseGiftGenerativeServices({ name: '刘子朔', employmentStatus: 'inactive', approvalStatus: 'approved' }), false);
  assert.equal(canUseGiftGenerativeServices({ name: '马海洋', employmentStatus: 'active', approvalStatus: 'pending' }), false);
  assert.equal(canUseGiftGenerativeServices({ name: '马海洋', employmentStatus: 'active', approvalStatus: 'rejected' }), false);
  assert.equal(canUseGiftGenerativeServices({ name: '马海洋', employmentStatus: 'active', approvalStatus: 'suspended' }), false);
});
