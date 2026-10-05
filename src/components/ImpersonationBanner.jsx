import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function ImpersonationBanner() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    // ⚠️ base44.auth.getImpersonating() sait que ce drapeau est stocké dans
    // sessionStorage : ne jamais lire localStorage directement ici.
    setInfo(base44.auth.getImpersonating());
  }, []);

  if (!info) return null;

  const handleExit = () => {
    // ⚠️ base44.auth.logout() efface le token + user (sessionStorage),
    // et clearImpersonating() efface le drapeau d'impersonation —
    // les deux savent où sont réellement stockées ces données.
    base44.auth.logout();
    base44.auth.clearImpersonating();
    window.close();
    // si l'onglet n'a pas été ouvert par script, window.close() ne fait rien : on redirige en secours
    setTimeout(() => {
      window.location.href = '/approvals';
    }, 300);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
        color: '#fff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 14,
        fontFamily: 'inherit',
      }}
    >
      <span>
        Vous naviguez en tant que <strong>{info.name || info.email}</strong>
      </span>
      <button
        onClick={handleExit}
        style={{
          background: '#fff',
          color: '#4f46e5',
          border: 'none',
          borderRadius: 6,
          padding: '4px 14px',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Quitter
      </button>
    </div>
  );
}