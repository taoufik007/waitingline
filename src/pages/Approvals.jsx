import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import {
  CheckCircle2,
  Ban,
  RotateCcw,
  LogOut,
  Users,
  Clock,
  ShieldCheck,
  ShieldX,
  UserPlus,
  Crown,
  X,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import UserAccountPanel from '@/components/UserAccountPanel';

const APPROVALS_TOKEN_KEY = 'approvals_token';
const APPROVALS_USER_KEY = 'approvals_user';
const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const clearApprovalsSession = () => {
  sessionStorage.removeItem(APPROVALS_TOKEN_KEY);
  sessionStorage.removeItem(APPROVALS_USER_KEY);
  localStorage.removeItem(APPROVALS_TOKEN_KEY);
  localStorage.removeItem(APPROVALS_USER_KEY);
};

const getStoredApprovalsSession = () => {
  const token = sessionStorage.getItem(APPROVALS_TOKEN_KEY);
  const rawUser = sessionStorage.getItem(APPROVALS_USER_KEY);

  if (!token || !rawUser) {
    clearApprovalsSession();
    return { token: null, user: null };
  }

  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    clearApprovalsSession();
    return { token: null, user: null };
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const StatCard = ({ icon: Icon, label, value, colorClass }) => (
  <div className={`relative overflow-hidden rounded-2xl border p-5 ${colorClass.bg}`}>
    <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${colorClass.blob}`} />
    <div className="flex items-center gap-3 relative">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass.iconBg}`}>
        <Icon className={`w-5 h-5 ${colorClass.icon}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold ${colorClass.text}`}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  </div>
);

export default function Approvals() {
  const [approvalsUser, setApprovalsUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState(null);
  const [expandedClientEmail, setExpandedClientEmail] = useState(null);

  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { token } = getStoredApprovalsSession();
      if (!token) {
        setPending([]);
        setApproved([]);
        setClients([]);
        return;
      }
      const res = await fetch('/api/approvals/pending-users', {
        headers: { 'x-approvals-token': token },
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const nextClients = Array.isArray(data.clients)
        ? data.clients.filter((client) => normalizeRole(client?.role || 'admin') === 'admin')
        : Array.isArray(data.admins)
          ? data.admins.filter((client) => normalizeRole(client?.role || 'admin') === 'admin')
          : [];
      setPending(data.pending || []);
      setApproved(data.approved || []);
      setClients(nextClients);
    } catch (err) {
      toast({ title: 'Erreur', description: 'Impossible de charger les demandes' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const { user: aUser, token } = getStoredApprovalsSession();
      if (aUser && token) {
        sessionStorage.setItem(APPROVALS_TOKEN_KEY, token);
        sessionStorage.setItem(APPROVALS_USER_KEY, JSON.stringify(aUser));
      }
      setApprovalsUser(aUser || null);
      if (aUser) {
        load();
      }
    } catch {}
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) {
    return null;
  }

  if (!approvalsUser) {
    window.location.replace('/approvals/login');
    return null;
  }

  const approve = async (email) => {
    setBusyEmail(email);
    try {
      const { token } = getStoredApprovalsSession();
      const res = await fetch('/api/approvals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-approvals-token': token },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('approve failed');
      toast({ title: 'Approuvé', description: `${email} approuvé — email de notification envoyé` });
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: `Échec lors de l'approbation de ${email}` });
    } finally {
      setBusyEmail(null);
    }
  };

  const setActive = async (email, active) => {
    setBusyEmail(email);
    try {
      const { token } = getStoredApprovalsSession();
      const res = await fetch('/api/approvals/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-approvals-token': token },
        body: JSON.stringify({ email, active }),
      });
      if (!res.ok) throw new Error('failed');
      toast({
        title: active ? 'Compte réactivé' : 'Compte désactivé',
        description: email,
      });
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: `Échec de la mise à jour pour ${email}` });
    } finally {
      setBusyEmail(null);
    }
  };

  const deleteClient = async (email) => {
    if (!window.confirm(`Supprimer le compte client ${email} ? Cette action supprimera aussi ses agents attachés.`)) {
      return;
    }

    setBusyEmail(email);
    try {
      const { token } = getStoredApprovalsSession();
      const res = await fetch('/api/approvals/delete-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-approvals-token': token },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'delete failed');
      toast({ title: 'Compte supprimé', description: `${email} a été supprimé` });
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message || `Échec de la suppression de ${email}` });
    } finally {
      setBusyEmail(null);
    }
  };

  const impersonate = async (email) => {
    setBusyEmail(email);
    try {
      const { token } = getStoredApprovalsSession();
      const res = await fetch('/api/approvals/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-approvals-token': token },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Échec');

      const userParam = encodeURIComponent(JSON.stringify(data.user));
      const bridgeUrl = `/impersonate-bridge?token=${encodeURIComponent(data.token)}&user=${userParam}`;
      window.open(bridgeUrl, '_blank');
    } catch (err) {
      toast({ title: 'Erreur', description: err.message || `Impossible d'accéder à l'espace de ${email}` });
    } finally {
      setBusyEmail(null);
    }
  };

  const handleLogout = () => {
    clearApprovalsSession();
    window.location.replace('/approvals/login');
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    const fullName = `${adminForm.firstName.trim()} ${adminForm.lastName.trim()}`.trim();

    if (!adminForm.email.trim() || !fullName || !adminForm.password) {
      toast({ title: 'Erreur', description: 'Remplis tous les champs' });
      return;
    }
    if (adminForm.password.length < 6) {
      toast({ title: 'Erreur', description: 'Le mot de passe doit faire au moins 6 caractères' });
      return;
    }

    setCreatingAdmin(true);
    try {
      const token = sessionStorage.getItem('approvals_token');
      const res = await fetch('/api/approvals/create-approver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-approvals-token': token },
        body: JSON.stringify({
          email: adminForm.email.trim(),
          name: fullName,
          password: adminForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Échec de la création');

      toast({ title: 'Administrateur ajouté', description: `${fullName} peut maintenant se connecter à /approvals/login` });
      setAdminForm({ firstName: '', lastName: '', email: '', password: '' });
      setShowAdminForm(false);
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message || 'Échec de la création' });
    } finally {
      setCreatingAdmin(false);
    }
  };

  const activeCount = approved.filter((u) => u.active !== false).length;
  const inactiveCount = approved.filter((u) => u.active === false).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Gestion des inscriptions</h1>
                <p className="text-sm text-white/60">
                  Connecté en tant que {approvalsUser.name || approvalsUser.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowAdminForm((v) => !v)}
                className="bg-white text-slate-900 hover:bg-white/90"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Ajouter un admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="bg-white/5 border-white/20 text-white hover:bg-white/15 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Se déconnecter
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {showAdminForm && (
          <div className="mb-10 border rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">Nouvel administrateur</h3>
              </div>
              <button
                onClick={() => setShowAdminForm(false)}
                className="text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={adminForm.firstName}
                    onChange={(e) => setAdminForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Karim"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={adminForm.lastName}
                    onChange={(e) => setAdminForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Bennani"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse email</Label>
                <Input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="karim@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Au moins 6 caractères"
                  required
                />
              </div>
              <Button type="submit" disabled={creatingAdmin} className="w-full">
                {creatingAdmin ? 'Création…' : 'Créer l\'administrateur'}
              </Button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard
            icon={Clock}
            label="En attente d'approbation"
            value={pending.length}
            colorClass={{
              bg: 'bg-amber-50 border-amber-200',
              blob: 'bg-amber-400',
              iconBg: 'bg-amber-100',
              icon: 'text-amber-600',
              text: 'text-amber-700',
            }}
          />
          <StatCard
            icon={ShieldCheck}
            label="Comptes actifs"
            value={activeCount}
            colorClass={{
              bg: 'bg-emerald-50 border-emerald-200',
              blob: 'bg-emerald-400',
              iconBg: 'bg-emerald-100',
              icon: 'text-emerald-600',
              text: 'text-emerald-700',
            }}
          />
          <StatCard
            icon={ShieldX}
            label="Comptes désactivés"
            value={inactiveCount}
            colorClass={{
              bg: 'bg-red-50 border-red-200',
              blob: 'bg-red-400',
              iconBg: 'bg-red-100',
              icon: 'text-red-600',
              text: 'text-red-700',
            }}
          />
        </div>

        <div className="mb-10 rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-slate-300">Compte connecté</div>
                <div className="font-semibold">{approvalsUser.name || approvalsUser.email}</div>
              </div>
            </div>
            <span className="text-xs uppercase tracking-wide bg-white/10 border border-white/10 px-2 py-1 rounded-full">
              approbateur
            </span>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-200">
            <div>
              <span className="text-slate-400">Email</span>
              <div className="font-medium text-white">{approvalsUser.email}</div>
            </div>
            <div>
              <span className="text-slate-400">État</span>
              <div className="font-medium text-emerald-300">Connecté</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Comptes à approuver
                <span className="text-sm font-normal text-muted-foreground">({pending.length})</span>
              </h2>
              {pending.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground text-sm">
                  Aucune demande en attente. Tout est à jour ✨
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((u) => (
                    <div
                      key={u.email}
                      className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.name || u.email}</div>
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                      <Button onClick={() => approve(u.email)} disabled={busyEmail === u.email}>
                        {busyEmail === u.email ? 'Approbation…' : 'Approuver'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {clients.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-indigo-500" />
                  Comptes clients
                  <span className="text-sm font-normal text-muted-foreground">({clients.length})</span>
                </h2>
                <div className="space-y-3">
                  {clients.map((a) => {
                    const isExpanded = expandedClientEmail === a.email;
                    const clientAgents = Array.isArray(a.agents) ? a.agents : [];
                    const totalSessions = clientAgents.reduce((sum, agent) => sum + (agent.sessionCount || 0), 0);
                    return (
                      <div
                        key={a.email}
                        className="flex flex-col gap-3 p-4 border rounded-xl bg-indigo-50/50 border-indigo-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                              {(a.name || a.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {a.name || a.email}
                                {a.email === approvalsUser.email && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                                    Toi
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">{a.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedClientEmail(isExpanded ? null : a.email)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                              {isExpanded ? 'Masquer' : 'Détails'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => impersonate(a.email)}
                              disabled={busyEmail === a.email}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              {busyEmail === a.email ? '…' : 'Accéder'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setActive(a.email, a.active === false)}
                              disabled={busyEmail === a.email}
                            >
                              {a.active === false ? <RotateCcw className="w-4 h-4 mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
                              {busyEmail === a.email ? '…' : a.active === false ? 'Réactiver' : 'Désactiver'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteClient(a.email)}
                              disabled={busyEmail === a.email}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {busyEmail === a.email ? '…' : 'Supprimer'}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-indigo-100 bg-white/80 px-3 py-2">
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                            <span>Résumé</span>
                            <span className="font-semibold text-indigo-700">
                              {a.agentCount || 0} agent(s) · {totalSessions} session(s) récentes
                            </span>
                          </div>

                          {clientAgents.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {clientAgents.map((agent) => (
                                <div
                                  key={agent.email}
                                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${
                                    agent.sessionCount > 0
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <span>{agent.name || agent.email}</span>
                                  <span className="font-semibold">({agent.sessionCount || 0})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">Aucun agent rattaché à ce compte.</div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="rounded-xl border border-indigo-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700 mb-3">
                              Détail du compte client
                            </div>
                            <div className="space-y-3">
                              {clientAgents.length === 0 ? (
                                <div className="text-sm text-slate-500">Aucun agent associé pour ce client.</div>
                              ) : (
                                clientAgents.map((agent) => (
                                  <div key={agent.email} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <div>
                                        <div className="font-medium text-slate-800">{agent.name || agent.email}</div>
                                        <div className="text-xs text-slate-500">{agent.email}</div>
                                      </div>
                                      <span
                                        className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                                          agent.sessionCount > 0
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-200 text-slate-600'
                                        }`}
                                      >
                                        {agent.sessionCount || 0} récente(s)
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                                      <div>
                                        <div className="font-medium text-slate-700 mb-1">Service</div>
                                        <div>
                                          {Array.isArray(agent.assignedServiceIds) && agent.assignedServiceIds.length > 0
                                            ? agent.assignedServiceIds.join(', ')
                                            : Array.isArray(agent.assignedCounterIds) && agent.assignedCounterIds.length > 0
                                              ? agent.assignedCounterIds.join(', ')
                                              : 'Aucun service assigné'}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-slate-700 mb-1">Statut</div>
                                        <div>{agent.active === false ? 'Inactif' : 'Actif'}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Comptes approuvés
                <span className="text-sm font-normal text-muted-foreground">({approved.length})</span>
              </h2>
              {approved.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground text-sm">
                  Aucun compte approuvé pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {approved.map((u) => {
                    const isActive = u.active !== false;
                    return (
                      <div
                        key={u.email}
                        className={`flex items-center justify-between p-4 border rounded-xl shadow-sm hover:shadow-md transition-shadow ${
                          isActive ? 'bg-white' : 'bg-red-50/60 border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {u.name || u.email}
                              {!isActive && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wide">
                                  Désactivé
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{u.email}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Approuvé le {formatDate(u.approvedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => impersonate(u.email)}
                              disabled={busyEmail === u.email}
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Accéder à son espace
                            </Button>
                          )}
                          {isActive ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setActive(u.email, false)}
                              disabled={busyEmail === u.email}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              {busyEmail === u.email ? '…' : 'Désactiver'}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActive(u.email, true)}
                              disabled={busyEmail === u.email}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              {busyEmail === u.email ? '…' : 'Réactiver'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}