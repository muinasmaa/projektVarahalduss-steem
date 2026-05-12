'use strict';

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'varahaldus.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/** @type {import('sql.js').Database | null} */
let database = null;

let transactionDepth = 0;

function saveToFile() {
  if (!database) return;
  const data = database.export();
  const buf = Buffer.from(data);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, buf);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {string} sql @param {Record<string, unknown>} obj */
function namedToDollar(sql, obj) {
  const bind = {};
  const newSql = sql.replace(/@(\w+)/g, (_, name) => {
    const key = '$' + name;
    const val = Object.prototype.hasOwnProperty.call(obj, name) ? obj[name] : null;
    bind[key] = val === undefined ? null : val;
    return key;
  });
  return { sql: newSql, bind };
}

function lastInsertRowid() {
  const st = database.prepare('SELECT last_insert_rowid() AS i');
  try {
    st.step();
    const row = st.getAsObject();
    return row.i;
  } finally {
    st.free();
  }
}

/** @param {string} originalSql */
function wrapPrepare(originalSql) {
  return {
    all(...bindArgs) {
      let sql = originalSql;
      /** @type {import('sql.js').Statement | null} */
      let stmt = null;
      try {
        if (bindArgs.length === 0) {
          stmt = database.prepare(sql);
        } else if (bindArgs.length === 1 && isPlainObject(bindArgs[0])) {
          const r = namedToDollar(sql, bindArgs[0]);
          sql = r.sql;
          stmt = database.prepare(sql);
          stmt.bind(r.bind);
        } else {
          stmt = database.prepare(sql);
          stmt.bind(bindArgs);
        }
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        return rows;
      } finally {
        if (stmt) stmt.free();
      }
    },

    get(...bindArgs) {
      let sql = originalSql;
      /** @type {import('sql.js').Statement | null} */
      let stmt = null;
      try {
        if (bindArgs.length === 0) {
          stmt = database.prepare(sql);
        } else if (bindArgs.length === 1 && isPlainObject(bindArgs[0])) {
          const r = namedToDollar(sql, bindArgs[0]);
          sql = r.sql;
          stmt = database.prepare(sql);
          stmt.bind(r.bind);
        } else {
          stmt = database.prepare(sql);
          stmt.bind(bindArgs);
        }
        if (!stmt.step()) return undefined;
        return stmt.getAsObject();
      } finally {
        if (stmt) stmt.free();
      }
    },

    run(...bindArgs) {
      let sql = originalSql;
      /** @type {import('sql.js').Statement | null} */
      let stmt = null;
      try {
        if (bindArgs.length === 1 && isPlainObject(bindArgs[0])) {
          const r = namedToDollar(sql, bindArgs[0]);
          sql = r.sql;
          stmt = database.prepare(sql);
          stmt.bind(r.bind);
        } else if (bindArgs.length > 0) {
          stmt = database.prepare(sql);
          stmt.bind(bindArgs);
        } else {
          stmt = database.prepare(sql);
        }
        stmt.step();
      } finally {
        if (stmt) stmt.free();
      }
      const out = {
        lastInsertRowid: lastInsertRowid(),
        changes: database.getRowsModified()
      };
      if (transactionDepth === 0) saveToFile();
      return out;
    }
  };
}

function getDb() {
  if (!database) throw new Error('Database not initialized. Call await initDb() first.');
  return {
    prepare: (sql) => wrapPrepare(sql),
    exec: (sql) => {
      database.exec(sql);
      if (transactionDepth === 0) saveToFile();
    },
    transaction: (fn) => {
      return function trans() {
        database.run('BEGIN IMMEDIATE;');
        transactionDepth++;
        try {
          fn();
          database.run('COMMIT;');
        } catch (e) {
          try {
            database.run('ROLLBACK;');
          } catch (_) {
            /* ignore */
          }
          throw e;
        } finally {
          transactionDepth--;
          if (transactionDepth === 0) saveToFile();
        }
      };
    }
  };
}

async function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const sqlDistDir = path.dirname(require.resolve('sql.js'));
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlDistDir, file)
  });

  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    database = new SQL.Database(filebuffer);
  } else {
    database = new SQL.Database();
  }

  database.run('PRAGMA foreign_keys = ON;');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  seedIfEmpty();

  if (transactionDepth === 0) saveToFile();

  return database;
}

function seedIfEmpty() {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM assets').get();
  if (row && Number(row.c) > 0) return;

  const now = new Date().toISOString();

  const insertAsset = getDb().prepare(`
    INSERT INTO assets (
      asset_id, name, subgroup, status, purchase_date, expected_life_months,
      warranty_end_date, invoice_number, current_responsible_name, current_room, created_at
    ) VALUES (
      @asset_id, @name, @subgroup, @status, @purchase_date, @expected_life_months,
      @warranty_end_date, @invoice_number, @current_responsible_name, @current_room, @created_at
    )
  `);

  const assets = [
    {
      asset_id: 'SEAD-1001',
      name: 'Lenovo ThinkPad T14',
      subgroup: 'Sülearvuti',
      status: 'IN_STOCK',
      purchase_date: '2022-01-15',
      expected_life_months: 48,
      warranty_end_date: '2025-01-14',
      invoice_number: 'OST-2022-00045',
      current_responsible_name: null,
      current_room: null
    },
    {
      asset_id: 'SEAD-1002',
      name: 'Dell UltraSharp 27"',
      subgroup: 'Monitor',
      status: 'ASSIGNED',
      purchase_date: '2023-06-01',
      expected_life_months: 60,
      warranty_end_date: '2026-05-31',
      invoice_number: 'OST-2023-00102',
      current_responsible_name: 'Mari Tamm',
      current_room: 'A-203'
    },
    {
      asset_id: 'SEAD-1003',
      name: 'Cisco telefon IP',
      subgroup: 'Side',
      status: 'ASSIGNED',
      purchase_date: '2021-11-20',
      expected_life_months: 36,
      warranty_end_date: '2024-11-19',
      invoice_number: 'OST-2021-00888',
      current_responsible_name: 'Mari Tamm',
      current_room: 'A-203'
    }
  ];

  const tx = getDb().transaction(() => {
    for (const a of assets) {
      insertAsset.run({ ...a, created_at: now });
    }
  });
  tx();

  const insertOp = getDb().prepare(`
    INSERT INTO operations (type, number, timestamp, created_by, employee_name, room, ticket, notes)
    VALUES (@type, @number, @timestamp, @created_by, @employee_name, @room, @ticket, @notes)
  `);
  const link = getDb().prepare(`
    INSERT INTO operation_assets (operation_id, asset_id) VALUES (?, ?)
  `);

  const tx2 = getDb().transaction(() => {
    const info = insertOp.run({
      type: 'ISSUE',
      number: 'AKT-000001',
      timestamp: new Date(Date.now() - 86400000 * 14).toISOString(),
      created_by: 'ATK',
      employee_name: 'Mari Tamm',
      room: 'A-203',
      ticket: 'INC-4521',
      notes: 'Kasutusse andmine uuele töötajale.'
    });
    const opId = info.lastInsertRowid;
    link.run(opId, 'SEAD-1002');
    link.run(opId, 'SEAD-1003');
  });
  tx2();
}

function nextOperationNumber() {
  const row = getDb().prepare(`SELECT MAX(operation_id) AS m FROM operations`).get();
  const m = row && row.m != null ? Number(row.m) : 0;
  const n = m + 1;
  return `AKT-${String(n).padStart(6, '0')}`;
}

module.exports = {
  initDb,
  getDb,
  nextOperationNumber
};
