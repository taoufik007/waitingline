import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2 } from 'lucide-react';

export default function CounterManager({ counters, services, onChange }) {
  const [name, setName] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleService = (id) => {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await base44.entities.Counter.create({ name, service_ids: selectedServices, status: 'available' });
    setName('');
    setSelectedServices([]);
    setSaving(false);
    onChange();
  };

  const handleDelete = async (id) => {
    await base44.entities.Counter.delete(id);
    onChange();
  };

  const serviceName = (id) => services.find((s) => s.id === id)?.name || '';

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold mb-4">Guichets</h2>
      <form onSubmit={handleAdd} className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du guichet (ex: Guichet 1)"
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Ajouter
          </button>
        </div>
        {services.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => toggleService(s.id)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  selectedServices.includes(s.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="space-y-2">
        {counters.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.service_ids?.length ? c.service_ids.map(serviceName).join(', ') : 'Tous les services'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  c.status === 'available'
                    ? 'bg-emerald-100 text-emerald-700'
                    : c.status === 'busy'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {c.status === 'available' ? 'Disponible' : c.status === 'busy' ? 'Occupé' : 'Fermé'}
              </span>
              <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {counters.length === 0 && <p className="text-muted-foreground text-sm">Aucun guichet. Ajoutez-en un ci-dessus.</p>}
      </div>
    </div>
  );
}