export const normalizeRole = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['admin', 'agent', 'approver'].includes(normalized) ? normalized : 'unknown';
};

export const isAllowedRoute = (pathname, role) => {
  const route = String(pathname || '').trim();
  const normalizedRole = normalizeRole(role);

  if (!route) return false;
  if (normalizedRole === 'agent') {
    return route === '/agent' || route.startsWith('/agent?') || route.startsWith('/agent/');
  }

  if (normalizedRole === 'admin' || normalizedRole === 'approver') {
    return true;
  }

  return false;
};

export const getApprovedAgentCountForClient = (accounts = [], adminEmail = '') => {
  const target = String(adminEmail || '').trim().toLowerCase();
  if (!target) return 0;

  return (accounts || []).filter((account) => {
    const role = normalizeRole(account?.role);
    return role === 'agent' &&
      String(account?.parentAdminEmail || '').trim().toLowerCase() === target &&
      account?.approved === true;
  }).length;
};
