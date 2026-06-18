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

// Uploads happen in three steps instead of one giant request body: a huge single
// POST (one CSV's worth of rows as a single JSON blob) is what was crashing the app
// on hosted free-tier RAM. Splitting it into a start + many small chunks + a finish
// means no single request ever has to hold more than one chunk's worth of rows.
router.post('/start', wrap(async (req, res) => {
  const { name, sourceType, schema } = req.body || {};
  if (!name || !sourceType || !Array.isArray(schema)) {
    return res.status(400).json({ error: 'name, sourceType and schema[] are required' });
  }
  const created = await datasetsRepo.startCreate(req.user.sub, { name, sourceType, schema });
  res.status(201).json(created);
}));

router.post('/:id/chunk', wrap(async (req, res) => {
  const { index, rows } = req.body || {};
  if (typeof index !== 'number' || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'index (number) and rows[] are required' });
  }
  try {
    await datasetsRepo.appendChunk(req.params.id, req.user.sub, index, rows);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'Dataset not found') return res.status(404).json({ error: err.message });
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

router.post('/:id/finish', wrap(async (req, res) => {
  try {
    const created = await datasetsRepo.finishCreate(req.params.id, req.user.sub);
    if (created.rowCount > MAX_ROWS) {
      await datasetsRepo.remove(req.params.id, req.user.sub);
      return res.status(413).json({ error: `Dataset has ${created.rowCount.toLocaleString()} rows, which exceeds the ${MAX_ROWS.toLocaleString()} row limit.` });
    }
    res.status(201).json(created);
  } catch (err) {
    if (err.message === 'Dataset not found') return res.status(404).json({ error: err.message });
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
