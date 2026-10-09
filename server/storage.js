import pool from './database.js';
import bcrypt from 'bcrypt';
// ─────────────────────────────────────────────────────────────
// PARTIE 1 : COMPTES + OTP + RESET TOKENS → tables MySQL
// ─────────────────────────────────────────────────────────────

// Convertit une ligne SQL en objet account (au format attendu par l'app)
const rowToAccount = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        password: row.password,
        createdAt: row.created_at,
        provider: row.provider,
        emailVerified: !!row.email_verified,
        approver: !!row.approver,
        approved: !!row.approved,
        approvalToken: row.approval_token,
        active: !!row.active,
        sessionToken: row.session_token,
        sessionTokens: row.session_tokens || [],
        displayMode: row.display_mode,
        parentAdminEmail: row.parent_admin_email,
        assignedServiceIds: row.assigned_service_ids || [],
        assignedCounterIds: row.assigned_counter_ids || [],
    };
};

export const getAccount = async (email) => {
    const [rows] = await pool.query('SELECT * FROM accounts WHERE email = ?', [email]);
    return rowToAccount(rows[0]);
};

export const hasAccount = async (email) => {
    const [rows] = await pool.query('SELECT 1 FROM accounts WHERE email = ? LIMIT 1', [email]);
    return rows.length > 0;
};

export const listAccounts = async () => {
    const [rows] = await pool.query('SELECT * FROM accounts');
    return rows.map(rowToAccount);
};

export const setAccount = async (email, account) => {
    // ═══════════════════════════════════════════════════════════
    // Hashage du mot de passe si nécessaire
    // ═══════════════════════════════════════════════════════════
    let passwordToSave = account.password || null;

    // Si le mot de passe n'est pas déjà hashé (ne commence pas par $2a$ ou $2b$)
    if (passwordToSave && !passwordToSave.startsWith('$2a$') && !passwordToSave.startsWith('$2b$')) {
        passwordToSave = await bcrypt.hash(passwordToSave, 12);
    }

    await pool.execute(
        `INSERT INTO accounts (
            id, email, name, role, password, created_at, provider,
            email_verified, approver, approved, approval_token, active,
            session_token, session_tokens, display_mode, parent_admin_email,
            assigned_service_ids, assigned_counter_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            role = VALUES(role),
            password = VALUES(password),
            provider = VALUES(provider),
            email_verified = VALUES(email_verified),
            approver = VALUES(approver),
            approved = VALUES(approved),
            approval_token = VALUES(approval_token),
            active = VALUES(active),
            session_token = VALUES(session_token),
            session_tokens = VALUES(session_tokens),
            display_mode = VALUES(display_mode),
            parent_admin_email = VALUES(parent_admin_email),
            assigned_service_ids = VALUES(assigned_service_ids),
            assigned_counter_ids = VALUES(assigned_counter_ids)`,
        [
            account.id, email, account.name || null, account.role || 'agent',
            passwordToSave, account.createdAt || null, account.provider || null,
            account.emailVerified ? 1 : 0, account.approver ? 1 : 0, account.approved ? 1 : 0,
            account.approvalToken || null, account.active ? 1 : 0,
            account.sessionToken || null,
            JSON.stringify(account.sessionTokens || []),
            account.displayMode || null, account.parentAdminEmail || null,
            JSON.stringify(account.assignedServiceIds || []),
            JSON.stringify(account.assignedCounterIds || [])
        ]
    );
    return account;
};

export const deleteAccount = async (email) => {
    await pool.execute('DELETE FROM accounts WHERE email = ?', [email]);
    return true;
};

// ─────────────────────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────────────────────

export const getPendingOtp = async (email) => {
    const [rows] = await pool.query('SELECT payload FROM pending_otps WHERE email = ?', [email]);
    if (!rows[0]) return null;
    // Le payload peut être déjà un objet (JSON) ou une string selon la config mysql2
    return typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
};

