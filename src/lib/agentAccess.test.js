import test from 'node:test';
import assert from 'node:assert/strict';

import { filterAgentCounters, getAgentAllowedServiceIds, filterVisibleTickets } from './agentAccess.js';

test('agent sees only counters for assigned services', () => {
  const user = {
    role: 'agent',
    assignedServiceIds: ['svc-2', 'svc-3'],
  };

  const counters = [
    { id: 'c1', service_ids: ['svc-1'] },
    { id: 'c2', service_ids: ['svc-2'] },
    { id: 'c3', service_ids: ['svc-3', 'svc-4'] },
    { id: 'c4', service_ids: [] },
  ];

  assert.deepEqual(filterAgentCounters(counters, user).map((c) => c.id), ['c2', 'c3']);
  assert.deepEqual(getAgentAllowedServiceIds(user), ['svc-2', 'svc-3']);
});

test('tickets outside assigned services are hidden for agent', () => {
  const tickets = [
    { id: 't1', service_id: 'svc-1', status: 'waiting' },
    { id: 't2', service_id: 'svc-2', status: 'waiting' },
    { id: 't3', service_id: 'svc-9', status: 'waiting' },
  ];

  assert.deepEqual(filterVisibleTickets(tickets, ['svc-2']).map((t) => t.id), ['t2']);
});

test('agent can keep multiple assigned services', () => {
  const user = {
    role: 'agent',
    assignedServiceIds: ['svc-2', 'svc-5'],
  };

  assert.deepEqual(getAgentAllowedServiceIds(user), ['svc-2', 'svc-5']);
});

test('agent falls back to legacy assignedCounterIds when assignedServiceIds is empty', () => {
  const user = {
    role: 'agent',
    assignedServiceIds: [],
    assignedCounterIds: ['svc-4', 'svc-5'],
  };

  assert.deepEqual(getAgentAllowedServiceIds(user), ['svc-4', 'svc-5']);
});
