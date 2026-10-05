import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

const CHECK_INTERVAL_MS = 5000;

const getApprovalsToken = () => sessionStorage.getItem('approvals_token');

export default function SessionGuard() {
  useEffect(() => {
    const clearApprovalsSession = () => {
      sessionStorage.removeItem('approvals_token');
      sessionStorage.removeItem('approvals_user');
      localStorage.removeItem('approvals_token');
      localStorage.removeItem('approvals_user');
    };

    const checkSession = async () => {
      const userToken = base44.auth.getToken();
      if (userToken) {
        try {
          const res = await fetch('/api/session-check', {
            headers: { 'x-session-token': userToken },
          });
          if (!res.ok) {
            base44.auth.logout();
            toast({ title: 'Session terminée', description: 'Votre compte a été désactivé.' });
            window.location.href = '/login';
            return;
          }
        } catch {
          // erreur réseau : on ignore, on réessaiera au prochain tick
        }
      }

      const approverToken = getApprovalsToken();
      if (approverToken) {
        try {
          const res = await fetch('/api/session-check', {
            headers: { 'x-session-token': approverToken },
          });
          if (!res.ok) {
            clearApprovalsSession();
            toast({ title: 'Session terminée', description: 'Votre compte a été désactivé.' });
            window.location.href = '/approvals/login';
            return;
          }
        } catch {
          // erreur réseau : on ignore
        }
      }
    };

    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);
    checkSession();
    return () => clearInterval(interval);
  }, []);

  return null;
}