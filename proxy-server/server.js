import Fastify from 'fastify';

const fastify = Fastify({ logger: true });
const PORT          = Number(process.env.PORT)  || 8080;
const PROXY_API_KEY = process.env.PROXY_API_KEY || '';
const BCRA_BASE     = 'https://api.bcra.gob.ar';
const TIMEOUT_MS    = 10_000;

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
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });

    clearTimeout(timer);

    const body = await res.text();
    return reply.status(res.status).header('content-type', 'application/json').send(body);
  } catch (err) {
    clearTimeout(timer);
    fastify.log.error(err);
    return reply.status(502).send({ error: 'Upstream error', detail: err.message });
  }
});

await fastify.listen({ port: PORT, host: '0.0.0.0' });
