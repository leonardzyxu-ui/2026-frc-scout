import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {spawn} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import type {ServerResponse} from 'node:http';
import {homedir} from 'node:os';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const repoRoot = __dirname;
const localTbaKeyJsonPath = path.join(homedir(), 'Library', 'Application Support', 'PowerScout', 'tba-api-key.json');
const localTbaEnvPath = path.resolve(repoRoot, '.vite-env', '.env.local');

const unquoteEnvValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'string' ? parsed.trim() : trimmed;
  } catch {
    return trimmed.replace(/^['"]|['"]$/g, '').trim();
  }
};

const extractTbaKey = (rawText: string) => {
  const trimmed = rawText.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidateKeys = ['tbaApiKey', 'tba_api_key', 'apiKey', 'key', 'token', 'TBA_API_KEY', 'VITE_TBA_API_KEY', 'MODEL_TBA_API_KEY'];
      for (const key of candidateKeys) {
        if (typeof parsed?.[key] === 'string' && parsed[key].trim()) return parsed[key].trim();
      }
    } catch {
      return '';
    }
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_TBA_API_KEY|MODEL_TBA_API_KEY|TBA_API_KEY)\s*=\s*(.+?)\s*$/);
    if (match?.[2]) return unquoteEnvValue(match[2]);
  }

  return trimmed.includes('\n') || trimmed.includes('=') ? '' : trimmed;
};

const readLocalTbaKey = () => {
  for (const sourcePath of [localTbaKeyJsonPath, localTbaEnvPath]) {
    if (!existsSync(sourcePath)) continue;
    const key = extractTbaKey(readFileSync(sourcePath, 'utf8'));
    if (key) return key;
  }
  return process.env.MODEL_TBA_API_KEY || process.env.VITE_TBA_API_KEY || process.env.TBA_API_KEY || '';
};

const getLocalProxyUrl = () =>
  process.env.https_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.HTTP_PROXY ||
  'http://127.0.0.1:7890';

const fetchJsonViaCurl = async <T,>(url: string, headers: Record<string, string>): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const proxyUrl = getLocalProxyUrl();
    const args = ['--silent', '--show-error', '--fail', '--max-time', '20'];
    if (proxyUrl) args.push('--proxy', proxyUrl);
    args.push('--config', '-');

    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', chunk => stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', code => {
      const body = Buffer.concat(stdoutChunks).toString('utf8');
      const errorText = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(errorText || `curl exited with status ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('TBA schedule response was not valid JSON.'));
      }
    });
    const config = [
      `url = "${url}"`,
      ...Object.entries(headers).map(([key, value]) => `header = "${key}: ${value.replace(/(["\\])/g, '\\$1')}"`),
      ''
    ].join('\n');
    child.stdin.end(config);
  });

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const localTbaDevProxyPlugin = (): Plugin => ({
  name: 'local-tba-dev-proxy',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = new URL(req.url || '/', 'http://localhost');
      const match = requestUrl.pathname.match(/^\/api\/local-tba\/event\/([^/]+)\/matches$/);
      if (!match?.[1]) {
        next();
        return;
      }

      const eventKey = decodeURIComponent(match[1]).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!eventKey) {
        sendJson(res, 400, { error: 'Missing event key.' });
        return;
      }

      const tbaKey = readLocalTbaKey();
      if (!tbaKey) {
        sendJson(res, 503, { error: 'Local TBA key is not configured on this device.' });
        return;
      }

      try {
        const matches = await fetchJsonViaCurl<unknown[]>(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, {
          'X-TBA-Auth-Key': tbaKey
        });
        sendJson(res, 200, { matches });
      } catch (error) {
        sendJson(res, 502, {
          error: error instanceof Error ? error.message : 'Local TBA schedule request failed.'
        });
      }
    });
  }
});

export default defineConfig(({mode}) => {
  return {
    envDir: path.resolve(repoRoot, '.vite-env'),
    plugins: [
      localTbaDevProxyPlugin(),
      react(), 
      tailwindcss({
        optimize: false
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5000000,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
              }
            }
          ]
        },
        manifest: {
          name: 'REBUILT Scout',
          short_name: 'Scout',
          description: 'FRC Scouting App for REBUILT',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: 'icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
      })
    ],
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(repoRoot, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
