import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoVariables } from './types';
import { authMiddleware } from './middleware/auth';
import { projectsRouter } from './routes/projects';
import { roomsRouter } from './routes/rooms';
import { itemsRouter } from './routes/items';
import { imagesRouter } from './routes/images';
import { materialsRouter } from './routes/materials';
import { takeoffRouter } from './routes/takeoff';
import { usersRouter } from './routes/users';

export const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// ─── CORS ─────────────────────────────────────────────────────────────────
// Must run before auth so OPTIONS preflight requests are not rejected.
// Be specific — no wildcard origins.
app.use(
  '*',
  cors({
    origin: ['https://cweber12.github.io', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  }),
);

// ─── Health check (no auth required) ──────────────────────────────────────
app.get('/healthz', (c) => c.json({ ok: true }));

// ─── Auth middleware (all /api/v1/* routes) ───────────────────────────────
app.use('/api/v1/*', authMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────
app.route('/api/v1/projects', projectsRouter);
app.route('/api/v1/projects', materialsRouter);
app.route('/api/v1/rooms', roomsRouter);
app.route('/api/v1/items', itemsRouter);
app.route('/api/v1/images', imagesRouter);
app.route('/api/v1', materialsRouter);
app.route('/api/v1', takeoffRouter);
app.route('/api/v1/users', usersRouter);

// ─── Fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Default export satisfies the Cloudflare Workers `fetch` handler interface.
export default app;