export const setPendingOtp = async (email, payload) => {
    await pool.execute(
        `INSERT INTO pending_otps (email, payload) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
        [email, JSON.stringify(payload)]
    );
    return payload;
};

export const deletePendingOtp = async (email) => {
    await pool.execute('DELETE FROM pending_otps WHERE email = ?', [email]);
    return true;
};

// ─────────────────────────────────────────────────────────────
// RESET TOKENS
// ─────────────────────────────────────────────────────────────

export const getPasswordResetToken = async (token) => {
    const [rows] = await pool.query(
        'SELECT email, created_at, expires_at FROM password_reset_tokens WHERE token = ?',
        [token]
    );
    if (!rows[0]) return null;
    return {
        email: rows[0].email,
        createdAt: rows[0].created_at,
        expiresAt: rows[0].expires_at,
    };
};

export const setPasswordResetToken = async (token, payload) => {
    await pool.execute(
        `INSERT INTO password_reset_tokens (token, email, created_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email)`,
        [token, payload.email, payload.createdAt || null, payload.expiresAt || null]
    );
    return payload;
};

export const deletePasswordResetToken = async (token) => {
    await pool.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
    return true;
};

// ─────────────────────────────────────────────────────────────
// PARTIE 2 : SERVICES / COUNTERS / TICKETS → tables MySQL
// ─────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES = ['services', 'counters', 'tickets'];

const assertValidType = (type) => {
    if (!VALID_ENTITY_TYPES.includes(type)) {
        const err = new Error(`Unknown entity type: ${type}`);
        err.status = 400;
        throw err;
    }
};

// Gardé pour compatibilité (index.js l'importe peut-être encore)
// Retourne un identifiant logique basé sur l'email, plus un chemin fichier
export const fileForOwner = (ownerEmail) => {
    return `mysql://waitingline/services?owner=${encodeURIComponent(ownerEmail)}`;
};

// Conversion d'une ligne SQL en objet du type attendu par l'app
const rowToEntity = (type, row) => {
    if (!row) return null;
    if (type === 'services') {
        return {
            id: row.id,
            ownerEmail: row.owner_email,
            name: row.name,
            prefix: row.prefix,
            color: row.color,
            active: !!row.active,
            image: row.image,
        };
    }
    if (type === 'counters') {
        return {
            id: row.id,
            ownerEmail: row.owner_email,
            name: row.name,
            service_ids: row.service_ids || [],
            status: row.status,
            current_ticket_id: row.current_ticket_id,
        };
    }
    if (type === 'tickets') {
        return {
            id: row.id,
            ownerEmail: row.owner_email,
            status: row.status,
            created_date: row.created_date ? new Date(row.created_date).toISOString() : null,
            number: row.number,
            code: row.code,
            service_id: row.service_id,
            category: row.category,
        };
    }
    return row;
};

export const listEntities = async (type, ownerEmail) => {
    assertValidType(type);
    const [rows] = await pool.query(
        `SELECT * FROM ${type} WHERE owner_email = ?`,
        [ownerEmail]
    );
    return rows.map((row) => rowToEntity(type, row));
};

export const createEntity = async (type, ownerEmail, fields) => {
    assertValidType(type);
    const id = fields.id || `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    if (type === 'services') {
        await pool.execute(
            `INSERT INTO services (id, owner_email, name, prefix, color, active, image)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, ownerEmail, fields.name, fields.prefix || null, fields.color || null,
             fields.active ? 1 : 0, fields.image || null]
        );
    } else if (type === 'counters') {
        await pool.execute(
            `INSERT INTO counters (id, owner_email, name, service_ids, status, current_ticket_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, ownerEmail, fields.name,
             JSON.stringify(fields.service_ids || fields.serviceIds || []),
             fields.status || 'closed', fields.current_ticket_id || null]
        );
    } else if (type === 'tickets') {
        await pool.execute(
            `INSERT INTO tickets (id, owner_email, status, created_date, number, code, service_id, category)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, ownerEmail, fields.status || 'waiting',
             fields.created_date ? new Date(fields.created_date) : new Date(),
             fields.number || null, fields.code || null,
             fields.service_id || null, fields.category || null]
        );
    }

    const [rows] = await pool.query(`SELECT * FROM ${type} WHERE id = ?`, [id]);
    return rowToEntity(type, rows[0]);
};

export const updateEntity = async (type, id, ownerEmail, patch) => {
    assertValidType(type);

    // Vérifier que l'entité existe et appartient bien à ce owner
    const [existing] = await pool.query(
        `SELECT * FROM ${type} WHERE id = ? AND owner_email = ?`,
        [id, ownerEmail]
    );
    if (!existing[0]) {
        const err = new Error('Entity not found');
        err.status = 404;
        throw err;
    }

    if (type === 'services') {
        const merged = { ...rowToEntity(type, existing[0]), ...patch };
        await pool.execute(
            `UPDATE services SET name = ?, prefix = ?, color = ?, active = ?, image = ?
             WHERE id = ? AND owner_email = ?`,
            [merged.name, merged.prefix || null, merged.color || null,
             merged.active ? 1 : 0, merged.image || null, id, ownerEmail]
        );
    } else if (type === 'counters') {
        const merged = { ...rowToEntity(type, existing[0]), ...patch };
        await pool.execute(
            `UPDATE counters SET name = ?, service_ids = ?, status = ?, current_ticket_id = ?
             WHERE id = ? AND owner_email = ?`,
            [merged.name, JSON.stringify(merged.service_ids || []),
             merged.status || null, merged.current_ticket_id || null, id, ownerEmail]
        );
    } else if (type === 'tickets') {
        const merged = { ...rowToEntity(type, existing[0]), ...patch };
        await pool.execute(
            `UPDATE tickets SET status = ?, created_date = ?, number = ?, code = ?, service_id = ?, category = ?
             WHERE id = ? AND owner_email = ?`,
            [merged.status, merged.created_date ? new Date(merged.created_date) : null,
             merged.number || null, merged.code || null, merged.service_id || null,
             merged.category || null, id, ownerEmail]
        );
    }

    const [rows] = await pool.query(`SELECT * FROM ${type} WHERE id = ?`, [id]);
    return rowToEntity(type, rows[0]);
};

export const deleteEntity = async (type, id, ownerEmail) => {
    assertValidType(type);
    const [result] = await pool.execute(
        `DELETE FROM ${type} WHERE id = ? AND owner_email = ?`,
        [id, ownerEmail]
    );
    if (result.affectedRows === 0) {
        const err = new Error('Entity not found');
        err.status = 404;
        throw err;
    }
    return true;
};