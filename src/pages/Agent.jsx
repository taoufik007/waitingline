import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import StaffHeader from '@/components/staff/StaffHeader';
import QueueTicketRow from '@/components/staff/QueueTicketRow';
import { sortQueue, isToday, CATEGORY_LABELS } from '@/lib/ticketUtils';
import { getAgentAllowedServiceIds, filterAgentCounters, filterVisibleTickets } from '@/lib/agentAccess';
import { PhoneCall, RotateCcw, CheckCheck, UserX, PauseCircle, Loader2, ArrowLeftRight } from 'lucide-react';
import UserAccountPanel from '@/components/UserAccountPanel';

export default function Agent() {
  const [user, setUser] = useState(null);
  const [counters, setCounters] = useState([]);
  const [services, setServices] = useState([]);
  const [counterId, setCounterId] = useState(localStorage.getItem('fa_counter_id') || '');
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ticketList, counterList] = await Promise.all([
      base44.entities.Ticket.list('-created_date', 300),
      base44.entities.Counter.list(),
    ]);
    setTickets(ticketList.filter((t) => isToday(t.created_date)));
    setCounters(counterList);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser);
    Promise.all([base44.entities.Counter.list(), base44.entities.Service.filter({ active: true })]).then(
      ([c, s]) => {
        setCounters(c);
        setServices(s);
        setLoading(false);
      }
    );
    load();
    const unsubscribe = base44.entities.Ticket.subscribe(() => load());
    const poll = setInterval(load, 5000);
    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [load]);

  const allowedServiceIds = getAgentAllowedServiceIds(user);
  const visibleCounters = filterAgentCounters(counters, user);
  const visibleTickets = filterVisibleTickets(tickets, allowedServiceIds);

  const managedServiceIds = getAgentAllowedServiceIds(user);
  const managedServices = services.filter((service) => managedServiceIds.includes(service.id));
  const managedServiceLabel = managedServices.length > 0 ? managedServices.map((service) => service.name).join(', ') : 'Aucun service assigné';

  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    const waitingTickets = visibleTickets.filter((t) => t.status === 'waiting');
    const newOnes = waitingTickets.filter((t) => !knownIdsRef.current.has(t.id));
    if (knownIdsRef.current.size > 0 && newOnes.length > 0) {
      newOnes.forEach((t) => {
        const svc = services.find((s) => s.id === t.service_id)?.name || '';
        toast({
          title: `Nouveau ticket — ${t.code}`,
          description: `${svc}${t.category !== 'normal' ? ` · ${CATEGORY_LABELS[t.category] || ''}` : ''}`,
        });
      });
    }
    waitingTickets.forEach((t) => knownIdsRef.current.add(t.id));
  }, [visibleTickets, services]);

  const counter = visibleCounters.find((c) => c.id === counterId);
  const serviceName = (id) => services.find((s) => s.id === id)?.name || '';

  const waiting = visibleTickets.filter(
    (t) => t.status === 'waiting' && (!counter?.service_ids?.length || counter.service_ids.includes(t.service_id))
  );
  const sortedWaiting = sortQueue(waiting, callCount);
  const currentTicket = visibleTickets.find((t) => t.id === counter?.current_ticket_id);

  const selectCounter = (id) => {
    setCounterId(id);
    localStorage.setItem('fa_counter_id', id);
  };

  const handleCallNext = async () => {
    if (!counter || sortedWaiting.length === 0) return;
    setBusy(true);
    try {
      const next = sortedWaiting[0];
      await base44.entities.Ticket.update(next.id, {
        status: 'called',
        counter_id: counter.id,
        called_at: new Date().toISOString(),
      });
      await base44.entities.Counter.update(counter.id, { current_ticket_id: next.id, status: 'busy' });
      setCallCount((c) => c + 1);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRecall = async () => {
    if (!currentTicket || !counter) return;
    setBusy(true);
    try {
      await base44.entities.Ticket.update(currentTicket.id, {
        status: 'called',
        counter_id: counter.id,
        called_at: new Date().toISOString(),
      });
      await base44.entities.Counter.update(counter.id, { current_ticket_id: currentTicket.id, status: 'busy' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!currentTicket || !counter) return;
    setBusy(true);
    try {
      await base44.entities.Ticket.update(currentTicket.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      await base44.entities.Counter.update(counter.id, { current_ticket_id: '', status: 'available' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleMissed = async () => {
    if (!currentTicket || !counter) return;
    setBusy(true);
    try {
      await base44.entities.Ticket.update(currentTicket.id, { status: 'missed' });
      await base44.entities.Counter.update(counter.id, { current_ticket_id: '', status: 'available' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleHold = async () => {
    if (!currentTicket || !counter) return;
    setBusy(true);
    try {
      await base44.entities.Ticket.update(currentTicket.id, {
        status: 'waiting',
        counter_id: '',
        called_at: null,
      });
      await base44.entities.Counter.update(counter.id, { current_ticket_id: '', status: 'available' });
      await load();
    } finally {
      setBusy(false);
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
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <UserAccountPanel
          user={user}
          onThemeChange={(mode) => {
            setUser((current) => ({ ...(current || {}), displayMode: mode }));
          }}
        />
        {!counterId ? (
          <div>
            <h1 className="font-heading text-2xl font-bold mb-6">Choisissez votre guichet</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleCounters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCounter(c.id)}
                  className="px-6 py-5 rounded-xl bg-card border border-border hover:border-primary hover:shadow-md transition-all text-left"
                >
                  <p className="font-heading text-lg font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {c.service_ids?.length ? c.service_ids.map(serviceName).join(', ') : 'Tous les services'}
                  </p>
                </button>
              ))}
              {visibleCounters.length === 0 && (
                <p className="text-muted-foreground">Aucun service assigné à votre compte. Contactez votre administrateur.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Vous opérez</p>
                  <h1 className="font-heading text-2xl font-bold">{counter?.name}</h1>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Service géré</p>
                  <p className="text-sm font-medium text-primary">{managedServiceLabel}</p>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Service assigné</p>
                <p className="mt-1 font-medium">{managedServiceLabel}</p>
              </div>

              <button
                onClick={() => selectCounter('')}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground"
              >
                <ArrowLeftRight size={16} />
                Changer de guichet
              </button>

              <div className="bg-card border border-border rounded-2xl p-8 text-center mb-8">
                {currentTicket ? (
                  <>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Ticket en cours</p>
                    <p className="font-heading text-6xl font-extrabold mb-6">{currentTicket.code}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={handleRecall}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary hover:bg-secondary/70 text-sm font-medium disabled:opacity-50"
                      >
                        <RotateCcw size={16} />
                        Rappeler
                      </button>
                      <button
                        onClick={handleComplete}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
                      >
                        <CheckCheck size={16} />
                        Terminer
                      </button>
                      <button
                        onClick={handleHold}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary hover:bg-secondary/70 text-sm font-medium disabled:opacity-50"
                      >
                        <PauseCircle size={16} />
                        Mettre en attente
                      </button>
                      <button
                        onClick={handleMissed}
                        disabled={busy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-medium disabled:opacity-50"
                      >
                        <UserX size={16} />
                        Absent
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-6">Aucun ticket en cours</p>
                    <button
                      onClick={handleCallNext}
                      disabled={busy || sortedWaiting.length === 0}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 transition-all"
                    >
                      <PhoneCall size={18} />
                      Appeler le suivant
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <h2 className="font-heading text-lg font-semibold mb-4">
                File d'attente ({sortedWaiting.length})
              </h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedWaiting.length === 0 && (
                  <p className="text-muted-foreground text-sm">Aucun ticket en attente.</p>
                )}
                {sortedWaiting.map((t) => (
                  <QueueTicketRow
                    key={t.id}
                    ticket={t}
                    serviceName={serviceName(t.service_id)}
                    isCurrent={currentTicket?.id === t.id}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}