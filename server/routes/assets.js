'use strict';

const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function parseBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
}

/** GET /api/assets */
router.get('/', (req, res, next) => {
  try {
    const {
      id,
      name,
      subgroup,
      responsible,
      inStock,
      includeWrittenOff
    } = req.query;

    const includeWoff = parseBool(includeWrittenOff) === true;
    const inStockFilter = parseBool(inStock);

    const conditions = [];
    const params = {};

    if (!includeWoff) {
      conditions.push(`assets.status != 'WRITTEN_OFF'`);
    }

    if (id != null && String(id).trim() !== '') {
      conditions.push(`assets.asset_id = @id`);
      params.id = String(id).trim();
    }

    if (name != null && String(name).trim() !== '') {
      conditions.push(`assets.name LIKE @name`);
      params.name = `%${String(name).trim()}%`;
    }

    if (subgroup != null && String(subgroup).trim() !== '') {
      conditions.push(`assets.subgroup LIKE @subgroup`);
      params.subgroup = `%${String(subgroup).trim()}%`;
    }

    if (responsible != null && String(responsible).trim() !== '') {
      conditions.push(`assets.current_responsible_name LIKE @resp`);
      params.resp = `%${String(responsible).trim()}%`;
    }

    if (inStockFilter === true) {
      conditions.push(`assets.status = 'IN_STOCK'`);
    } else if (inStockFilter === false) {
      conditions.push(`assets.status = 'ASSIGNED'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT asset_id, name, subgroup, status, purchase_date, expected_life_months,
             warranty_end_date, invoice_number, current_responsible_name, current_room, created_at
      FROM assets
      ${where}
      ORDER BY asset_id ASC
    `;

    const rows = getDb().prepare(sql).all(params);

    const idTrimmed = id != null ? String(id).trim() : '';
    const hasId = idTrimmed !== '';
    const onlyIdSearch =
      hasId &&
      !(name != null && String(name).trim() !== '') &&
      !(subgroup != null && String(subgroup).trim() !== '') &&
      !(responsible != null && String(responsible).trim() !== '') &&
      inStockFilter === undefined;

    if (onlyIdSearch && rows.length === 0) {
      return res.status(404).json({ error: `Sellise ID-ga vara süsteemis pole: ${idTrimmed}` });
    }

    res.json({ assets: rows });
  } catch (e) {
    next(e);
  }
});

/** GET /api/assets/:assetId */
router.get('/:assetId', (req, res, next) => {
  try {
    const assetId = String(req.params.assetId || '').trim();
    const asset = getDb()
      .prepare(
        `SELECT asset_id, name, subgroup, status, purchase_date, expected_life_months,
                warranty_end_date, invoice_number, current_responsible_name, current_room, created_at
         FROM assets WHERE asset_id = ?`
      )
      .get(assetId);

    if (!asset) {
      return res.status(404).json({ error: `Sellise ID-ga vara süsteemis pole: ${assetId}` });
    }

    const ops = getDb()
      .prepare(
        `SELECT o.operation_id, o.type, o.number, o.timestamp, o.created_by, o.employee_name
         FROM operations o
         JOIN operation_assets oa ON oa.operation_id = o.operation_id
         WHERE oa.asset_id = ?
         ORDER BY o.timestamp DESC`
      )
      .all(assetId);

    res.json({ asset, operations: ops });
  } catch (e) {
    next(e);
  }
});

/** POST /api/assets */
router.post('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const asset_id = String(b.asset_id || b.assetId || '').trim();
    if (!asset_id) throw httpError(400, 'asset_id on kohustuslik.');

    const existing = getDb().prepare(`SELECT asset_id FROM assets WHERE asset_id = ?`).get(asset_id);
    if (existing) throw httpError(409, `Vara ID on juba kasutusel: ${asset_id}`);

    const name = String(b.name || '').trim() || 'Nimetamata';
    const subgroup = String(b.subgroup || '').trim() || 'Määramata';
    const purchase_date = String(b.purchase_date || b.purchaseDate || '').trim();
    if (!purchase_date) throw httpError(400, 'purchase_date on kohustuslik (YYYY-MM-DD).');

    const warranty_end_date = String(b.warranty_end_date || b.warrantyEndDate || '').trim();
    if (!warranty_end_date) throw httpError(400, 'warranty_end_date on kohustuslik (YYYY-MM-DD).');

    const expected_life_months = Number(b.expected_life_months ?? b.expectedLifeMonths ?? 36);
    if (!Number.isFinite(expected_life_months) || expected_life_months < 1) {
      throw httpError(400, 'expected_life_months peab olema positiivne arv.');
    }

    const invoice_number = String(b.invoice_number || b.invoiceNumber || '').trim();

    const created_at = new Date().toISOString();

    getDb()
      .prepare(
        `INSERT INTO assets (
          asset_id, name, subgroup, status, purchase_date, expected_life_months,
          warranty_end_date, invoice_number, current_responsible_name, current_room, created_at
        ) VALUES (?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, NULL, NULL, ?)`
      )
      .run(
        asset_id,
        name,
        subgroup,
        purchase_date,
        expected_life_months,
        warranty_end_date,
        invoice_number,
        created_at
      );

    const asset = getDb()
      .prepare(`SELECT * FROM assets WHERE asset_id = ?`)
      .get(asset_id);

    res.status(201).json({ asset });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/assets/:assetId — soft-delete */
router.delete('/:assetId', (req, res, next) => {
  try {
    const assetId = String(req.params.assetId || '').trim();
    const asset = getDb().prepare(`SELECT * FROM assets WHERE asset_id = ?`).get(assetId);
    if (!asset) {
      return res.status(404).json({ error: `Sellise ID-ga vara süsteemis pole: ${assetId}` });
    }
    if (asset.status === 'WRITTEN_OFF') {
      return res.json({ asset, message: 'Vara on juba maha kantud.' });
    }

    getDb()
      .prepare(
        `UPDATE assets SET status = 'WRITTEN_OFF', current_responsible_name = NULL, current_room = NULL WHERE asset_id = ?`
      )
      .run(assetId);

    const updated = getDb().prepare(`SELECT * FROM assets WHERE asset_id = ?`).get(assetId);
    res.json({ asset: updated });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
