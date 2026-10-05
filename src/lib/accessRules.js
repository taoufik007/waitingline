export function isPublicAccessRoute(pathname = '') {
  const route = String(pathname || '').trim();
  if (!route) {
    return true;
  }

  const normalized = route.replace(/\/+$/, '') || '/';

  return (
    normalized === '/' ||
    normalized.startsWith('/mirror') ||
    normalized === '/ecran' ||
    normalized.startsWith('/approvals') ||
    normalized === '/login' ||
    normalized === '/register' ||
    normalized === '/forgot-password' ||
    normalized === '/reset-password' ||
    normalized === '/impersonate-bridge'
  );
}
