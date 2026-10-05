import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock3,
  Headphones,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Ticket,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Ticket,
    title: 'Gestion intelligente des files',
    description: 'Organisez les demandes, appelez les tickets automatiquement et gardez tout le monde informé.',
  },
  {
    icon: Users,
    title: 'Expérience client fluide',
    description: 'Des écrans lisibles, des messages clairs et des flux optimisés pour chaque type d’accueil.',
  },
  {
    icon: Clock3,
    title: 'Suivi en temps réel',
    description: 'Visualisez les appels, les guichets actifs et les files d’attente sans friction pour les équipes.',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité et contrôle',
    description: 'Accès réservé, approbation de comptes et gestion des rôles pour un usage professionnel.',
  },
];

const stats = [
  { value: '2x', label: 'plus rapide' },
  { value: '24/7', label: 'visibilité' },
  { value: '99%', label: 'satisfaction' },
];

export default function LandingPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const savedTheme = window.localStorage.getItem('waitingline_landing_theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    root.dataset.theme = isDarkMode ? 'dark' : 'light';
    window.localStorage.setItem('waitingline_landing_theme', isDarkMode ? 'dark' : 'light');

    return () => {
      root.classList.remove('dark');
      root.dataset.theme = 'light';
    };
  }, [isDarkMode]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ type: 'error', message: 'Veuillez remplir tous les champs.' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Une erreur est survenue.');
      }

      setStatus({
        type: 'success',
        message: data.message || 'Votre message a bien été envoyé. Nous vous répondrons rapidement.',
      });
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Impossible d’envoyer votre message.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden ${isDarkMode ? 'bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.25),_transparent_30%),linear-gradient(135deg,_#020817_0%,_#0f172a_30%,_#111827_100%)] text-slate-50' : 'bg-[radial-gradient(circle_at_top_left,_rgba(143,214,255,0.30),_transparent_30%),linear-gradient(135deg,_#edf7ff_0%,_#effcfb_28%,_#ffffff_100%)] text-slate-900'}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -left-24 top-10 h-72 w-72 rounded-full ${isDarkMode ? 'bg-cyan-500/20 blur-3xl' : 'bg-cyan-200/50 blur-3xl'}`} />
        <div className={`absolute right-0 top-0 h-80 w-80 rounded-full ${isDarkMode ? 'bg-indigo-500/20 blur-3xl' : 'bg-indigo-200/50 blur-3xl'}`} />
        <div className={`absolute bottom-0 left-1/3 h-72 w-72 rounded-full ${isDarkMode ? 'bg-emerald-500/10 blur-3xl' : 'bg-emerald-200/40 blur-3xl'}`} />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <header className={`${isDarkMode ? 'border border-slate-700/80 bg-slate-900/70 text-slate-50 shadow-[0_18px_40px_rgba(2,6,23,0.6)]' : 'border border-slate-200/70 bg-white/70 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)]'} rounded-full px-4 py-3 backdrop-blur-xl`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F4C81] via-[#2F80ED] to-[#7EE7D8] text-lg font-bold text-white shadow-lg shadow-cyan-200/60">
                W
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight text-slate-900">WaitingLine</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Service Flow</div>
              </div>
            </div>

            <nav className="hidden items-center gap-8 text-sm text-slate-600 lg:flex">
              <a href="#features" className="transition hover:text-slate-900">Fonctionnalités</a>
              <a href="#contact" className="transition hover:text-slate-900">Contact</a>
              <a href="#about" className="transition hover:text-slate-900">À propos</a>
            </nav>

            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Basculer en mode nuit ou jour"
                onClick={() => setIsDarkMode((value) => !value)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700'}`}
              >
                {isDarkMode ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                to="/login"
                className={`hidden rounded-full border px-4 py-2 text-sm font-semibold transition sm:inline-flex ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-700 hover:text-sky-300' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700'}`}
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0F4C81] via-[#2563EB] to-[#5EEAD4] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:translate-y-[-1px]"
              >
                Créer un compte
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="pt-14 sm:pt-20">
          <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                La meilleure façon de gérer les files d’attente
              </div>

              <h1 className={`max-w-xl text-4xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl lg:text-7xl ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>
                Votre service
                <span className="block bg-gradient-to-r from-[#0F4C81] via-[#2563EB] to-[#34D399] bg-clip-text text-transparent">
                  plus fluide.
                </span>
              </h1>

              <p className={`mt-6 max-w-xl text-lg leading-8 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                WaitingLine centralise l’accueil, les appels, les écrans de suivi et la communication client en un seul système pensé pour les services rapides et efficaces.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0F4C81] via-[#2563EB] to-[#5EEAD4] px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-200/70 transition hover:translate-y-[-2px]"
                >
                  Commencer maintenant
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className={`inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-base font-semibold shadow-sm transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-700 hover:text-sky-300' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700'}`}
                >
                  Se connecter
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-5 sm:gap-8">
                {stats.map((item) => (
                  <div key={item.label}>
                    <div className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>{item.value}</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className={`absolute -inset-6 rounded-[2rem] blur-2xl ${isDarkMode ? 'bg-gradient-to-br from-sky-500/20 via-cyan-500/10 to-emerald-500/10' : 'bg-gradient-to-br from-sky-200/70 via-cyan-100/60 to-emerald-100/60'}`} />
              <div className={`relative rounded-[32px] border p-5 backdrop-blur-2xl ${isDarkMode ? 'border-slate-700/80 bg-slate-900/70 shadow-[0_30px_80px_rgba(2,6,23,0.72)]' : 'border-slate-200/80 bg-white/80 shadow-[0_30px_80px_rgba(37,99,235,0.15)]'}`}>
                <div className="rounded-[26px] bg-gradient-to-br from-[#041C2D] via-[#0F4C81] to-[#0B6A7B] p-5 text-white shadow-2xl shadow-sky-200/50">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/80">Service</p>
                      <h2 className="mt-1 text-2xl font-black">Accueil client</h2>
                    </div>
                    <div className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-cyan-50">
                      Live
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between text-sm text-cyan-50/90">
                      <span>Ticket actuel</span>
                      <span>Guichet 2</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="text-6xl font-black tracking-[-0.08em] text-white">A-24</div>
                      <div className="rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-bold text-emerald-200">Appelé</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {['A-21', 'A-22', 'A-23'].map((ticket, idx) => (
                      <div key={ticket} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">Suivant</div>
                        <div className="mt-2 text-2xl font-bold text-white">{ticket}</div>
                        {idx === 0 && <div className="mt-2 text-[10px] text-emerald-200">En attente</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="mt-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Fonctionnalités</p>
              <h2 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>
                Un service pensé pour des équipes qui veulent gagner du temps
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className={`rounded-[28px] border p-6 backdrop-blur-sm transition hover:-translate-y-1 ${isDarkMode ? 'border-slate-700 bg-slate-900/70 shadow-[0_18px_40px_rgba(2,6,23,0.45)] hover:shadow-[0_24px_50px_rgba(14,116,144,0.18)]' : 'border-slate-200/80 bg-white/75 shadow-[0_18px_40px_rgba(15,23,42,0.06)] hover:shadow-[0_24px_50px_rgba(37,99,235,0.12)]'}`}>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F4C81] via-[#2563EB] to-[#5EEAD4] text-white shadow-lg shadow-sky-200/60">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>{title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="contact" className="mt-24">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div className={`rounded-[30px] border p-8 backdrop-blur-sm ${isDarkMode ? 'border-slate-700 bg-slate-900/70 shadow-[0_18px_40px_rgba(2,6,23,0.5)]' : 'border-slate-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Contact</p>
                <h2 className={`mt-4 text-3xl font-black tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>
                  Une question ?
                  <span className="mt-2 block text-sky-700">Nous sommes là pour vous aider.</span>
                </h2>
                <div className={`mt-8 space-y-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={`text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email</div>
                      <div className={`font-medium ${isDarkMode ? 'text-slate-50' : 'text-slate-800'}`}>fileattente.team@gmail.com</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                      <Headphones className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={`text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Service client</div>
                      <div className={`font-medium ${isDarkMode ? 'text-slate-50' : 'text-slate-800'}`}>Réponse rapide par email</div>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className={`rounded-[30px] border p-8 backdrop-blur-sm ${isDarkMode ? 'border-slate-700 bg-slate-900/70 shadow-[0_18px_40px_rgba(2,6,23,0.52)]' : 'border-slate-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'}`}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    Nom
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-50 placeholder:text-slate-400 focus:border-sky-500 focus:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white'}`}
                      placeholder="Votre nom"
                    />
                  </label>

                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    Email
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-50 placeholder:text-slate-400 focus:border-sky-500 focus:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white'}`}
                      placeholder="vous@email.com"
                    />
                  </label>
                </div>

                <label className={`mt-5 block text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  Message
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={6}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-50 placeholder:text-slate-400 focus:border-sky-500 focus:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white'}`}
                    placeholder="Décrivez votre besoin..."
                  />
                </label>

                {status.message && (
                  <div
                    className={[
                      'mt-5 rounded-2xl border px-4 py-3 text-sm',
                      status.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700',
                    ].join(' ')}
                  >
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0F4C81] via-[#2563EB] to-[#5EEAD4] px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-200/70 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer le message'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>

          <section id="about" className={`mt-24 rounded-[32px] border p-8 backdrop-blur-sm sm:p-10 ${isDarkMode ? 'border-slate-700 bg-slate-900/70 shadow-[0_20px_45px_rgba(2,6,23,0.55)]' : 'border-slate-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'}`}>
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Pourquoi nous</p>
                <h2 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>
                  Une plateforme fiable pour gérer l’accueil, le service et l’information.
                </h2>
              </div>

              <div className={`flex items-center gap-3 rounded-full border px-4 py-3 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                <Headphones className="h-5 w-5" />
                Support client premium
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                'Interface claire et professionnelle',
                'Visibilité du service en temps réel',
                'Écrans dédiés pour clients et équipe',
              ].map((item) => (
                <div key={item} className={`rounded-2xl border p-4 text-sm font-medium ${isDarkMode ? 'border-slate-700 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-50/80 text-slate-700'}`}>
                  {item}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
