import { spawn } from 'node:child_process';
import net from 'node:net';

const findOpenPort = async (startPort = 4180) => {
  for (let port = startPort; port < startPort + 40; port += 1) {
    const open = await new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (open) return port;
  }
  throw new Error(`No open localhost port found starting at ${startPort}.`);
};

const waitForPreview = async (url, timeoutMs = 20000) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw lastError || new Error(`Preview did not become ready at ${url}.`);
};

const waitForExit = child => new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => {
    if (code === 0) resolve();
    else reject(new Error(`Process exited with code ${code ?? 'unknown'}.`));
  });
});

const build = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'build'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_LOCAL_MODE: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

build.stdout.on('data', chunk => process.stdout.write(`[build] ${chunk}`));
build.stderr.on('data', chunk => process.stderr.write(`[build] ${chunk}`));
await waitForExit(build);

const port = await findOpenPort();
const baseUrl = `http://127.0.0.1:${port}/adminv4?fixture=test-mode`;
const preview = spawn(
  process.execPath,
  ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_LOCAL_MODE: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

preview.stdout.on('data', chunk => process.stdout.write(`[preview] ${chunk}`));
preview.stderr.on('data', chunk => process.stderr.write(`[preview] ${chunk}`));

try {
  await waitForPreview(baseUrl);
  const qa = spawn(process.execPath, ['scripts/adminv4-visual-qa.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMINV4_QA_URL: baseUrl
    },
    stdio: 'inherit'
  });
  await waitForExit(qa);
} finally {
  if (!preview.killed) preview.kill('SIGTERM');
}
