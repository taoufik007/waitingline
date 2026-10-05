// Shared helpers for ticket numbering and queue ordering.

// Normalise les dates Base44 (microsecondes sans 'Z') vers un format ISO valide.
// Base44 retourne created_date au format "2026-09-24T18:10:38.436000" (6 décimales, sans 'Z'),
// ce qui peut produire une Invalid Date dans certains navigateurs.
function normalizeDateStr(dateStr) {
  if (!dateStr) return null;
  let s = String(dateStr);
  // Tronque les microsecondes (6+ décimales) en millisecondes (3)
  s = s.replace(/\.(\d{3})\d+/, '.$1');
  // Ajoute 'Z' si aucun fuseau horaire n'est spécifié
  if (!/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z';
  }
  return s;
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(normalizeDateStr(dateStr));
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function nextTicketCode(prefix, todaysCountForService) {
  const number = todaysCountForService + 1;
  const code = `${prefix}${String(number).padStart(3, '0')}`;
  return { number, code };
}

// Priority rule: 1 priority ticket for every 5 normal tickets served.
// We approximate by always surfacing priority/pmr tickets first,
// but every 6th call we force a normal ticket if one is waiting.
export function sortQueue(tickets, callCounter) {
  const priority = tickets.filter((t) => t.category === 'priority' || t.category === 'pmr');
  const normal = tickets.filter((t) => t.category === 'normal' || t.category === 'appointment');

  const byCreated = (a, b) => new Date(normalizeDateStr(a.created_date)) - new Date(normalizeDateStr(b.created_date));
  priority.sort(byCreated);
  normal.sort(byCreated);

  if (priority.length === 0) return normal;
  if (normal.length === 0) return priority;

  const forceNormal = callCounter % 6 === 5 && normal.length > 0;
  return forceNormal ? [normal[0], ...priority, ...normal.slice(1)] : [priority[0], ...normal, ...priority.slice(1)];
}

export const CATEGORY_LABELS = {
  normal: 'Normal',
  priority: 'Prioritaire',
  pmr: 'PMR',
  appointment: 'Rendez-vous',
};

export const STATUS_LABELS = {
  waiting: 'En attente',
  called: 'Appelé',
  serving: 'En cours',
  completed: 'Terminé',
  missed: 'Absent',
  hold: 'En pause',
  cancelled: 'Annulé',
};