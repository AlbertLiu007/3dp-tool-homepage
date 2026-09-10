import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaries } from './i18n/dictionaries';
import { createToolNavigation } from './tool-navigation';

const expectedHrefs = ['/quote', '/converter', '/gift', '/crm/'];

test('uses the fixed navigation order and localized labels', () => {
  assert.deepEqual(createToolNavigation(dictionaries.zh).map(({ label, href }) => ({ label, href })), [
    { label: '自动报价', href: '/quote' },
    { label: '格式转换', href: '/converter' },
    { label: '联泰礼品', href: '/gift' },
    { label: 'CRM 工作台', href: '/crm/' },
  ]);
  assert.deepEqual(createToolNavigation(dictionaries.en).map(({ label, href }) => ({ label, href })), [
    { label: 'Auto Quote', href: '/quote' },
    { label: 'Converter', href: '/converter' },
    { label: 'UnionTech Gifts', href: '/gift' },
    { label: 'CRM Workspace', href: '/crm/' },
  ]);
});

test('keeps the home navigation unselected and highlights only gifts on the gift page', () => {
  const home = createToolNavigation(dictionaries.zh);
  assert.deepEqual(home.map((item) => item.href), expectedHrefs);
  assert.equal(home.some((item) => item.active), false);

  const gift = createToolNavigation(dictionaries.zh, 'gift');
  assert.deepEqual(gift.filter((item) => item.active).map((item) => item.href), ['/gift']);
});
