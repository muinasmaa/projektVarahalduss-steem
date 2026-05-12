'use strict';

const express = require('express');
const { getDb, nextOperationNumber } = require('../db');

const router = express.Router();

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function normName(s) {
  return String(s || '').trim();
}

/** GET /api/operations?limit=10 */
router.get('/', (req, res, next) => {
  try {
    const limitRaw = req.query.limit;
    const limit =
      limitRaw !== undefined && limitRaw !== ''
        ? Math.min(500, Math.max(1, parseInt(String(limitRaw), 10) || 0))
        : null;

    const sqlBase = `
      SELECT operation_id, type, number, timestamp, created_by, employee_name, room, ticket, notes
      FROM operations
      ORDER BY datetime(timestamp) DESC, operation_id DESC
    `;

    const rows =
      limit != null && limit > 0
        ? getDb().prepare(`${sqlBase} LIMIT ?`).all(limit)
        : getDb().prepare(sqlBase).all();

    res.json({ operations: rows });
  } catch (e) {
    next(e);
  }
});

/** GET /api/operations/:operationId */
router.get('/:operationId', (req, res, next) => {
  try {
    const opId = parseInt(String(req.params.operationId), 10);
    if (!Number.isFinite(opId)) throw httpError(400, 'Vale toimingu ID.');

    const op = getDb()
      .prepare(
        `SELECT operation_id, type, number, timestamp, created_by, employee_name, room, ticket, notes
         FROM operations WHERE operation_id = ?`
      )
      .get(opId);

    if (!op) return res.status(404).json({ error: 'Toimingut ei leitud.' });

    const assets = getDb()
      .prepare(
        `SELECT a.asset_id, a.name, a.subgroup, a.status, a.current_responsible_name, a.current_room
         FROM assets a
         JOIN operation_assets oa ON oa.asset_id = a.asset_id
         WHERE oa.operation_id = ?
         ORDER BY a.asset_id ASC`
      )
      .all(opId);

    res.json({ operation: op, assets });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/operations
 * body: { type: 'ISSUE'|'RETURN', employeeName, assetIds[], room?, ticket?, notes? }
 */
router.post('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const type = String(b.type || '').trim().toUpperCase();
    if (type !== 'ISSUE' && type !== 'RETURN') {
      throw httpError(400, 'type peab olema ISSUE või RETURN.');
    }

    const employeeName = normName(b.employeeName ?? b.employee_name);
    if (!employeeName) throw httpError(400, 'employeeName on kohustuslik.');

    let assetIds = b.assetIds ?? b.asset_ids;
    if (!Array.isArray(assetIds)) assetIds = [];
    assetIds = assetIds.map((x) => String(x || '').trim()).filter(Boolean);
    if (assetIds.length === 0) throw httpError(400, 'Vali vähemalt üks vara (assetIds).');

    const room = normName(b.room) || null;
    const ticket = normName(b.ticket) || null;
    const notes = normName(b.notes) || null;

    if (type === 'ISSUE') {
      if (!room) throw httpError(400, 'Kasutusse andmisel on ruum (room) nõutud.');
      if (!ticket) throw httpError(400, 'Kasutusse andmisel on pilet (ticket) nõutud.');
    }

    const db = getDb();
    const number = nextOperationNumber();
    const ts = new Date().toISOString();
    const created_by = 'ATK';

    const insertOp = db.prepare(`
      INSERT INTO operations (type, number, timestamp, created_by, employee_name, room, ticket, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const link = db.prepare(`INSERT INTO operation_assets (operation_id, asset_id) VALUES (?, ?)`);
    const getAsset = db.prepare(`SELECT * FROM assets WHERE asset_id = ?`);

    const run = db.transaction(() => {
      const info = insertOp.run(type, number, ts, created_by, employeeName, room, ticket, notes);
      const operationId = info.lastInsertRowid;

      for (const aid of assetIds) {
        const a = getAsset.get(aid);
        if (!a) throw httpError(400, `Vara ID süsteemis puudub: ${aid}`);
        if (a.status === 'WRITTEN_OFF') {
          throw httpError(400, `Maha kantud vara ei saa toimingus kasutada: ${aid}`);
        }

        if (type === 'ISSUE') {
          if (a.status !== 'IN_STOCK') {
            throw httpError(400, `Vara ${aid} ei ole laos (praegune olek: ${a.status}).`);
          }
          db.prepare(
            `UPDATE assets SET status = 'ASSIGNED', current_responsible_name = ?, current_room = ? WHERE asset_id = ?`
          ).run(employeeName, room, aid);
        } else {
          // RETURN
          if (a.status !== 'ASSIGNED') {
            throw httpError(400, `Vara ${aid} ei ole kasutaja käes (praegune olek: ${a.status}).`);
          }
          const r = normName(a.current_responsible_name);
          if (r !== employeeName) {
            throw httpError(
              400,
              `Vara ${aid} ei ole valitud töötaja (${employeeName}) nimel (praegu: ${r || '—'}).`
            );
          }
          db.prepare(
            `UPDATE assets SET status = 'IN_STOCK', current_responsible_name = NULL, current_room = NULL WHERE asset_id = ?`
          ).run(aid);
        }

        link.run(operationId, aid);
      }
    });

    run();

    const operation = db.prepare(`SELECT * FROM operations WHERE number = ?`).get(number);
    const assets = db
      .prepare(
        `SELECT a.asset_id, a.name, a.subgroup, a.status, a.current_responsible_name, a.current_room
         FROM assets a JOIN operation_assets oa ON oa.asset_id = a.asset_id
         WHERE oa.operation_id = ? ORDER BY a.asset_id`
      )
      .all(operation.operation_id);

    res.status(201).json({ operation, assets });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
