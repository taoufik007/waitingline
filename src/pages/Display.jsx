import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { isToday } from '@/lib/ticketUtils';
import { Volume2, VolumeX, Newspaper } from 'lucide-react';

const getVoiceStorageKey = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return 'waitingline_voice_gender_default';
  return `waitingline_voice_gender_${normalized.replace(/[@.]/g, '_')}`;
};

const numberWords = {
  0: 'zéro',
  1: 'un',
  2: 'deux',
  3: 'trois',
  4: 'quatre',
  5: 'cinq',
  6: 'six',
  7: 'sept',
  8: 'huit',
  9: 'neuf',
};

const formatTicketCodeForSpeech = (code = '') => {
  const cleaned = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return 'ticket';

  return Array.from(cleaned)
    .map((char) => {
      if (/\d/.test(char)) return numberWords[Number(char)] || char;
      if (/[A-Z]/.test(char)) return char;
      return char;
    })
    .join(', ');
};

const buildAnnouncementText = (code, counterName) => {
  const spokenCode = formatTicketCodeForSpeech(code);
  const cleanedCounter = String(counterName || '').trim() || 'Guichet';
  return `Numéro ${spokenCode}. ${cleanedCounter}.`;
};

const pickVoice = (preferredGender = 'female') => {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const frenchVoices = voices.filter((voice) => (voice.lang || '').toLowerCase().startsWith('fr'));
  const pool = frenchVoices.length ? frenchVoices : voices;

  const normalizedGender = preferredGender === 'male' ? 'male' : 'female';
  const maleMatchers = [
    /(male|man|homme)/i,
    /(david|daniel|paul|jacob|oliver|thomas|john|mark|michael|charles)/i,
    /google.*(male|homme)/i,
    /microsoft.*(david|paul|james|mark|michael|thomas)/i,
  ];
  const femaleMatchers = [
    /(female|woman|femme)/i,
    /(samantha|victoria|zira|aria|jenny|alice|sophie|claire|emma|zoe|ceri|nausicaa|nora|luna)/i,
    /google.*(female|femme)/i,
    /microsoft.*(samantha|zira|victoria|aria|jenny|sophie|claire|emma)/i,
  ];

  const matcherList = normalizedGender === 'male' ? maleMatchers : femaleMatchers;
  const preferred = pool.find((voice) => matcherList.some((matcher) => matcher.test(voice.name || '')));
  return preferred || pool[0];
};

