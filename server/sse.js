import Redis from 'ioredis';

// ═══════════════════════════════════════════════════════════════
// Configuration Redis (Pub/Sub pour clustering)
// ═══════════════════════════════════════════════════════════════
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: false,
  maxRetriesPerRequest: null,
};

let publisher = null;
let subscriber = null;
let redisAvailable = false;

try {
  publisher = new Redis(redisConfig);
  subscriber = new Redis(redisConfig);

  publisher.on('connect', () => {
    redisAvailable = true;
    console.log(`[SSE] Redis Publisher connecté sur ${redisConfig.host}:${redisConfig.port}`);
  });

  publisher.on('error', (err) => {
    console.error('[SSE] Redis Publisher erreur:', err.message);
    redisAvailable = false;
  });

  subscriber.on('error', (err) => {
    console.error('[SSE] Redis Subscriber erreur:', err.message);
  });
} catch (err) {
  console.error('[SSE] Redis initialisation échouée, mode local uniquement:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// Clients SSE locaux (par admin)
// ═══════════════════════════════════════════════════════════════
const clients = new Map();

let totalConnections = 0;
let totalDisconnections = 0;

// Channel Redis par admin
const channelFor = (ownerEmail) => `waitingline:sse:${ownerEmail}`;

// ═══════════════════════════════════════════════════════════════
// Souscription Redis (recevoir les broadcasts des autres workers)
// ═══════════════════════════════════════════════════════════════
if (subscriber) {
  // ⚠️ Avec psubscribe, l'événement est 'pmessage' (pas 'message')
  subscriber.on('pmessage', (pattern, channel, message) => {
    try {
      const { eventName, data } = JSON.parse(message);
      const ownerEmail = channel.replace('waitingline:sse:', '');
      console.log(`[SSE] 📥 Message Redis reçu pour ${ownerEmail} (${eventName})`);
      deliverLocal(ownerEmail, eventName, data);
    } catch (err) {
      console.error('[SSE] Erreur parse message Redis', err);
    }
  });

  subscriber.psubscribe('waitingline:sse:*', (err) => {
    if (err) console.error('[SSE] Erreur psubscribe', err);
    else console.log('[SSE] Subscriber abonné à waitingline:sse:*');
  });
}

// ═══════════════════════════════════════════════════════════════
// Envoi local (aux clients SSE de ce worker)
// ═══════════════════════════════════════════════════════════════
const deliverLocal = (ownerEmail, eventName, data) => {
  const ownerClients = clients.get(ownerEmail);
  if (!ownerClients || ownerClients.size === 0) return;

  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of ownerClients) {
    try {
      client.write(message);
    } catch (err) {
      console.error(`[SSE] Erreur envoi`, err.message);
      ownerClients.delete(client);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// API publique
// ═══════════════════════════════════════════════════════════════
export const addClient = (ownerEmail, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write(`: SSE stream started\n\n`);   // ⬅️ AJOUTE CETTE LIGNE
  if (!clients.has(ownerEmail)) {
    clients.set(ownerEmail, new Set());
  }
  clients.get(ownerEmail).add(res);
  totalConnections++;

  console.log(`[SSE] Client connecté (${ownerEmail}). Total: ${clients.get(ownerEmail).size}`);

  // Envoyer un message de confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected', ownerEmail })}\n\n`);

  // Heartbeat toutes les 30 secondes
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Nettoyage
  const cleanup = () => {
    clearInterval(heartbeat);
    if (clients.has(ownerEmail)) {
      clients.get(ownerEmail).delete(res);
      if (clients.get(ownerEmail).size === 0) clients.delete(ownerEmail);
    }
    totalDisconnections++;
    console.log(`[SSE] Client déconnecté (${ownerEmail})`);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
  res.on('end', cleanup);
};

export const broadcast = async (ownerEmail, eventName, data) => {
  // Publier dans Redis (tous les workers recevront)
  if (publisher && redisAvailable) {
    try {
      await publisher.publish(
        channelFor(ownerEmail),
        JSON.stringify({ eventName, data })
      );
      console.log(`[SSE] Broadcast '${eventName}' publié pour ${ownerEmail}`);
    } catch (err) {
      console.error('[SSE] Erreur publish Redis, fallback local:', err.message);
      deliverLocal(ownerEmail, eventName, data);
    }
  } else {
    // Pas de Redis → envoi local uniquement
    console.log(`[SSE] Redis indisponible, envoi local pour ${ownerEmail}`);
    deliverLocal(ownerEmail, eventName, data);
  }
};

export const getClientCount = (ownerEmail) => clients.get(ownerEmail)?.size || 0;

export const getTotalClientCount = () => {
  let total = 0;
  for (const set of clients.values()) total += set.size;
  return total;
};

export const getStats = () => ({
  totalConnected: getTotalClientCount(),
  totalAdmins: clients.size,
  totalConnections,
  totalDisconnections,
  redisAvailable,
});