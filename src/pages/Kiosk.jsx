import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { nextTicketCode, isToday } from '@/lib/ticketUtils';
import { printTicket } from '@/lib/printTicket';
import { Loader2, CheckCircle2, ArrowLeft, HeartHandshake } from 'lucide-react';

const DEFAULT_KIOSK_CONFIG = {
  accentColor: '#2563eb',
  backgroundColor: '#0f172a',
  backgroundGradientStart: '#0f172a',
  backgroundGradientEnd: '#1e293b',
  backgroundType: 'gradient',
  effect: 'glow',
  logo: '',
  displayMode: 'landscape',
  fullscreen: true,
  showMirrorQr: true,
  showPriorityOption: true,
  hideAdminLink: true,
};

const readKioskConfig = () => {
  if (typeof window === 'undefined') return DEFAULT_KIOSK_CONFIG;

  try {
    const stored = JSON.parse(window.localStorage.getItem('waitingline_kiosk_config') || '{}');
    return { ...DEFAULT_KIOSK_CONFIG, ...stored };
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
};

const getViewportMode = () => {
  if (typeof window === 'undefined') {
    return { isPortrait: false, isCompact: false, ratio: 16 / 9 };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = width / Math.max(height, 1);

  return {
    isPortrait: height > width,
    isCompact: width < 900 || height < 700,
    ratio,
  };
};

const getContrastTextColor = (hexColor = '#ffffff') => {
  const cleaned = String(hexColor || '#ffffff').replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((char) => char + char).join('')
    : cleaned;

  if (normalized.length !== 6) return '#ffffff';

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

const getDisplayTokenMap = () => {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.localStorage.getItem('waitingline_display_token_map') || '{}');
  } catch {
    return {};
  }
};

const saveDisplayTokenMap = (map) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('waitingline_display_token_map', JSON.stringify(map));
};

const createMirrorToken = (email = '') => {
  const value = String(email || '').trim();

  if (!value) {
    return 'admin-display-default';
  }

  try {
    const encoded = btoa(unescape(encodeURIComponent(value)));
    return encodeURIComponent(encoded.replace(/=+$/g, '')).replace(/%/g, '-');
  } catch {
    return encodeURIComponent(value.replace(/[^a-zA-Z0-9_-]/g, '-'));
  }
};

const getDisplayTokenForEmail = (email = '') => {
  const value = String(email || '').trim();
  if (!value) return 'admin-display-default';

  const map = getDisplayTokenMap();
  if (map[value]) return map[value];

  const token = createMirrorToken(value);
  map[value] = token;
  saveDisplayTokenMap(map);
  return token;
};

