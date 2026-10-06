'use strict';

/* =========================================================
   Bip – suivi quotidien de l'humeur (bipolarité)
   Tout est stocké localement (localStorage), rien n'est envoyé.
   ========================================================= */

const KEY_ENTRIES = 'bip.entries.v1';
const KEY_SETTINGS = 'bip.settings.v1';

const LEVELS = ['non', 'un peu', 'nettement', 'beaucoup'];

/* Symptômes notés de 0 à 3. Humeur, énergie et sommeil sont toujours présents.
   'def' : activé par défaut (choix pensé pour le type 2). */
const SYMPTOMS = [
  { key: 'irrit', short: 'Irr.', label: 'Irritabilité', hint: 'agacement, impatience, colère', def: true },
  { key: 'anxiety', short: 'Anx.', label: 'Anxiété', hint: 'inquiétude, tension, nervosité', def: true },
  { key: 'thoughts', short: 'Pens.', label: 'Pensées rapides', hint: 'idées qui fusent, parler beaucoup, plein de projets', def: true },
  { key: 'impuls', short: 'Imp.', label: 'Impulsivité', hint: 'dépenses, prises de risque, décisions sur un coup de tête', def: false },
  { key: 'focus', short: 'Conc.', label: 'Difficulté à se concentrer', hint: 'lire, suivre une conversation, travailler', def: false },
  { key: 'stress', short: 'Stress', label: 'Stress / événement', hint: 'conflit, deadline, deuil, voyage…', def: false },
  { key: 'alcohol', short: 'Alc.', label: 'Alcool / substances', hint: 'plus que d\'habitude', def: false },
];
const SYM = Object.fromEntries(SYMPTOMS.map(x => [x.key, x]));
const sv = (e, k) => e[k] || 0;
const lvl = v => LEVELS[clamp(Math.round(v), 0, 3)];
function symLabel(k, v) { return `${SYM[k].label.toLowerCase()} ${lvl(v)}`; }

/* Moments de la journée : 1, 2 ou 3 relevés par jour.
   time = heure du rappel (fin du moment), ask = texte de la notification. */
const SLOT_SETS = {
  1: [{ id: 'j', label: 'Journée', time: '21:00', ask: 'Comment s\'est passée ta journée ?' }],
  2: [{ id: 'm', label: 'Matinée', time: '13:00', ask: 'Comment s\'est passée ta matinée ?' },
      { id: 's', label: 'Après-midi et soirée', time: '21:30', ask: 'Comment se sont passés ton après-midi et ta soirée ?' }],
  3: [{ id: 'm', label: 'Matinée', time: '12:30', ask: 'Comment s\'est passée ta matinée ?' },
      { id: 'a', label: 'Après-midi', time: '18:00', ask: 'Comment s\'est passé ton après-midi ?' },
      { id: 's', label: 'Soirée', time: '22:00', ask: 'Comment s\'est passée ta soirée ?' }],
};
const SLOT_LABEL = { j: 'journée', m: 'matin', a: 'après-midi', s: 'soir' };
const SLOT_ORDER = ['m', 'a', 's', 'j'];
function activeSlots() {
  return SLOT_SETS[settings.slotCount].map(x => Object.assign({}, x, { time: settings.slotTimes[settings.slotCount + x.id] || x.time }));
}

const DEFAULT_SETTINGS = {
  baseline: 7.5,
  psyName: '', psyTel: '',
  famName: '', famTel: '',
  remind: false, remindTime: '21:00',
  slotCount: 1,              // relevés par jour (1, 2 ou 3)
  slotTimes: {},             // heures de rappel personnalisées, clé « <nombre><id> » (ex. « 3m »)
  symptoms: SYMPTOMS.filter(x => x.def).map(x => x.key),
  calibrate: true,           // ajuster les calculs à la façon de noter du patient
  signs: [],                 // signes d'alerte personnels { id, text, pole: 'high'|'low', archived? }
  planHigh: '', planLow: '', // plan d'action écrit avec le psychiatre
  consults: [],              // dates des consultations (pour le récapitulatif)
  reportName: '',
};

/* Signes avant-coureurs fréquents, proposés comme point de départ */
const SUGGESTED_SIGNS = [
  ['high', 'Je dors moins sans être fatigué·e'], ['high', 'Je fais plein de projets ou de listes'],
  ['high', 'Je dépense plus que d\'habitude'], ['high', 'Je parle plus vite ou plus fort'],
  ['high', 'J\'envoie beaucoup de messages'], ['high', 'Je me sens invincible, très sûr·e de moi'],
  ['high', 'Je commence plein de choses sans les finir'], ['high', 'Je prends des risques (conduite, sorties…)'],
  ['low', 'Je m\'isole, j\'annule des sorties'], ['low', 'Je reste au lit plus longtemps'],
  ['low', 'Je perds l\'intérêt pour ce que j\'aime'], ['low', 'Je néglige les repas ou la toilette'],
  ['low', 'Je ressasse, je culpabilise'], ['low', 'Tout me demande un effort énorme'],
];

const MOOD_LABELS = { '-3': 'très basse', '-2': 'basse', '-1': 'un peu basse', '0': 'neutre', '1': 'un peu haute', '2': 'haute', '3': 'très haute' };
const ENERGY_LABELS = { '-3': 'à plat', '-2': 'basse', '-1': 'un peu basse', '0': 'normale', '1': 'un peu haute', '2': 'haute', '3': 'survolté·e' };

/* ---------- stockage ---------- */
/* Mode démo (./?demo) : données fictives gardées en mémoire uniquement.
   On ne lit ni n'écrit jamais le localStorage du vrai suivi. */
const DEMO = new URLSearchParams(location.search).has('demo');
const memStore = {};

