import { spawn } from 'node:child_process';
import net from 'node:net';

const preferredPort = Number(process.env.PORT || 3001);

const findAvailablePort = (startPort) => new Promise((resolve, reject) => {
  const tester = net.createServer();

  tester.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      resolve(findAvailablePort(startPort + 1));
      return;
    }

    reject(error);
  });

  tester.once('listening', () => {
    tester.close(() => resolve(startPort));
  });

  tester.listen(startPort);
});

const start = async () => {
  const port = await findAvailablePort(preferredPort || 3001);

  const sharedEnv = { ...process.env, PORT: String(port), VITE_API_PORT: String(port) };

  if (port !== preferredPort && preferredPort) {
    console.warn(`Port ${preferredPort} is already in use. Starting the app on port ${port}.`);
  }

  const viteBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const backend = spawn(process.execPath, ['server/index.js'], {
    stdio: 'inherit',
    env: sharedEnv,
    cwd: process.cwd(),
  });

  const frontend = spawn(viteBinary, ['vite', '--host', '0.0.0.0'], {
    stdio: 'inherit',
    env: sharedEnv,
    cwd: process.cwd(),
  });

  const shutdown = () => {
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('exit', (code) => {
    if (code !== 0) {
      frontend.kill('SIGTERM');
      process.exit(code || 1);
    }
  });

  frontend.on('exit', (code) => {
    backend.kill('SIGTERM');
    process.exit(code || 0);
  });
};

start().catch((error) => {
  console.error('Unable to start the development environment:', error);
  process.exit(1);
});
