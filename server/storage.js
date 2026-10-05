import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const useDb = () => Boolean(process.env.NETLIFY_DB_URL);

const DATA_FILE = path.join(process.cwd(), 'server', 'data.json');
const ENTITIES_DIR = path.join(process.cwd(), 'server', 'data-clients');

const readDataFile = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { accounts: {}, pendingOtps: {}, passwordResetTokens: {} };
  }
};

const writeDataFile = async (data) => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const fileForOwner = (ownerEmail) => {
  const hash = crypto.createHash('sha256').update(ownerEmail).digest('hex').slice(0, 24);
  return path.join(ENTITIES_DIR, `${hash}.json`);
};

const readOwnerEntitiesFile = async (ownerEmail) => {
  try {
    const raw = await fs.readFile(fileForOwner(ownerEmail), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { services: [], counters: [], tickets: [] };
  }
};

const writeOwnerEntitiesFile = async (ownerEmail, payload) => {
  await fs.mkdir(ENTITIES_DIR, { recursive: true });
  await fs.writeFile(fileForOwner(ownerEmail), JSON.stringify(payload, null, 2), 'utf8');
};

const getDb = async () => {
  if (!useDb()) return null;
  const mod = await import('../db/index.ts');
  return mod.db;
};

const getSchema = async () => {
  if (!useDb()) return null;
  return import('../db/schema.ts');
};

const getOne = async (table, keyColumn, key) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    return store[table.keyName]?.[key] ?? null;
  }
  const [row] = await db.select({ data: table.data }).from(table).where(keyColumn.eq ? keyColumn.eq(key) : keyColumn(key)).limit(1);
  return row?.data ?? null;
};

const upsert = async (table, keyColumn, keyName, key, data) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    store[keyName === 'token' ? 'passwordResetTokens' : keyName === 'email' && table.name === 'pending_otps' ? 'pendingOtps' : keyName === 'email' ? 'accounts' : 'entities'] = store[keyName === 'token' ? 'passwordResetTokens' : keyName === 'email' && table.name === 'pending_otps' ? 'pendingOtps' : keyName === 'email' ? 'accounts' : 'entities'] || {};
    store[keyName === 'token' ? 'passwordResetTokens' : keyName === 'email' && table.name === 'pending_otps' ? 'pendingOtps' : keyName === 'email' ? 'accounts' : 'entities'][key] = data;
    await writeDataFile(store);
    return data;
  }
  await db
    .insert(table)
    .values({ [keyName]: key, data })
    .onConflictDoUpdate({ target: keyColumn, set: { data } });
  return data;
};

const removeOne = async (table, keyColumn, key) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    const target = table.name === 'password_reset_tokens' ? 'passwordResetTokens' : table.name === 'pending_otps' ? 'pendingOtps' : 'accounts';
    if (store[target]) delete store[target][key];
    await writeDataFile(store);
    return true;
  }
  await db.delete(table).where(keyColumn.eq ? keyColumn.eq(key) : keyColumn(key));
  return true;
};

export const getAccount = async (email) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    return store.accounts?.[email] ?? null;
  }
  const { accounts } = await getSchema();
  const [row] = await db.select({ data: accounts.data }).from(accounts).where(accounts.email.eq(email)).limit(1);
  return row?.data ?? null;
};

export const hasAccount = async (email) => !!(await getAccount(email));

export const listAccounts = async () => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    return Object.values(store.accounts || {});
  }
  const { accounts } = await getSchema();
  const rows = await db.select({ data: accounts.data }).from(accounts);
  return rows.map((row) => row.data);
};

export const setAccount = async (email, account) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    store.accounts = store.accounts || {};
    store.accounts[email] = account;
    await writeDataFile(store);
    return account;
  }
  const { accounts } = await getSchema();
  await db.insert(accounts).values({ email, data: account }).onConflictDoUpdate({ target: accounts.email, set: { data: account } });
  return account;
};

export const deleteAccount = async (email) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    if (store.accounts) delete store.accounts[email];
    await writeDataFile(store);
    return true;
  }
  const { accounts } = await getSchema();
  await db.delete(accounts).where(accounts.email.eq(email));
  return true;
};

export const getPendingOtp = async (email) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    return store.pendingOtps?.[email] ?? null;
  }
  const { pendingOtps } = await getSchema();
  const [row] = await db.select({ data: pendingOtps.data }).from(pendingOtps).where(pendingOtps.email.eq(email)).limit(1);
  return row?.data ?? null;
};

export const setPendingOtp = async (email, payload) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    store.pendingOtps = store.pendingOtps || {};
    store.pendingOtps[email] = payload;
    await writeDataFile(store);
    return payload;
  }
  const { pendingOtps } = await getSchema();
  await db.insert(pendingOtps).values({ email, data: payload }).onConflictDoUpdate({ target: pendingOtps.email, set: { data: payload } });
  return payload;
};

