'use strict';

const path = require('path');
const express = require('express');
const { initDb } = require('./db');
const assetsRouter = require('./routes/assets');
const operationsRouter = require('./routes/operations');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json({ limit: '500kb' }));

app.use('/api/assets', assetsRouter);
app.use('/api/operations', operationsRouter);

app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Varahaldus MVP: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
