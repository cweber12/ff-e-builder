import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, HonoVariables } from './types';
import { authMiddleware } from './middleware/auth';
import { requireAuthorized } from './middleware/requireAuthorized';
import { columnDefsRouter } from './routes/columnDefs';
import { projectsRouter } from './routes/projects';
import { roomsRouter } from './routes/rooms';
import { itemsRouter } from './routes/items';
import { imagesRouter } from './routes/images';
import { materialsRouter } from './routes/materials';
import { plansRouter } from './routes/plans';
import { proposalRouter } from './routes/proposal';
import { usersRouter } from './routes/users';

export const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// ─── CORS ─────────────────────────────────────────────────────────────────
// Must run before auth so OPTIONS preflight requests are not rejected.
// Be specific — no wildcard origins.
app.use(
  '*',
  cors({
    origin: ['https://cweber12.github.io', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  }),
);

// ─── Health check (no auth required) ──────────────────────────────────────
app.get('/healthz', (c) => c.json({ ok: true }));

// ─── Auth middleware (all /api/v1/* routes) ───────────────────────────────
app.use('/api/v1/*', authMiddleware);

// ─── Authorization guard (all Neon/R2 routes — users router handles its own) ──
app.use('/api/v1/projects/*', requireAuthorized);
app.use('/api/v1/rooms/*', requireAuthorized);
app.use('/api/v1/items/*', requireAuthorized);
app.use('/api/v1/images/*', requireAuthorized);
app.use('/api/v1/materials/*', requireAuthorized);
app.use('/api/v1/proposal/*', requireAuthorized);

// ─── Routes ───────────────────────────────────────────────────────────────
app.route('/api/v1/projects', projectsRouter);
app.route('/api/v1/projects', plansRouter);
app.route('/api/v1/projects', materialsRouter);
app.route('/api/v1/projects', columnDefsRouter);
app.route('/api/v1/rooms', roomsRouter);
app.route('/api/v1/items', itemsRouter);
app.route('/api/v1/images', imagesRouter);
app.route('/api/v1', materialsRouter);
app.route('/api/v1', proposalRouter);
app.route('/api/v1/users', usersRouter);

// ─── Fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Default export satisfies the Cloudflare Workers `fetch` handler interface.
export default app;
