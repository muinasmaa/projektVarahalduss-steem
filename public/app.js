'use strict';

/** @param {string} path */
async function apiJson(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !(options.headers && options.headers['Content-Type'])
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Vastust ei saanud lugeda' };
  }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Päring ebaõnnestus';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function formatDateIso(isoDate) {
  if (!isoDate) return '—';
  const d = String(isoDate).slice(0, 10);
  return d;
}

function monthsBetween(startIso, endIso) {
  const s = new Date(String(startIso).slice(0, 10) + 'T12:00:00');
  const e = new Date(String(endIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  return Math.max(0, months);
}

function computedAgeMonths(purchaseDate, now = new Date()) {
  return monthsBetween(purchaseDate, now.toISOString().slice(0, 10));
}

function computedRemainingLifeMonths(purchaseDate, expectedLifeMonths, now = new Date()) {
  const used = computedAgeMonths(purchaseDate, now);
  if (used == null) return null;
  return Math.max(0, Number(expectedLifeMonths) - used);
}

function warrantyStatus(warrantyEndDate, now = new Date()) {
  const end = String(warrantyEndDate || '').slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (!end) return { ok: false, label: 'Määramata' };
  if (today <= end) return { ok: true, label: 'Kehtiv' };
  return { ok: false, label: 'Aegunud' };
}

function statusEt(status) {
  switch (status) {
    case 'IN_STOCK':
      return 'Laos';
    case 'ASSIGNED':
      return 'Kasutaja käes';
    case 'WRITTEN_OFF':
      return 'Mahakantud';
    default:
      return status || '—';
  }
}

function statusBadgeClass(status) {
  if (status === 'IN_STOCK') return 'stock';
  if (status === 'ASSIGNED') return 'assigned';
  if (status === 'WRITTEN_OFF') return 'written';
  return '';
}

function operationTypeEt(type) {
  if (type === 'ISSUE') return 'Kasutusse andmine';
  if (type === 'RETURN') return 'Vara tagastamine';
  return type || '—';
}

function showAlert(el, type, message) {
  if (!el) return;
  el.className = `alert ${type === 'error' ? 'error' : 'ok'}`;
  el.textContent = message;
  el.hidden = false;
}

function clearAlert(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

/** Nav active state by pathname */
function setActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  document.querySelectorAll('nav a[data-nav]').forEach((a) => {
    a.classList.remove('active');
    const href = a.getAttribute('href') || '';
    const hrefPath = href.split('?')[0].replace(/\/$/, '') || '/';

    if (hrefPath === '/' && (path === '/' || path === '/index.html')) {
      a.classList.add('active');
    } else if (hrefPath !== '/' && path.endsWith(hrefPath)) {
      a.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);
