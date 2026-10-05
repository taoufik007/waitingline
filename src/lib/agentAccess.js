export function normalizeAssignedServiceIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.filter(Boolean).map(String))];
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  return [String(value)];
}

export function getAssignedServiceIds(user) {
  if (!user || typeof user !== 'object') {
    return [];
  }

  const serviceIds = normalizeAssignedServiceIds(user.assignedServiceIds);
  if (serviceIds.length > 0) {
    return serviceIds;
  }

  return normalizeAssignedServiceIds(user.assignedCounterIds);
}

export function getAgentAllowedServiceIds(user) {
  if (!user || String(user.role || '').toLowerCase() !== 'agent') {
    return [];
  }

  return getAssignedServiceIds(user);
}

export function filterAgentCounters(counters, user) {
  const allowed = new Set(getAgentAllowedServiceIds(user));

  if (!allowed.size) {
    return Array.isArray(counters) ? counters : [];
  }

  return (Array.isArray(counters) ? counters : []).filter((counter) => {
    const ids = Array.isArray(counter?.service_ids) ? counter.service_ids : [];
    if (!ids.length) {
      return false;
    }
    return ids.some((serviceId) => allowed.has(String(serviceId)));
  });
}

export function filterVisibleTickets(tickets, allowedServiceIds) {
  const allowed = new Set((Array.isArray(allowedServiceIds) ? allowedServiceIds : []).map(String));

  if (!allowed.size) {
    return Array.isArray(tickets) ? tickets : [];
  }

  return (Array.isArray(tickets) ? tickets : []).filter((ticket) => {
    const serviceId = ticket?.service_id;
    if (serviceId === undefined || serviceId === null || serviceId === '') {
      return false;
    }
    return allowed.has(String(serviceId));
  });
}