function load(key, fallback) {
  if (DEMO) return key in memStore ? JSON.parse(memStore[key]) : fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  if (DEMO) { memStore[key] = JSON.stringify(value); return true; }
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

let entries = load(KEY_ENTRIES, {});
let settings = normSettings(load(KEY_SETTINGS, {}));
function normSettings(o) {
  const st = Object.assign({}, DEFAULT_SETTINGS, o);
  st.symptoms = Array.isArray(st.symptoms) ? st.symptoms.filter(k => SYM[k]) : DEFAULT_SETTINGS.symptoms.slice();
  st.calibrate = st.calibrate !== false;
  st.slotCount = [1, 2, 3].includes(+st.slotCount) ? +st.slotCount : 1;
  const times = {};
  for (const [k, v] of Object.entries(st.slotTimes && typeof st.slotTimes === 'object' ? st.slotTimes : {})) {
    if (/^[123][jmas]$/.test(k) && /^\d{2}:\d{2}$/.test(v)) times[k] = v;
  }
  if (!times['1j'] && /^\d{2}:\d{2}$/.test(st.remindTime || '') && st.remindTime !== '21:00') times['1j'] = st.remindTime; // ancien réglage
  st.slotTimes = times;
  st.signs = (Array.isArray(st.signs) ? st.signs : [])
    .filter(x => x && typeof x.id === 'string' && typeof x.text === 'string' && (x.pole === 'high' || x.pole === 'low'))
    .map(x => ({ id: x.id.slice(0, 40), text: x.text.slice(0, 80), pole: x.pole, archived: !!x.archived }));
  st.planHigh = typeof st.planHigh === 'string' ? st.planHigh.slice(0, 1000) : '';
  st.planLow = typeof st.planLow === 'string' ? st.planLow.slice(0, 1000) : '';
  st.consults = (Array.isArray(st.consults) ? st.consults : []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  st.reportName = typeof st.reportName === 'string' ? st.reportName.slice(0, 80) : '';
  return st;
}

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
const round1 = v => Math.round(v * 10) / 10;

/* Valeurs du jour à partir des relevés de la journée :
   humeur et énergie = moyenne, symptômes = le plus haut (un moment difficile compte),
   signes = tous ceux cochés dans la journée. */
function aggregateDay(e) {
  const list = SLOT_ORDER.filter(id => e.slots && e.slots[id]).map(id => e.slots[id]);
  if (!list.length) return e;
  const mean = k => round1(list.reduce((t, x) => t + x[k], 0) / list.length);
  e.mood = mean('mood'); e.energy = mean('energy');
  for (const x of SYMPTOMS) {
    const v = list.filter(r => r[x.key] !== undefined).map(r => r[x.key]);
    if (v.length) e[x.key] = Math.max(...v); else delete e[x.key];
  }
  const signs = [...new Set(list.flatMap(r => r.signs || []))];
  if (signs.length) e.signs = signs; else delete e.signs;
  return e;
}
/* Écart entre le relevé le plus bas et le plus haut de la journée (humeur) */
function dayRange(e) {
  const v = e.slots ? Object.values(e.slots).map(r => r.mood) : [];
  return v.length >= 2 ? Math.max(...v) - Math.min(...v) : 0;
}

/* ---------- étalonnage personnel ----------
   Chacun utilise les échelles à sa façon : quelqu'un qui ne note jamais 3 signale
   déjà quelque chose avec un 1 ; quelqu'un qui note souvent 3 doit s'écarter davantage.
   On apprend donc, sur les 6 derniers mois, le point de repère (médiane) et l'amplitude
   habituelle (écart moyen à la médiane) de chaque curseur, puis on raisonne en écarts.
   Garde-fous : le repère de l'humeur et de l'énergie ne peut pas s'éloigner de plus de 1
   de la neutralité, et l'amplitude est bornée, pour qu'une longue phase basse ou haute
   ne devienne pas « la normale » et ne fasse pas taire les alertes. */
const CAL_MIN = 21, CAL_WINDOW = 180;
let calCache = null;
function median(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function spread(a, c) { return 1.25 * a.reduce((t, v) => t + Math.abs(v - c), 0) / a.length; }
function calibration() {
  if (calCache) return calCache;
  const from = addDays(today(), -(CAL_WINDOW - 1));
  const list = Object.keys(entries).filter(d => d >= from).map(d => entries[d]);
  const c = { on: settings.calibrate, active: false, n: list.length, need: Math.max(0, CAL_MIN - list.length), dims: {} };
  if (c.on && list.length >= CAL_MIN) {
    c.active = true;
    for (const k of ['mood', 'energy']) {
      const v = list.map(e => e[k]), med = median(v);
      c.dims[k] = { center: clamp(med, -1, 1), scale: clamp(spread(v, med), 0.6, 1.5) };
    }
    const sl = list.map(e => e.sleep);
    c.dims.sleep = { center: settings.baseline, scale: clamp(spread(sl, median(sl)), 0.75, 2) };
    for (const x of SYMPTOMS) {
      const v = list.filter(e => e[x.key] !== undefined).map(e => e[x.key]);
      if (v.length < CAL_MIN) continue;
      const med = median(v);
      c.dims[x.key] = { center: Math.min(med, 2), scale: Math.max(0.5, spread(v, med)), mean: v.reduce((a, b) => a + b, 0) / v.length };
    }
  }
  return (calCache = c);
}
function resetCalibration() { calCache = null; }

/* Valeurs « ressenties » une fois ramenées à la façon de noter du patient */
function effMood(e) { const d = calibration().dims.mood; return d ? clamp((e.mood - d.center) / d.scale, -3, 3) : e.mood; }
function effEnergy(e) { const d = calibration().dims.energy; return d ? clamp((e.energy - d.center) / d.scale, -3, 3) : e.energy; }
function sleepScore(e) { const d = calibration().dims.sleep; return clamp((settings.baseline - e.sleep) / (d ? d.scale : 1), -3, 3); }
/* Nuit nettement plus courte / plus longue que d'habitude (2 h, ou 2 « écarts habituels » si étalonné) */
function shortNight(e) { const d = calibration().dims.sleep, gap = settings.baseline - e.sleep; return d ? gap >= 1.5 && gap / d.scale >= 2 : gap >= 2; }
function longNight(e) { const d = calibration().dims.sleep, gap = e.sleep - settings.baseline; return d ? gap >= 1.5 && gap / d.scale >= 2 : gap >= 2; }
/* Symptôme inhabituellement présent pour CE patient */
function symHigh(e, k, strong) {
  const v = sv(e, k), d = calibration().dims[k];
  if (!d) return v >= (strong ? 3 : 2);
  return v >= 1 && (v - d.center) / d.scale >= (strong ? 2.5 : 1.5);
}
function symThreshold(k, strong) { for (let v = 1; v <= 3; v++) if (symHigh({ [k]: v }, k, strong)) return v; return null; }

/* Indice du jour : -3 (bas) .. +3 (haut).
   Dormir moins que d'habitude est l'un des premiers signes de phase haute,
   dormir beaucoup plus accompagne souvent la phase basse. */
function dayIndex(e) {
  return Math.round((0.5 * effMood(e) + 0.3 * effEnergy(e) + 0.2 * sleepScore(e)) * 10) / 10;
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

function signStats(list, pole) {
  const distinct = new Set(); let ticks = 0;
  for (const e of list) for (const id of e.signs || []) {
    const sg = signById(id);
    if (sg && sg.pole === pole) { ticks++; distinct.add(sg.text); }
  }
  return { ticks, distinct };
}
function signById(id) { return settings.signs.find(x => x.id === id); }
function activeSigns() { return settings.signs.filter(x => !x.archived); }

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
      alerts.push({ level: 'crit', pole: 'high', title: `${highStreak} jours d'affilée en zone haute`,
        text: "C'est la durée qui définit un épisode hypomaniaque. En phase haute on se sent souvent très bien, ce qui la rend difficile à repérer soi-même : c'est le bon moment pour appeler votre psychiatre et en parler à un proche.",
        who: ['psy', 'fam'] });
    } else if (highStreak >= 2) {
      alerts.push({ level: 'warn', pole: 'high', title: `${highStreak} jours d'affilée en zone haute`,
        text: 'À surveiller. Protégez votre sommeil (horaires réguliers, pas d\'écrans tard), évitez les grosses décisions et dépenses. Si ça continue 2 jours de plus, contactez votre psychiatre.',
        who: [] });
    }

    const shortNights = recent3.filter(shortNight);
    const energized = recent3.some(e => effEnergy(e) >= 1);
    if (shortNights.length >= 2 && energized) {
      const moodUp = recent3.some(e => effMood(e) >= 1);
      alerts.push({ level: moodUp ? 'crit' : 'warn', pole: 'high', title: 'Moins de sommeil, sans fatigue',
        text: `${shortNights.length} nuits sur 3 nettement sous votre sommeil habituel (${fmtH(base)}), avec une énergie haute. Le besoin de sommeil réduit est l'un des signes précoces les plus fiables d'une phase haute.` + (moodUp ? ' Avec une humeur haute en plus, contactez votre psychiatre.' : ''),
        who: moodUp ? ['psy', 'fam'] : ['psy'] });
    }

    const accelDays = recent3.filter(e => symHigh(e, 'thoughts') || symHigh(e, 'impuls'));
    if (accelDays.length >= 2) {
      const withHigh = accelDays.some(e => dayIndex(e) >= 1 || shortNight(e));
      alerts.push({ level: withHigh ? 'crit' : 'warn', pole: 'high', title: 'Pensées qui accélèrent',
        text: `${accelDays.length} jours sur 3 avec des pensées rapides ou de l'impulsivité inhabituelles pour vous. C'est un signe typique de phase haute, souvent vécu comme agréable.` +
          (withHigh ? ' Avec une humeur haute ou moins de sommeil, appelez votre psychiatre.' : ' Si ça se confirme, parlez-en à votre psychiatre.'),
        who: withHigh ? ['psy', 'fam'] : ['psy'] });
    }
    if (recent3.some(e => symHigh(e, 'impuls', true))) {
      alerts.push({ level: 'warn', pole: 'high', title: 'Impulsivité forte',
        text: 'Règle des 48 h : reportez les grosses dépenses, achats en ligne et décisions importantes. Vous pouvez demander à un proche de garder votre carte bancaire quelques jours.',
        who: ['fam'] });
    }

    const mixedDays = recent3.filter(e => effMood(e) <= -1 &&
      (effEnergy(e) >= 1 || symHigh(e, 'irrit') || symHigh(e, 'anxiety') || symHigh(e, 'thoughts')));
    if (mixedDays.length >= 2) {
      alerts.push({ level: 'crit', pole: 'mixed', title: 'Signes mixtes',
        text: "Humeur basse combinée à de l'agitation, de l'irritabilité, de l'anxiété ou des pensées rapides plusieurs jours de suite. Les états mixtes sont plus à risque : contactez votre psychiatre rapidement et ne restez pas seul·e avec ça.",
        who: ['psy', 'fam'] });
    }

    if (lowStreak >= 14) {
      alerts.push({ level: 'crit', pole: 'low', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'Deux semaines de phase basse correspondent à la durée d\'un épisode dépressif. Prenez rendez-vous avec votre psychiatre et parlez-en à un proche.',
        who: ['psy', 'fam'] });
    } else if (lowStreak >= 7) {
      alerts.push({ level: 'warn', pole: 'low', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'Une semaine en zone basse : c\'est le moment d\'en parler à votre psychiatre, avant que ça s\'installe.',
        who: ['psy'] });
    } else if (lowStreak >= 3) {
      alerts.push({ level: 'warn', pole: 'low', title: `${lowStreak} jours d'affilée en zone basse`,
        text: 'À surveiller. Gardez un rythme régulier (lever, repas, lumière du jour, un peu d\'activité) et restez en lien avec vos proches.',
        who: [] });
    }

    const irritDays = recent7.filter(e => symHigh(e, 'irrit')).length;
    if (irritDays >= 3 && !mixedDays.length) {
      alerts.push({ level: 'warn', title: 'Irritabilité fréquente',
        text: `${irritDays} jours sur les 7 derniers avec une irritabilité inhabituelle pour vous. Elle peut accompagner une phase haute comme une phase basse : notez-le pour votre prochain rendez-vous.`,
        who: [] });
    }
    const anxDays = recent7.filter(e => symHigh(e, 'anxiety')).length;
    if (anxDays >= 4 && !mixedDays.length) {
      alerts.push({ level: 'warn', title: 'Anxiété persistante',
        text: `${anxDays} jours sur les 7 derniers avec une anxiété inhabituelle pour vous. Parlez-en à votre psychiatre : elle peut précéder un changement de phase et se soigne.`,
        who: ['psy'] });
    }

    // Humeur qui fait de grands écarts au sein d'une même journée
    const labile = recent3.filter(e => dayRange(e) >= 3).length;
    if (labile >= 2) {
      alerts.push({ level: mixedDays.length ? 'crit' : 'warn', pole: 'mixed', title: 'Humeur très changeante dans la journée',
        text: `${labile} jours sur 3 avec un écart d'au moins 3 points entre vos relevés d'une même journée. Des variations rapides peuvent accompagner un état mixte : parlez-en à votre psychiatre, notes à l'appui.`,
        who: ['psy'] });
    }

    // Signes d'alerte personnels : ceux que le patient a choisis avec son psychiatre
    for (const [pole, days, label] of [['high', 3, 'phase haute'], ['low', 5, 'phase basse']]) {
      const st = signStats(lastNDays(last, days), pole);
      if (st.ticks >= 3 || st.distinct.size >= 2) {
        const strong = pole === 'high' ? highStreak >= 2 || shortNights.length >= 1 : lowStreak >= 3;
        alerts.push({ level: strong ? 'crit' : 'warn', pole, title: `Vos signes de ${label}`,
          text: `Ces ${days} derniers jours : ${[...st.distinct].join(' · ')}. Ce sont les signes que vous avez repérés comme annonciateurs : ` +
            (strong ? 'avec le reste du suivi, c\'est le moment d\'appeler votre psychiatre.' : 'restez attentif·ve et suivez votre plan.'),
          who: strong ? ['psy', 'fam'] : [] });
      }
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
  const lowest = lastE.slots ? Math.min(...Object.values(lastE.slots).map(r => r.mood)) : lastE.mood;
  const crisis = stale <= 1 && (lowest <= -3 || alerts.some(a => a.title === 'Signes mixtes'));
  return { last, stale, avg, n7: w7.n, slope, phase: phaseOf(avg), dir: directionOf(slope), alerts, crisis };
}

/* ---------- UI : onglets ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showTab(name) {
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + name; });
  document.body.classList.toggle('report-mode', name === 'report');
  try { sessionStorage.setItem('bip.tab', name); } catch (e) {}
  if (name === 'history') renderHistory();
  if (name === 'report') openReport();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------- UI : saisie ---------- */
const F = {
  date: $('#f-date'), mood: $('#f-mood'), energy: $('#f-energy'), sleep: $('#f-sleep'),
  meds: $('#f-meds'), note: $('#f-note'),
};

function updateOutputs() {
  $('#o-mood').textContent = `${fmtNum(+F.mood.value, 0).replace('+0', '0')} · ${MOOD_LABELS[F.mood.value]}`;
  $('#o-energy').textContent = `${fmtNum(+F.energy.value, 0).replace('+0', '0')} · ${ENERGY_LABELS[F.energy.value]}`;
  const diff = +F.sleep.value - settings.baseline;
  $('#o-sleep').textContent = fmtH(+F.sleep.value) + (Math.abs(diff) >= 1 ? ` (${diff > 0 ? '+' : '−'}${fmtH(Math.abs(diff))})` : '');
}
['mood', 'energy', 'sleep'].forEach(k => F[k].addEventListener('input', updateOutputs));

/* Symptômes : 4 boutons (0..3) par ligne, plus rapides qu'un curseur au pouce */
let symVals = {};
function renderSymptomInputs() {
  $('#symptoms').innerHTML = settings.symptoms.map(k => `
    <div class="sym" role="radiogroup" aria-label="${esc(SYM[k].label)}">
      <div class="sym-head"><span class="sym-label">${esc(SYM[k].label)}</span><span class="sym-val" id="sv-${k}"></span></div>
      <div class="chips">${LEVELS.map((l, v) =>
        `<button type="button" role="radio" data-sym="${k}" data-v="${v}" aria-label="${esc(l)}">${v === 0 ? '0' : v}</button>`).join('')}</div>
    </div>`).join('');
  paintSymptoms();
}
function paintSymptoms() {
  for (const k of settings.symptoms) {
    const v = symVals[k] || 0;
    $$(`[data-sym="${k}"]`).forEach(b => b.setAttribute('aria-checked', String(+b.dataset.v === v)));
    const o = $('#sv-' + k); if (o) o.textContent = LEVELS[v];
  }
}
$('#symptoms').addEventListener('click', ev => {
  const b = ev.target.closest('[data-sym]'); if (!b) return;
  symVals[b.dataset.sym] = +b.dataset.v; paintSymptoms();
});

/* Signes personnels : puces à cocher, rien de pré-coché (ce sont des faits du jour) */
let signVals = new Set();
function renderSignInputs() {
  const box = $('#signs-today'), list = activeSigns();
  if (!list.length) {
    box.innerHTML = '<p class="muted small sign-empty">Astuce : ajoutez <a href="#" data-goto="settings">vos propres signes d\'alerte</a>, à cocher en un geste.</p>';
    return;
  }
  box.innerHTML = `<div class="sym-head"><span class="sym-label">Mes signes aujourd'hui</span><span class="sym-val">touchez ceux qui sont là</span></div>
    <div class="sign-chips">${list.map(x => `<button type="button" class="sign-chip ${x.pole}" data-sign="${x.id}" aria-pressed="false">
      <span class="pole" aria-label="${x.pole === 'high' ? 'phase haute' : 'phase basse'}">${x.pole === 'high' ? '↑' : '↓'}</span>${esc(x.text)}</button>`).join('')}</div>`;
  paintSigns();
}
function paintSigns() { $$('[data-sign]').forEach(b => b.setAttribute('aria-pressed', String(signVals.has(b.dataset.sign)))); }
$('#signs-today').addEventListener('click', ev => {
  const b = ev.target.closest('[data-sign]'); if (!b) return;
  const id = b.dataset.sign;
  if (signVals.has(id)) signVals.delete(id); else signVals.add(id);
  paintSigns();
});

/* Moment en cours de saisie (null quand 1 relevé par jour) */
let curSlot = null;
function nowHHMM() { return new Date().toTimeString().slice(0, 5); }
function addMin(hhmm, n) { const [h, m] = hhmm.split(':').map(Number), t = clamp(h * 60 + m + n, 0, 1439); return `${String(t / 60 | 0).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
/* Moment proposé : le premier non noté dont l'heure est (presque) passée, sinon le dernier passé, sinon le premier */
function guessSlot(date) {
  const slots = activeSlots(), e = entries[date] || {}, done = id => e.slots && e.slots[id];
  if (date !== today()) return (slots.find(x => !done(x.id)) || slots[slots.length - 1]).id;
  const now = nowHHMM();
  const due = slots.filter(x => addMin(x.time, -90) <= now);
  return (due.find(x => !done(x.id)) || due[due.length - 1] || slots[0]).id;
}
function renderSlotPicker(date) {
  const box = $('#slot-picker');
  if (settings.slotCount === 1) { box.hidden = true; box.innerHTML = ''; return; }
  const e = entries[date] || {};
  box.hidden = false;
  box.innerHTML = activeSlots().map(x => {
    const done = e.slots && e.slots[x.id];
    return `<button type="button" data-slot="${x.id}" aria-pressed="${x.id === curSlot}">${done ? '✓ ' : ''}${esc(x.label)}</button>`;
  }).join('');
}
$('#slot-picker').addEventListener('click', ev => {
  const b = ev.target.closest('[data-slot]'); if (!b) return;
  fillForm(F.date.value || today(), b.dataset.slot);
});

function fillForm(date, slot) {
  F.date.value = date;
  const e = entries[date];
  curSlot = settings.slotCount === 1 ? null : (slot || guessSlot(date));
  renderSlotPicker(date);
  const own = e && (curSlot ? e.slots && e.slots[curSlot] : e);
  // Pas encore noté : on part du relevé précédent (moment d'avant, ou dernier jour noté)
  let src = own;
  if (!src && e && e.slots) src = e.slots[SLOT_ORDER.filter(id => e.slots[id]).pop()];
  if (!src && e) src = e;
  const prev = Object.keys(entries).filter(d => d < date).sort().pop();
  if (!src) src = prev ? entries[prev] : { mood: 0, energy: 0, meds: false };
  F.mood.value = Math.round(src.mood); F.energy.value = Math.round(src.energy);
  F.sleep.value = e ? e.sleep : (prev ? entries[prev].sleep : settings.baseline);
  symVals = {}; for (const k of settings.symptoms) symVals[k] = Math.round(sv(src, k));
  paintSymptoms();
  signVals = new Set(own && own.signs ? own.signs : []);
  paintSigns();
  F.meds.checked = e ? !!e.meds : !!(prev && entries[prev].meds);
  F.note.value = e ? (e.note || '') : '';
  const label = curSlot ? activeSlots().find(x => x.id === curSlot).label.toLowerCase() : '';
  $('#f-saved').hidden = !own;
  $('#f-submit').textContent = (own ? 'Mettre à jour' : 'Enregistrer') + (label ? ` · ${label}` : '');
  const multi = e && e.slots && Object.keys(e.slots).length > 1;
  $('#f-slot-note').hidden = !(settings.slotCount === 1 && multi);
  F.date.max = today();
  updateOutputs();
}
F.date.addEventListener('change', () => { if (F.date.value) fillForm(F.date.value); });

$('#entry').addEventListener('submit', ev => {
  ev.preventDefault();
  const date = F.date.value;
  if (!date || date > today()) { flash('#f-toast', 'Choisissez un jour passé ou aujourd\'hui.'); return; }
  const old = entries[date] || {};
  const id = curSlot || 'j';
  const oldRec = (old.slots && old.slots[id]) || (!old.slots ? old : {});
  // relevé du moment
  const rec = { mood: +F.mood.value, energy: +F.energy.value, at: nowHHMM() };
  // on garde les symptômes / signes déjà notés à ce moment-là même s'ils ont été désactivés depuis
  for (const x of SYMPTOMS) if (oldRec[x.key] !== undefined) rec[x.key] = oldRec[x.key];
  for (const k of settings.symptoms) rec[k] = symVals[k] || 0;
  const keptSigns = (oldRec.signs || []).filter(sid => { const sg = signById(sid); return !sg || sg.archived; });
  const signs = [...new Set([...keptSigns, ...signVals])];
  if (signs.length) rec.signs = signs;
  // journée : sommeil, traitement et note sont communs ; 1 relevé/jour remplace les relevés multiples
  // 1 relevé/jour : il vaut pour toute la journée. Plusieurs : ils remplacent un éventuel relevé « journée ».
  const slots = settings.slotCount === 1 ? {} : Object.assign({}, old.slots || {});
  delete slots.j;
  slots[id] = rec;
  entries[date] = aggregateDay({ sleep: +F.sleep.value, meds: F.meds.checked, note: F.note.value.trim(), slots });
  const ok = save(KEY_ENTRIES, entries);
  const what = curSlot ? activeSlots().find(x => x.id === curSlot).label : (date === today() ? "aujourd'hui" : fmtShort(date));
  flash('#f-toast', ok ? `Noté : ${what}${curSlot && date !== today() ? ' du ' + fmtShort(date) : ''} ✓` : 'Impossible d\'enregistrer (stockage du navigateur indisponible).');
  fillForm(date, curSlot);
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

/* Une seule carte « Que faire » sous les alertes : plan d'action + contacts, sans répétition */
function actionCard(alerts) {
  const poles = new Set(alerts.map(a => a.pole));
  const high = poles.has('high') || poles.has('mixed'), low = poles.has('low') || poles.has('mixed');
  const who = [...new Set(alerts.flatMap(a => a.who))];
  const crit = alerts.some(a => a.level === 'crit');
  const plans = [];
  if (high && settings.planHigh) plans.push(['Si ça monte', settings.planHigh]);
  if (low && settings.planLow) plans.push(['Si ça descend', settings.planLow]);
  if (!plans.length && !who.length) return '';
  const missing = (high && !settings.planHigh) || (low && !settings.planLow);
  return `<div class="card action ${crit ? 'crit' : ''}"><h3>Que faire</h3>
    ${plans.map(([t, p]) => `<div class="plan"><b>Mon plan · ${t}</b><p>${esc(p).replace(/\n/g, '<br>')}</p></div>`).join('')}
    ${missing ? '<p class="muted small">Vous pouvez écrire <a href="#" data-goto="settings">votre plan d\'action</a> avec votre psychiatre : il s\'affichera ici.</p>' : ''}
    ${contactLinks(who)}</div>`;
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderStatus() {
  resetCalibration();
  renderBackupInfo();
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
        <h3>${al.level === 'crit' ? '⚠️ ' : ''}${esc(al.title)}</h3><p>${esc(al.text)}</p>
      </div>`).join('') + actionCard(a.alerts);
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
$$('[data-range]').forEach(b => b.addEventListener('click', () => {
  range = +b.dataset.range;
  $$('[data-range]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
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

function tickAnchor(x, W) { return x > W - 26 ? 'end' : x < 46 ? 'start' : 'middle'; }

function idxColor(v) { return v >= 1 ? 'var(--high)' : v <= -1 ? 'var(--low)' : 'var(--neutral)'; }

function renderHistory() {
  resetCalibration();
  const c = calibration();
  $('#cal-note').innerHTML = c.active
    ? `Indice ajusté à votre façon de noter (étalonné sur ${c.n} relevés). <a href="#" data-goto="settings">Voir</a>`
    : '';
  const end = today(), start = addDays(end, -(range - 1));
  const days = [];
  for (let i = 0; i < range; i++) days.push(addDays(start, i));
  const any = days.some(d => entries[d]);
  drawMood(days, any);
  drawSleep(days, any);
  drawSymptoms(days, any);
  renderTable();
}

function slotsSummary(e) {
  if (!e.slots || Object.keys(e.slots).length < 2) return '';
  return 'humeur ' + SLOT_ORDER.filter(id => e.slots[id]).map(id => `${SLOT_LABEL[id]} ${fmtNum(e.slots[id].mood, 0).replace('+0', '0')}`).join(' · ');
}
const fmtV = v => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
function signsSummary(e) { return (e.signs || []).map(signById).filter(Boolean).map(g => (g.pole === 'high' ? '↑ ' : '↓ ') + esc(g.text)).join(' · '); }
function symSummary(e) {
  return SYMPTOMS.filter(x => sv(e, x.key) > 0).map(x => symLabel(x.key, e[x.key])).join(' · ');
}

/* Carte de chaleur : une ligne par symptôme (+ signes personnels), une case par jour.
   Une seule teinte, plus foncé = plus fort. */
function heatRows(days) {
  const rows = SYMPTOMS.filter(x => settings.symptoms.includes(x.key) || days.some(d => entries[d] && entries[d][x.key] !== undefined))
    .map(x => ({ label: x.label, val: e => (e[x.key] === undefined ? null : e[x.key]), tip: e => (e[x.key] === undefined ? '—' : lvl(e[x.key])) }));
  const usedSign = pole => days.some(d => entries[d] && (entries[d].signs || []).some(id => { const g = signById(id); return g && g.pole === pole; }));
  for (const [pole, label] of [['high', 'Mes signes ↑'], ['low', 'Mes signes ↓']]) {
    if (!settings.signs.some(x => x.pole === pole && !x.archived) && !usedSign(pole)) continue;
    const ids = e => (e.signs || []).map(signById).filter(g => g && g.pole === pole);
    rows.push({ label, val: e => Math.min(3, ids(e).length), tip: e => ids(e).map(g => esc(g.text)).join(', ') || 'aucun' });
  }
  return rows;
}

function drawSymptoms(days, any, box = $('#chart-symptoms'), card = $('#card-symptoms')) {
  const rows = heatRows(days);
  if (card) card.hidden = !rows.length;
  if (!rows.length) { box.innerHTML = ''; return; }
  if (!any) { box.innerHTML = '<p class="empty">Pas encore de données sur cette période.</p>'; return; }
  const W0 = Math.max(280, Math.round(box.clientWidth || 680)), W = W0;
  const labelW = Math.min(150, Math.round(W0 * 0.32)), rowH = 22;
  box.innerHTML = '';
  const H = rows.length * rowH + 30;
  const svg = el('svg', { viewBox: `0 0 ${W0} ${H}`, role: 'img', 'aria-label': 'Intensité des symptômes par jour' }, box);
  const m = { l: labelW, r: 6, t: 4, b: 24 }, iw = W0 - m.l - m.r, n = days.length, slot = iw / n;
  const x = i => m.l + slot * (i + 0.5);
  const gap = slot > 4 ? 1 : 0;
  const op = [0, 0.28, 0.58, 1];
  rows.forEach((row, r) => {
    const yy = m.t + r * rowH;
    el('text', { x: 0, y: yy + rowH / 2 + 4 }, svg).textContent = row.label.length > 22 && labelW < 150 ? row.label.slice(0, 18) + '…' : row.label;
    el('rect', { x: m.l, y: yy + 2, width: iw, height: rowH - 4, fill: 'var(--grid)', rx: 3 }, svg);
    days.forEach((d, i) => {
      const e = entries[d]; if (!e) return;
      const v = Math.round(row.val(e) || 0); if (!v) return;
      el('rect', { x: m.l + slot * i + gap / 2, y: yy + 2, width: Math.max(1, slot - gap), height: rowH - 4, fill: 'var(--sym)', 'fill-opacity': op[v], rx: Math.min(2, slot / 3) }, svg);
    });
  });
  for (const [i, s] of xTicks(days[0], n, iw + 30)) {
    el('text', { x: x(i), y: H - 6, 'text-anchor': tickAnchor(x(i), W) }, svg).textContent = fmtShort(s);
  }
  attachHover(svg, box, W0, days, x, { l: m.l, t: m.t, b: m.b }, rows.length * rowH, i => {
    const d = days[i], e = entries[d];
    if (!e) return `<b>${fmtLong(d)}</b><br>pas de relevé`;
    return `<b>${fmtLong(d)}</b><br>` + rows.map(row => `${esc(row.label)} : <b>${row.tip(e)}</b>`).join('<br>');
  });
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

function drawMood(days, any, box = $('#chart-mood')) {
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
    el('text', { x: x(i), y: H - 6, 'text-anchor': tickAnchor(x(i), W) }, svg).textContent = fmtShort(s);
  }

  // moyenne glissante 7 jours (au moins 3 jours notés dans la fenêtre)
  const avgs = days.map(d => { const w = avgWindow(d, 7); return w.n >= 3 ? w.avg : null; });
  let path = '', pen = false;
  avgs.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
  });
  el('path', { d: path, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

  // écart dans la journée : trait vertical entre le relevé le plus bas et le plus haut
  const leg = $('#lg-range');
  if (leg && box.id === 'chart-mood') leg.hidden = !days.some(d => entries[d] && dayRange(entries[d]) > 0);
  days.forEach((d, i) => {
    const e = entries[d]; if (!e || !e.slots || Object.keys(e.slots).length < 2) return;
    const v = Object.values(e.slots).map(r => dayIndex(Object.assign({}, r, { sleep: e.sleep })));
    el('line', { x1: x(i), x2: x(i), y1: y(Math.max(...v)), y2: y(Math.min(...v)), stroke: 'var(--neutral)', 'stroke-width': n <= 92 ? 2 : 1, 'stroke-linecap': 'round', 'stroke-opacity': 0.7 }, svg);
  });
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
      `<br>humeur ${MOOD_LABELS[Math.round(e.mood)]} · énergie ${ENERGY_LABELS[Math.round(e.energy)]}<br>sommeil ${fmtH(e.sleep)}` +
      (slotsSummary(e) ? `<br>${slotsSummary(e)}` : '') +
      (symSummary(e) ? `<br>${symSummary(e)}` : '') +
      (signsSummary(e) ? `<br>signes : ${signsSummary(e)}` : '') +
      (e.note ? `<br><i>${esc(e.note)}</i>` : '');
  });
}

function drawSleep(days, any, box = $('#chart-sleep')) {
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
    el('text', { x: x(i), y: H - 6, 'text-anchor': tickAnchor(x(i), W) }, svg).textContent = fmtShort(s);
  }
  const bw = Math.max(1, Math.min(14, slot - 2));
  days.forEach((d, i) => {
    const e = entries[d]; if (!e || e.sleep <= 0) return;
    const h = y(0) - y(e.sleep), rr = Math.min(4, bw / 2, h);
    const x0 = x(i) - bw / 2, y0 = y(e.sleep);
    const fill = shortNight(e) ? 'var(--high)' : longNight(e) ? 'var(--low)' : 'var(--neutral)';
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
    return `<tr><td><button data-edit="${d}" title="Modifier">${fmtShort(d)}</button></td><td>${fmtV(e.mood)}</td><td>${fmtV(e.energy)}</td><td>${fmtH(e.sleep)}</td>
      <td style="color:${idxColor(v)};font-weight:600">${fmtNum(v)}</td><td>${[...SYMPTOMS.filter(x => sv(e, x.key) > 0).map(x => `${x.short} ${fmtV(e[x.key])}`), ...signCounts(e)].join(' · ')}</td><td class="note">${esc(e.note || '')}</td></tr>`;
  }).join('');
}
function signCounts(e) {
  const out = [];
  for (const [pole, arrow] of [['high', '↑'], ['low', '↓']]) {
    const n = (e.signs || []).map(signById).filter(g => g && g.pole === pole).length;
    if (n) out.push(`signes ${arrow}${n}`);
  }
  return out;
}
$('#log').addEventListener('click', ev => {
  const b = ev.target.closest('[data-edit]');
  if (b) { showTab('today'); fillForm(b.dataset.edit); }
});

/* ---------- récapitulatif de consultation ---------- */
function periodDays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

/* Phases prolongées repérées sur la moyenne 7 jours : haute ≥ 4 jours, basse ≥ 7 jours */
function detectEpisodes(days) {
  const res = []; let cur = null;
  for (const d of days) {
    const w = avgWindow(d, 7), v = w.n >= 3 ? w.avg : null;
    const pole = v === null ? null : v >= 1 ? 'high' : v <= -1 ? 'low' : null;
    if (cur && pole === cur.pole) { cur.end = d; cur.peak = pole === 'high' ? Math.max(cur.peak, v) : Math.min(cur.peak, v); continue; }
    if (cur) res.push(cur);
    cur = pole ? { pole, start: d, end: d, peak: v } : null;
  }
  if (cur) res.push(cur);
  return res.map(r => Object.assign(r, { len: diffDays(r.end, r.start) + 1 })).filter(r => r.len >= (r.pole === 'high' ? 4 : 7));
}

function openReport() {
  const t = today();
  const prev = settings.consults.filter(d => d < t).pop();
  if (!$('#r-from').value) $('#r-from').value = prev || addDays(t, -89);
  if (!$('#r-to').value) $('#r-to').value = t;
  $('#r-name').value = settings.reportName;
  renderReport();
}
['#r-from', '#r-to'].forEach(id => $(id).addEventListener('change', renderReport));
$('#r-name').addEventListener('change', ev => { settings.reportName = ev.target.value.trim(); saveSettings(); renderReport(); });
$('#open-report').addEventListener('click', () => showTab('report'));
$('#r-print').addEventListener('click', () => window.print());
$('#r-consult').addEventListener('click', () => {
  const t = today();
  if (!settings.consults.includes(t)) settings.consults.push(t);
  settings.consults.sort(); saveSettings();
  flash('#r-toast', 'Consultation du ' + fmtShort(t) + ' notée : le prochain récapitulatif partira de cette date ✓');
});
$('#r-share').addEventListener('click', () => {
  // Fichier autonome : on recopie les styles de la page (sans le thème sombre) et le contenu du récap.
  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) {
        if (r.conditionText && /prefers-color-scheme|print/.test(r.conditionText)) continue;
        if (r.selectorText && /data-theme="dark"/.test(r.selectorText)) continue;
        css += r.cssText + '\n';
      }
    } catch (e) {}
  }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(reportTitle())}</title><style>${css} body{background:#fff} main{padding:16px}</style></head>
<body class="report-mode"><main>${$('#report-body').innerHTML}</main></body></html>`;
  saveFile(`bip-recapitulatif-${$('#r-from').value}-${$('#r-to').value}.html`, html, 'text/html');
});
function reportTitle() { return 'Suivi de l\'humeur' + (settings.reportName ? ' – ' + settings.reportName : ''); }

function renderReport() {
  resetCalibration();
  let from = $('#r-from').value, to = $('#r-to').value || today();
  if (!from || from > to) from = addDays(to, -89);
  const days = periodDays(from, to), list = days.filter(d => entries[d]), es = list.map(d => entries[d]);
  const body = $('#report-body');
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + ' %';
  const head = `<header class="rp-head"><h1>${esc(reportTitle())}</h1>
    <p>Du <b>${fmtLong(from)}</b> au <b>${fmtLong(to)}</b> · document généré le ${fmtShort(today())} ${fromStr(today()).getFullYear()} avec Bip</p></header>`;
  if (!es.length) { body.innerHTML = head + '<p class="empty">Aucun relevé sur cette période.</p>'; return; }

  const idx = es.map(dayIndex);
  const hi = idx.filter(v => v >= 1).length, lo = idx.filter(v => v <= -1).length;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sleepAvg = avg(es.map(e => e.sleep));
  const shortN = es.filter(shortNight).length, longN = es.filter(longNight).length;
  const medsN = es.filter(e => e.meds).length;
  const eps = detectEpisodes(days);
  const stat = (label, value, sub = '') => `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

  const symRows = SYMPTOMS.filter(x => es.some(e => e[x.key] !== undefined)).map(x => {
    const v = es.filter(e => e[x.key] !== undefined);
    return `<tr><td>${esc(x.label)}</td><td>${v.length}</td><td>${v.filter(e => e[x.key] >= 1).length}</td><td>${v.filter(e => e[x.key] >= 2).length}</td>
      <td>${v.filter(e => symHigh(e, x.key)).length}</td><td>${avg(v.map(e => e[x.key])).toFixed(1).replace('.', ',')}</td></tr>`;
  }).join('');
  const signRows = settings.signs.map(g => ({ g, n: es.filter(e => (e.signs || []).includes(g.id)).length })).filter(r => r.n)
    .sort((a, b) => b.n - a.n).map(r => `<tr><td>${r.g.pole === 'high' ? '↑ haute' : '↓ basse'}</td><td>${esc(r.g.text)}</td><td>${r.n}</td></tr>`).join('');
  const notes = list.filter(d => entries[d].note).map(d => `<li><b>${fmtShort(d)}</b> ${esc(entries[d].note)}</li>`).join('');
  const a = to === today() ? analyze() : null;
  const cal = calibration();

  body.innerHTML = head + `
    <section class="rp-sec"><div class="rp-grid">
      ${stat('Relevés', `${es.length} / ${days.length} j`, pct(es.length, days.length) + ' des jours')}
      ${stat('Indice moyen', fmtNum(avg(idx)), `de ${fmtNum(Math.min(...idx))} à ${fmtNum(Math.max(...idx))}`)}
      ${stat('Jours en zone haute', hi, pct(hi, es.length) + ' des relevés')}
      ${stat('Jours en zone basse', lo, pct(lo, es.length) + ' des relevés')}
      ${stat('Sommeil moyen', fmtH(Math.round(sleepAvg * 10) / 10), `habituel ${fmtH(settings.baseline)}`)}
      ${stat('Nuits courtes / longues', `${shortN} / ${longN}`, 'nettement sous / au-dessus de l\'habitude')}
      ${stat('Traitement coché', pct(medsN, es.length), 'des jours notés')}
      ${es.some(e => e.slots && Object.keys(e.slots).length > 1) ? stat('Écart dans la journée', fmtNum(avg(es.filter(e => e.slots && Object.keys(e.slots).length > 1).map(dayRange))).replace('+', ''), `moyen · ${es.filter(e => dayRange(e) >= 3).length} jour(s) ≥ 3 points`) : ''}
      ${a ? stat('Aujourd\'hui', a.phase.label, a.dir.label) : ''}
    </div></section>

    <section class="rp-sec"><h2>Phases repérées</h2>
      ${eps.length ? `<ul class="rp-list">${eps.map(r => `<li><span class="sign-pole ${r.pole}">${r.pole === 'high' ? '↑ haute' : '↓ basse'}</span>
        du <b>${fmtShort(r.start)}</b> au <b>${fmtShort(r.end)}</b> (${r.len} j) · pic de la moyenne 7 j : ${fmtNum(r.peak)}</li>`).join('')}</ul>
        <p class="muted small">Repérées sur la moyenne des 7 derniers jours (haute : au moins 4 jours ≥ +1 ; basse : au moins 7 jours ≤ −1). Les dates sont approximatives, de quelques jours.</p>`
        : '<p class="small">Aucune phase haute ou basse prolongée sur la période.</p>'}
      ${a && a.alerts.length ? `<p class="small"><b>Alertes en cours :</b> ${a.alerts.map(x => esc(x.title)).join(' · ')}</p>` : ''}
    </section>

    <section class="rp-sec"><h2>Indice d'humeur</h2>
      <p class="legend"><span class="lg lg-dot"></span>jour <span class="lg lg-line"></span>moyenne 7 jours <span class="lg lg-high"></span>zone haute <span class="lg lg-low"></span>zone basse${es.some(e => dayRange(e) > 0) ? ' <span class="lg lg-range"></span>écart dans la journée' : ''}</p>
      <div class="chart" id="rp-mood"></div></section>
    <section class="rp-sec"><h2>Sommeil (heures)</h2>
      <p class="legend"><span class="lg lg-bar"></span>nuit <span class="lg lg-high"></span>courte <span class="lg lg-low"></span>longue <span class="lg lg-base"></span>sommeil habituel</p>
      <div class="chart" id="rp-sleep"></div></section>
    <section class="rp-sec" id="rp-sym-sec"><h2>Symptômes et signes</h2>
      <p class="legend"><span class="lg lg-s1"></span>un peu <span class="lg lg-s2"></span>nettement <span class="lg lg-s3"></span>beaucoup</p>
      <div class="chart" id="rp-sym"></div>
      ${symRows ? `<table class="rp-table"><thead><tr><th>Symptôme</th><th>Jours notés</th><th>≥ un peu</th><th>≥ nettement</th><th>Inhabituel*</th><th>Moyenne /3</th></tr></thead><tbody>${symRows}</tbody></table>
        <p class="muted small">* Inhabituel au regard de la façon de noter du patient${cal.active ? '' : ' (étalonnage pas encore actif : seuil « nettement »)'}.</p>` : ''}
    </section>
    ${signRows ? `<section class="rp-sec"><h2>Signes d'alerte personnels</h2><table class="rp-table"><thead><tr><th>Phase</th><th>Signe</th><th>Jours</th></tr></thead><tbody>${signRows}</tbody></table></section>` : ''}
    ${settings.planHigh || settings.planLow ? `<section class="rp-sec"><h2>Plan d'action</h2>
      ${settings.planHigh ? `<p class="small"><b>Phase haute :</b> ${esc(settings.planHigh).replace(/\n/g, '<br>')}</p>` : ''}
      ${settings.planLow ? `<p class="small"><b>Phase basse :</b> ${esc(settings.planLow).replace(/\n/g, '<br>')}</p>` : ''}</section>` : ''}
    ${notes ? `<section class="rp-sec"><h2>Notes</h2><ul class="rp-notes">${notes}</ul></section>` : ''}
    <footer class="rp-foot">
      Auto-évaluation ${settings.slotCount > 1 ? `${settings.slotCount} fois par jour (humeur et énergie : moyenne des relevés ; symptômes : maximum de la journée)` : 'quotidienne'} : humeur et énergie de −3 à +3, sommeil en heures, symptômes de 0 à 3.
      Indice du jour = 50 % humeur + 30 % énergie + 20 % écart de sommeil${cal.active ? `, ajustés à la façon de noter du patient (repère et amplitude habituels, étalonnés sur ${cal.n} relevés des 6 derniers mois)` : ''}.
      Zone haute ≥ +1, zone basse ≤ −1. Inspiré de la NIMH Life Chart Method et de l'étude MONARCA.
      Outil de suivi personnel, pas un outil de diagnostic.
    </footer>`;
  drawMood(days, true, $('#rp-mood'));
  drawSleep(days, true, $('#rp-sleep'));
  drawSymptoms(days, true, $('#rp-sym'), $('#rp-sym-sec'));
}

/* ---------- UI : réglages ---------- */
const S = {
  baseline: $('#s-baseline'), psyName: $('#s-psy-name'), psyTel: $('#s-psy-tel'),
  famName: $('#s-fam-name'), famTel: $('#s-fam-tel'), remind: $('#s-remind'),
};
function fillSettings() {
  S.baseline.value = settings.baseline;
  S.psyName.value = settings.psyName; S.psyTel.value = settings.psyTel;
  S.famName.value = settings.famName; S.famTel.value = settings.famTel;
  S.remind.checked = settings.remind;
  renderSlotSettings(settings.slotCount);
  renderCalCard(); renderSignsCard();
  $('#s-symptoms').innerHTML = SYMPTOMS.map(x => `
    <label class="check sym-opt"><input type="checkbox" value="${x.key}" ${settings.symptoms.includes(x.key) ? 'checked' : ''}>
      <span><b>${esc(x.label)}</b>${x.def ? ' <span class="pill">conseillé</span>' : ''}<br><span class="muted">${esc(x.hint)}</span></span></label>`).join('');
}
function renderSlotSettings(count) {
  $$('[data-slotcount]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.slotcount === count)));
  $('#s-slot-times').innerHTML = SLOT_SETS[count].map(x => `
    <label class="slot-time"><span>${esc(x.label)}</span>
      <span class="inline">rappel à <input type="time" data-key="${count}${x.id}" value="${settings.slotTimes[count + x.id] || x.time}"></span></label>`).join('');
}
$('#s-slot-count').addEventListener('click', ev => {
  const b = ev.target.closest('[data-slotcount]'); if (b) renderSlotSettings(+b.dataset.slotcount);
});

function refreshAll() {
  resetCalibration();
  fillSettings(); renderSymptomInputs(); renderSignInputs(); fillForm(F.date.value || today()); renderStatus();
}
function saveSettings() { save(KEY_SETTINGS, settings); resetCalibration(); }

/* ---------- réglages : ma façon de noter (étalonnage) ---------- */
function renderCalCard() {
  resetCalibration();
  const c = calibration(), box = $('#cal-detail');
  $('#s-calibrate').checked = c.on;
  if (!c.on) { box.innerHTML = '<p class="muted small">Désactivé : les notes sont prises telles quelles, avec la même échelle pour tout le monde.</p>'; return; }
  if (!c.active) {
    box.innerHTML = `<p class="small">L'ajustement démarre après ${CAL_MIN} relevés sur les 6 derniers mois <b>(encore ${c.need})</b>. D'ici là, les notes sont prises telles quelles.</p>`;
    return;
  }
  const f = v => fmtNum(v).replace(',0', '');
  const dm = c.dims.mood, de = c.dims.energy, ds = c.dims.sleep;
  const rows = [
    ['Humeur', `repère ${f(dm.center)}`, `un +1 compte pour ${f((1 - dm.center) / dm.scale)}, un −1 pour ${f((-1 - dm.center) / dm.scale)}`],
    ['Énergie', `repère ${f(de.center)}`, `un +1 compte pour ${f((1 - de.center) / de.scale)}, un −1 pour ${f((-1 - de.center) / de.scale)}`],
    ['Sommeil', `vos nuits varient d'environ ±${(ds.scale / 1.25).toFixed(1).replace('.', ',')} h`, `1 h de moins compte pour ${f(1 / ds.scale)} ; nuit « courte » à partir de −${fmtH(Math.max(1.5, Math.ceil(2 * ds.scale * 2) / 2))}`],
  ];
  for (const x of SYMPTOMS) {
    const d = c.dims[x.key]; if (!d) continue;
    const thr = symThreshold(x.key);
    rows.push([x.label, `en moyenne ${d.mean.toFixed(1).replace('.', ',')} / 3`,
      thr ? `signal à partir de ${thr} (${LEVELS[thr]})` + (thr === 1 ? ' : vous le notez rarement, un 1 compte déjà' : '')
          : 'aucun niveau ne ressort : vous le notez souvent au maximum'].concat(d.mean >= 1.5 ? ['⚠︎ très présent au quotidien : à évoquer en consultation'] : []));
  }
  box.innerHTML = `<p class="small">Étalonné sur <b>${c.n} relevés</b> (6 derniers mois).</p>
    <table class="cal-table"><tbody>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}<br><span class="muted">${esc(r[2])}</span>${r[3] ? `<br><span class="warn-txt">${esc(r[3])}</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
}
$('#s-calibrate').addEventListener('change', ev => {
  settings.calibrate = ev.target.checked; saveSettings(); renderCalCard(); renderStatus();
});

/* ---------- réglages : mes signes d'alerte + plan ---------- */
function newId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function addSign(text, pole) {
  text = text.trim().slice(0, 80); if (!text) return;
  const same = settings.signs.find(x => x.text.toLowerCase() === text.toLowerCase() && x.pole === pole);
  if (same) same.archived = false; else settings.signs.push({ id: newId(), text, pole, archived: false });
  saveSettings(); renderSignsCard(); renderSignInputs(); paintSigns();
}
function renderSignsCard() {
  const list = activeSigns();
  $('#signs-list').innerHTML = list.length ? list.map(x => `
    <li><span class="sign-pole ${x.pole}">${x.pole === 'high' ? '↑ haute' : '↓ basse'}</span><span class="sign-text">${esc(x.text)}</span>
      <button type="button" class="x" data-del-sign="${x.id}" aria-label="Retirer">✕</button></li>`).join('')
    : '<li class="muted small">Aucun signe pour l\'instant. Choisissez dans les suggestions ou écrivez les vôtres.</li>';
  const have = new Set(list.map(x => x.pole + x.text.toLowerCase()));
  $('#signs-suggest').innerHTML = SUGGESTED_SIGNS.filter(([p, t]) => !have.has(p + t.toLowerCase()))
    .map(([p, t]) => `<button type="button" class="suggest ${p}" data-add-sign="${p}">${p === 'high' ? '↑' : '↓'} ${esc(t)}</button>`).join('');
  $('#s-plan-high').value = settings.planHigh; $('#s-plan-low').value = settings.planLow;
}
$('#signs-card').addEventListener('click', ev => {
  const del = ev.target.closest('[data-del-sign]');
  if (del) {
    const sg = signById(del.dataset.delSign);
    if (sg) sg.archived = true;   // gardé pour que l'historique reste lisible
    saveSettings(); renderSignsCard(); renderSignInputs();
  }
  const sug = ev.target.closest('[data-add-sign]');
  if (sug) addSign(sug.textContent.replace(/^[↑↓]\s*/, ''), sug.dataset.addSign);
});
$('#sign-add').addEventListener('submit', ev => {
  ev.preventDefault();
  addSign($('#sign-text').value, $('#sign-pole').value);
  $('#sign-text').value = '';
});
for (const [id, key] of [['#s-plan-high', 'planHigh'], ['#s-plan-low', 'planLow']]) {
  $(id).addEventListener('change', ev => { settings[key] = ev.target.value.slice(0, 1000); saveSettings(); flash('#signs-toast', 'Plan enregistré ✓'); renderStatus(); });
}

$('#settings').addEventListener('submit', async ev => {
  ev.preventDefault();
  settings = Object.assign({}, settings, {
    baseline: clamp(parseFloat(S.baseline.value) || DEFAULT_SETTINGS.baseline, 4, 12),
    psyName: S.psyName.value.trim(), psyTel: S.psyTel.value.trim(),
    famName: S.famName.value.trim(), famTel: S.famTel.value.trim(),
    remind: S.remind.checked,
    slotCount: +($('[data-slotcount][aria-pressed="true"]') || { dataset: { slotcount: 1 } }).dataset.slotcount,
    slotTimes: Object.assign({}, settings.slotTimes, Object.fromEntries($$('#s-slot-times input').filter(i => i.value).map(i => [i.dataset.key, i.value]))),
    symptoms: $$('#s-symptoms input:checked').map(i => i.value),
  });
  if (settings.remind && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  save(KEY_SETTINGS, settings);
  refreshAll();
  flash('#s-toast', 'Réglages enregistrés ✓');
});

/* ---------- données : export / import / démo ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* Sur mobile : menu Partager du système (Enregistrer dans Fichiers, Drive, mail…).
   Ailleurs, ou si le partage de fichiers n'existe pas : téléchargement classique. */
async function saveFile(name, text, type) {
  if ((isIOS || isAndroid) && navigator.canShare) {
    const file = new File([text], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  download(name, text, type);
  return true;
}

const KEY_BACKUP = 'bip.lastBackup.v1';
function lastBackup() { return load(KEY_BACKUP, null); }
function renderBackupInfo() {
  const lb = lastBackup(), n = Object.keys(entries).length;
  $('#d-last').innerHTML = `${n} relevé${n > 1 ? 's' : ''} sur cet appareil · dernière sauvegarde : <b>${lb ? (lb === today() ? "aujourd'hui" : fmtShort(lb) + ` (il y a ${diffDays(today(), lb)} j)`) : 'jamais'}</b>`;
  const nudge = $('#backup-nudge');
  const due = !DEMO && n >= 14 && (!lb || diffDays(today(), lb) > 30);
  nudge.innerHTML = due ? `<div class="card backup"><p class="small" style="margin:0">💾 ${lb ? `Dernière sauvegarde il y a ${diffDays(today(), lb)} jours.` : 'Vous n\'avez jamais sauvegardé vos relevés.'} Si le téléphone est perdu ou le navigateur vidé, ils seraient perdus.</p>
    <button type="button" data-backup>Sauvegarder maintenant</button></div>` : '';
}

async function exportBackup() {
  const payload = { app: 'bip', version: 1, exportedAt: new Date().toISOString(), settings, entries };
  const ok = await saveFile(`bip-sauvegarde-${today()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  if (ok) { save(KEY_BACKUP, today()); renderBackupInfo(); flash('#s-toast', 'Sauvegarde créée ✓'); }
}
$('#d-export').addEventListener('click', exportBackup);
document.addEventListener('click', ev => { if (ev.target.closest('[data-backup]')) exportBackup(); });

$('#d-csv').addEventListener('click', () => {
  const rows = [['date', 'humeur', 'energie', 'sommeil_h', ...SYMPTOMS.map(x => x.key), 'signes_haute', 'signes_basse', 'traitement_pris', 'indice', 'moyenne_7j', 'note']];
  for (const d of Object.keys(entries).sort()) {
    const e = entries[d], w = avgWindow(d, 7);
    rows.push([d, e.mood, e.energy, e.sleep, ...SYMPTOMS.map(x => e[x.key] === undefined ? '' : e[x.key]),
      ...['high', 'low'].map(p => (e.signs || []).map(signById).filter(g => g && g.pole === p).map(g => g.text).join(' / ')), e.meds ? 'oui' : 'non', dayIndex(e), w.n >= 3 ? w.avg.toFixed(2) : '', e.note || '']);
  }
  const csv = rows.map(r => r.map(c => /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\n');
  saveFile(`bip-humeur-${today()}.csv`, '﻿' + csv, 'text/csv');
});

/* Vérifie et nettoie un relevé venant d'un fichier ; null s'il est inutilisable */
function cleanRecord(e) {
  if (!e || typeof e !== 'object') return null;
  const num = v => (typeof v === 'number' && isFinite(v) ? v : NaN);
  const mood = num(e.mood), energy = num(e.energy);
  if (isNaN(mood) || isNaN(energy)) return null;
  const out = { mood: clamp(round1(mood), -3, 3), energy: clamp(round1(energy), -3, 3) };
  for (const x of SYMPTOMS) if (!isNaN(num(e[x.key]))) out[x.key] = clamp(round1(e[x.key]), 0, 3);
  if (Array.isArray(e.signs)) {
    const signs = e.signs.filter(id => typeof id === 'string').map(id => id.slice(0, 40)).slice(0, 30);
    if (signs.length) out.signs = signs;
  }
  if (typeof e.at === 'string' && /^\d{2}:\d{2}$/.test(e.at)) out.at = e.at;
  return out;
}
/* Vérifie et nettoie un relevé venant d'un fichier ; null s'il est inutilisable */
function cleanEntry(e) {
  const base = cleanRecord(e);
  const sleep = e && typeof e.sleep === 'number' && isFinite(e.sleep) ? e.sleep : NaN;
  if (!base || isNaN(sleep)) return null;
  const out = Object.assign(base, { sleep: clamp(Math.round(sleep * 2) / 2, 0, 14), meds: !!e.meds, note: typeof e.note === 'string' ? e.note.slice(0, 280) : '' });
  delete out.at;
  if (e.slots && typeof e.slots === 'object') {
    const slots = {};
    for (const id of SLOT_ORDER) { const r = cleanRecord(e.slots[id]); if (r) slots[id] = r; }
    if (Object.keys(slots).length) { out.slots = slots; aggregateDay(out); }
  }
  return out;
}

let pendingImport = null;
$('#d-import').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = '';
  if (!file) return;
  const panel = $('#d-import-panel');
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.entries !== 'object') throw new Error('format');
    const clean = {}; let bad = 0;
    for (const [d, e] of Object.entries(data.entries)) {
      const c = /^\d{4}-\d{2}-\d{2}$/.test(d) ? cleanEntry(e) : null;
      if (c) clean[d] = c; else bad++;
    }
    const dates = Object.keys(clean).sort();
    if (!dates.length) throw new Error('vide');
    const dup = dates.filter(d => entries[d]).length;
    pendingImport = { entries: clean, settings: data.settings && typeof data.settings === 'object' ? data.settings : null };
    panel.innerHTML = `
      <p class="small"><b>${esc(file.name)}</b><br>${dates.length} relevé${dates.length > 1 ? 's' : ''} du ${fmtShort(dates[0])} ${fromStr(dates[0]).getFullYear()} au ${fmtShort(dates[dates.length - 1])} ${fromStr(dates[dates.length - 1]).getFullYear()}` +
      (bad ? ` · ${bad} ligne(s) illisible(s) ignorée(s)` : '') + `.<br>Sur cet appareil : ${Object.keys(entries).length} relevé(s)` + (dup ? `, dont ${dup} jour(s) aussi présents dans le fichier.` : '.') + `</p>
      <div class="btns">
        <button type="button" class="primary-sm" data-imp="merge">Fusionner</button>
        <button type="button" data-imp="replace">Remplacer tout</button>
        <button type="button" data-imp="cancel">Annuler</button>
      </div>
      <p class="muted small"><b>Fusionner</b> ajoute les jours du fichier à ceux de l'appareil (pour un jour présent des deux côtés, le fichier l'emporte) et garde vos réglages actuels. <b>Remplacer tout</b> efface l'appareil et reprend exactement la sauvegarde, réglages compris.</p>`;
    panel.hidden = false;
  } catch (e) {
    pendingImport = null;
    panel.innerHTML = '<p class="small">Ce fichier n\'est pas une sauvegarde Bip lisible.</p><div class="btns"><button type="button" data-imp="cancel">OK</button></div>';
    panel.hidden = false;
  }
});
$('#d-import-panel').addEventListener('click', ev => {
  const b = ev.target.closest('[data-imp]'); if (!b) return;
  const panel = $('#d-import-panel');
  if (b.dataset.imp !== 'cancel' && pendingImport) {
    const n = Object.keys(pendingImport.entries).length;
    if (b.dataset.imp === 'replace') {
      if (!confirm(`Effacer les ${Object.keys(entries).length} relevé(s) de cet appareil et les remplacer par la sauvegarde ?`)) return;
      entries = pendingImport.entries;
      if (pendingImport.settings) settings = normSettings(pendingImport.settings);
    } else {
      Object.assign(entries, pendingImport.entries);
      // garder le texte des signes personnels référencés par les relevés importés
      if (pendingImport.settings) {
        for (const g of normSettings(pendingImport.settings).signs) if (!signById(g.id)) settings.signs.push(Object.assign({}, g, { archived: true }));
      }
    }
    save(KEY_ENTRIES, entries); save(KEY_SETTINGS, settings);
    resetCalibration(); fillSettings(); renderSymptomInputs(); renderSignInputs(); fillForm(today()); renderStatus();
    flash('#s-toast', `${n} relevé(s) importé(s) ✓`);
  }
  pendingImport = null; panel.hidden = true; panel.innerHTML = '';
});
$('#d-wipe').addEventListener('click', () => {
  if (!confirm('Effacer définitivement tous vos relevés sur cet appareil ?\n\nSi vous n\'avez pas de sauvegarde, annulez et touchez d\'abord « Sauvegarder ».')) return;
  entries = {}; save(KEY_ENTRIES, entries); fillForm(today()); renderStatus();
});
/* Un an fictif, profil type 2 : épisodes dépressifs longs, hypomanies courtes,
   un passage mixte, des oublis, et une hypomanie qui démarre ces derniers jours. */
function demoYear() {
  const out = {}, end = today();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // from/to : jours avant aujourd'hui. Valeurs = intensité au pic.
  const EPISODES = [
    { from: 330, to: 292, mood: -2, energy: -2, sleep: 2, anxiety: 2, irrit: 1, focus: 2 },
    { from: 232, to: 222, mood: 2, energy: 2.4, sleep: -2.8, thoughts: 2.6, impuls: 2, irrit: 1.4 },
    { from: 222, to: 206, mood: -1.2, energy: -1, sleep: 1, anxiety: 1 },
    { from: 168, to: 158, mood: -1.6, energy: 1.4, sleep: -1.5, irrit: 2.6, anxiety: 2.6, thoughts: 2 },
    { from: 158, to: 108, mood: -1.9, energy: -1.8, sleep: 1.8, anxiety: 1.8, focus: 2.2, irrit: 0.8 },
    { from: 75, to: 66, mood: 0.8, energy: 1, sleep: -1, thoughts: 1, stress: 2 },
    { from: 9, to: -6, mood: 2.6, energy: 2.8, sleep: -3.2, thoughts: 3, impuls: 2.6, irrit: 1.6 },
  ];
  const sgn = { high: ['dh1', 'dh2', 'dh3'], low: ['dl1', 'dl2', 'dl3'] };
  const NOTES = { 320: 'Fatigue, envie de rien', 300: 'Reprise du sport', 229: 'Nuit blanche à coder, super idée', 226: 'Gros achat en ligne',
    165: 'Tendu, dispute avec la famille', 140: 'Arrêt de travail', 112: 'Ça va mieux', 72: 'Déménagement', 40: 'Vacances',
    5: 'Plein de projets en tête', 2: 'Dormi 4 h, en pleine forme', 1: 'Proche trouve que je parle vite' };
  for (let i = 364; i >= 0; i--) {
    const lvl = { mood: 0, energy: 0, sleep: 0, irrit: 0, anxiety: 0, thoughts: 0, impuls: 0, focus: 0, stress: 0 };
    let inLow = false;
    for (const ep of EPISODES) {
      if (i > ep.from || i < ep.to) continue;
      const t = (ep.from - i) / (ep.from - ep.to);
      const w = Math.sin(Math.PI * Math.min(1, t));          // montée puis descente
      const k = ep.to < 0 ? Math.min(1, t * 1.8) : w;         // épisode en cours : pas encore de descente
      for (const key in lvl) if (ep[key]) lvl[key] += ep[key] * k;
      if (ep.mood < 0) inLow = true;
    }
    if (rnd() < (inLow ? 0.16 : 0.06) && i > 3) continue;     // oublis, plus fréquents en phase basse
    const d = addDays(end, -i), wd = fromStr(d).getDay();
    const noise = a => (rnd() - 0.5) * a;
    const weekend = wd === 0 || wd === 6 ? 0.6 : 0;
    const lv = (k, a = 1.5) => clamp(Math.round(lvl[k] + noise(a)), -3, 3);
    const sym = (k, a = 0.8) => clamp(Math.round(Math.max(0, lvl[k] + noise(a) - 0.1)), 0, 3);
    out[d] = {
      mood: lv('mood'), energy: lv('energy'),
      sleep: clamp(Math.round((7.5 + lvl.sleep + weekend + noise(1.4)) * 2) / 2, 2.5, 12),
      irrit: sym('irrit'), anxiety: sym('anxiety'), thoughts: sym('thoughts'), impuls: sym('impuls'),
      focus: sym('focus'), stress: sym('stress'),
      meds: rnd() > (inLow ? 0.2 : 0.06), note: NOTES[i] || '',
    };
    // signes personnels cochés quand l'épisode est bien là
    const signs = [];
    for (const id of sgn.high) if (lvl.mood + lvl.energy > 1.6 && rnd() < 0.55) signs.push(id);
    for (const id of sgn.low) if (lvl.mood < -0.9 && rnd() < 0.5) signs.push(id);
    if (signs.length) out[d].signs = signs;
    // 6 dernières semaines : 3 relevés par jour, avec des journées plus chahutées pendant l'hypomanie
    if (i < 42) {
      const swing = 0.6 + Math.max(0, lvl.mood) * 0.5 + (lvl.irrit > 1 ? 0.8 : 0);
      const slots = {};
      ['m', 'a', 's'].forEach((id, k) => {
        const r = Object.assign({}, out[d], { at: ['12:40', '18:10', '22:05'][k] });
        delete r.sleep; delete r.meds; delete r.note; delete r.slots;
        r.mood = clamp(Math.round(out[d].mood + (k - 1) * 0.4 * swing + noise(swing * 1.4)), -3, 3);
        r.energy = clamp(Math.round(out[d].energy + noise(swing)), -3, 3);
        if (k !== 1) for (const x of SYMPTOMS) if (r[x.key] !== undefined) r[x.key] = clamp(Math.round(r[x.key] - rnd() * 0.8), 0, 3);
        if (k !== 2) delete r.signs;
        slots[id] = r;
      });
      out[d].slots = slots; aggregateDay(out[d]);
    }
  }
  return out;
}

/* ---------- rappels (tant que l'app est ouverte ou en arrière-plan) ---------- */
async function notify(title, body, slot) {
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'bip-' + slot, data: { slot } };
  try {
    const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch (e) {}
  try {
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); openSlot(slot); n.close(); };
  } catch (e) {}
}
function openSlot(slot) {
  showTab('today');
  fillForm(today(), settings.slotCount > 1 ? slot : undefined);
}
function checkReminders() {
  if (DEMO || !settings.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = nowHHMM(), d = today(), e = entries[d] || {};
  let sent = {}; try { sent = JSON.parse(localStorage.getItem('bip.reminded.v2') || '{}'); } catch (err) {}
  if (sent.date !== d) sent = { date: d, slots: [] };
  for (const x of activeSlots()) {
    const done = settings.slotCount === 1 ? !!entries[d] : !!(e.slots && e.slots[x.id]);
    // dans les 3 h qui suivent l'heure du rappel, une seule fois, et seulement si pas encore noté
    if (done || sent.slots.includes(x.id) || now < x.time || now > addMin(x.time, 180)) continue;
    notify('Bip', x.ask + ' 5 secondes pour le noter.', x.id);
    sent.slots.push(x.id);
  }
  try { localStorage.setItem('bip.reminded.v2', JSON.stringify(sent)); } catch (err) {}
}
setInterval(checkReminders, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
// clic sur une notification affichée par le service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.slot) openSlot(ev.data.slot); });
}

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (!$('#tab-history').hidden) renderHistory(); }, 150);
});