const fallbackNews = [
  {
    title: 'Le Maroc avance sur ses projets structurants',
    summary: 'Les investissements publics et privés continuent de dynamiser l’économie locale.',
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'Le secteur agricole se modernise',
    summary: 'Les coopératives et les agriculteurs adoptent des technologies pour améliorer la productivité.',
    image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'Le tourisme marocain attire encore plus de visiteurs',
    summary: 'Les destinations culturelles, côtières et historiques renforcent leur présence internationale.',
    image: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'L’économie numérique accélère sa croissance',
    summary: 'Les start-ups et plateformes locales consolident le tissu numérique marocain.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'Le budget national soutient l’infrastructure locale',
    summary: 'Les investissements sont orientés vers les villes, les transports et la modernisation.',
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'Les régions marocaines attirent de nouveaux projets',
    summary: 'Les zones industrielles et touristiques renforcent leur dynamisme économique.',
    image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
  {
    title: 'Le Maroc renforce son attractivité internationale',
    summary: 'Les réformes et partenariats visent à accélérer la croissance sur plusieurs secteurs.',
    image: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80',
    link: 'https://news.google.com',
  },
];

const REPEATED_DEFAULT_NEWS_IMAGE = 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80';

const getResolvedNewsImage = (item, index) => {
  const url = item?.image || '';
  const preferred = fallbackNews[index % fallbackNews.length]?.image || fallbackNews[0].image;
  if (!url || url === REPEATED_DEFAULT_NEWS_IMAGE) {
    return preferred;
  }
  return url;
};

const getDailyNews = (items = fallbackNews, _date = new Date()) => {
  const baseItems = Array.isArray(items) && items.length > 0
    ? items.filter((item) => item && (item.title || item.summary || item.link || item.image))
    : fallbackNews;

  if (!baseItems.length) return fallbackNews.map((item, index) => ({
    key: `fallback-${index}`,
    label: 'Maroc',
    color: 'from-emerald-500 to-teal-600',
    item: {
      ...item,
      title: item.title || `Actualité du Maroc ${index + 1}`,
      summary: item.summary || 'Informations locales et nationales à suivre.',
      image: getResolvedNewsImage(item, index),
      link: item.link || 'https://news.google.com',
    },
  }));

  return baseItems.map((item, index) => {
    const fallback = fallbackNews[index % fallbackNews.length] || fallbackNews[0];
    const resolvedImage = getResolvedNewsImage(item, index);
    return {
      key: `${item.link || item.title || 'news'}-${index}`,
      label: 'Maroc',
      color: 'from-emerald-500 to-teal-600',
      item: {
        ...item,
        title: item.title || fallback.title || `Actualité du Maroc ${index + 1}`,
        summary: item.summary || fallback.summary || 'Informations locales et nationales à suivre.',
        image: resolvedImage,
        link: item.link || fallback.link || 'https://news.google.com',
      },
    };
  });
};

const resolveThemeMode = () => false;

const getWeatherLabel = (weatherCode) => {
  const code = Number(weatherCode ?? 0);

  if (code === 0) return 'Dégagé';
  if ([1, 2, 3].includes(code)) return 'Partiellement nuageux';
  if ([45, 48].includes(code)) return 'Brouillard';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Pluie';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Neige';
  if ([95, 96, 99].includes(code)) return 'Orage';
  return 'Nuageux';
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

export default function Display() {
  const { token: mirrorToken } = useParams();
  const [current, setCurrent] = useState(null);
  const [recent, setRecent] = useState([]);
  const [counters, setCounters] = useState({});
  const [now, setNow] = useState(new Date());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechReady, setSpeechReady] = useState(false);
  const [voiceGender, setVoiceGender] = useState('female');
  const [newsSlideIndex, setNewsSlideIndex] = useState(0);
  const [newsItems, setNewsItems] = useState(fallbackNews);
  const [counterList, setCounterList] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => resolveThemeMode());
  const [adminEmail, setAdminEmail] = useState('');
  const [kioskConfig, setKioskConfig] = useState(() => {
    if (typeof window === 'undefined') return { logo: '' };

    try {
      return JSON.parse(window.localStorage.getItem('waitingline_kiosk_config') || '{}');
    } catch {
      return { logo: '' };
    }
  });
  const [weather, setWeather] = useState({
    temp: null,
    condition: 'Météo',
    city: 'Casablanca',
    updatedAt: null,
  });
  const isMirrorView = Boolean(mirrorToken);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncKioskConfig = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('waitingline_kiosk_config') || '{}');
        setKioskConfig(stored || { logo: '' });
      } catch {
        setKioskConfig({ logo: '' });
      }
    };

    const activeEmail =
      window.sessionStorage.getItem('waitingline_active_user') ||
      window.localStorage.getItem('waitingline_active_user') ||
      '';
    setAdminEmail(activeEmail);
    syncKioskConfig();

    window.addEventListener('storage', syncKioskConfig);
    return () => window.removeEventListener('storage', syncKioskConfig);
  }, []);

  const currentDisplayToken = useMemo(() => {
    if (adminEmail) {
      return getDisplayTokenForEmail(adminEmail);
    }
    if (mirrorToken) {
      return String(mirrorToken).trim();
    }
    return 'admin-display-default';
  }, [adminEmail, mirrorToken]);

  const isValidMirrorToken = useMemo(() => {
    if (!mirrorToken) return true;
    return mirrorToken === currentDisplayToken;
  }, [mirrorToken, currentDisplayToken]);

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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.dataset.theme = 'light';
    setIsDarkMode(false);

    const observer = new MutationObserver(() => {
      root.classList.remove('dark');
      root.dataset.theme = 'light';
      setIsDarkMode(false);
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [now]
  );

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=33.5731&longitude=-7.5898&current=temperature_2m,weather_code&timezone=auto&forecast_days=1'
        );

        if (!response.ok) {
          throw new Error('Weather request failed');
        }

        const data = await response.json();
        const currentWeather = data?.current;

        if (!cancelled) {
          setWeather({
            temp: currentWeather?.temperature_2m ?? null,
            condition: getWeatherLabel(currentWeather?.weather_code),
            city: 'Casablanca',
            updatedAt: new Date(),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setWeather((previous) => ({
            ...previous,
            condition: previous.condition || 'Météo indisponible',
          }));
        }
      }
    };

    loadWeather();
    const refreshTimer = setInterval(loadWeather, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, []);

  const dailyNews = useMemo(() => getDailyNews(newsItems, now), [newsItems, now]);
  const counterSlots = useMemo(() => {
    if (counterList.length > 0) return counterList.slice(0, 6);
    return Array.from({ length: 6 }, (_, index) => ({
      id: `fallback-${index + 1}`,
      name: `Guichet ${index + 1}`,
    }));
  }, [counterList]);

  useEffect(() => {
    let isMounted = true;

    const loadNews = async () => {
      try {
        const response = await fetch('/api/news/morocco');
        if (!response.ok) throw new Error('News request failed');
        const payload = await response.json();
        const items = Array.isArray(payload?.items) && payload.items.length > 0 ? payload.items : fallbackNews;
        if (isMounted) {
          setNewsItems(items);
          setNewsSlideIndex(0);
        }
      } catch (error) {
        if (isMounted) {
          setNewsItems(fallbackNews);
          setNewsSlideIndex(0);
        }
      }
    };

    loadNews();
    const refreshTimer = setInterval(loadNews, 60 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setNewsSlideIndex((previous) => (previous + 1) % Math.max(dailyNews.length, 1));
    }, 6000);

    return () => clearInterval(slideTimer);
  }, [dailyNews.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeEmail = window.sessionStorage.getItem('waitingline_active_user') || window.localStorage.getItem('waitingline_active_user') || '';
    const key = getVoiceStorageKey(activeEmail);
    const saved = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
    setVoiceGender(saved === 'male' ? 'male' : 'female');

    const syncFromStorage = (event) => {
      const changedKey = event.key || key;
      if (!changedKey || !changedKey.startsWith('waitingline_voice_gender_')) return;
      const next = event.newValue === 'male' ? 'male' : 'female';
      setVoiceGender(next);
    };

    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const prevCodeRef = useRef(null);
  const prevCallRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const lastAnnouncementRef = useRef('');
  const queuedAnnouncementRef = useRef(null);
  const speechTimerRef = useRef(null);

  const enableSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch {}
    setSpeechReady(true);
  }, []);

  const announceCurrentTicket = useCallback(() => {
    if (!current || !voiceEnabled || !('speechSynthesis' in window)) return;

    const voices = window.speechSynthesis.getVoices();
    if (!speechReady && voices.length === 0) return;

    const announcementKey = `${current.id}:${current.code}:${current.counter_id}:${voiceGender}`;
    if (lastAnnouncementRef.current === announcementKey) return;
    if (queuedAnnouncementRef.current === announcementKey) return;

    const text = buildAnnouncementText(current.code, counters[current.counter_id] || 'Guichet');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = voiceGender === 'male' ? 0.8 : 1.2;
    utterance.volume = 1;
    const preferredVoice = pickVoice(voiceGender) || voices[0] || null;
    if (preferredVoice) utterance.voice = preferredVoice;

    const startAnnouncement = () => {
      try {
        window.speechSynthesis.resume();
      } catch {}
      queuedAnnouncementRef.current = null;
      lastAnnouncementRef.current = announcementKey;
      window.speechSynthesis.speak(utterance);
    };

    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      queuedAnnouncementRef.current = announcementKey;
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      speechTimerRef.current = setTimeout(() => {
        if (queuedAnnouncementRef.current === announcementKey && !synth.speaking && !synth.pending) {
          startAnnouncement();
        }
      }, 1500);
      return;
    }

    startAnnouncement();
  }, [current, voiceEnabled, speechReady, voiceGender, counters]);

  const handleEnableVoice = useCallback(() => {
    if (!voiceEnabled) {
      setVoiceEnabled(true);
    }
    enableSpeech();
    setTimeout(() => announceCurrentTicket(), 150);
  }, [enableSpeech, voiceEnabled, announceCurrentTicket]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setSpeechReady(true);
      }
    };

    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const load = useCallback(async () => {
    const [tickets, counterListResult] = await Promise.all([
      base44.entities.Ticket.filter({}, '-called_at', 100),
      base44.entities.Counter.list(),
    ]);
    const counterMap = {};
    counterListResult.forEach((c) => (counterMap[c.id] = c.name));
    setCounters(counterMap);
    setCounterList(counterListResult);

    const activeToday = tickets.filter((t) => isToday(t.created_date) && (t.status === 'called' || t.status === 'serving'));
    activeToday.sort((a, b) => new Date(b.called_at || 0) - new Date(a.called_at || 0));
    setCurrent(activeToday[0] || null);
    setRecent(activeToday.slice(1, 6));
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.Ticket.subscribe(() => load());
    const poll = setInterval(load, 3000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      unsubscribe();
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    const unlockSpeechOnInteraction = () => {
      enableSpeech();
      setTimeout(() => announceCurrentTicket(), 180);
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, unlockSpeechOnInteraction, { passive: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, unlockSpeechOnInteraction);
      });
    };
  }, [enableSpeech, announceCurrentTicket]);

  // Annonce vocale : déclenchée quand un ticket est appelé, y compris au premier
  // chargement de l'écran si un ticket est déjà en cours. Le navigateur bloque la
  // synthèse vocale tant qu'il n'y a pas eu une interaction utilisateur.
  useEffect(() => {
    const newCode = current?.code ?? null;
    const newCallKey = current ? `${current.id}:${current.called_at ?? ''}` : null;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (newCode && speechReady) {
        announceCurrentTicket();
      }
      prevCodeRef.current = newCode;
      prevCallRef.current = newCallKey;
      return;
    }

    const shouldSpeak = newCode && (newCode !== prevCodeRef.current || newCallKey !== prevCallRef.current);
    if (shouldSpeak) {
      announceCurrentTicket();
    }

    prevCodeRef.current = newCode;
    prevCallRef.current = newCallKey;
  }, [current, voiceEnabled, speechReady, announceCurrentTicket]);

  const shellBackground = isDarkMode
    ? 'bg-[radial-gradient(circle_at_top_left,_rgba(158,210,255,0.28),_transparent_32%),linear-gradient(135deg,_#081d2d,_#0b2e4d_35%,_#0c3d5f)] text-white'
    : 'bg-[radial-gradient(circle_at_top_left,_rgba(203,213,225,0.18),_transparent_32%),linear-gradient(135deg,_#f5f6f8,_#edf2f7_35%,_#f8fafc)] text-slate-900';

  const panelBackground = isDarkMode
    ? 'border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(158,210,255,0.22),_transparent_28%),linear-gradient(135deg,_rgba(7,22,36,0.98),_rgba(12,35,55,0.96))] shadow-[0_30px_80px_rgba(5,17,29,0.55)]'
    : 'border border-slate-400 bg-[radial-gradient(circle_at_top_left,_rgba(226,232,240,0.38),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(241,245,249,0.98))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]';

  const panelSurface = isDarkMode
    ? 'border-[#9ED2FF]/10 bg-[#0b2340]/70'
    : 'border border-slate-300 bg-slate-50';

  const mutedText = isDarkMode ? 'text-[#DDF4FF]' : 'text-slate-700';
  const accentText = isDarkMode ? 'text-[#ABFFF9]' : 'text-slate-800';
  const secondaryText = isDarkMode ? 'text-slate-200' : 'text-slate-600';
  const highlightCard = isDarkMode
    ? 'border-[#9ED2FF]/10 bg-[#112d43]/80 text-slate-200 shadow-inner shadow-[#071b2d]/50'
    : 'border border-slate-300 bg-slate-50 text-slate-700 shadow-inner shadow-slate-200';

  const getNewsImageUrl = (item, index = 0) => {
    const fallbackImage = fallbackNews[index % fallbackNews.length]?.image || fallbackNews[0].image;
    if (!item?.image) return fallbackImage;
    if (item.image === REPEATED_DEFAULT_NEWS_IMAGE) {
      return fallbackImage;
    }
    return item.image;
  };

  return (
    <div className={`min-h-screen p-2 sm:p-4 ${shellBackground}`}>
      <div className={`mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1600px] flex-col overflow-auto rounded-[26px] px-3 py-3 sm:px-4 ${panelBackground}`}>
        <header className="mb-3 flex items-center justify-between px-1 sm:px-2">
          <div className="flex items-center gap-3">
            {kioskConfig.logo ? (
              <img
                src={kioskConfig.logo}
                alt="Logo de l'entreprise"
                className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)] sm:h-16 sm:w-16 lg:h-20 lg:w-20"
              />
            ) : (
              <div className={`flex h-14 w-14 items-center justify-center text-lg font-black sm:h-16 sm:w-16 sm:text-xl lg:h-20 lg:w-20 ${isDarkMode ? 'text-[#BFE7FF]' : 'text-indigo-700'}`}>W</div>
            )}
          </div>

          <div className={`flex items-center gap-3 sm:gap-4 ${mutedText}`}>
            <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${isDarkMode ? 'border-[#9ED2FF]/20 bg-white/5 text-[#DDF4FF]' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
              {weather.temp !== null ? `${Math.round(weather.temp)}°C` : 'Météo'}
            </span>
            <span className={`hidden text-[10px] uppercase tracking-[0.14em] sm:inline ${isDarkMode ? 'text-[#9ED2FF]' : 'text-indigo-500'}`}>
              {weather.condition}
            </span>
            <span className={`font-mono text-xs tracking-[0.12em] sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </header>

        <div className={`mb-3 flex items-center justify-between rounded-[18px] border px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3 ${isDarkMode ? 'border-[#9ED2FF]/20 bg-white/5' : 'border-slate-300 bg-slate-50/90'}`}>
          <div className={`flex items-center gap-2 sm:gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-base shadow-inner sm:h-10 sm:w-10 sm:text-lg ${isDarkMode ? 'from-[#9ED2FF] to-[#ABFFF9] text-[#061e30] shadow-[#ABFFF9]/20' : 'from-indigo-200 to-emerald-200 text-indigo-900 shadow-indigo-100'}`}>▤</div>
            <div>
              <div className={`font-heading text-xl font-bold tracking-tight sm:text-2xl lg:text-4xl ${isDarkMode ? 'text-[#F0F9FF]' : 'text-slate-900'}`}>FILE D'ATTENTE</div>
              <div className={`text-[9px] uppercase tracking-[0.18em] sm:text-[10px] ${isDarkMode ? 'text-[#9ED2FF]' : 'text-indigo-600'}`}>
                {dateLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!voiceEnabled) {
                setVoiceEnabled(true);
              }
              enableSpeech();
              window.speechSynthesis.cancel();
            }}
            className={`flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium shadow-[0_10px_25px_rgba(15,23,42,0.12)] transition ${isDarkMode ? 'border-[#9ED2FF]/20 bg-white/5 text-[#DDF4FF] hover:bg-[#9ED2FF]/10' : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            title={voiceEnabled ? 'Couper le son' : 'Activer le son'}
          >
            <span className="flex items-center gap-2">
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span className="hidden sm:inline">Son</span>
            </span>
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-visible px-1 pb-2 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:gap-6 lg:overflow-hidden lg:px-2">
          <aside className={`relative rounded-[20px] p-3 backdrop-blur-sm sm:p-4 ${panelSurface}`}>
            <p className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] sm:mb-4 sm:text-xs ${isDarkMode ? 'text-[#9ED2FF]' : 'text-indigo-600'}`}>DERNIERS APPELS</p>
            <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
              <span className={`select-none text-[22px] font-black uppercase tracking-[0.24em] opacity-10 ${isDarkMode ? 'text-slate-200' : 'text-slate-300'}`}>
                DERNIERS APPELS
              </span>
            </div>
            <div className="relative space-y-2 sm:space-y-3">
              {recent.length === 0 && <div className={`rounded-xl p-3 sm:p-4 ${isDarkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>—</div>}
              {recent.map((t) => (
                <div key={t.id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${highlightCard}`}>
                  <div className={`font-heading text-2xl font-bold tracking-tight sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.code}</div>
                  <div className={`flex items-center gap-2 ${isDarkMode ? 'text-[#9ED2FF]' : 'text-indigo-600'}`}>
                    <span className="text-base sm:text-lg">◌</span>
                    <span className={`text-[10px] sm:text-xs ${secondaryText}`}>{counters[t.counter_id] || 'Guichet'}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className={`flex flex-col justify-between rounded-[20px] p-3 backdrop-blur-sm sm:p-4 ${panelSurface}`}>
            <div className={`flex items-center justify-between px-1 pt-1 sm:px-2 sm:pt-2 ${mutedText}`}>
              <span className={`text-[10px] uppercase tracking-[0.2em] sm:text-sm ${accentText}`}>NUMÉRO APPELÉ</span>
            </div>

            <div className="flex flex-1 items-center justify-center py-2 sm:py-0">
              {current ? (
                <div className="text-center">
                  <div className={`font-heading text-[4.5rem] leading-[0.82] font-extrabold tracking-[-0.08em] drop-shadow-[0_0_18px_rgba(158,210,255,0.22)] sm:text-[6rem] lg:text-[9rem] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{current.code}</div>
                  <div className={`mt-2 text-2xl font-semibold sm:mt-4 sm:text-4xl ${accentText}`}>{counters[current.counter_id] || 'Guichet'}</div>
                </div>
              ) : (
                <p className={`text-xl sm:text-3xl ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>En attente du prochain appel...</p>
              )}
            </div>

            {voiceEnabled && !speechReady && (
              <button
                type="button"
                onClick={handleEnableVoice}
                className={`mx-auto mt-4 rounded-full bg-gradient-to-r px-5 py-3 text-sm font-semibold shadow-lg ${isDarkMode ? 'from-[#9ED2FF] to-[#ABFFF9] text-[#082033] shadow-[#9ED2FF]/20' : 'from-indigo-200 to-emerald-200 text-indigo-900 shadow-indigo-200/80'}`}
              >
                Cliquez pour activer le son
              </button>
            )}

            <div className={`mt-4 rounded-[20px] border p-2.5 sm:mt-5 sm:p-3 ${isDarkMode ? 'border-[#9ED2FF]/10 bg-[#0b2340]/70' : 'border-slate-300 bg-slate-50'}`}>
              <div className={`mb-3 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.2em] sm:mb-4 sm:px-2 sm:text-sm ${mutedText}`}>
                <span>Guichets</span>
                <span className={`text-[9px] sm:text-[10px] ${isDarkMode ? 'text-[#BFE7FF]' : 'text-slate-500'}`}>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {counterSlots.map((counter) => {
                  const isCurrent = !!current && String(current.counter_id) === String(counter.id);
                  return (
                    <div
                      key={counter.id}
                      className={`flex min-h-[64px] items-center justify-center rounded-xl border sm:min-h-[88px] ${isCurrent
                        ? isDarkMode
                          ? 'border-[#ABFFF9]/30 bg-gradient-to-br from-[#9ED2FF]/20 to-[#ABFFF9]/20 text-[#E8FCFF]'
                          : 'border-indigo-200 bg-gradient-to-br from-indigo-100 to-emerald-100 text-indigo-900'
                        : isDarkMode
                          ? 'border-[#9ED2FF]/10 bg-[#112d43]/80 text-slate-200'
                          : 'border border-slate-300 bg-slate-100 text-slate-700'}`}
                    >
                      <div className="text-center">
                        <div className={`text-[8px] uppercase tracking-[0.12em] sm:text-[10px] ${isDarkMode ? 'text-[#BFE7FF]' : 'text-slate-500'}`}>{counter.name || 'Guichet'}</div>
                        {isCurrent && current && (
                          <div className={`mt-1 font-heading text-xl font-bold sm:mt-2 sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{current.code}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className={`flex flex-col rounded-[20px] p-3 backdrop-blur-sm ${panelSurface}`}>
            <div className={`mb-3 flex items-center gap-3 px-2 pt-2 ${mutedText}`}>
              <span className={isDarkMode ? 'text-base text-[#ABFFF9]' : 'text-base text-emerald-600'}>▣</span>
              <span className={`text-[10px] uppercase tracking-[0.22em] sm:text-sm ${isDarkMode ? 'text-[#9ED2FF]' : 'text-indigo-600'}`}>ACTUALITÉS</span>
            </div>

            <div className={`relative flex-1 overflow-hidden rounded-[18px] ${isDarkMode ? 'bg-[#081d2d]' : 'bg-slate-100'}`}>
              {dailyNews.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-200">
                  Aucune actualité disponible pour le moment.
                </div>
              ) : (
                <>
                  {dailyNews.map(({ key, label, color, item }, index) => {
                    const isActive = index === newsSlideIndex;
                    return (
                      <div
                        key={key}
                        className={`absolute inset-0 overflow-hidden transition-all duration-700 ease-out ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}`}
                      >
                        <img
                          src={getNewsImageUrl(item, index)}
                          alt={item.title || 'Actualité'}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            const nextImage = fallbackNews[index % fallbackNews.length]?.image || fallbackNews[0].image;
                            event.currentTarget.src = nextImage;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />
                        <div className="absolute inset-x-0 bottom-0 flex h-full flex-col justify-end p-2.5 sm:p-4">
                          <div className={`inline-flex w-fit rounded-full bg-gradient-to-r ${color} px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.18em] text-white sm:px-2.5 sm:text-[8px]`}>
                            {label}
                          </div>
                          <h3 className="mt-2 w-full max-w-[12rem] text-[0.9rem] font-bold leading-tight text-white sm:max-w-[15rem] sm:text-[1.1rem] lg:text-[1.35rem]">{item.title}</h3>
                          <p className="mt-1.5 w-full max-w-[12rem] text-[9px] leading-3.5 text-slate-100 sm:max-w-[15rem] sm:text-[10px] sm:leading-4 lg:text-xs lg:leading-5">{item.summary}</p>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[7px] uppercase tracking-[0.18em] text-slate-100 sm:text-[8px]"
                            >
                              Lire la suite
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
                    {dailyNews.map((slide, index) => (
                      <button
                        key={slide.key}
                        type="button"
                        onClick={() => setNewsSlideIndex(index)}
                        aria-label={`Afficher ${slide.label}`}
                        className={`h-2.5 rounded-full transition-all ${index === newsSlideIndex ? 'w-8 bg-[#ABFFF9]' : 'w-2.5 bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}