// migrate-data.js
// À exécuter UNE SEULE FOIS depuis le dossier `server/` :
//   node migrate-data.js
//
// Ce script :
// 1. Lit votre data.json actuel (avec accounts + entities mélangés)
// 2. Réécrit data.json en ne gardant QUE accounts + pendingOtps
// 3. Crée un fichier server/data-clients/<hash>.json par ownerEmail,
//    contenant ses services/counters/tickets
// 4. Fait une sauvegarde de sécurité : data.json.backup-avant-migration
//
// Rien n'est supprimé tant que vous n'avez pas vérifié le résultat.

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_FILE = path.join(process.cwd(), 'data.json');
const ENTITIES_DIR = path.join(process.cwd(), 'data-clients');
const BACKUP_FILE = path.join(process.cwd(), 'data.json.backup-avant-migration');

// ⚠️ Doit être IDENTIQUE à la fonction fileForOwner() dans storage.js
const fileForOwner = (ownerEmail) => {
  const hash = crypto.createHash('sha256').update(ownerEmail).digest('hex').slice(0, 24);
  return path.join(ENTITIES_DIR, `${hash}.json`);
};

const run = async () => {
  console.log('Lecture de', DATA_FILE, '...');
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const old = JSON.parse(raw);

  // 1. Sauvegarde de sécurité avant toute modification
  await fs.writeFile(BACKUP_FILE, raw, 'utf8');
  console.log('Sauvegarde créée :', BACKUP_FILE);

  const accounts = old.accounts || {};
  const pendingOtps = old.pendingOtps || {};
  const entities = old.entities || { services: [], counters: [], tickets: [] };

  // 2. Regrouper services/counters/tickets par ownerEmail
  const byOwner = new Map(); // ownerEmail -> { services: [], counters: [], tickets: [] }

  const ensureOwner = (ownerEmail) => {
    if (!byOwner.has(ownerEmail)) {
      byOwner.set(ownerEmail, { services: [], counters: [], tickets: [] });
    }
    return byOwner.get(ownerEmail);
  };

  for (const type of ['services', 'counters', 'tickets']) {
    for (const item of entities[type] || []) {
      if (!item.ownerEmail) {
        console.warn(`  ⚠ ${type} ${item.id} n'a pas de ownerEmail, ignoré`);
        continue;
      }
      ensureOwner(item.ownerEmail)[type].push(item);
    }
  }

  // 3. Écrire un fichier par client
  await fs.mkdir(ENTITIES_DIR, { recursive: true });
  for (const [ownerEmail, ownerEntities] of byOwner.entries()) {
    const file = fileForOwner(ownerEmail);
    await fs.writeFile(file, JSON.stringify(ownerEntities, null, 2), 'utf8');
    console.log(
      `  → ${ownerEmail} : ${ownerEntities.services.length} services, ` +
        `${ownerEntities.counters.length} guichets, ${ownerEntities.tickets.length} tickets ` +
        `→ ${path.relative(process.cwd(), file)}`
    );
  }

  // 4. Réécrire data.json sans les entities
  const newData = { accounts, pendingOtps };
  await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8');
  console.log('\ndata.json réécrit (comptes + OTP uniquement).');
  console.log(`${byOwner.size} client(s) migré(s) avec succès.`);
  console.log('\nVérifiez les fichiers dans data-clients/, puis vous pouvez supprimer',
    BACKUP_FILE, 'si tout est correct.');
};

run().catch((err) => {
  console.error('Erreur pendant la migration :', err);
  process.exit(1);
});