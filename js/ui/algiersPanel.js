import { h, range, stepper, seg, select, toggle, color, chips, cards } from './controls.js';
import { GROUPS, LOOK_KEYS, PBR_KEYS, CROWNS, BALS, DEFAULTS } from '../algiers/schema.js';
import { ROLES } from '../pbr/roles.js';
import { MATS } from '../pbr/labGen.js';
import { applyPBR, rescalePBR, roleMaps } from '../pbr/manager.js';
import { TYPES, typeIcon, programFor } from '../algiers/types.js';
import { design } from '../algiers/design.js';
import { IRON, ironPreview } from '../algiers/textures.js';
import { applyLook } from '../algiers/materials.js';
import { later } from '../app/build.js';
import { S } from '../core/state.js';
import { ll } from '../scene/scene.js';

// Algiers designer panel, generated from algiers/schema.js. Widgets commit to the design
// store; the store subscription re-syncs widgets and decides between a cheap recolour and a
// full rebuild.

const IRON_NAMES = { classic: 'كلاسيكي', nouveau: 'آرت نوفو', deco: 'آرت ديكو', moorish: 'موريسكي', bars: 'قضبان', grille: 'شبكة' };
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];

export function initAlgiersPanel(root = document.getElementById('alg')) {
  const W = {}, st = () => design.state; let prog = null, pt = 0;

  const commit = (k, v, live = false) => {
    const p = { [k]: v };
    if (k === 'type') Object.assign(p, TYPES[v].patch, { programAuto: true, program: programFor(v, TYPES[v].patch.floors) });
    if (k === 'floors' && st().programAuto) p.program = programFor(st().type, v);
    if (k === 'floors' && !st().programAuto) { const pr = st().program.slice(0, v - 1); while (pr.length < v - 1) pr.splice(Math.max(0, pr.length - 1), 0, { ...(pr[Math.max(0, pr.length - 2)] || { bal: 'single', crown: 'flat' }) }); p.program = pr; }
    design.set(p, { history: !live });
  };

  // ---- toolbar
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => { const f = fileIn.files[0]; if (!f) return; try { design.replace({ ...DEFAULTS, ...JSON.parse(await f.text()) }); } catch (e) { alert('ملف غير صالح: ' + e.message); } fileIn.value = ''; } });
  const tb = h('div', { class: 'toolbar' },
    h('button', { type: 'button', title: 'تراجع (Ctrl+Z)', onclick: () => design.undo() }, '↶'),
    h('button', { type: 'button', title: 'إعادة (Ctrl+Y)', onclick: () => design.redo() }, '↷'),
    h('button', { type: 'button', title: 'تنويع داخل نفس النوع', onclick: vary }, '🎲 تنويع'),
    h('button', { type: 'button', title: 'مبنى عشوائي كلياً', onclick: randomAll }, '🎰'),
    h('button', { type: 'button', title: 'حفظ التصميم JSON', onclick: saveJSON }, '💾'),
    h('button', { type: 'button', title: 'فتح تصميم JSON', onclick: () => fileIn.click() }, '📂'),
    h('button', { type: 'button', title: 'إعادة النوع الحالي لقيمه الأصلية', onclick: () => commit('type', st().type) }, '⟲'), fileIn);
  const search = h('input', { type: 'search', class: 'search', placeholder: '🔎 ابحث عن خاصية… (مثال: قبة، شرفة)', oninput: filter });
  root.append(tb, search);

  // ---- groups
  for (const g of GROUPS) {
    const body = h('div', { class: 'grp-b' });
    const det = h('details', { class: 'grp', 'data-g': g.id, open: g.open || false }, h('summary', {}, h('span', { class: 'gi' }, g.icon), g.title), body);
    for (const c of g.controls) {
      const on = (v, live) => commit(c.k, v, live);
      let w;
      if (c.t === 'range') w = range({ ...c, def: DEFAULTS[c.k] }, on);
      else if (c.t === 'stepper') w = stepper(c, on);
      else if (c.t === 'seg') w = seg(c, on);
      else if (c.t === 'select') w = select(c, on);
      else if (c.t === 'toggle') w = toggle(c, on);
      else if (c.t === 'color') w = color(c, on);
      else if (c.t === 'chips') w = chips(c, (o) => commit(c.k, o));
      else if (c.t === 'pbrRoles') w = pbrCtl(c);
      else if (c.t === 'types') w = cards({ ...c, cls: 'types' }, Object.entries(TYPES).map(([v, t]) => ({ v, label: t.name, sub: t.where, img: typeIcon(v) })), on);
      else if (c.t === 'iron') w = cards({ ...c, cls: 'iron' }, IRON.map((v) => ({ v, label: IRON_NAMES[v], img: ironPreview(v, '#888') })), on);
      else if (c.t === 'seed') w = seedCtl(c, on);
      else if (c.t === 'program') w = programCtl(c);
      if (!w) continue;
      w.c = c; W[c.k] = w; body.append(w.el);
    }
    root.append(det);
  }
  root.append(h('div', { class: 'kbd' }, 'اختصارات: Ctrl+Z تراجع · Ctrl+Y إعادة · نقرة مزدوجة على المنزلق = القيمة الافتراضية'));

  function seedCtl(c, on) {
    const n = h('input', { type: 'number', min: 1, max: 99999, class: 'num', onchange: () => on(Math.max(1, +n.value | 0)) });
    const el = h('div', { class: 'ctl', 'data-k': c.k, 'data-label': c.label }, h('label', { class: 'ctl-l' }, c.label), h('div', { class: 'ctl-w' }, n, h('button', { type: 'button', class: 'dice', title: 'بذرة جديدة', onclick: () => on(1 + Math.floor(Math.random() * 9999)) }, '🎲')));
    return { el, set: (v) => { n.value = v; } };
  }

  // PBR roles: material preset per role, progress bar, per-role map export
  function pbrCtl(c) {
    prog = h('div', { class: 'pbar', hidden: true }, h('i'), h('span'));
    const rows = Object.entries(ROLES).map(([role, r]) => {
      const sel = h('select', { onchange: () => design.set({ pbrMats: { ...st().pbrMats, [role]: sel.value } }) }, r.opts.map((k) => h('option', { value: k }, MATS[k].label)));
      const dl = h('button', { type: 'button', class: 'dl', title: 'تنزيل خرائط Albedo / Normal / ORM', onclick: () => exportRole(role) }, '⬇');
      return { role, sel, el: h('div', { class: 'pbr-r' }, h('label', {}, r.label), sel, dl) };
    });
    const el = h('div', { class: 'ctl ctl-col', 'data-k': c.k, 'data-label': 'خامات PBR مواد الخرسانة الحجر الأسفلت الخشب المعدن' }, h('div', { class: 'pbr' }, rows.map((r) => r.el)), prog, h('div', { class: 'hint' }, 'الخرائط تُولَّد بمولّد Facade Bake Lab (Albedo + Normal + Roughness + AO) وتتكرر بلا فواصل.'));
    return { el, set: () => rows.forEach((r) => { r.sel.value = st().pbrMats[r.role] || ROLES[r.role].def; }) };
  }
  function exportRole(role) {
    const m = roleMaps(role); if (!m) { alert('الخامة لم تُولَّد بعد.'); return; }
    for (const [n, cv] of [['albedo', m.albedo], ['normal', m.normal], ['orm', m.orm]]) cv.toBlob((b) => { const a = h('a', { href: URL.createObjectURL(b), download: `${role}_${st().pbrMats[role]}_${n}.png` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  }
  function regenPBR(delay = 250) {
    clearTimeout(pt); pt = setTimeout(async () => {
      const bar = prog; const upd = (p, label) => { if (!bar) return; bar.hidden = p >= 1; bar.firstChild.style.width = Math.round(p * 100) + '%'; bar.lastChild.textContent = label ? `توليد ${label}… ${Math.round(p * 100)}%` : ''; };
      const done = await applyPBR(st(), upd); if (done !== false || !st().pbrOn) ll.taa.reset(); upd(1, '');
    }, delay);
  }

  // floor-by-floor programme: balcony type + window crown for each upper floor
  function programCtl(c) {
    const box = h('div', { class: 'prog' });
    const el = h('div', { class: 'ctl ctl-col', 'data-k': c.k, 'data-label': c.label + ' طابق شرفة تاج' }, h('label', { class: 'ctl-l' }, c.label), box);
    const set = () => {
      const s = st(), pr = s.program.slice(0, s.floors - 1); box.textContent = '';
      box.append(h('div', { class: 'prog-h' }, h('span', {}, s.programAuto ? '⚙️ تلقائي حسب النوع' : '✍️ مخصّص'), s.programAuto ? null : h('button', { type: 'button', onclick: () => design.set({ programAuto: true, program: programFor(s.type, s.floors) }) }, '↺ تلقائي')));
      for (let i = pr.length - 1; i >= 0; i--) {
        const f = pr[i], edit = (patch) => { const p = s.program.map((x) => ({ ...x })); p[i] = { ...p[i], ...patch }; design.set({ program: p, programAuto: false }); };
        box.append(h('div', { class: 'prog-r' }, h('span', { class: 'prog-n' }, `ط ${i + 1}`),
          h('div', { class: 'seg mini' }, BALS.map(([v, l, t]) => h('button', { type: 'button', class: 'seg-b' + (f.bal === v ? ' on' : ''), title: t, onclick: () => edit({ bal: v }) }, l))),
          h('select', { onchange: (e) => edit({ crown: e.target.value }) }, CROWNS.map(([v, l]) => h('option', { value: v, selected: f.crown === v }, l)))));
      }
      box.append(h('div', { class: 'prog-r prog-g' }, h('span', { class: 'prog-n' }, 'أرضي'), h('span', {}, { arcade: 'أروقة بأقواس', shops: 'محلات تجارية', plain: 'واجهة بسيطة' }[s.ground])));
    };
    return { el, set };
  }

  function sync() {
    const s = st();
    for (const k in W) { const w = W[k]; w.set(k === 'program' ? null : s[k]); if (w.c.when) w.el.hidden = !w.c.when(s); }
    for (const b of root.querySelectorAll('.iron .card')) b.querySelector('.card-i').style.backgroundImage = `url(${ironPreview(b.dataset.v, s.ironColor)})`;
  }

  function filter() {
    const q = search.value.trim();
    for (const det of root.querySelectorAll('.grp')) {
      let any = false;
      for (const c of det.querySelectorAll('.ctl')) { const m = !q || (c.dataset.label || '').includes(q) || det.querySelector('summary').textContent.includes(q); c.classList.toggle('filtered', !m); any = any || m; }
      det.hidden = !any; if (q && any) det.open = true;
    }
  }

  function vary() {
    const R = Math.random, s = st();
    design.set({ seed: 1 + Math.floor(R() * 9999), shutterOpen: Math.round(R() * 20) / 20, awnings: Math.round(R() * 10) / 20, weather: Math.round((0.15 + R() * 0.6) * 20) / 20,
      shutterColor: pick(GROUPS.find((g) => g.id === 'color').controls.find((c) => c.k === 'shutterColor').sw), W: Math.round((s.W * (0.85 + R() * 0.3)) * 2) / 2, floors: s.floors, program: s.program });
  }
  function randomAll() {
    const R = Math.random, type = pick(Object.keys(TYPES)), floors = 4 + Math.floor(R() * 5), t = TYPES[type].patch;
    design.set({ ...t, type, floors, program: programFor(type, floors), programAuto: true, seed: 1 + Math.floor(R() * 9999),
      corner: pick(['sharp', 'chamfer', 'round']), cornerSize: 2 + Math.round(R() * 30) / 10, arch: pick(['round', 'seg', 'basket', 'horse']), iron: pick(IRON),
      dome: R() < 0.4 ? pick(['imperial', 'hemi', 'onion']) : 'none', consoles: pick(['simple', 'scroll', 'heavy']), ornament: Math.round(R() * 20) / 20 });
  }
  function saveJSON() {
    const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(st(), null, 2)], { type: 'application/json' })), download: `alger-${st().type}-${st().seed}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); design.undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); design.redo(); }
  });

  design.subscribe((patch) => {
    sync(); W.program && W.program.set();
    const keys = Object.keys(patch), geo = keys.filter((k) => !LOOK_KEYS.has(k) && !PBR_KEYS.has(k));
    if (keys.some((k) => LOOK_KEYS.has(k))) { applyLook(st()); ll.taa.reset(); }
    if (keys.includes('weather') || keys.some((k) => PBR_KEYS.has(k) && k !== 'pbrScale')) regenPBR();
    else if (keys.includes('pbrScale')) { rescalePBR(st()); ll.taa.reset(); }
    if (geo.length && S.mode === 'alg') later();
  });
  sync(); W.program && W.program.set();
  return { regenPBR };
}
