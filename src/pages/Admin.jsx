import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import StaffHeader from '@/components/staff/StaffHeader';
import ServiceManager from '@/components/admin/ServiceManager';
import CounterManager from '@/components/admin/CounterManager';
import { BarChart3, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import UserAccountPanel from '@/components/UserAccountPanel';

const getVoiceStorageKey = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return 'waitingline_voice_gender_default';
  return `waitingline_voice_gender_${normalized.replace(/[@.]/g, '_')}`;
};

const getCurrentAdminToken = () => {
  try {
    const sessionMap = JSON.parse(window.localStorage.getItem('waitingline_session_map') || '{}');

    const preferredAdminToken = Object.entries(sessionMap)
      .map(([email, entry]) => ({ email, token: entry?.token, user: entry?.user }))
      .find((entry) => {
        const role = String(entry?.user?.role || '').toLowerCase();
        return !!entry?.token && (role === 'admin' || role === 'approver');
      })?.token;

    if (preferredAdminToken) {
      return preferredAdminToken;
    }

    const activeUser =
      window.sessionStorage.getItem('waitingline_active_user') ||
      window.localStorage.getItem('waitingline_active_user') ||
      null;

    if (activeUser && sessionMap[activeUser]?.token) {
      return sessionMap[activeUser].token;
    }

    const currentUserEmail =
      window.sessionStorage.getItem('waitingline_active_user') ||
      window.localStorage.getItem('waitingline_active_user') ||
      JSON.parse(window.localStorage.getItem('waitingline_user') || 'null')?.email ||
      null;

    if (currentUserEmail && sessionMap[currentUserEmail]?.token) {
      return sessionMap[currentUserEmail].token;
    }

    const currentToken = base44.auth.getToken();
    if (currentToken) return currentToken;

    const fallbackToken = window.localStorage.getItem('waitingline_token');
    if (fallbackToken) return fallbackToken;

    const firstSession = Object.values(sessionMap).find((entry) => entry?.token);
    return firstSession?.token || '';
  } catch {
    return base44.auth.getToken() || window.localStorage.getItem('waitingline_token') || '';
  }
};

const readCurrentStorageValue = (key, fallback = null) => {
  if (typeof window === 'undefined') return fallback;
  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;
  const localValue = window.localStorage.getItem(key);
  return localValue !== null ? localValue : fallback;
};

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

