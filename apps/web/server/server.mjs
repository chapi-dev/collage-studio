#!/usr/bin/env node
/**
 * Zero dependency static server for the Collage Studio SPA.
 *
 * It is deliberately dependency free so the App Service deployment package
 * needs no `npm install` step: unzip and run.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrotliCompress, createGzip } from 'node:zlib';
import { pipeline } from 'node:stream';

const here = fileURLToPath(new URL('.', import.meta.url));

const CANDIDATE_ROOTS = [
  process.env.STATIC_ROOT,
  join(here, 'public'),
  join(here, 'dist'),
  join(here, '..', 'dist'),
].filter(Boolean);

const ROOT = CANDIDATE_ROOTS.map((candidate) => resolve(candidate)).find((candidate) =>
  existsSync(join(candidate, 'index.html')),
);

if (!ROOT) {
  console.error(
    `[collage-web] No index.html found. Looked in:\n  ${CANDIDATE_ROOTS.join('\n  ')}\n` +
      'Run "npm run build" first or set STATIC_ROOT.',
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const ENVIRONMENT = process.env.APP_ENVIRONMENT ?? 'local';
const RELEASE = process.env.APP_VERSION ?? 'dev';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest\+json)|image\/svg)/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

function cacheControl(filePath) {
  if (filePath.endsWith('index.html')) return 'no-cache, must-revalidate';
  if (filePath.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function encoderFor(acceptEncoding, contentType) {
  if (!COMPRESSIBLE.test(contentType)) return null;
  if (/\bbr\b/.test(acceptEncoding)) return { name: 'br', stream: createBrotliCompress() };
  if (/\bgzip\b/.test(acceptEncoding)) return { name: 'gzip', stream: createGzip() };
  return null;
}

function serveFile(req, res, filePath) {
  const stats = statSync(filePath);
  const contentType = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const etag = `W/"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    send(res, 304, null, { ETag: etag, 'Cache-Control': cacheControl(filePath) });
    return;
  }

  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': cacheControl(filePath),
    ETag: etag,
    Vary: 'Accept-Encoding',
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'Content-Length': stats.size });
    res.end();
    return;
  }

  const encoder = encoderFor(String(req.headers['accept-encoding'] ?? ''), contentType);
  if (!encoder) {
    res.writeHead(200, { ...headers, 'Content-Length': stats.size });
    createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Encoding': encoder.name });
  pipeline(createReadStream(filePath), encoder.stream, res, (error) => {
    if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('[collage-web] stream error', error.message);
    }
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
      return;
    }

    const url = req.url ?? '/';

    if (url === '/healthz' || url === '/health') {
      send(
        res,
        200,
        JSON.stringify({ status: 'healthy', environment: ENVIRONMENT, release: RELEASE }),
        {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      );
      return;
    }

    if (url === '/robots.txt') {
      send(res, 200, 'User-agent: *\nAllow: /\n', {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      return;
    }

    const requested = resolveSafe(url === '/' ? '/index.html' : url);
    if (!requested) {
      send(res, 403, 'Forbidden');
      return;
    }

    if (existsSync(requested) && statSync(requested).isFile()) {
      serveFile(req, res, requested);
      return;
    }

    // Single page app: unknown routes fall back to the shell.
    const shell = join(ROOT, 'index.html');
    const html = await readFile(shell);
    send(res, 200, html, {
      'Content-Type': MIME['.html'],
      'Cache-Control': 'no-cache, must-revalidate',
    });
  } catch (error) {
    console.error('[collage-web] request failed', error);
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.warn(
    `[collage-web] serving ${ROOT} on http://${HOST}:${PORT} (${ENVIRONMENT}/${RELEASE})`,
  );
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
