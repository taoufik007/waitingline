import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function ImpersonateBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userRaw = params.get('user');

    if (token && userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw));
        base44.auth.setSession(token, user, { persistToLocal: false });
        base44.auth.setImpersonating({ name: user.name, email: user.email });
      } catch (e) {
        console.error('Impersonation bridge error', e);
      }
    }

    window.location.href = '/admin';
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}