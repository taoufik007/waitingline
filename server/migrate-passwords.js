import bcrypt from 'bcrypt';
import pool from './database.js';

async function migratePasswords() {
  console.log('🔐 Début de la migration des mots de passe...');

  const [rows] = await pool.query('SELECT id, email, password FROM accounts');

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.password) {
      skipped++;
      continue;
    }

    // Déjà hashé ?
    if (row.password.startsWith('$2a$') || row.password.startsWith('$2b$')) {
      skipped++;
      continue;
    }

    // Hasher le mot de passe en clair
    const hashed = await bcrypt.hash(row.password, 12);
    await pool.execute('UPDATE accounts SET password = ? WHERE id = ?', [hashed, row.id]);

    console.log(`  ✅ ${row.email} → hashé`);
    migrated++;
  }

  console.log(`\n🔐 Migration terminée : ${migrated} hashés, ${skipped} ignorés`);
  process.exit(0);
}

migratePasswords().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
