import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest } from '@farmassist/ai/manifest';

test('unit runner loads the class manifest without network or DB', () => {
  assert.equal(loadClassManifest().classes.length, 30);
});