const getKioskConfig = () => {
  if (typeof window === 'undefined') return DEFAULT_KIOSK_CONFIG;

  try {
    const stored = JSON.parse(window.localStorage.getItem('waitingline_kiosk_config') || '{}');
    return { ...DEFAULT_KIOSK_CONFIG, ...stored };
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
};

export default function Admin() {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voiceGender, setVoiceGender] = useState('female');
  const [agentForm, setAgentForm] = useState({ name: '', email: '', password: '', assignedServiceIds: [] });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [kioskConfig, setKioskConfig] = useState(() => getKioskConfig());

  useEffect(() => {
    const currentEmail = user?.email || readCurrentStorageValue('waitingline_active_user') || '';
    const key = getVoiceStorageKey(currentEmail);
    const stored = window.localStorage.getItem(key) ?? readCurrentStorageValue(key);
    setVoiceGender(stored === 'male' ? 'male' : 'female');
  }, [user]);

  const load = useCallback(async () => {
    const sessionToken = getCurrentAdminToken();
    const [s, c, a] = await Promise.all([
      base44.entities.Service.list('name'),
      base44.entities.Counter.list('name'),
      fetch('/api/admin/agents', {
        headers: { 'x-session-token': sessionToken },
      }).then(async (response) => {
        if (!response.ok) return [];
        const data = await response.json();
        return data.agents || [];
      }),
    ]);
    setServices(s);
    setCounters(c);
    setAgents(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser);
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentEmail = user?.email || readCurrentStorageValue('waitingline_active_user') || '';
    const key = getVoiceStorageKey(currentEmail);
    window.sessionStorage.setItem(key, voiceGender);
    window.localStorage.setItem(key, voiceGender);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: voiceGender }));
  }, [voiceGender, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('waitingline_kiosk_config', JSON.stringify(kioskConfig));
    window.dispatchEvent(new CustomEvent('waitingline-kiosk-config-updated', { detail: kioskConfig }));
  }, [kioskConfig]);

  const updateKioskConfig = (updates) => {
    setKioskConfig((current) => ({ ...current, ...updates }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateKioskConfig({ logo: String(reader.result || '') });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAgent = async (event) => {
    event.preventDefault();
    if (!agentForm.name.trim() || !agentForm.email.trim() || !agentForm.password.trim()) return;

    const sessionToken = getCurrentAdminToken();
    if (!sessionToken) {
      window.alert('Session admin introuvable. Reconnectez-vous pour créer un agent.');
      window.location.href = '/login';
      return;
    }

    const assignedServiceIds = Array.isArray(agentForm.assignedServiceIds)
      ? agentForm.assignedServiceIds.filter(Boolean)
      : [];

    setCreatingAgent(true);
    try {
      const response = await fetch('/api/admin/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          name: agentForm.name.trim(),
          email: agentForm.email.trim(),
          password: agentForm.password,
          assignedServiceIds,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to create agent');
      setAgentForm({ name: '', email: '', password: '', assignedServiceIds: [] });
      await load();
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Unable to create agent');
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleDeleteAgent = async (email) => {
    if (!email) return;
    if (!window.confirm(`Supprimer le compte agent ${email} ?`)) return;

    const sessionToken = getCurrentAdminToken();
    if (!sessionToken) {
      window.alert('Session admin introuvable. Reconnectez-vous pour supprimer cet agent.');
      window.location.href = '/login';
      return;
    }

    try {
      const response = await fetch('/api/admin/delete-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to delete agent');
      await load();
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Unable to delete agent');
    }
  };

  const handleUpdateAgentService = async (email, serviceIds) => {
    if (!email) return;

    const sessionToken = getCurrentAdminToken();
    if (!sessionToken) {
      window.alert('Session admin introuvable. Reconnectez-vous pour modifier cet agent.');
      window.location.href = '/login';
      return;
    }

    const normalizedServiceIds = Array.isArray(serviceIds)
      ? [...new Set(serviceIds.filter(Boolean).map(String))]
      : serviceIds
        ? [String(serviceIds).trim()].filter(Boolean)
        : [];

    try {
      const response = await fetch('/api/admin/update-agent-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ email, serviceIds: normalizedServiceIds, serviceId: normalizedServiceIds[0] || '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to update agent service');
      await load();
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Unable to update agent service');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader user={user} />
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold mb-1">Configuration</h1>
            <p className="text-muted-foreground text-sm">Gérez vos services, vos guichets et la voix d’annonce.</p>
          </div>
          <a
            href="/admin/statistiques"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <BarChart3 size={16} />
            Statistiques
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-xl font-semibold mb-4">Paramètres de la borne</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Personnalisez la couleur, le fond, l’effet visuel, le logo, le mode d’affichage et le plein écran de la page borne client.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Couleur principale</span>
              <input
                type="color"
                value={kioskConfig.accentColor}
                onChange={(event) => updateKioskConfig({ accentColor: event.target.value })}
                className="h-11 w-full rounded-lg border border-input bg-background p-1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Type de fond</span>
              <select
                value={kioskConfig.backgroundType}
                onChange={(event) => updateKioskConfig({ backgroundType: event.target.value })}
                className="px-3 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="solid">Unie</option>
                <option value="gradient">Dégradé</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Couleur de fond</span>
              <input
                type="color"
                value={kioskConfig.backgroundColor}
                onChange={(event) => updateKioskConfig({ backgroundColor: event.target.value })}
                className="h-11 w-full rounded-lg border border-input bg-background p-1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Dégradé 2</span>
              <input
                type="color"
                value={kioskConfig.backgroundGradientEnd}
                onChange={(event) => updateKioskConfig({ backgroundGradientEnd: event.target.value })}
                className="h-11 w-full rounded-lg border border-input bg-background p-1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Dégradé 1</span>
              <input
                type="color"
                value={kioskConfig.backgroundGradientStart}
                onChange={(event) => updateKioskConfig({ backgroundGradientStart: event.target.value })}
                className="h-11 w-full rounded-lg border border-input bg-background p-1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Effet visuel</span>
              <select
                value={kioskConfig.effect}
                onChange={(event) => updateKioskConfig({ effect: event.target.value })}
                className="px-3 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="none">Aucun</option>
                <option value="glow">Lueur</option>
                <option value="shadow">Ombre</option>
                <option value="blur">Flou</option>
              </select>
            </label>

            <div className="flex flex-col gap-2 text-sm text-foreground md:col-span-2">
              <span className="font-medium">Logo (photo)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:font-medium"
              />
              <span className="text-[11px] text-muted-foreground">
                Pour un fond transparent, privilégiez un fichier PNG avec transparence. Un fond blanc sur un JPG ne peut pas être retiré automatiquement.
              </span>
              {kioskConfig.logo ? (
                <div className="flex items-center gap-3 rounded-lg border border-input bg-background p-2">
                  <img src={kioskConfig.logo} alt="Logo de la borne" className="h-16 w-16 rounded-md object-contain bg-transparent" />
                  <button
                    type="button"
                    onClick={() => updateKioskConfig({ logo: '' })}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Supprimer le logo
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Aucune photo ajoutée</span>
              )}
            </div>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span className="font-medium">Affichage</span>
              <select
                value={kioskConfig.displayMode}
                onChange={(event) => updateKioskConfig({ displayMode: event.target.value })}
                className="px-3 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="landscape">Paysage</option>
                <option value="portrait">Portrait</option>
              </select>
            </label>

            <div className="flex flex-col gap-3 rounded-lg border border-input bg-background p-3">
              <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                <span>Plein écran</span>
                <input
                  type="checkbox"
                  checked={kioskConfig.fullscreen}
                  onChange={(event) => updateKioskConfig({ fullscreen: event.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                <span>Afficher le QR miroir</span>
                <input
                  type="checkbox"
                  checked={kioskConfig.showMirrorQr}
                  onChange={(event) => updateKioskConfig({ showMirrorQr: event.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                <span>Afficher l’option prioritaire</span>
                <input
                  type="checkbox"
                  checked={kioskConfig.showPriorityOption}
                  onChange={(event) => updateKioskConfig({ showPriorityOption: event.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                <span>Cacher le lien admin</span>
                <input
                  type="checkbox"
                  checked={kioskConfig.hideAdminLink}
                  onChange={(event) => updateKioskConfig({ hideAdminLink: event.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-xl font-semibold mb-4">Voix d’annonce</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choisissez la voix utilisée pour lire les numéros appelés sur l’écran d’affichage.
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              { value: 'female', label: 'Voix femme' },
              { value: 'male', label: 'Voix homme' },
            ].map((option) => {
              const active = voiceGender === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVoiceGender(option.value)}
                  className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/60'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-heading text-xl font-semibold">Comptes agents</h2>
              <p className="text-sm text-muted-foreground">{agents.length} agent(s) attaché(s) à ce compte.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Users size={16} />
              {agents.length}
            </div>
          </div>
          <form onSubmit={handleCreateAgent} className="grid gap-3 md:grid-cols-2">
            <input
              value={agentForm.name}
              onChange={(event) => setAgentForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nom complet"
              className="px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="email"
              value={agentForm.email}
              onChange={(event) => setAgentForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="agent@exemple.com"
              className="px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="password"
              value={agentForm.password}
              onChange={(event) => setAgentForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Mot de passe"
              className="px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="rounded-lg border border-input bg-background p-2">
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Services assignés</label>
              <select
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  const nextValue = event.target.value;
                  setAgentForm((current) => ({
                    ...current,
                    assignedServiceIds: Array.from(new Set([...(current.assignedServiceIds || []), nextValue])),
                  }));
                  event.target.value = '';
                }}
                className="w-full px-3 py-2.5 rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Ajouter un service</option>
                {services
                  .filter((service) => !(agentForm.assignedServiceIds || []).includes(service.id))
                  .map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
              </select>

              <div className="mt-3 flex flex-wrap gap-2">
                {(agentForm.assignedServiceIds || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">Aucun service sélectionné</span>
                ) : (
                  (agentForm.assignedServiceIds || []).map((serviceId) => {
                    const service = services.find((item) => item.id === serviceId);
                    if (!service) return null;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() =>
                          setAgentForm((current) => ({
                            ...current,
                            assignedServiceIds: (current.assignedServiceIds || []).filter((id) => id !== service.id),
                          }))
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {service.name}
                        <span aria-hidden="true">×</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingAgent}
              className="md:col-span-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {creatingAgent ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Créer un compte agent
            </button>
          </form>
          {agents.length > 0 && (
            <div className="mt-6 space-y-3">
              {agents.map((agent) => {
                const assignedServiceIds = Array.isArray(agent.assignedServiceIds) && agent.assignedServiceIds.length > 0
                  ? agent.assignedServiceIds
                  : Array.isArray(agent.assignedCounterIds) && agent.assignedCounterIds.length > 0
                    ? agent.assignedCounterIds
                    : [];
                const normalizedServiceIds = [...new Set(assignedServiceIds.filter(Boolean).map(String))];
                const assignedServiceName =
                  normalizedServiceIds.length > 0
                    ? normalizedServiceIds
                        .map((serviceId) => services.find((service) => service.id === serviceId)?.name)
                        .filter(Boolean)
                        .join(', ') || 'Service inconnu'
                    : 'Aucun service assigné';

                return (
                  <div key={agent.id} className="rounded-xl border border-border bg-background px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
                          <span className="text-xs font-medium text-muted-foreground">Services</span>
                          <div className="flex flex-col gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                            <select
                              value=""
                              onChange={(event) => {
                                if (!event.target.value) return;
                                const next = Array.from(new Set([...normalizedServiceIds, event.target.value]));
                                handleUpdateAgentService(agent.email, next);
                                event.target.value = '';
                              }}
                              className="w-full min-w-[160px] rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="">Ajouter un service</option>
                              {services
                                .filter((service) => !normalizedServiceIds.includes(service.id))
                                .map((service) => (
                                  <option key={service.id} value={service.id}>{service.name}</option>
                                ))}
                            </select>

                            <div className="flex flex-wrap gap-2">
                              {normalizedServiceIds.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Aucun service</span>
                              ) : (
                                normalizedServiceIds.map((serviceId) => {
                                  const service = services.find((item) => item.id === serviceId);
                                  if (!service) return null;
                                  return (
                                    <button
                                      key={service.id}
                                      type="button"
                                      onClick={() => {
                                        const next = normalizedServiceIds.filter((id) => id !== service.id);
                                        handleUpdateAgentService(agent.email, next);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                                    >
                                      {service.name}
                                      <span aria-hidden="true">×</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <Plus size={12} />
                            Agent
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgent(agent.email)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                          >
                            <Trash2 size={12} />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">Services affectés : {assignedServiceName}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ServiceManager services={services} onChange={load} />
        <CounterManager counters={counters} services={services} onChange={load} />
      </div>
    </div>
  );
}