import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ═══════════════════════════════════════════════════════════════
// Configuration adaptative selon l'environnement
// ═══════════════════════════════════════════════════════════════
const isProduction = process.env.NODE_ENV === 'production';

// En production (Hostinger), on limite les connexions pour ne pas
// dépasser la limite de 75 connexions MySQL par utilisateur.
// En développement (local), on peut se permettre plus de connexions.
const connectionLimit = isProduction
  ? Number(process.env.DB_POOL_SIZE || 5)   // Production : 5 par défaut
  : 10;                                       // Dev : 10

console.log(`[DB] Environnement: ${isProduction ? 'production' : 'development'} | Pool: ${connectionLimit} connexions`);

// ═══════════════════════════════════════════════════════════════
// Création du pool MySQL
// ═══════════════════════════════════════════════════════════════
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',

  // Gestion des connexions
  waitForConnections: true,
  connectionLimit,
  queueLimit: 100,              // Limite la file d'attente (évite les débordements)
  maxIdle: connectionLimit,     // Nombre max de connexions inactives
  idleTimeout: 60000,           // Ferme les connexions inactives après 60s
  enableKeepAlive: true,        // Ping régulier pour garder la connexion
  keepAliveInitialDelay: 10000, // Premier ping après 10s

  // Timeouts
  connectTimeout: 10000,        // Timeout de connexion (10s)
  // acquireTimeout: 15000,     // (optionnel) Timeout d'acquisition

  // Autres
  timezone: 'Z',                // UTC par défaut
  dateStrings: false,           // Retourne des objets Date
  multipleStatements: false,    // Sécurité : évite les injections multi-requêtes
});

// ═══════════════════════════════════════════════════════════════
// Gestion des erreurs de connexion
// ═══════════════════════════════════════════════════════════════
pool.on('connection', (connection) => {
  // Configurer la session MySQL
  connection.query('SET SESSION sql_mode="STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION"');
});

// Test de connexion au démarrage
(async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    connection.release();
    console.log('[DB] ✅ Connexion MySQL établie');
  } catch (error) {
    console.error('[DB] ❌ Erreur de connexion MySQL:', error.message);
    // Ne pas crasher : l'app peut démarrer et réessayer plus tard
  }
})();
export default pool;


