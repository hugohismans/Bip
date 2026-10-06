'use strict';

/* =========================================================
   Bip – suivi quotidien de l'humeur (bipolarité)
   Tout est stocké localement (localStorage), rien n'est envoyé.
   ========================================================= */

const KEY_ENTRIES = 'bip.entries.v1';
const KEY_SETTINGS = 'bip.settings.v1';

const DEFAULT_SETTINGS = {
  baseline: 7.5,
  psyName: '', psyTel: '',
  famName: '', famTel: '',
  remind: false, remindTime: '21:00',
};

const MOOD_LABELS = { '-3': 'très basse', '-2': 'basse', '-1': 'un peu basse', '0': 'neutre', '1': 'un peu haute', '2': 'haute', '3': 'très haute' };
const ENERGY_LABELS = { '-3': 'à plat', '-2': 'basse', '-1': 'un peu basse', '0': 'normale', '1': 'un peu haute', '2': 'haute', '3': 'survolté·e' };
const IRRIT_LABELS = { '0': 'aucune', '1': 'légère', '2': 'nette', '3': 'forte' };

/* ---------- stockage ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

let entries = load(KEY_ENTRIES, {});
let settings = Object.assign({}, DEFAULT_SETTINGS, load(KEY_SETTINGS, {}));

/* ---------- dates (format AAAA-MM-JJ, heure locale) ---------- */
function toStr(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromStr(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function today() { return toStr(new Date()); }
function addDays(s, n) { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); }
function diffDays(a, b) { return Math.round((fromStr(a) - fromStr(b)) / 86400000); }
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function fmtShort(s) { const d = fromStr(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function fmtLong(s) { const d = fromStr(s); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
const fmtNum = (n, digits = 1) => (n > 0 ? '+' : '') + n.toFixed(digits).replace('.', ',');
const fmtH = h => String(h).replace('.', ',') + ' h';

/* ---------- calculs ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Indice du jour : -3 (bas) .. +3 (haut).
   Dormir moins que d'habitude est l'un des premiers signes de phase haute,
   dormir beaucoup plus accompagne souvent la phase basse. */
function dayIndex(e) {
  const sleepScore = clamp(settings.baseline - e.sleep, -3, 3);
  return Math.round((0.5 * e.mood + 0.3 * e.energy + 0.2 * sleepScore) * 10) / 10;
}

function avgWindow(endDate, days) {
  const vals = [];
  for (let i = 0; i < days; i++) {
    const e = entries[addDays(endDate, -i)];
    if (e) vals.push(dayIndex(e));
  }
  return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : { avg: null, n: 0 };
}

function slopeWindow(endDate, days) {
  const pts = [];
  for (let i = 0; i < days; i++) {
    const s = addDays(endDate, -i);
    if (entries[s]) pts.push([-i, dayIndex(entries[s])]);
  }
  if (pts.length < 3) return null;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den ? num / den : 0;
}

/* nombre de jours consécutifs (finissant à endDate) qui vérifient pred */
function streak(endDate, pred) {
  let n = 0, s = endDate;
  while (entries[s] && pred(entries[s])) { n++; s = addDays(s, -1); }
  return n;
}

function lastNDays(endDate, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const s = addDays(endDate, -i); if (entries[s]) out.push(entries[s]); }
  return out;
}

function phaseOf(avg) {
  if (avg === null) return { key: 'none', label: 'Pas assez de données', color: 'var(--neutral)' };
  if (avg >= 1) return { key: 'high', label: 'Phase haute', color: 'var(--high)' };
  if (avg >= 0.5) return { key: 'mhigh', label: 'Tendance haute', color: 'var(--high)' };
  if (avg <= -1) return { key: 'low', label: 'Phase basse', color: 'var(--low)' };
  if (avg <= -0.5) return { key: 'mlow', label: 'Tendance basse', color: 'var(--low)' };
  return { key: 'stable', label: 'Stable', color: 'var(--neutral)' };
}

function directionOf(slope) {
  if (slope === null) return { label: '—', sub: 'au moins 3 jours notés' };
  if (slope > 0.15) return { label: '↗ En montée', sub: `${fmtNum(slope * 7)} sur 7 jours` };
  if (slope < -0.15) return { label: '↘ En descente', sub: `${fmtNum(slope * 7)} sur 7 jours` };
  return { label: '→ Plutôt stable', sub: `${fmtNum(slope * 7)} sur 7 jours` };
}

function analyze() {
  const dates = Object.keys(entries).sort();
  if (!dates.length) return null;
  const last = dates[dates.length - 1];
  const ref = today();
  const stale = diffDays(ref, last);
  const w7 = avgWindow(ref, 7);
  const avg = w7.n >= 3 ? w7.avg : null;
  const slope = slopeWindow(ref, 7);
  const base = settings.baseline;

  const alerts = [];
  const highStreak = streak(last, e => dayIndex(e) >= 1);
  const lowStreak = streak(last, e => dayIndex(e) <= -1);
  const recent3 = stale <= 1 ? lastNDays(last, 3) : [];
  const recent7 = stale <= 1 ? lastNDays(last, 7) : [];

  if (stale <= 1) {
    if (highStreak >= 4) {
      alerts.push({ level: 'crit', title: `${highStreak} jours d'affilée en zone haute`,
        text: "C'est la durée qui définit un épisode hypomaniaque. En phase haute on se sent souvent très bien, ce qui la rend difficile à repérer soi-même : c'est le bon moment pour appeler votre psychiatre et en parler à un proche.",
        who: ['psy', 'fam'] });
    } else if (highStreak >= 2) {
      alerts.push({ level: 'warn', title: `${highStreak} jours d'affilée en zone haute`,
        text: 'À surveiller. Protégez votre sommeil (horaires réguliers, pas d\'écrans tard), évitez les grosses décisions et dépenses. Si ça continue 2 jours de plus, contactez votre psychiatre.',
        who: [] });
    }

    const shortNights = recent3.filter(e => e.sleep <= base - 2);
    const energized = recent3.some(e => e.energy >= 1);
    if (shortNights.length >= 2 && energized) {
      const moodUp = recent3.some(e => e.mood >= 1);
      alerts.push({ level: moodUp ? 'crit' : 'warn', title: 'Moins de sommeil, sans fatigue',
        text: `${shortNights.length} nuits sur 3 au moins 2 h sous votre sommeil habituel (${fmtH(base)}), avec une énergie haute. Le besoin de sommeil réduit est l'un des signes précoces les plus fiables d'une phase haute.` + (moodUp ? ' Avec une humeur haute en plus, contactez votre psychiatre.' : ''),
        who: moodUp ? ['psy', 'fam'] : ['psy'] });
    }

    const mixedDays = recent3.filter(e => e.mood <= -1 && (e.energy >= 1 || e.irrit >= 2));
    if (mixedDays.length >= 2) {
      alerts.push({ level: 'crit', title: 'Signes mixtes',
        text: "Humeur basse combinée à de l'agitation ou de l'irritabilité plusieurs jours de suite. Les états mixtes sont plus à risque : contactez votre psychiatre rapidement et ne restez pas seul·e avec ça.",
        who: ['psy', 'fam'] });
    }

    if (lowStreak >= 14) {
      alerts.push({ level: 'crit', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'Deux semaines de phase basse correspondent à la durée d\'un épisode dépressif. Prenez rendez-vous avec votre psychiatre et parlez-en à un proche.',
        who: ['psy', 'fam'] });
    } else if (lowStreak >= 7) {
      alerts.push({ level: 'warn', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'Une semaine en zone basse : c\'est le moment d\'en parler à votre psychiatre, avant que ça s\'installe.',
        who: ['psy'] });
    } else if (lowStreak >= 3) {
      alerts.push({ level: 'warn', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'À surveiller. Gardez un rythme régulier (lever, repas, lumière du jour, un peu d\'activité) et restez en lien avec vos proches.',
        who: [] });
    }

    const irritDays = recent7.filter(e => e.irrit >= 2).length;
    if (irritDays >= 3 && !mixedDays.length) {
      alerts.push({ level: 'warn', title: 'Irritabilité fréquente',
        text: `${irritDays} jours sur les 7 derniers avec une irritabilité nette. Elle peut accompagner une phase haute comme une phase basse : notez-le pour votre prochain rendez-vous.`,
        who: [] });
    }

    const a3 = avgWindow(last, 3), before = avgWindow(addDays(last, -3), 7);
    if (a3.n >= 2 && before.n >= 3 && Math.abs(a3.avg - before.avg) >= 1.5) {
      const up = a3.avg > before.avg;
      alerts.push({ level: 'warn', title: up ? 'Montée rapide' : 'Chute rapide',
        text: `Votre indice a ${up ? 'monté' : 'baissé'} de ${Math.abs(a3.avg - before.avg).toFixed(1).replace('.', ',')} point en quelques jours. Un changement brusque mérite d'être signalé à votre psychiatre s'il se maintient.`,
        who: [] });
    }
  }

  const lastE = entries[last];
  const crisis = stale <= 1 && (lastE.mood === -3 || alerts.some(a => a.title === 'Signes mixtes'));
  return { last, stale, avg, n7: w7.n, slope, phase: phaseOf(avg), dir: directionOf(slope), alerts, crisis };
}

/* ---------- UI : onglets ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showTab(name) {
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + name; });
  try { sessionStorage.setItem('bip.tab', name); } catch (e) {}
  if (name === 'history') renderHistory();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------- UI : saisie ---------- */
const F = {
  date: $('#f-date'), mood: $('#f-mood'), energy: $('#f-energy'), sleep: $('#f-sleep'), irrit: $('#f-irrit'),
  meds: $('#f-meds'), note: $('#f-note'),
};

function updateOutputs() {
  $('#o-mood').textContent = `${fmtNum(+F.mood.value, 0).replace('+0', '0')} · ${MOOD_LABELS[F.mood.value]}`;
  $('#o-energy').textContent = `${fmtNum(+F.energy.value, 0).replace('+0', '0')} · ${ENERGY_LABELS[F.energy.value]}`;
  const diff = +F.sleep.value - settings.baseline;
  $('#o-sleep').textContent = fmtH(+F.sleep.value) + (Math.abs(diff) >= 1 ? ` (${diff > 0 ? '+' : '−'}${fmtH(Math.abs(diff))})` : '');
  $('#o-irrit').textContent = IRRIT_LABELS[F.irrit.value];
}
['mood', 'energy', 'sleep', 'irrit'].forEach(k => F[k].addEventListener('input', updateOutputs));

function fillForm(date) {
  F.date.value = date;
  const e = entries[date];
  // Pas encore noté : on part de la dernière saisie pour aller plus vite
  const prev = Object.keys(entries).filter(d => d < date).sort().pop();
  const src = e || (prev ? entries[prev] : { mood: 0, energy: 0, sleep: settings.baseline, irrit: 0, meds: false });
  F.mood.value = src.mood; F.energy.value = src.energy; F.sleep.value = src.sleep; F.irrit.value = src.irrit;
  F.meds.checked = !!src.meds;
  F.note.value = e ? (e.note || '') : '';
  $('#f-saved').hidden = !e;
  $('#f-submit').textContent = e ? 'Mettre à jour' : 'Enregistrer';
  F.date.max = today();
  updateOutputs();
}
F.date.addEventListener('change', () => { if (F.date.value) fillForm(F.date.value); });

$('#entry').addEventListener('submit', ev => {
  ev.preventDefault();
  const date = F.date.value;
  if (!date || date > today()) { flash('#f-toast', 'Choisissez un jour passé ou aujourd\'hui.'); return; }
  entries[date] = {
    mood: +F.mood.value, energy: +F.energy.value, sleep: +F.sleep.value, irrit: +F.irrit.value,
    meds: F.meds.checked, note: F.note.value.trim(),
  };
  const ok = save(KEY_ENTRIES, entries);
  flash('#f-toast', ok ? `Noté pour ${date === today() ? "aujourd'hui" : fmtShort(date)} ✓` : 'Impossible d\'enregistrer (stockage du navigateur indisponible).');
  fillForm(date);
  renderStatus();
});

function flash(sel, msg) {
  const el = $(sel); el.textContent = msg;
  clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 3500);
}

/* ---------- UI : statut + alertes ---------- */
function contactLinks(who) {
  const out = [];
  if (who.includes('psy')) {
    out.push(settings.psyTel
      ? `<a href="tel:${encodeURI(settings.psyTel)}">Appeler ${esc(settings.psyName || 'mon psychiatre')}</a>`
      : `<a href="#" data-goto="settings">Ajouter le numéro du psychiatre</a>`);
  }
  if (who.includes('fam')) {
    out.push(settings.famTel
      ? `<a href="tel:${encodeURI(settings.famTel)}">Appeler ${esc(settings.famName || 'mon proche')}</a>`
      : `<a href="#" data-goto="settings">Ajouter un proche de confiance</a>`);
  }
  return out.length ? `<div class="act">${out.join('')}</div>` : '';
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderStatus() {
  const a = analyze();
  const status = $('#status'), alertsEl = $('#alerts'), crisis = $('#crisis');
  if (!a) {
    status.innerHTML = '<p class="ok">Notez votre journée chaque soir. Après 3 jours, Bip vous indique votre phase et votre direction ; l\'historique se construit au fil des semaines.</p>';
    alertsEl.innerHTML = ''; crisis.hidden = true;
    return;
  }
  const staleTxt = a.stale === 0 ? "aujourd'hui" : a.stale === 1 ? 'hier' : `il y a ${a.stale} jours`;
  status.innerHTML = `
    <div class="status-grid">
      <div class="stat"><div class="label">Phase (7 derniers jours)</div>
        <div class="value"><span class="phase-dot" style="background:${a.phase.color}"></span>${a.phase.label}</div>
        <div class="sub">${a.avg === null ? `${a.n7} jour(s) noté(s) sur 7` : `indice moyen ${fmtNum(a.avg)}`}</div></div>
      <div class="stat"><div class="label">Direction</div>
        <div class="value">${a.dir.label}</div><div class="sub">${a.dir.sub}</div></div>
    </div>
    <p class="muted small" style="margin:10px 0 0">Dernier relevé : ${staleTxt}.</p>`;

  if (a.stale > 1) {
    alertsEl.innerHTML = `<div class="card alert"><h3>Quelques jours sans relevé</h3><p>Pas de saisie depuis ${a.stale} jours. Vous pouvez compléter les jours manqués en changeant la date en haut. Interrompre le suivi arrive souvent quand l'humeur change : ça vaut le coup de vous poser la question.</p></div>`;
  } else if (a.alerts.length) {
    alertsEl.innerHTML = a.alerts.map(al => `
      <div class="card alert ${al.level === 'crit' ? 'crit' : ''}">
        <h3>${al.level === 'crit' ? '⚠️ ' : ''}${esc(al.title)}</h3><p>${esc(al.text)}</p>${contactLinks(al.who)}
      </div>`).join('');
  } else {
    alertsEl.innerHTML = '<div class="card"><p class="ok" style="margin:0">Aucun signal particulier ces derniers jours.</p></div>';
  }

  crisis.hidden = !a.crisis;
  if (a.crisis) {
    crisis.innerHTML = `<h2>Si c'est trop lourd en ce moment</h2>
      <p class="small">Si vous avez des idées noires ou pensez au suicide, parlez-en tout de suite, à quelqu'un de confiance ou à une ligne d'écoute (gratuit, 24 h/24) :</p>
      <p class="small">🇫🇷 <a href="tel:3114">3114</a> · 🇧🇪 <a href="tel:080032123">0800 32 123</a> · 🇨🇭 <a href="tel:143">143</a> · 🇨🇦 <a href="tel:988">988</a> · Urgence : <a href="tel:112">112</a></p>
      ${contactLinks(['psy', 'fam'])}`;
  }
}

document.addEventListener('click', ev => {
  const g = ev.target.closest('[data-goto]');
  if (g) { ev.preventDefault(); showTab(g.dataset.goto); }
});

/* ---------- UI : historique (graphes SVG) ---------- */
let range = 30;
$$('.seg button').forEach(b => b.addEventListener('click', () => {
  range = +b.dataset.range;
  $$('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderHistory();
}));

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function xTicks(start, days, W) {
  const out = [], every = tickEvery(days, W);
  const monthly = days > 92, monthStep = Math.ceil(every / 30);
  for (let i = 0; i < days; i++) {
    const s = addDays(start, i), d = fromStr(s);
    if (monthly ? d.getDate() === 1 && d.getMonth() % monthStep === 0 : (days - 1 - i) % every === 0) out.push([i, s]);
  }
  return out;
}

function idxColor(v) { return v >= 1 ? 'var(--high)' : v <= -1 ? 'var(--low)' : 'var(--neutral)'; }

function renderHistory() {
  const end = today(), start = addDays(end, -(range - 1));
  const days = [];
  for (let i = 0; i < range; i++) days.push(addDays(start, i));
  const any = days.some(d => entries[d]);
  drawMood(days, any);
  drawSleep(days, any);
  renderTable();
}

function chartFrame(container, H) {
  container.innerHTML = '';
  const W = Math.max(280, Math.round(container.clientWidth || 680)), m = { l: 26, r: 6, t: 10, b: 24 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, container);
  return { svg, W, H, m, iw: W - m.l - m.r, ih: H - m.t - m.b };
}
function tickEvery(days, W) {
  // espace minimal ~56 px entre deux dates
  const per = Math.ceil(days / Math.max(2, Math.floor(W / 56)));
  return days <= 92 ? Math.max(per, 7) : per;
}

function drawMood(days, any) {
  const box = $('#chart-mood');
  if (!any) { box.innerHTML = '<p class="empty">Pas encore de données sur cette période.</p>'; return; }
  const { svg, W, H, m, iw, ih } = chartFrame(box, 240);
  svg.setAttribute('aria-label', 'Indice d\'humeur quotidien et moyenne sur 7 jours');
  const n = days.length;
  const x = i => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => m.t + ((3 - v) / 6) * ih;

  el('rect', { x: m.l, y: y(3), width: iw, height: y(1) - y(3), fill: 'var(--high-zone)' }, svg);
  el('rect', { x: m.l, y: y(-1), width: iw, height: y(-3) - y(-1), fill: 'var(--low-zone)' }, svg);
  for (let v = -3; v <= 3; v++) {
    el('line', { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--neutral)' : 'var(--grid)', 'stroke-width': 1 }, svg);
    el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v > 0 ? '+' + v : v;
  }
  for (const [i, s] of xTicks(days[0], n, W)) {
    el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = fmtShort(s);
  }

  // moyenne glissante 7 jours (au moins 3 jours notés dans la fenêtre)
  const avgs = days.map(d => { const w = avgWindow(d, 7); return w.n >= 3 ? w.avg : null; });
  let path = '', pen = false;
  avgs.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
  });
  el('path', { d: path, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

  const r = n <= 31 ? 4.5 : n <= 92 ? 3.5 : 2.5;
  days.forEach((d, i) => {
    const e = entries[d]; if (!e) return;
    const v = dayIndex(e);
    el('circle', { cx: x(i), cy: y(v), r, fill: idxColor(v), stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg);
  });

  attachHover(svg, box, W, days, x, m, ih, i => {
    const d = days[i], e = entries[d];
    const avg = avgs[i];
    if (!e) return `<b>${fmtLong(d)}</b><br>pas de relevé` + (avg !== null ? `<br>moyenne 7 j : <b>${fmtNum(avg)}</b>` : '');
    return `<b>${fmtLong(d)}</b><br>indice <b>${fmtNum(dayIndex(e))}</b>` + (avg !== null ? ` · moy. 7 j <b>${fmtNum(avg)}</b>` : '') +
      `<br>humeur ${MOOD_LABELS[e.mood]} · énergie ${ENERGY_LABELS[e.energy]}<br>sommeil ${fmtH(e.sleep)} · irritabilité ${IRRIT_LABELS[e.irrit]}` +
      (e.note ? `<br><i>${esc(e.note)}</i>` : '');
  });
}

function drawSleep(days, any) {
  const box = $('#chart-sleep');
  if (!any) { box.innerHTML = '<p class="empty">Pas encore de données sur cette période.</p>'; return; }
  const { svg, W, H, m, iw, ih } = chartFrame(box, 160);
  svg.setAttribute('aria-label', 'Heures de sommeil par nuit');
  const n = days.length;
  const maxH = Math.max(12, ...days.map(d => entries[d] ? entries[d].sleep : 0));
  const slot = iw / n;
  const x = i => m.l + slot * (i + 0.5);
  const y = v => m.t + (1 - v / maxH) * ih;
  for (let v = 0; v <= maxH; v += 3) {
    el('line', { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v), stroke: 'var(--grid)' }, svg);
    el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v;
  }
  for (const [i, s] of xTicks(days[0], n, W)) {
    el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = fmtShort(s);
  }
  const bw = Math.max(1, Math.min(14, slot - 2));
  days.forEach((d, i) => {
    const e = entries[d]; if (!e || e.sleep <= 0) return;
    const h = y(0) - y(e.sleep), rr = Math.min(4, bw / 2, h);
    const x0 = x(i) - bw / 2, y0 = y(e.sleep);
    const fill = e.sleep <= settings.baseline - 2 ? 'var(--high)' : e.sleep >= settings.baseline + 2 ? 'var(--low)' : 'var(--neutral)';
    el('path', { d: `M${x0},${y(0)}V${y0 + rr}Q${x0},${y0} ${x0 + rr},${y0}H${x0 + bw - rr}Q${x0 + bw},${y0} ${x0 + bw},${y0 + rr}V${y(0)}Z`, fill }, svg);
  });
  el('line', { x1: m.l, x2: m.l + iw, y1: y(settings.baseline), y2: y(settings.baseline), stroke: 'var(--text-2)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);

  attachHover(svg, box, W, days, x, m, ih, i => {
    const d = days[i], e = entries[d];
    if (!e) return `<b>${fmtLong(d)}</b><br>pas de relevé`;
    const diff = e.sleep - settings.baseline;
    return `<b>${fmtLong(d)}</b><br>sommeil <b>${fmtH(e.sleep)}</b>` + (diff ? ` (${diff > 0 ? '+' : '−'}${fmtH(Math.abs(diff))} vs habitude)` : '');
  });
}

function attachHover(svg, box, W, days, x, m, ih, html) {
  const tip = $('#tooltip');
  const cross = el('line', { y1: m.t, y2: m.t + ih, stroke: 'var(--text-2)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const hit = el('rect', { x: 0, y: 0, width: W, height: m.t + ih + m.b, fill: 'transparent' }, svg);
  const move = ev => {
    const rect = svg.getBoundingClientRect();
    const sx = (ev.clientX - rect.left) * (W / rect.width);
    let best = 0, bd = Infinity;
    days.forEach((_, i) => { const dd = Math.abs(x(i) - sx); if (dd < bd) { bd = dd; best = i; } });
    cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best)); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = html(best); tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = ev.clientX + 12; if (left + tw > window.innerWidth - 8) left = ev.clientX - tw - 12;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, ev.clientY - th - 12) + 'px';
  };
  const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
  box.addEventListener('pointerleave', leave);
}

function renderTable() {
  const tb = $('#log tbody');
  const from = addDays(today(), -(range - 1));
  const dates = Object.keys(entries).filter(d => d >= from).sort().reverse();
  if (!dates.length) { tb.innerHTML = '<tr><td colspan="7" class="muted">Aucun relevé sur cette période.</td></tr>'; return; }
  tb.innerHTML = dates.map(d => {
    const e = entries[d], v = dayIndex(e);
    return `<tr><td><button data-edit="${d}" title="Modifier">${fmtShort(d)}</button></td><td>${e.mood}</td><td>${e.energy}</td><td>${fmtH(e.sleep)}</td><td>${e.irrit}</td>
      <td style="color:${idxColor(v)};font-weight:600">${fmtNum(v)}</td><td class="note">${esc(e.note || '')}</td></tr>`;
  }).join('');
}
$('#log').addEventListener('click', ev => {
  const b = ev.target.closest('[data-edit]');
  if (b) { showTab('today'); fillForm(b.dataset.edit); }
});

/* ---------- UI : réglages ---------- */
const S = {
  baseline: $('#s-baseline'), psyName: $('#s-psy-name'), psyTel: $('#s-psy-tel'),
  famName: $('#s-fam-name'), famTel: $('#s-fam-tel'), remind: $('#s-remind'), remindTime: $('#s-remind-time'),
};
function fillSettings() {
  S.baseline.value = settings.baseline;
  S.psyName.value = settings.psyName; S.psyTel.value = settings.psyTel;
  S.famName.value = settings.famName; S.famTel.value = settings.famTel;
  S.remind.checked = settings.remind; S.remindTime.value = settings.remindTime;
}
$('#settings').addEventListener('submit', async ev => {
  ev.preventDefault();
  settings = {
    baseline: clamp(parseFloat(S.baseline.value) || DEFAULT_SETTINGS.baseline, 4, 12),
    psyName: S.psyName.value.trim(), psyTel: S.psyTel.value.trim(),
    famName: S.famName.value.trim(), famTel: S.famTel.value.trim(),
    remind: S.remind.checked, remindTime: S.remindTime.value || '21:00',
  };
  if (settings.remind && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  save(KEY_SETTINGS, settings);
  fillSettings(); updateOutputs(); renderStatus();
  flash('#s-toast', 'Réglages enregistrés ✓');
});

/* ---------- données : export / import / démo ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('#d-export').addEventListener('click', () => {
  download(`bip-sauvegarde-${today()}.json`, JSON.stringify({ app: 'bip', version: 1, settings, entries }, null, 2), 'application/json');
});
$('#d-csv').addEventListener('click', () => {
  const rows = [['date', 'humeur', 'energie', 'sommeil_h', 'irritabilite', 'traitement_pris', 'indice', 'moyenne_7j', 'note']];
  for (const d of Object.keys(entries).sort()) {
    const e = entries[d], w = avgWindow(d, 7);
    rows.push([d, e.mood, e.energy, e.sleep, e.irrit, e.meds ? 'oui' : 'non', dayIndex(e), w.n >= 3 ? w.avg.toFixed(2) : '', e.note || '']);
  }
  const csv = rows.map(r => r.map(c => /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\n');
  download(`bip-humeur-${today()}.csv`, '﻿' + csv, 'text/csv');
});
$('#d-import').addEventListener('change', async ev => {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.entries !== 'object') throw new Error('format');
    let n = 0;
    for (const [d, e] of Object.entries(data.entries)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && e && typeof e.mood === 'number') { entries[d] = e; n++; }
    }
    if (data.settings) settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    save(KEY_ENTRIES, entries); save(KEY_SETTINGS, settings);
    fillSettings(); fillForm(today()); renderStatus();
    alert(`${n} relevé(s) importé(s).`);
  } catch (e) { alert('Fichier non reconnu.'); }
  ev.target.value = '';
});
$('#d-wipe').addEventListener('click', () => {
  if (!confirm('Effacer définitivement tous vos relevés sur cet appareil ?')) return;
  entries = {}; save(KEY_ENTRIES, entries); fillForm(today()); renderStatus();
});
$('#d-demo').addEventListener('click', () => {
  if (Object.keys(entries).length && !confirm('Remplacer vos relevés par des données de démonstration ?')) return;
  entries = demoData(); save(KEY_ENTRIES, entries); fillForm(today()); renderStatus();
  showTab('history');
});

/* 120 jours fictifs : stabilité, épisode dépressif, retour, puis montée hypomaniaque récente */
function demoData() {
  const out = {}, end = today();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 119; i >= 0; i--) {
    if (rnd() < 0.08) continue; // quelques oublis
    const d = addDays(end, -i);
    let level;
    if (i > 85) level = 0;
    else if (i > 55) level = -1.8 * Math.sin(((85 - i) / 30) * Math.PI);
    else if (i > 8) level = 0.2;
    else level = 0.4 + (8 - i) * 0.3;
    const noise = () => Math.round((rnd() - 0.5) * 1.6);
    const mood = clamp(Math.round(level) + noise(), -3, 3);
    const energy = clamp(Math.round(level * 1.1) + noise(), -3, 3);
    const sleep = clamp(Math.round((7.5 - level * 1.2 + (rnd() - 0.5) * 1.5) * 2) / 2, 3, 12);
    const irrit = clamp(Math.round(Math.abs(level) * 0.6 + rnd() * 0.8), 0, 3);
    out[d] = { mood, energy, sleep, irrit, meds: rnd() > 0.1, note: i === 70 ? 'Conflit au travail' : i === 5 ? 'Plein de projets en tête' : '' };
  }
  return out;
}

/* ---------- rappel du soir (si l'app est ouverte) ---------- */
setInterval(() => {
  if (!settings.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(), hhmm = now.toTimeString().slice(0, 5), d = today();
  let last = ''; try { last = localStorage.getItem('bip.lastReminder') || ''; } catch (e) {}
  if (hhmm >= settings.remindTime && !entries[d] && last !== d) {
    try { new Notification('Bip', { body: 'Comment était ta journée ? 5 secondes pour la noter.', icon: 'icon.svg' }); } catch (e) {}
    try { localStorage.setItem('bip.lastReminder', d); } catch (e) {}
  }
}, 60000);

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (!$('#tab-history').hidden) renderHistory(); }, 150);
});

/* ---------- démarrage ---------- */
fillSettings();
fillForm(today());
renderStatus();
let startTab = 'today';
try { startTab = sessionStorage.getItem('bip.tab') || 'today'; } catch (e) {}
showTab(startTab);
window.addEventListener('focus', () => { if (F.date.max !== today()) { fillForm(today()); renderStatus(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
