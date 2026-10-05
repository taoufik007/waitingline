import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicAccessRoute } from './accessRules.js';

test('public display and approvals routes remain open without a session', () => {
  assert.equal(isPublicAccessRoute('/mirror/abc123'), true);
  assert.equal(isPublicAccessRoute('/ecran'), true);
  assert.equal(isPublicAccessRoute('/approvals/login'), true);
  assert.equal(isPublicAccessRoute('/approvals'), true);
  assert.equal(isPublicAccessRoute('/kiosk'), false);
  assert.equal(isPublicAccessRoute('/admin'), false);
});
