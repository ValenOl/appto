import Fastify from 'fastify';

const fastify = Fastify({ logger: true });
const PORT          = Number(process.env.PORT)  || 8080;
const PROXY_API_KEY = process.env.PROXY_API_KEY || '';
const BCRA_BASE     = 'https://api.bcra.gob.ar';
const TIMEOUT_MS    = 25_000;
const RETRY_DELAY   = 6_000;

const BCRA_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Connection':      'close',
};

function isEconnreset(err) {
  return err?.cause?.code === 'ECONNRESET' || String(err?.message).includes('ECONNRESET');
}

async function bcraFetch(url, signal) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetch(url, { signal, headers: BCRA_HEADERS });
    } catch (err) {
      if (attempt === 1 && isEconnreset(err)) {
        fastify.log.warn(`ECONNRESET en ${url} — reintentando en ${RETRY_DELAY}ms`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
      throw err;
    }
  }
}

fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

fastify.get('/fetch-bcra', async (request, reply) => {
  if (PROXY_API_KEY && request.headers['x-proxy-key'] !== PROXY_API_KEY) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { endpoint } = request.query;
  if (!endpoint || typeof endpoint !== 'string') {
    return reply.status(400).send({ error: 'Missing endpoint param' });
  }

  const url        = `${BCRA_BASE}${endpoint}`;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await bcraFetch(url, controller.signal);
    clearTimeout(timer);
    const body = await res.text();
    return reply.status(res.status).header('content-type', 'application/json').send(body);
  } catch (err) {
    clearTimeout(timer);
    fastify.log.error({ err, msg: 'upstream error' });
    return reply.status(502).send({ error: 'Upstream error', detail: err.message });
  }
});

await fastify.listen({ port: PORT, host: '0.0.0.0' });
