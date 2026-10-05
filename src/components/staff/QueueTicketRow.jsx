import { CATEGORY_LABELS } from '@/lib/ticketUtils';

export default function QueueTicketRow({ ticket, serviceName, isCurrent = false }) {
  const isPriority = ticket.category === 'priority' || ticket.category === 'pmr';

  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all ${
        isCurrent
          ? 'bg-primary/10 border-primary/60 shadow-sm'
          : 'bg-secondary border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`font-heading text-lg ${isCurrent ? 'font-black text-primary' : 'font-bold text-foreground'}`}>
          {ticket.code}
        </span>
        {isPriority && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {CATEGORY_LABELS[ticket.category]}
          </span>
        )}
      </div>
      <span className={`text-sm ${isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        {serviceName}
      </span>
    </div>
  );
}