/* ---------- installation (iOS / Android) ---------- */
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let deferredPrompt = null;

function installDismissed() { try { return localStorage.getItem('bip.installDismissed') === '1'; } catch (e) { return false; } }
function renderInstall() {
  const box = $('#install'), state = $('#install-state');
  if (isStandalone) {
    box.hidden = true;
    state.innerHTML = '<p class="ok">✓ Bip est installée sur cet appareil.</p>';
    return;
  }
  let body = '';
  if (deferredPrompt) {
    body = `<p class="small">Ajoutez Bip à votre écran d'accueil : elle s'ouvre comme une app, fonctionne hors connexion, et vos données restent sur le téléphone.</p>
      <button type="button" class="primary" data-install>Installer l'app</button>`;
  } else if (isIOS) {
    body = `<p class="small">Pour l'avoir comme une app : dans <b>Safari</b>, touchez <b>Partager</b> <span class="share-ic" aria-hidden="true">⬆︎</span> puis <b>« Sur l'écran d'accueil »</b>.</p>
      <p class="muted small">Faites-le avant de commencer : sur iPhone, l'app installée garde ses propres données, séparées de Safari. Installée, elle protège aussi vos données de l'effacement automatique de Safari.</p>`;
  } else if (isAndroid) {
    body = `<p class="small">Pour l'avoir comme une app : dans Chrome, touchez <b>⋮</b> puis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>`;
  }
  state.innerHTML = deferredPrompt ? '<button type="button" data-install>Installer l\'app</button>' : '';
  box.hidden = !body || installDismissed();
  box.innerHTML = `<div class="install-head"><h2>📲 Installer Bip</h2><button type="button" class="x" data-dismiss aria-label="Masquer">✕</button></div>${body}`;
}
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); deferredPrompt = ev; renderInstall(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#install').hidden = true; });
document.addEventListener('click', async ev => {
  if (ev.target.closest('[data-install]') && deferredPrompt) {
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) {}
    deferredPrompt = null; renderInstall();
  }
  if (ev.target.closest('[data-dismiss]')) {
    try { localStorage.setItem('bip.installDismissed', '1'); } catch (e) {}
    $('#install').hidden = true;
  }
});

