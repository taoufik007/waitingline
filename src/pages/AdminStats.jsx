import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, Clock3, Users, FileDown, Loader2 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

const STATUS_COLORS = {
  waiting: '#f59e0b',
  called: '#3b82f6',
  serving: '#8b5cf6',
  completed: '#10b981',
  missed: '#ef4444',
};

const STATUS_LABELS = {
  waiting: 'En attente',
  called: 'Appelé',
  serving: 'En cours',
  completed: 'Terminé',
  missed: 'Absent',
};

export default function AdminStats() {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const dashboardRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [ticketList, serviceList, counterList, agentList] = await Promise.all([
          base44.entities.Ticket.list('-created_date', 5000),
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

      if (selectedYear !== 'all' && ticketDate.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && ticketDate.getMonth() !== Number(selectedMonth)) return false;

      return true;
    });
  }, [tickets, selectedYear, selectedMonth]);

  const serviceMap = useMemo(
    () => Object.fromEntries((services || []).map((service) => [service.id, service.name])),
    [services]
  );

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
      called: 0,
    };

    const byService = new Map();
    const byDay = new Map();
    const byHour = new Map();
    const byStatus = new Map();

    const now = new Date();

    filteredTickets.forEach((ticket) => {
      const serviceId = String(ticket.service_id || 'unknown');
      const serviceName = serviceMap[serviceId] || 'Service non défini';
      const createdDate = normalizeDate(ticket.created_date || ticket.createdAt || ticket.called_at);
      const status = String(ticket.status || 'waiting');

      // Par service
      const row = byService.get(serviceName) || { label: serviceName, total: 0 };
      row.total += 1;
      byService.set(serviceName, row);

      // Par jour (30 derniers jours)
      if (createdDate) {
        const dayKey = createdDate.toISOString().slice(0, 10);
        byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

        const hour = createdDate.getHours();
        byHour.set(hour, (byHour.get(hour) || 0) + 1);

        if (createdDate.toDateString() === now.toDateString()) totals.today += 1;
        if (createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear()) totals.thisMonth += 1;
        if (createdDate.getFullYear() === now.getFullYear()) totals.thisYear += 1;
      }

      // Par statut
      byStatus.set(status, (byStatus.get(status) || 0) + 1);

      if (status === 'completed') totals.completed += 1;
      if (status === 'waiting') totals.waiting += 1;
      if (status === 'missed') totals.missed += 1;
      if (status === 'called' || status === 'serving') {
        totals.served += 1;
        totals.called += 1;
      }
    });

    // Données pour graphique journalier (30 derniers jours)
    const dayData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayData.push({
        day: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        tickets: byDay.get(key) || 0,
      });
    }

    // Données par heure (0-23)
    const hourData = [];
    for (let h = 0; h < 24; h++) {
      hourData.push({
        hour: `${String(h).padStart(2, '0')}h`,
        tickets: byHour.get(h) || 0,
      });
    }

    // Données par statut pour camembert
    const statusData = [...byStatus.entries()].map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));

    // Top services
    const serviceData = [...byService.entries()]
      .map(([label, row]) => ({ name: label, tickets: row.total }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 8);

    const busiestHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      totals,
      dayData,
      hourData,
      statusData,
      serviceData,
      busiestHour: busiestHour ? { hour: busiestHour[0], count: busiestHour[1] } : null,
    };
  }, [filteredTickets, serviceMap]);

  const filterLabel =
    selectedYear === 'all' && selectedMonth === 'all'
      ? 'Toutes les données'
      : selectedYear !== 'all' && selectedMonth === 'all'
        ? `Année ${selectedYear}`
        : selectedYear === 'all' && selectedMonth !== 'all'
          ? `Mois ${new Date(2000, Number(selectedMonth), 1).toLocaleString('fr-FR', { month: 'long' })}`
          : `Mois ${new Date(2000, Number(selectedMonth), 1).toLocaleString('fr-FR', { month: 'long' })} ${selectedYear}`;

  const handleExportPdf = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 10;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 5;

      pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 10;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 5;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 10;
      }

      pdf.save(`statistiques_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
      window.alert('Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

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
            <h1 className="mt-2 text-3xl font-bold">Tableau de bord</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {exporting ? 'Génération…' : 'Exporter en PDF'}
            </button>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ArrowLeft size={16} />
              Retour admin
            </Link>
          </div>
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

        <div ref={dashboardRef} style={{ backgroundColor: '#ffffff', padding: '20px' }}>
          {/* Cartes KPI */}
          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Total visiteurs', value: stats.totals.visitors, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: "Aujourd'hui", value: stats.totals.today, icon: CalendarDays, color: 'text-green-600 bg-green-50' },
              { label: 'Ce mois', value: stats.totals.thisMonth, icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
              { label: 'Cette année', value: stats.totals.thisYear, icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Heure la plus chargée', value: stats.busiestHour ? formatHourLabel(stats.busiestHour.hour) : 'N/A', icon: Clock3, color: 'text-orange-600 bg-orange-50' },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${card.color}`}>
                    <card.icon size={16} />
                  </span>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Graphique 1 : Évolution journalière */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">📈 Évolution des tickets (30 derniers jours)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.dayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip />
                <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Tickets" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique 2 : Répartition par statut + Top services */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-lg font-semibold">🥧 Répartition par statut</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats.statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-lg font-semibold">🏆 Top services</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.serviceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis dataKey="name" type="category" width={100} stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#10b981" name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graphique 3 : Heures de pointe */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">⏰ Heures de pointe</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip />
                <Bar dataKey="tickets" fill="#f59e0b" name="Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Résumé opérationnel */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">📊 Résumé opérationnel</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-sm text-amber-700">En attente</p>
                <p className="mt-2 text-2xl font-bold text-amber-900">{stats.totals.waiting}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Appelés / Servis</p>
                <p className="mt-2 text-2xl font-bold text-blue-900">{stats.totals.served}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">Terminés</p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">{stats.totals.completed}</p>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-700">Absents</p>
                <p className="mt-2 text-2xl font-bold text-red-900">{stats.totals.missed}</p>
              </div>
            </div>
            {stats.busiestHour && (
              <p className="mt-4 text-sm text-muted-foreground">
                L'heure la plus chargée est <strong>{formatHourLabel(stats.busiestHour.hour)}</strong> avec <strong>{stats.busiestHour.count}</strong> visiteur(s).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}