export const deletePendingOtp = async (email) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    if (store.pendingOtps) delete store.pendingOtps[email];
    await writeDataFile(store);
    return true;
  }
  const { pendingOtps } = await getSchema();
  await db.delete(pendingOtps).where(pendingOtps.email.eq(email));
  return true;
};

export const getPasswordResetToken = async (token) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    return store.passwordResetTokens?.[token] ?? null;
  }
  const { passwordResetTokens } = await getSchema();
  const [row] = await db.select({ data: passwordResetTokens.data }).from(passwordResetTokens).where(passwordResetTokens.token.eq(token)).limit(1);
  return row?.data ?? null;
};

export const setPasswordResetToken = async (token, payload) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    store.passwordResetTokens = store.passwordResetTokens || {};
    store.passwordResetTokens[token] = payload;
    await writeDataFile(store);
    return payload;
  }
  const { passwordResetTokens } = await getSchema();
  await db.insert(passwordResetTokens).values({ token, data: payload }).onConflictDoUpdate({ target: passwordResetTokens.token, set: { data: payload } });
  return payload;
};

export const deletePasswordResetToken = async (token) => {
  const db = await getDb();
  if (!db) {
    const store = await readDataFile();
    if (store.passwordResetTokens) delete store.passwordResetTokens[token];
    await writeDataFile(store);
    return true;
  }
  const { passwordResetTokens } = await getSchema();
  await db.delete(passwordResetTokens).where(passwordResetTokens.token.eq(token));
  return true;
};

const VALID_ENTITY_TYPES = ['services', 'counters', 'tickets'];

const assertValidType = (type) => {
  if (!VALID_ENTITY_TYPES.includes(type)) {
    const err = new Error(`Unknown entity type: ${type}`);
    err.status = 400;
    throw err;
  }
};

const notFound = () => {
  const err = new Error('Entity not found');
  err.status = 404;
  return err;
};

export const listEntities = async (type, ownerEmail) => {
  assertValidType(type);
  const db = await getDb();
  if (!db) {
    const file = await readOwnerEntitiesFile(ownerEmail);
    return (file[type] || []).map((item) => item);
  }
  const { entities } = await getSchema();
  const rows = await db.select({ data: entities.data }).from(entities).where(entities.type.eq(type) && entities.ownerEmail.eq(ownerEmail));
  return rows.map((row) => row.data);
};

export const createEntity = async (type, ownerEmail, fields) => {
  assertValidType(type);
  const db = await getDb();
  if (!db) {
    const file = await readOwnerEntitiesFile(ownerEmail);
    const entity = { id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`, ownerEmail, ...fields };
    file[type] = file[type] || [];
    file[type].push(entity);
    await writeOwnerEntitiesFile(ownerEmail, file);
    return entity;
  }
  const { entities } = await getSchema();
  const entity = { id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`, ownerEmail, ...fields };
  await db.insert(entities).values({ id: entity.id, type, ownerEmail, data: entity });
  return entity;
};

export const updateEntity = async (type, id, ownerEmail, patch) => {
  assertValidType(type);
  const db = await getDb();
  if (!db) {
    const file = await readOwnerEntitiesFile(ownerEmail);
    const items = file[type] || [];
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) throw notFound();
    const updated = { ...items[idx], ...patch };
    items[idx] = updated;
    file[type] = items;
    await writeOwnerEntitiesFile(ownerEmail, file);
    return updated;
  }
  const { entities } = await getSchema();
  const [row] = await db.select({ data: entities.data }).from(entities).where(entities.id.eq(id) && entities.type.eq(type) && entities.ownerEmail.eq(ownerEmail)).limit(1);
  if (!row) throw notFound();
  const updated = { ...row.data, ...patch };
  await db.update(entities).set({ data: updated }).where(entities.id.eq(id) && entities.type.eq(type) && entities.ownerEmail.eq(ownerEmail));
  return updated;
};

export const deleteEntity = async (type, id, ownerEmail) => {
  assertValidType(type);
  const db = await getDb();
  if (!db) {
    const file = await readOwnerEntitiesFile(ownerEmail);
    const items = (file[type] || []).filter((item) => item.id !== id);
    if (items.length === (file[type] || []).length) throw notFound();
    file[type] = items;
    await writeOwnerEntitiesFile(ownerEmail, file);
    return true;
  }
  const { entities } = await getSchema();
  const deleted = await db.delete(entities).where(entities.id.eq(id) && entities.type.eq(type) && entities.ownerEmail.eq(ownerEmail)).returning({ id: entities.id });
  if (deleted.length === 0) throw notFound();
  return true;
};
