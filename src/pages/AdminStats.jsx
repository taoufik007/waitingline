import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, Clock3, Users } from 'lucide-react';

const formatDateKey = (value) => {
  if (!value) return 'Inconnu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatMonthKey = (value) => {
  if (!value) return 'Inconnu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
};

const formatHourLabel = (hour) => {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'Heure inconnue';
  const start = `${String(h).padStart(2, '0')}:00`;
  const end = `${String((h + 1) % 24).padStart(2, '0')}:00`;
  return `${start}–${end}`;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const safeText = (value) => String(value || 'Inconnu');

export default function AdminStats() {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncThemeFromStorage = () => {
      const email =
        window.sessionStorage.getItem('waitingline_active_user') ||
        window.localStorage.getItem('waitingline_active_user') ||
        (() => {
          try {
            const stored = JSON.parse(window.localStorage.getItem('waitingline_user') || window.sessionStorage.getItem('waitingline_user') || 'null');
            return stored?.email || '';
          } catch {
            return '';
          }
        })();

      const key = email ? `waitingline_theme_${String(email).trim().toLowerCase().replace(/[@.]/g, '_')}` : 'waitingline_active_theme';
      const value = (email ? window.localStorage.getItem(key) || window.sessionStorage.getItem(key) : null) || window.localStorage.getItem('waitingline_active_theme') || window.sessionStorage.getItem('waitingline_active_theme') || 'light';
      const root = document.documentElement;
      root.classList.toggle('dark', value === 'dark');
      root.dataset.theme = value === 'dark' ? 'dark' : 'light';
    };

    syncThemeFromStorage();
    window.addEventListener('storage', syncThemeFromStorage);
    return () => window.removeEventListener('storage', syncThemeFromStorage);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [ticketList, serviceList, counterList, agentList] = await Promise.all([
          base44.entities.Ticket.list('-created_date', 1000),
          base44.entities.Service.list('name'),
          base44.entities.Counter.list('name'),
          fetch('/api/admin/agents', {
            headers: { 'x-session-token': base44.auth.getToken() || localStorage.getItem('waitingline_token') || '' },
          }).then(async (response) => {
            if (!response.ok) return [];
            const data = await response.json();
            return data.agents || [];
          }),
        ]);

        if (!mounted) return;
        setTickets(ticketList || []);
        setServices(serviceList || []);
        setCounters(counterList || []);
        setAgents(agentList || []);
      } catch (error) {
        console.error('Failed to load admin stats', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set();
    (tickets || []).forEach((ticket) => {
      const ticketDate = normalizeDate(ticket.created_date || ticket.createdAt || ticket.called_at);
      if (ticketDate) years.add(String(ticketDate.getFullYear()));
    });
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter((ticket) => {
      const ticketDate = normalizeDate(ticket.created_date || ticket.createdAt || ticket.called_at);
      if (!ticketDate) return true;

      if (selectedYear !== 'all' && ticketDate.getFullYear() !== Number(selectedYear)) {
        return false;
      }

      if (selectedMonth !== 'all' && ticketDate.getMonth() !== Number(selectedMonth)) {
        return false;
      }

      return true;
    });
  }, [tickets, selectedYear, selectedMonth]);

  const serviceMap = useMemo(
    () => Object.fromEntries((services || []).map((service) => [service.id, service.name])),
    [services]
  );

  const counterMap = useMemo(
    () => Object.fromEntries((counters || []).map((counter) => [counter.id, counter])),
    [counters]
  );

  const agentByCounter = useMemo(() => {
    const map = new Map();

    (agents || []).forEach((agent) => {
      const assignedCounterIds = new Set((agent.assignedCounterIds || []).filter(Boolean).map(String));
      const assignedServiceIds = new Set((agent.assignedServiceIds || []).filter(Boolean).map(String));

      (counters || []).forEach((counter) => {
        const counterId = String(counter.id);
        const counterServices = new Set((counter.service_ids || []).filter(Boolean).map(String));
        const matchesCounter = assignedCounterIds.has(counterId);
        const matchesService = !![...assignedServiceIds].find((serviceId) => counterServices.has(serviceId));

        if (matchesCounter || matchesService) {
          map.set(counterId, agent);
        }
      });
    });

    return map;
  }, [agents, counters]);

  const stats = useMemo(() => {
    const totals = {
      visitors: filteredTickets.length,
      today: 0,
      thisMonth: 0,
      thisYear: 0,
      served: 0,
      waiting: 0,
      completed: 0,
      missed: 0,
    };

    const byService = new Map();
    const byAgent = new Map();
    const byDay = new Map();
    const byMonth = new Map();
    const byYear = new Map();
    const byHour = new Map();

    const now = new Date();

    filteredTickets.forEach((ticket) => {
      const serviceId = String(ticket.service_id || 'unknown');
      const serviceName = serviceMap[serviceId] || 'Service non défini';
      const createdDate = normalizeDate(ticket.created_date || ticket.createdAt || ticket.called_at);
      const status = String(ticket.status || 'waiting');

      if (serviceId) {
        const row = byService.get(serviceName) || { label: serviceName, total: 0, waiting: 0, completed: 0, called: 0, missed: 0 };
        row.total += 1;
        if (status === 'waiting') row.waiting += 1;
        if (status === 'completed') row.completed += 1;
        if (status === 'called' || status === 'serving') row.called += 1;
        if (status === 'missed') row.missed += 1;
        byService.set(serviceName, row);
      }

      const counterId = String(ticket.counter_id || '');
      const agent = counterId ? agentByCounter.get(counterId) : null;
      const agentKey = agent ? `${agent.name} (${agent.email})` : 'Non affecté';
      if (agentKey) {
        const agentRow = byAgent.get(agentKey) || { label: agentKey, total: 0, services: new Set() };
        agentRow.total += 1;
        if (serviceId) agentRow.services.add(serviceName);
        byAgent.set(agentKey, agentRow);
      }

      const dayKey = createdDate ? createdDate.toISOString().slice(0, 10) : 'unknown';
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

      const monthKey = createdDate ? new Date(createdDate.getFullYear(), createdDate.getMonth(), 1).toISOString().slice(0, 7) : 'unknown';
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + 1);

      const yearKey = createdDate ? String(createdDate.getFullYear()) : 'unknown';
      byYear.set(yearKey, (byYear.get(yearKey) || 0) + 1);

      const hour = createdDate ? createdDate.getHours() : null;
      if (hour !== null) {
        byHour.set(hour, (byHour.get(hour) || 0) + 1);
      }

      if (createdDate) {
        const isToday = createdDate.toDateString() === now.toDateString();
        if (isToday) totals.today += 1;
        if (createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear()) totals.thisMonth += 1;
        if (createdDate.getFullYear() === now.getFullYear()) totals.thisYear += 1;
      }

      if (status === 'completed') totals.completed += 1;
      if (status === 'waiting') totals.waiting += 1;
      if (status === 'missed') totals.missed += 1;
      if (status === 'called' || status === 'serving') totals.served += 1;
    });

    const busiestHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

    const topAgents = [...byAgent.entries()]
      .map(([label, row]) => ({
        label,
        total: row.total,
        services: [...row.services].slice(0, 3).join(', ') || 'Non défini',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const dayRows = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
    const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
    const yearRows = [...byYear.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 8);

    return {
      totals,
      topAgents,
      byService: [...byService.entries()].map(([label, row]) => ({ ...row, label })).sort((a, b) => b.total - a.total),
      dayRows,
      monthRows,
      yearRows,
      busiestHour: busiestHour ? { hour: busiestHour[0], count: busiestHour[1] } : null,
    };
  }, [filteredTickets, serviceMap, agentByCounter]);

  const filterLabel =
    selectedYear === 'all' && selectedMonth === 'all'
      ? 'Toutes les données'
      : selectedYear !== 'all' && selectedMonth === 'all'
        ? `Année ${selectedYear}`
        : selectedYear === 'all' && selectedMonth !== 'all'
          ? `Mois ${new Date(2000, Number(selectedMonth), 1).toLocaleString('fr-FR', { month: 'long' })}`
          : `Mois ${new Date(2000, Number(selectedMonth), 1).toLocaleString('fr-FR', { month: 'long' })} ${selectedYear}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement des statistiques…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Administration</p>
            <h1 className="mt-2 text-3xl font-bold">Statistiques de fréquentation</h1>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft size={16} />
            Retour admin
          </Link>
        </div>

        <div className="mb-8 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Filtre</p>
              <p className="mt-1 text-sm font-medium text-foreground">{filterLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="all">Toutes les années</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="all">Tous les mois</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={String(index)}>
                    {new Date(2000, index, 1).toLocaleString('fr-FR', { month: 'long' })}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedMonth('all');
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total visiteurs', value: stats.totals.visitors, icon: Users },
            { label: 'Aujourd’hui', value: stats.totals.today, icon: CalendarDays },
            { label: 'Ce mois', value: stats.totals.thisMonth, icon: BarChart3 },
            { label: 'Cette année', value: stats.totals.thisYear, icon: BarChart3 },
            { label: 'Heure la plus chargée', value: stats.busiestHour ? formatHourLabel(stats.busiestHour.hour) : 'N/A', icon: Clock3 },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon size={18} className="text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Par agent</h2>
            <div className="space-y-3">
              {stats.topAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée d’agent disponible.</p>
              ) : (
                stats.topAgents.map((agent) => (
                  <div key={agent.label} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{agent.label}</p>
                        <p className="text-xs text-muted-foreground">Services: {agent.services}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{agent.total}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Par service</h2>
            <div className="space-y-3">
              {stats.byService.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée de service disponible.</p>
              ) : (
                stats.byService.map((service) => (
                  <div key={service.label} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{service.label}</p>
                        <p className="text-xs text-muted-foreground">Attente: {service.waiting} • Terminés: {service.completed} • Appelés: {service.called}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-700">{service.total}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Par jour</h2>
            <div className="space-y-2">
              {stats.dayRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée journalière.</p>
              ) : (
                stats.dayRows.map(([day, count]) => (
                  <div key={day} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
                    <span>{formatDateKey(day)}</span>
                    <strong>{count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Par mois</h2>
            <div className="space-y-2">
              {stats.monthRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée mensuelle.</p>
              ) : (
                stats.monthRows.map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
                    <span>{formatMonthKey(`${month}-01`)}</span>
                    <strong>{count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Par année</h2>
            <div className="space-y-2">
              {stats.yearRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée annuelle.</p>
              ) : (
                stats.yearRows.map(([year, count]) => (
                  <div key={year} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
                    <span>{year}</span>
                    <strong>{count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Résumé opérationnel</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="mt-2 text-2xl font-bold">{stats.totals.waiting}</p>
            </div>
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-muted-foreground">Servis / appelés</p>
              <p className="mt-2 text-2xl font-bold">{stats.totals.served}</p>
            </div>
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-muted-foreground">Terminés</p>
              <p className="mt-2 text-2xl font-bold">{stats.totals.completed}</p>
            </div>
          </div>
          {stats.busiestHour && (
            <p className="mt-4 text-sm text-muted-foreground">
              L’heure la plus chargée est <strong>{formatHourLabel(stats.busiestHour.hour)}</strong> avec <strong>{stats.busiestHour.count}</strong> visiteur(s) enregistrés.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
