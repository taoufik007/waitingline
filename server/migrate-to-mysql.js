import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'waitingline_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'waitingline'
};

async function migrateGlobalData(connection) {
    console.log('\n=== Migration des données globales ===');
    const data = JSON.parse(await fs.readFile(
        '/Users/zhirinouhaila/waitingline/waitingline/server/data.json', 'utf-8'
    ));

    // 1. Accounts
    let count = 0;
    for (const [email, acc] of Object.entries(data.accounts || {})) {
        await connection.execute(
            `INSERT INTO accounts (
                id, email, name, role, password, created_at, provider,
                email_verified, approver, approved, approval_token, active,
                session_token, session_tokens, display_mode, parent_admin_email,
                assigned_service_ids, assigned_counter_ids
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE email = VALUES(email)`,
            [
                acc.id, acc.email, acc.name || null, acc.role || 'agent',
                acc.password || null, acc.createdAt || null, acc.provider || null,
                acc.emailVerified ? 1 : 0, acc.approver ? 1 : 0, acc.approved ? 1 : 0,
                acc.approvalToken || null, acc.active ? 1 : 0,
                acc.sessionToken || null,
                JSON.stringify(acc.sessionTokens || []),
                acc.displayMode || null, acc.parentAdminEmail || null,
                JSON.stringify(acc.assignedServiceIds || []),
                JSON.stringify(acc.assignedCounterIds || [])
            ]
        );
        count++;
    }
    console.log(`✅ ${count} comptes migrés`);

    // 2. Pending OTPs
    count = 0;
    for (const [email, payload] of Object.entries(data.pendingOtps || {})) {
        await connection.execute(
            `INSERT INTO pending_otps (email, payload) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
            [email, JSON.stringify(payload)]
        );
        count++;
    }
    console.log(`✅ ${count} OTPs migrés`);

    // 3. Password Reset Tokens
    count = 0;
    for (const [token, payload] of Object.entries(data.passwordResetTokens || {})) {
        await connection.execute(
            `INSERT INTO password_reset_tokens (token, email, created_at, expires_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email)`,
            [token, payload.email, payload.createdAt || null, payload.expiresAt || null]
        );
        count++;
    }
    console.log(`✅ ${count} tokens de reset migrés`);
}

async function migrateClientData(connection) {
    console.log('\n=== Migration des données clients ===');
    const clientsDir = '/Users/zhirinouhaila/waitingline/waitingline/server/data-clients';
    const files = await fs.readdir(clientsDir);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(clientsDir, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        for (const s of data.services || []) {
            await connection.execute(
                `INSERT INTO services (id, owner_email, name, prefix, color, active, image)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [s.id, s.ownerEmail, s.name, s.prefix || null, s.color || null,
                 s.active ? 1 : 0, s.image || null]
            );
        }

        for (const c of data.counters || []) {
            await connection.execute(
                `INSERT INTO counters (id, owner_email, name, service_ids, status, current_ticket_id)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [c.id, c.ownerEmail, c.name,
                 JSON.stringify(c.service_ids || c.serviceIds || []),
                 c.status || null, c.current_ticket_id || null]
            );
        }

        for (const t of data.tickets || []) {
            await connection.execute(
                `INSERT INTO tickets (id, owner_email, status, created_date, number, code, service_id, category)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                [t.id, t.ownerEmail, t.status || 'waiting', t.created_date ? new Date(t.created_date) : null,
                 t.number || null, t.code || null, t.service_id || null, t.category || null]
            );
        }

        console.log(`✅ ${file} : ${data.services?.length || 0} services, ${data.counters?.length || 0} counters, ${data.tickets?.length || 0} tickets`);
    }
}

async function main() {
    const connection = await mysql.createConnection(DB_CONFIG);
    try {
        await migrateGlobalData(connection);
        await migrateClientData(connection);
        console.log('\n🎉 Migration terminée avec succès !');
    } catch (err) {
        console.error('\n❌ Erreur:', err);
    } finally {
        await connection.end();
    }
}

main();
