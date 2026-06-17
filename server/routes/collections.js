import express from 'express';
import { queriesRepo, widgetsRepo, dashboardsRepo } from '../db/appDb.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Express 4 doesn't catch rejected promises from async handlers on its own —
// without this, a transient DB error would hang the request instead of erroring.
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

function makeRouter(repo) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', wrap(async (req, res) => {
    res.json({ items: await repo.list(req.user.sub) });
  }));

  router.put('/:id', wrap(async (req, res) => {
    const item = { ...req.body, id: req.params.id };
    const id = await repo.upsert(req.user.sub, item);
    res.json({ id });
  }));

  router.post('/', wrap(async (req, res) => {
    const id = await repo.upsert(req.user.sub, req.body || {});
    res.status(201).json({ id });
  }));

  router.delete('/:id', wrap(async (req, res) => {
    await repo.remove(req.params.id, req.user.sub);
    res.json({ ok: true });
  }));

  return router;
}

export const queriesRouter = makeRouter(queriesRepo);
export const widgetsRouter = makeRouter(widgetsRepo);
export const dashboardsRouter = makeRouter(dashboardsRepo);
