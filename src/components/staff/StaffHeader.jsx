import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { LayoutGrid, Settings, LogOut, Monitor, Tv } from 'lucide-react';

export default function StaffHeader({ user }) {
  const location = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || user?.approver;
  const isAgent = role === 'agent';

  const openKioskWindow = (path) => {
    const popup = window.open(
      path,
      '_blank',
      'noopener,noreferrer,toolbar=no,location=no,menubar=no,status=no,resizable=no,scrollbars=no,width=' + window.screen.width + ',height=' + window.screen.height + ',left=0,top=0'
    );

    if (popup) {
      popup.moveTo(0, 0);
      popup.resizeTo(window.screen.width, window.screen.height);
      popup.focus();
    }
  };

  const links = [
    ...(!isAgent ? [{ path: '/kiosk', label: 'Borne', icon: Monitor, newTab: true }] : []),
    { path: '/agent', label: 'Agent', icon: LayoutGrid },
    ...(isAdmin ? [{ path: '/admin', label: 'Configuration', icon: Settings }] : []),
    ...(isAdmin ? [{ path: '/ecran', label: 'Écran', icon: Tv, newTab: true }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm">FA</span>
            FileAttente
          </span>
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((l) => {
              const isCurrent = location.pathname === l.path;

              if (l.newTab) {
                return (
                  <a
                    key={l.path}
                    href={l.path}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </a>
                );
              }

              if (l.path === '/kiosk') {
                return (
                  <button
                    key={l.path}
                    type="button"
                    onClick={() => openKioskWindow(l.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </button>
                );
              }

              return (
                <Link
                  key={l.path}
                  to={l.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <l.icon size={16} />
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>
          <button
            onClick={() => base44.auth.logout('/login')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}