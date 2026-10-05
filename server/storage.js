import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// PARTIE 1 : COMPTES + OTP → data.json (fichier global, verrou global)
// ─────────────────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), 'server', 'data.json');

const defaultData = {
  accounts: {},
  pendingOtps: {},
  passwordResetTokens: {},
};

let globalWriteChain = Promise.resolve();
const withGlobalLock = (task) => {
  const run = globalWriteChain.then(task, task);
  globalWriteChain = run.then(() => {}, () => {});
  return run;
};

const readGlobalData = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      accounts: parsed.accounts || {},
      pendingOtps: parsed.pendingOtps || {},
      passwordResetTokens: parsed.passwordResetTokens || {},
    };
  } catch (err) {
    if (err?.code === 'ENOENT') return { ...defaultData };
    throw err;
  }
};

const writeGlobalData = async (data) => {
  const tmp = `${DATA_FILE}.tmp`;
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
};

export const getAccount = async (email) => {
  const data = await readGlobalData();
  return data.accounts[email] || null;
};

export const hasAccount = async (email) => {
  const acc = await getAccount(email);
  return !!acc;
};

export const listAccounts = async () => {
  const data = await readGlobalData();
  return Object.values(data.accounts);
};

export const setAccount = (email, account) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    data.accounts[email] = account;
    await writeGlobalData(data);
    return account;
  });

export const deleteAccount = (email) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    if (data.accounts[email]) delete data.accounts[email];
    await writeGlobalData(data);
    return true;
  });

export const getPendingOtp = async (email) => {
  const data = await readGlobalData();
  return data.pendingOtps[email] || null;
};

export const setPendingOtp = (email, payload) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    data.pendingOtps[email] = payload;
    await writeGlobalData(data);
    return payload;
  });

export const deletePendingOtp = (email) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    if (data.pendingOtps[email]) delete data.pendingOtps[email];
    await writeGlobalData(data);
    return true;
  });

export const getPasswordResetToken = async (token) => {
  const data = await readGlobalData();
  return data.passwordResetTokens[token] || null;
};

export const setPasswordResetToken = (token, payload) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    data.passwordResetTokens[token] = payload;
    await writeGlobalData(data);
    return payload;
  });

export const deletePasswordResetToken = (token) =>
  withGlobalLock(async () => {
    const data = await readGlobalData();
    if (data.passwordResetTokens[token]) delete data.passwordResetTokens[token];
    await writeGlobalData(data);
    return true;
  });

// ─────────────────────────────────────────────────────────────
// PARTIE 2 : SERVICES / GUICHETS / TICKETS → un fichier par client
// (server/data-clients/<hash-de-l-email>.json), verrou par client
// ─────────────────────────────────────────────────────────────

const ENTITIES_DIR = path.join(process.cwd(), 'server', 'data-clients');

const VALID_ENTITY_TYPES = ['services', 'counters', 'tickets'];

const assertValidType = (type) => {
  if (!VALID_ENTITY_TYPES.includes(type)) {
    const err = new Error(`Unknown entity type: ${type}`);
    err.status = 400;
    throw err;
  }
};

// Même fonction de hash que dans le script de migration : ne pas modifier
// sans re-migrer, sinon les fichiers existants ne seront plus retrouvés.
export const fileForOwner = (ownerEmail) => {
  const hash = crypto.createHash('sha256').update(ownerEmail).digest('hex').slice(0, 24);
  return path.join(ENTITIES_DIR, `${hash}.json`);
};

const defaultOwnerEntities = {
  services: [],
  counters: [],
  tickets: [],
};

const readOwnerEntities = async (ownerEmail) => {
  try {
    const raw = await fs.readFile(fileForOwner(ownerEmail), 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      services: parsed.services || [],
      counters: parsed.counters || [],
      tickets: parsed.tickets || [],
    };
  } catch (err) {
    if (err?.code === 'ENOENT') return { ...defaultOwnerEntities };
    throw err;
  }
};

const writeOwnerEntities = async (ownerEmail, entities) => {
  const file = fileForOwner(ownerEmail);
  const tmp = `${file}.tmp`;
  await fs.mkdir(ENTITIES_DIR, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(entities, null, 2), 'utf8');
  await fs.rename(tmp, file);
};

const locksByOwner = new Map();
const withOwnerLock = (ownerEmail, task) => {
  const previous = locksByOwner.get(ownerEmail) || Promise.resolve();
  const run = previous.then(task, task);
  locksByOwner.set(
    ownerEmail,
    run.then(() => {}, () => {})
  );
  return run;
};

export const listEntities = async (type, ownerEmail) => {
  assertValidType(type);
  const entities = await readOwnerEntities(ownerEmail);
  return entities[type];
};

export const createEntity = (type, ownerEmail, fields) =>
  withOwnerLock(ownerEmail, async () => {
    assertValidType(type);
    const entities = await readOwnerEntities(ownerEmail);
    const entity = {
      id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ownerEmail,
      ...fields,
    };
    entities[type].push(entity);
    await writeOwnerEntities(ownerEmail, entities);
    return entity;
  });

export const updateEntity = (type, id, ownerEmail, patch) =>
  withOwnerLock(ownerEmail, async () => {
    assertValidType(type);
    const entities = await readOwnerEntities(ownerEmail);
    const index = entities[type].findIndex((item) => item.id === id);
    if (index === -1) {
      const err = new Error('Entity not found');
      err.status = 404;
      throw err;
    }
    entities[type][index] = { ...entities[type][index], ...patch };
    await writeOwnerEntities(ownerEmail, entities);
    return entities[type][index];
  });

export const deleteEntity = (type, id, ownerEmail) =>
  withOwnerLock(ownerEmail, async () => {
    assertValidType(type);
    const entities = await readOwnerEntities(ownerEmail);
    const before = entities[type].length;
    entities[type] = entities[type].filter((item) => item.id !== id);
    if (entities[type].length === before) {
      const err = new Error('Entity not found');
      err.status = 404;
      throw err;
    }
    await writeOwnerEntities(ownerEmail, entities);
    return true;
  });