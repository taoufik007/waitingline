import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { MoonStar, SunMedium, ShieldCheck, UserRound, Palette } from 'lucide-react';

const normalizeTheme = (value) => {
  const next = String(value || 'light').trim().toLowerCase();
  return next === 'dark' ? 'dark' : 'light';
};

const roleLabelMap = {
  admin: 'Administrateur',
  agent: 'Agent',
  approver: 'Approvisionneur',
  client: 'Client',
};

const getRights = (user) => {
  const role = String(user?.role || '').toLowerCase();
  const rights = [];

  if (role === 'admin') {
    rights.push('Gérer les services', 'Gérer les guichets', 'Créer des agents', 'Voir les statistiques');
  } else if (role === 'agent') {
    rights.push('Traiter les tickets', 'Voir les files assignées', 'Changer de guichet', 'Utiliser l’espace agent');
  } else if (user?.approver) {
    rights.push('Valider les comptes', 'Désactiver ou supprimer les comptes', 'Accéder aux comptes approuvés');
  } else {
    rights.push('Accéder à son espace personnel', 'Gérer l’interface de travail', 'Choisir son mode d’affichage');
  }

  return rights;
};

export default function UserAccountPanel({ user, onThemeChange }) {
  const { updateUserTheme } = useAuth();
  const currentTheme = normalizeTheme(user?.displayMode || 'light');
  const [saving, setSaving] = useState(false);

  const applyDocumentTheme = (theme) => {
    const root = document.documentElement;
    const normalized = normalizeTheme(theme);
    root.classList.toggle('dark', normalized === 'dark');
    root.dataset.theme = normalized;
  };

  const roleLabel = useMemo(() => {
    if (user?.approver) return 'Approvisionneur';
    return roleLabelMap[String(user?.role || '').toLowerCase()] || 'Utilisateur';
  }, [user]);

  const rights = useMemo(() => getRights(user), [user]);

  const applyTheme = async (nextTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);
    if (!user?.email) return;

    setSaving(true);
    try {
      const token = base44.auth.getToken() || window.localStorage.getItem('waitingline_token') || window.sessionStorage.getItem('waitingline_token') || '';
      const response = await fetch('/api/account/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': token,
        },
        body: JSON.stringify({ mode: normalizedTheme }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Impossible de mettre à jour le thème');

      const userKey = `waitingline_theme_${String(user.email || '').trim().toLowerCase().replace(/[@.]/g, '_')}`;
      window.localStorage.setItem('waitingline_active_theme', normalizedTheme);
      window.localStorage.setItem(userKey, normalizedTheme);
      window.sessionStorage.setItem('waitingline_active_theme', normalizedTheme);
      window.sessionStorage.setItem(userKey, normalizedTheme);

      applyDocumentTheme(normalizedTheme);
      updateUserTheme(normalizedTheme);

      if (onThemeChange) {
        onThemeChange(normalizedTheme);
      }
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Impossible de保存 ce paramètre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound size={24} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mon compte</p>
            <h2 className="text-xl font-bold text-foreground">{user?.name || user?.email || 'Utilisateur'}</h2>
          </div>
        </div>

        <div className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm font-medium text-foreground">
          {roleLabel}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Informations</p>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-right break-all">{user?.email || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Rôle</span>
              <span className="font-medium">{roleLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Statut</span>
              <span className="font-medium">{user?.active === false ? 'Désactivé' : 'Actif'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-primary" />
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mode d’affichage</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyTheme('light')}
              disabled={saving || currentTheme === 'light'}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                currentTheme === 'light'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
            >
              <SunMedium size={16} />
              Jour
            </button>

            <button
              type="button"
              onClick={() => applyTheme('dark')}
              disabled={saving || currentTheme === 'dark'}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                currentTheme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
            >
              <MoonStar size={16} />
              Nuit
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Ce choix est enregistré pour ce compte uniquement et n’affecte pas les autres utilisateurs.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background/60 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Droits et accès</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {rights.map((right) => (
            <span key={right} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
              {right}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2.5 py-1">Compte personnel</span>
        <span className="rounded-full bg-secondary px-2.5 py-1">Rôle: {roleLabel}</span>
        <span className="rounded-full bg-secondary px-2.5 py-1">Thème: {currentTheme === 'dark' ? 'Nuit' : 'Jour'}</span>
      </div>
    </div>
  );
}
