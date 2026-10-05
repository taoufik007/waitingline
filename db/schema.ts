import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

// Les objets métier (comptes, OTP, tickets…) sont stockés en JSONB pour garder
// exactement la même forme que l'ancien stockage fichier (server/data.json).

export const accounts = pgTable("accounts", {
  email: text().primaryKey(),
  data: jsonb().notNull(),
});

export const pendingOtps = pgTable("pending_otps", {
  email: text().primaryKey(),
  data: jsonb().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text().primaryKey(),
  data: jsonb().notNull(),
});

export const entities = pgTable(
  "entities",
  {
    id: text().primaryKey(),
    type: text().notNull(),
    ownerEmail: text("owner_email").notNull(),
    data: jsonb().notNull(),
  },
  (t) => [index("entities_owner_type_idx").on(t.ownerEmail, t.type)],
);