export default function Kiosk() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [priority, setPriority] = useState(false);
  const [printError, setPrintError] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [kioskConfig, setKioskConfig] = useState(() => readKioskConfig());
  const [viewport, setViewport] = useState(() => getViewportMode());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentDisplayToken = useMemo(() => getDisplayTokenForEmail(adminEmail), [adminEmail]);

  const mirrorUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/mirror';
    const token = currentDisplayToken || 'admin-display-default';
    const baseOrigin = window.location.origin || 'http://localhost:5173';
    return `${baseOrigin}/mirror/${token}`;
  }, [currentDisplayToken]);

  const qrCodeUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mirrorUrl)}`,
    [mirrorUrl]
  );

  const ticketQrCodeUrl = useMemo(() => {
    if (!ticket) return '';

    const payload = {
      type: 'waitingline-ticket',
      code: ticket.code || '',
      number: ticket.number || '',
      service: ticket.serviceName || '',
      createdAt: new Date().toISOString(),
    };

    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify(payload))}`;
  }, [ticket]);

  useEffect(() => {
    const activeEmail = window.sessionStorage.getItem('waitingline_active_user') || window.localStorage.getItem('waitingline_active_user') || '';
    setAdminEmail(activeEmail);
  }, []);

  useEffect(() => {
    const syncConfig = () => setKioskConfig(readKioskConfig());
    const syncViewport = () => setViewport(getViewportMode());

    const enterKioskMode = async () => {
      try {
        const root = document.documentElement;
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        }
      } catch {
        // Browser may block fullscreen without a user gesture; keep app usable in normal mode.
      }

      try {
        if (screen.orientation && screen.orientation.lock) {
          const targetOrientation = isPortraitKiosk ? 'portrait' : 'landscape';
          await screen.orientation.lock(targetOrientation);
        }
      } catch {
        // Orientation locking is optional and can fail on some devices/browsers.
      }
    };

    const lockPage = () => {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.msUserSelect = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.touchAction = 'none';
      document.documentElement.style.userSelect = 'none';
      document.documentElement.style.webkitUserSelect = 'none';
      document.documentElement.style.msUserSelect = 'none';
    };

    const releasePage = () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.msUserSelect = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.touchAction = '';
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
      document.documentElement.style.msUserSelect = '';
    };

    const suppressBrowserActions = (event) => {
      const forbiddenKeys = ['F11', 'Escape', 'Tab'];
      if (forbiddenKeys.includes(event.key)) {
        event.preventDefault();
      }

      if ((event.ctrlKey || event.metaKey) && ['r', 'R', 'w', 'W', 't', 'T', 'p', 'P'].includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === 'F5') {
        event.preventDefault();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('waitingline-kiosk-config-updated', syncConfig);
    window.addEventListener('storage', syncConfig);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('keydown', suppressBrowserActions, { passive: false });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    lockPage();
    enterKioskMode();
    syncViewport();

    return () => {
      window.removeEventListener('waitingline-kiosk-config-updated', syncConfig);
      window.removeEventListener('storage', syncConfig);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('keydown', suppressBrowserActions);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', (event) => event.preventDefault());
      document.removeEventListener('touchmove', (event) => event.preventDefault());
      releasePage();
    };
  }, []);

  useEffect(() => {
    base44.entities.Service.filter({ active: true }, 'name').then((res) => {
      setServices(res);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!ticket) return;

    const resetTimer = setTimeout(() => {
      setTicket(null);
      setPriority(false);
    }, 8000);

    return () => clearTimeout(resetTimer);
  }, [ticket]);

  useEffect(() => {
    if (!printError) return;

    const timeout = setTimeout(() => setPrintError(null), 10000);
    return () => clearTimeout(timeout);
  }, [printError]);

  const handleTakeTicket = async (service) => {
    if (creating || printing) return;

    setCreating(true);

    try {
      const existing = await base44.entities.Ticket.filter({ service_id: service.id }, '-created_date', 300);
      const todaysCount = existing.filter((t) => isToday(t.created_date)).length;
      const { number, code } = nextTicketCode(service.prefix, todaysCount);
      const newTicket = await base44.entities.Ticket.create({
        number,
        code,
        service_id: service.id,
        category: priority ? 'priority' : 'normal',
        status: 'waiting',
      });
      const waitingAhead = existing.filter((t) => t.status === 'waiting' && isToday(t.created_date)).length;
      const generatedTicket = { ...newTicket, serviceName: service.name, waitingAhead };
      setTicket(generatedTicket);

      try {
        setPrinting(true);
        await printTicket(generatedTicket);
      } catch (error) {
        const ticketCode = generatedTicket.code || generatedTicket.number || 'Ticket';
        setPrintError(`Impossible d'imprimer. Veuillez vous adresser à l'accueil. Votre numéro : ${ticketCode}`);
      } finally {
        setPrinting(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const kioskBackground = kioskConfig.backgroundType === 'gradient'
    ? `linear-gradient(135deg, ${kioskConfig.backgroundGradientStart}, ${kioskConfig.backgroundGradientEnd})`
    : kioskConfig.backgroundColor;

  const isPortraitKiosk = kioskConfig.displayMode === 'portrait' || viewport.isPortrait;
  const kioskTargetSize = isPortraitKiosk
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
  const kioskFrameClass = isPortraitKiosk ? 'max-w-[440px]' : 'max-w-[920px]';

  const kioskFrameStyle = {
    width: isPortraitKiosk ? 'min(100vw - 2rem, 1080px)' : 'min(100vw - 2rem, 1920px)',
    height: isPortraitKiosk ? 'min(100vh - 2rem, 1920px)' : 'min(100vh - 2rem, 1080px)',
    maxHeight: 'calc(100vh - 2rem)',
    aspectRatio: isPortraitKiosk ? '1080 / 1920' : '1920 / 1080',
  };

  const visibleServices = services.slice(0, 5);
  const serviceStackClass = 'flex flex-col gap-3 w-full flex-1 justify-center';
  const serviceButtonMinHeight = (() => {
    const count = Math.min(visibleServices.length, 5);

    if (count === 1) return isPortraitKiosk ? '200px' : '170px';
    if (count === 2) return isPortraitKiosk ? '150px' : '130px';
    if (count === 3) return isPortraitKiosk ? '120px' : '100px';
    if (count === 4) return isPortraitKiosk ? '96px' : '84px';
    return isPortraitKiosk ? '82px' : '72px';
  })();

  const titleSizeClass = viewport.isCompact ? 'text-2xl' : 'text-3xl';
  const subtitleSizeClass = viewport.isCompact ? 'text-xs' : 'text-sm';
  const qrSizeClass = viewport.isCompact ? 'h-28 w-28' : 'h-32 w-32';

  const effectClass = kioskConfig.effect === 'glow'
    ? 'shadow-[0_0_60px_rgba(37,99,235,0.18)]'
    : kioskConfig.effect === 'shadow'
      ? 'shadow-2xl'
      : kioskConfig.effect === 'blur'
        ? 'backdrop-blur-md'
        : '';

  const pageBackgroundStyle = {
    background: kioskBackground,
    color: '#f8fafc',
  };

  if (ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={pageBackgroundStyle}>
        {printError && (
          <div className="absolute left-1/2 top-4 z-30 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-amber-400/70 bg-amber-500/90 px-4 py-3 text-center text-sm font-medium text-slate-950 shadow-xl shadow-amber-900/20">
            {printError}
          </div>
        )}

        <div className={`max-w-md w-full text-center ${effectClass}`}>
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <p className="text-slate-300 text-sm uppercase tracking-[0.2em] mb-3">{ticket.serviceName}</p>
          <p className="text-slate-400 text-sm mb-2">Votre numéro</p>
          <p className="font-heading text-8xl font-extrabold text-white mb-6 tracking-tight">{ticket.code}</p>
          <p className="text-slate-300">
            {ticket.waitingAhead > 0
              ? `${ticket.waitingAhead} personne${ticket.waitingAhead > 1 ? 's' : ''} devant vous`
              : 'Vous êtes le prochain !'}
          </p>

          {ticketQrCodeUrl && (
            <div className="mt-6 flex flex-col items-center">
              <img
                src={ticketQrCodeUrl}
                alt="QR code du ticket"
                className="h-36 w-36 rounded-2xl border border-slate-700 bg-white p-2 shadow-lg"
              />
              <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-slate-400">Ticket QR</p>
            </div>
          )}

          <p className="text-slate-500 text-xs mt-8">Retour automatique à l'accueil...</p>
          <button
            onClick={() => setTicket(null)}
            className="mt-6 inline-flex items-center gap-2 text-slate-300 hover:text-white text-sm"
          >
            <ArrowLeft size={16} />
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${kioskConfig.fullscreen ? 'min-h-screen' : 'min-h-[90vh]'} relative flex items-center justify-center px-6 py-4 ${effectClass}`}
      style={{
        ...pageBackgroundStyle,
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
    >
      {kioskConfig.showMirrorQr && (
        <div className="absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/10 p-2.5 shadow-xl shadow-slate-950/30 backdrop-blur-sm">
          <img
            src={qrCodeUrl}
            alt="QR code pour l'écran miroir"
            className={`${qrSizeClass} rounded-xl border border-slate-700 bg-white p-1 shadow-sm`}
          />
        </div>
      )}

      {printError && (
        <div className="absolute left-1/2 top-4 z-30 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-amber-400/70 bg-amber-500/90 px-4 py-3 text-center text-sm font-medium text-slate-950 shadow-xl shadow-amber-900/20">
          {printError}
        </div>
      )}

      <div
        className={`${kioskFrameClass} w-full flex flex-col justify-between gap-3 pt-8`}
        style={kioskFrameStyle}
      >
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <div className="mb-2 text-center">
            {kioskConfig.logo ? (
              <img
                src={kioskConfig.logo}
                alt="Logo de la borne"
                className="mx-auto mb-2 h-24 w-auto max-w-[220px] object-contain bg-transparent"
                style={{ background: 'transparent' }}
              />
            ) : (
              <div className="mb-3 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-200">
                Waiting Line
              </div>
            )}
            <p className={`text-slate-400 uppercase tracking-[0.25em] mb-2 ${subtitleSizeClass}`}>Bienvenue</p>
            <h1 className={`font-heading font-bold text-white mb-2 ${titleSizeClass}`}>Choisissez votre service</h1>
            <p className={`text-slate-400 ${subtitleSizeClass}`}>Touchez un bouton pour obtenir votre ticket</p>
          </div>

          {kioskConfig.showPriorityOption && (
            <label className="mb-3 flex items-center justify-center gap-3 text-slate-300 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={priority}
                onChange={(e) => setPriority(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <HeartHandshake size={16} />
              Je suis une personne prioritaire (PMR / urgence)
            </label>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <p className="text-center text-slate-400">Aucun service disponible pour le moment.</p>
          ) : (
            <div className={serviceStackClass}>
              {visibleServices.map((s) => {
                const buttonTextColor = getContrastTextColor(s.color || '#ffffff');

                return (
                  <button
                    key={s.id}
                    disabled={creating || printing}
                    onClick={() => handleTakeTicket(s)}
                    className="w-full flex-1 flex items-center justify-between gap-4 px-6 py-4 rounded-2xl disabled:opacity-50 transition-colors shadow-lg border border-white/10 overflow-hidden"
                    style={{
                      backgroundColor: s.color || '#ffffff',
                      color: buttonTextColor,
                      minHeight: serviceButtonMinHeight,
                      boxShadow: kioskConfig.effect === 'glow' ? `0 0 0 1px ${kioskConfig.accentColor}22, 0 0 35px ${kioskConfig.accentColor}33` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1 text-left">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="h-10 w-10 rounded-xl object-cover border border-slate-200 bg-white shadow-sm" />
                      ) : (
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: s.color || kioskConfig.accentColor, color: buttonTextColor }}
                        >
                          {s.prefix}
                        </span>
                      )}
                      <span className="font-heading text-lg font-semibold truncate" style={{ color: buttonTextColor }}>{s.name}</span>
                    </div>
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ backgroundColor: s.color || kioskConfig.accentColor, color: buttonTextColor }}
                    >
                      {s.prefix}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!kioskConfig.hideAdminLink && (
          <div className="text-center mt-2">
            <Link to="/agent" className="text-slate-400 hover:text-slate-200 text-[10px]">
              Espace agent / administration
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}