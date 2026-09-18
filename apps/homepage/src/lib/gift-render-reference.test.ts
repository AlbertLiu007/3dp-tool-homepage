import assert from 'node:assert/strict';
import test from 'node:test';
import { isPersonRenderReference, parseRenderReferencePurposes, toggleRenderReferencePurpose } from './gift-render-reference';

test('parses several purposes per image and accepts legacy single-purpose requests', () => {
  assert.deepEqual(parseRenderReferencePurposes([['facial_features', 'hairstyle'], ['material_color']], 2), [['facial_features', 'hairstyle'], ['material_color']]);
  assert.deepEqual(parseRenderReferencePurposes(['subject_identity'], 1), [['subject_identity']]);
  assert.deepEqual(parseRenderReferencePurposes([], 0), []);
});

test('rejects missing, duplicate, unknown and contradictory purposes', () => {
  for (const value of [[[]], [['hairstyle', 'hairstyle']], [['auto', 'hairstyle']], [['unknown']], ['hairstyle', 'material_color']]) {
    assert.equal(parseRenderReferencePurposes(value, 1), null);
  }
});

test('multi-select makes auto exclusive and keeps a valid fallback', () => {
  assert.deepEqual(toggleRenderReferencePurpose(['auto'], 'facial_features'), ['facial_features']);
  assert.deepEqual(toggleRenderReferencePurpose(['facial_features'], 'hairstyle'), ['facial_features', 'hairstyle']);
  assert.deepEqual(toggleRenderReferencePurpose(['facial_features'], 'facial_features'), ['auto']);
  assert.deepEqual(toggleRenderReferencePurpose(['hairstyle'], 'auto'), ['auto']);
  assert.equal(isPersonRenderReference(['facial_features', 'hairstyle']), true);
  assert.equal(isPersonRenderReference(['material_color']), false);
});
