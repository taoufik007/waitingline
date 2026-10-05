import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2 } from 'lucide-react';

export default function ServiceManager({ services, onChange }) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);

  const readImageData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return '';

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !prefix.trim()) return;
    setSaving(true);
    await base44.entities.Service.create({
      name,
      prefix: prefix.toUpperCase().slice(0, 2),
      color,
      image: image || '',
      active: true,
    });
    setName('');
    setPrefix('');
    setColor('#2563eb');
    setImage('');
    setSaving(false);
    onChange();
  };

  const handleDelete = async (id) => {
    await base44.entities.Service.delete(id);
    onChange();
  };

  const handleToggle = async (s) => {
    await base44.entities.Service.update(s.id, { active: !s.active });
    onChange();
  };

  const handleImageChange = async (event, service) => {
    const result = await readImageData(event);
    if (!result) return;
    await base44.entities.Service.update(service.id, { image: result });
    onChange();
  };

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold mb-4">Services</h2>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du service"
          className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Préfixe (ex: A)"
          maxLength={2}
          className="w-32 px-4 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/20"
        />
        <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-2 py-2">
          <span className="text-xs font-medium text-muted-foreground">Bouton</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-9 rounded-md border border-input cursor-pointer bg-background p-0"
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
          />
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const result = await readImageData(event);
            setImage(result || '');
          }}
          className="block max-w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:font-medium"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Ajouter
        </button>
      </form>

      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {s.image ? (
                <img src={s.image} alt={s.name} className="w-10 h-10 rounded-md object-cover border border-border bg-background" />
              ) : (
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: s.color }}
                >
                  {s.prefix}
                </span>
              )}
              <span className="font-medium truncate">{s.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleImageChange(event, s)}
                className="block max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-[10px] file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
              />
              <button
                onClick={() => handleToggle(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {s.active ? 'Actif' : 'Inactif'}
              </button>
              <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="text-muted-foreground text-sm">Aucun service. Ajoutez-en un ci-dessus.</p>}
      </div>
    </div>
  );
}