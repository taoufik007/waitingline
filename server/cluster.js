import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

// ═══════════════════════════════════════════════════════════════
// Configuration du cluster
// ═══════════════════════════════════════════════════════════════
const numCPUs = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
const isProduction = process.env.NODE_ENV === 'production';

// En développement, on lance 1 seul worker pour simplifier le debug.
// En production, on lance 1 worker par cœur CPU.
const numWorkers = isProduction ? numCPUs : 1;

console.log(`[Cluster] Mode: ${isProduction ? 'production' : 'development'}`);
console.log(`[Cluster] CPU disponibles: ${numCPUs}`);
console.log(`[Cluster] Workers à lancer: ${numWorkers}`);

// ═══════════════════════════════════════════════════════════════
// Mode master : lancer les workers et les surveiller
// ═══════════════════════════════════════════════════════════════
if (cluster.isPrimary) {
  console.log(`[Cluster] Master PID: ${process.pid}`);

  // Lancer les workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork();
    console.log(`[Cluster] Worker ${worker.process.pid} démarré`);
  }

  // Redémarrer un worker s'il crashe
  cluster.on('exit', (worker, code, signal) => {
    console.error(`[Cluster] Worker ${worker.process.pid} est mort (code: ${code}, signal: ${signal})`);
    console.log(`[Cluster] Redémarrage d'un nouveau worker...`);
    cluster.fork();
  });

  // Gestion propre de l'arrêt
  process.on('SIGTERM', () => {
    console.log('[Cluster] SIGTERM reçu, arrêt des workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Cluster] SIGINT reçu, arrêt des workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });

} else {
  // ═══════════════════════════════════════════════════════════════
  // Mode worker : exécuter l'application
  // ═══════════════════════════════════════════════════════════════
  console.log(`[Worker ${process.pid}] Démarrage de l'application...`);
  await import('./index.js');
}
