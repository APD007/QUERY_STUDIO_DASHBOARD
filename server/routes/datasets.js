import express from 'express';
import { datasetsRepo } from '../db/appDb.js';
import { requireAuth } from '../middleware/requireAuth.js';

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

const MAX_ROWS = 200_000;

const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  res.json({ items: await datasetsRepo.list(req.user.sub) });
}));

router.get('/:id', wrap(async (req, res) => {
  const dataset = await datasetsRepo.get(req.params.id, req.user.sub);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
  res.json(dataset);
}));

router.post('/', wrap(async (req, res) => {
  const { name, sourceType, schema, rows } = req.body || {};
  if (!name || !sourceType || !Array.isArray(schema) || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'name, sourceType, schema[] and rows[] are required' });
  }
  if (rows.length > MAX_ROWS) {
    return res.status(413).json({ error: `Dataset has ${rows.length.toLocaleString()} rows, which exceeds the ${MAX_ROWS.toLocaleString()} row limit.` });
  }
  try {
    const created = await datasetsRepo.create(req.user.sub, { name, sourceType, schema, rows });
    res.status(201).json(created);
  } catch (err) {
    // A file read with the wrong text encoding (e.g. UTF-16 decoded as UTF-8) can smuggle
    // a literal NUL byte into a field value, which Postgres' jsonb type always rejects.
    if (/unicode escape sequence|invalid byte sequence/i.test(err.message)) {
      return res.status(400).json({
        error: 'This file contains characters Postgres can\'t store (likely a NUL byte from a non-UTF-8 encoded file). Re-save it as UTF-8 and try again.',
      });
    }
    throw err;
  }
}));

router.patch('/:id', wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  await datasetsRepo.rename(req.params.id, req.user.sub, name);
  res.json({ ok: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  await datasetsRepo.remove(req.params.id, req.user.sub);
  res.json({ ok: true });
}));

export const datasetsRouter = router;
