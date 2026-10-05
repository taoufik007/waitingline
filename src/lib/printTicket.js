const PRINT_URL = (import.meta.env.VITE_PRINT_URL || 'http://127.0.0.1:9100').replace(/\/$/, '');

export async function printTicket(ticket = {}) {
  const payload = {
    number: ticket.number ?? ticket.code ?? '',
    service: ticket.serviceName ?? ticket.service ?? '',
    waiting: Number(ticket.waitingAhead ?? ticket.waiting ?? 0),
    time: new Date().toLocaleString('fr-FR'),
    guichet: 'Kiosk',
    guihcet: 'Kiosk',
    code: ticket.code ?? ticket.number ?? '',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${PRINT_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok || (json && json.ok === false)) {
      const message = json?.message || 'Impossible d’imprimer le ticket.';
      throw new Error(message);
    }

    return json ?? { ok: true };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Délai d’impression dépassé.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