/* Demande au navigateur de ne pas effacer les données en cas de manque de place */
async function askPersist() {
  const p = $('#d-persist');
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    const ok = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    p.textContent = ok ? 'Stockage protégé : le navigateur ne l\'effacera pas automatiquement.' : '';
  } catch (e) {}
}

/* ---------- démarrage ---------- */
if (DEMO) {
  settings.symptoms = ['irrit', 'anxiety', 'thoughts', 'impuls', 'focus', 'stress'];
  settings.slotCount = 3;
  settings.signs = [
    { id: 'dh1', text: 'Je fais plein de projets ou de listes', pole: 'high' },
    { id: 'dh2', text: 'Je dépense plus que d\'habitude', pole: 'high' },
    { id: 'dh3', text: 'J\'envoie beaucoup de messages', pole: 'high' },
    { id: 'dl1', text: 'Je m\'isole, j\'annule des sorties', pole: 'low' },
    { id: 'dl2', text: 'Je reste au lit plus longtemps', pole: 'low' },
    { id: 'dl3', text: 'Je néglige les repas ou la toilette', pole: 'low' },
  ];
  settings.planHigh = 'Coucher 23 h sans écran. Pas d\'achat de plus de 50 € avant 48 h. J\'appelle le Dr Martin et je préviens Léa.';
  settings.planLow = 'Lever 8 h quoi qu\'il arrive, 20 min de marche dehors, un appel à un proche par jour. Rendez-vous avec le Dr Martin.';
  settings.consults = [addDays(today(), -91)];
  settings.reportName = 'Démo';
  entries = demoYear();
  document.title = 'Bip – démo';
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.innerHTML = '<b>Mode démo</b> · 1 an de données fictives, rien n\'est enregistré. <a href="./">Retour à mon suivi</a>';
  document.body.prepend(bar);
  $('#d-wipe').hidden = true; $('#d-import').closest('label').hidden = true;
}
renderSymptomInputs();
renderSignInputs();
if (!DEMO) renderInstall();
askPersist();
fillSettings();
const slotParam = new URLSearchParams(location.search).get('slot');
fillForm(today(), slotParam && SLOT_SETS[settings.slotCount].some(x => x.id === slotParam) ? slotParam : undefined);
renderStatus();
let startTab = 'today';
if (!slotParam) { try { startTab = sessionStorage.getItem('bip.tab') || 'today'; } catch (e) {} }
if (DEMO) { $('[data-range="365"]').click(); startTab = 'history'; }
showTab(startTab);
window.addEventListener('focus', () => { if (F.date.max !== today()) { fillForm(today()); renderStatus(); } checkReminders(); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
