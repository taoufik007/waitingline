import { and, eq } from 'drizzle-orm';

import { db } from '../db/index.ts';
import { accounts, entities, passwordResetTokens, pendingOtps } from '../db/schema.ts';

// ─────────────────────────────────────────────────────────────
// PARTIE 1 : COMPTES + OTP + TOKENS DE RESET → Netlify Database
// Chaque objet est stocké tel quel (JSONB), indexé par sa clé.
// ─────────────────────────────────────────────────────────────

const getOne = async (table, keyColumn, key) => {
  const [row] = await db.select({ data: table.data }).from(table).where(eq(keyColumn, key)).limit(1);
  return row?.data ?? null;
};

const upsert = async (table, keyColumn, keyName, key, data) => {
  await db
    .insert(table)
    .values({ [keyName]: key, data })
    .onConflictDoUpdate({ target: keyColumn, set: { data } });
  return data;
};

const removeOne = async (table, keyColumn, key) => {
  await db.delete(table).where(eq(keyColumn, key));
  return true;
};

export const getAccount = (email) => getOne(accounts, accounts.email, email);

export const hasAccount = async (email) => !!(await getAccount(email));

export const listAccounts = async () => {
  const rows = await db.select({ data: accounts.data }).from(accounts);
  return rows.map((row) => row.data);
};

export const setAccount = (email, account) => upsert(accounts, accounts.email, 'email', email, account);

export const deleteAccount = (email) => removeOne(accounts, accounts.email, email);

export const getPendingOtp = (email) => getOne(pendingOtps, pendingOtps.email, email);

export const setPendingOtp = (email, payload) => upsert(pendingOtps, pendingOtps.email, 'email', email, payload);

export const deletePendingOtp = (email) => removeOne(pendingOtps, pendingOtps.email, email);

export const getPasswordResetToken = (token) =>
  getOne(passwordResetTokens, passwordResetTokens.token, token);

export const setPasswordResetToken = (token, payload) =>
  upsert(passwordResetTokens, passwordResetTokens.token, 'token', token, payload);

export const deletePasswordResetToken = (token) =>
  removeOne(passwordResetTokens, passwordResetTokens.token, token);

// ─────────────────────────────────────────────────────────────
// PARTIE 2 : SERVICES / GUICHETS / TICKETS → table `entities`,
// cloisonnée par ownerEmail
// ─────────────────────────────────────────────────────────────

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

const entityScope = (type, id, ownerEmail) =>
  and(eq(entities.id, id), eq(entities.type, type), eq(entities.ownerEmail, ownerEmail));

export const listEntities = async (type, ownerEmail) => {
  assertValidType(type);
  const rows = await db
    .select({ data: entities.data })
    .from(entities)
    .where(and(eq(entities.type, type), eq(entities.ownerEmail, ownerEmail)));
  return rows.map((row) => row.data);
};

export const createEntity = async (type, ownerEmail, fields) => {
  assertValidType(type);
  const entity = {
    id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ownerEmail,
    ...fields,
  };
  await db.insert(entities).values({ id: entity.id, type, ownerEmail, data: entity });
  return entity;
};

export const updateEntity = async (type, id, ownerEmail, patch) => {
  assertValidType(type);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ data: entities.data })
      .from(entities)
      .where(entityScope(type, id, ownerEmail))
      .for('update');
    if (!row) throw notFound();
    const updated = { ...row.data, ...patch };
    await tx.update(entities).set({ data: updated }).where(entityScope(type, id, ownerEmail));
    return updated;
  });
};

export const deleteEntity = async (type, id, ownerEmail) => {
  assertValidType(type);
  const deleted = await db
    .delete(entities)
    .where(entityScope(type, id, ownerEmail))
    .returning({ id: entities.id });
  if (deleted.length === 0) throw notFound();
  return true;
};
