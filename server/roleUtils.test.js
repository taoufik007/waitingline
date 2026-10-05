import test from 'node:test';
import assert from 'node:assert/strict';

import { getApprovedAgentCountForClient, isAllowedRoute, normalizeRole } from './roleUtils.js';

test('normalizeRole keeps the role consistent', () => {
  assert.equal(normalizeRole('AGENT'), 'agent');
  assert.equal(normalizeRole('Admin'), 'admin');
  assert.equal(normalizeRole('unknown'), 'unknown');
});

test('agent access is limited to the agent page', () => {
  assert.equal(isAllowedRoute('/agent', 'agent'), true);
  assert.equal(isAllowedRoute('/admin', 'agent'), false);
  assert.equal(isAllowedRoute('/admin', 'admin'), true);
  assert.equal(isAllowedRoute('/login', 'agent'), false);
});

test('approved agent count is computed per parent client', () => {
  const accounts = [
    { email: 'admin1@example.com', role: 'admin', approved: true },
    { email: 'agent1@example.com', role: 'agent', approved: true, parentAdminEmail: 'admin1@example.com' },
    { email: 'agent2@example.com', role: 'agent', approved: true, parentAdminEmail: 'admin1@example.com' },
    { email: 'agent3@example.com', role: 'agent', approved: false, parentAdminEmail: 'admin1@example.com' },
    { email: 'agent4@example.com', role: 'agent', approved: true, parentAdminEmail: 'admin2@example.com' },
  ];

  assert.equal(getApprovedAgentCountForClient(accounts, 'admin1@example.com'), 2);
  assert.equal(getApprovedAgentCountForClient(accounts, 'admin2@example.com'), 1);
});
