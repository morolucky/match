// Reusable input widgets (RTL-friendly). Every factory returns { el, set(value) } so the panel
// can push state back into the widget after undo/redo/preset changes.

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
export { h };

const fmtVal = (v, c) => c.fmt === 'pct' ? Math.round(v * 100) + '%' : (+v).toFixed(c.step < 0.1 ? 2 : c.step < 1 ? 1 : 0);

function row(c, ...kids) { return h('div', { class: 'ctl', 'data-k': c.k, 'data-label': c.label || '' }, c.label ? h('label', { class: 'ctl-l' }, c.label) : null, h('div', { class: 'ctl-w' }, ...kids)); }

/** slider + numeric field; live preview on input, commit on change */
export function range(c, onCommit) {
  const sl = h('input', { type: 'range', min: c.min, max: c.max, step: c.step });
  const num = h('input', { type: 'number', min: c.min, max: c.max, step: c.step, class: 'num' });
  const out = h('span', { class: 'unit' }, c.fmt === 'pct' ? '' : c.unit || '');
  const show = (v) => { sl.value = v; num.value = c.fmt === 'pct' ? Math.round(v * 100) : (+v).toFixed(c.step < 0.1 ? 2 : c.step < 1 ? 1 : 0); };
  if (c.fmt === 'pct') { num.min = c.min * 100; num.max = c.max * 100; num.step = c.step * 100; out.textContent = '%'; }
  sl.oninput = () => show(+sl.value);
  sl.onchange = () => onCommit(+sl.value);
  num.onchange = () => { let v = +num.value; if (c.fmt === 'pct') v /= 100; v = Math.min(c.max, Math.max(c.min, v)); show(v); onCommit(v); };
  sl.ondblclick = () => { if (c.def != null) { show(c.def); onCommit(c.def); } };
  return { el: row(c, sl, h('span', { class: 'numw' }, num, out)), set: show };
}

export function stepper(c, onCommit) {
  const val = h('output', { class: 'step-v' }); let v = 0;
  const go = (d) => { const n = Math.min(c.max, Math.max(c.min, v + d)); if (n !== v) onCommit(n); };
  const el = row(c, h('div', { class: 'stepper' }, h('button', { type: 'button', onclick: () => go(-1), title: 'إنقاص' }, '−'), val, h('button', { type: 'button', onclick: () => go(1), title: 'زيادة' }, '+')));
  return { el, set: (x) => { v = x; val.textContent = x; } };
}

/** segmented buttons (radio group) */
export function seg(c, onCommit) {
  const btns = c.opts.map(([v, l]) => h('button', { type: 'button', class: 'seg-b', 'data-v': String(v), onclick: () => onCommit(v) }, l));
  return { el: row(c, h('div', { class: 'seg', role: 'radiogroup' }, btns)), set: (x) => btns.forEach((b) => b.classList.toggle('on', b.dataset.v === String(x))) };
}

export function select(c, onCommit) {
  const s = h('select', { onchange: () => onCommit(c.opts.find(([v]) => String(v) === s.value)[0]) }, c.opts.map(([v, l]) => h('option', { value: v }, l)));
  return { el: row(c, s), set: (x) => { s.value = x; } };
}

/** on/off switch */
export function toggle(c, onCommit) {
  const i = h('input', { type: 'checkbox', role: 'switch', onchange: () => onCommit(i.checked) });
  return { el: row(c, h('label', { class: 'switch' }, i, h('span', { class: 'knob' }))), set: (x) => { i.checked = !!x; } };
}

/** palette swatches + free colour picker */
export function color(c, onCommit) {
  const pick = h('input', { type: 'color', class: 'pick', title: 'لون مخصص', oninput: () => onCommit(pick.value, true), onchange: () => onCommit(pick.value) });
  const sw = (c.sw || []).map((col) => h('button', { type: 'button', class: 'sw', style: `background:${col}`, title: col, 'data-c': col, onclick: () => onCommit(col) }));
  return { el: row(c, h('div', { class: 'swatches' }, sw, pick)), set: (x) => { pick.value = x; sw.forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === String(x).toLowerCase())); } };
}

/** multi-toggle chips bound to an object of booleans */
export function chips(c, onCommit) {
  let cur = {};
  const bs = c.opts.map(([k, l]) => h('button', { type: 'button', class: 'chip', 'data-k': k, onclick: () => onCommit({ ...cur, [k]: !cur[k] }) }, l));
  return { el: row(c, h('div', { class: 'chips' }, bs)), set: (o) => { cur = { ...o }; bs.forEach((b) => b.classList.toggle('on', !!cur[b.dataset.k])); } };
}

/** picture cards (types, patterns) */
export function cards(c, items, onCommit) {
  const bs = items.map((it) => h('button', { type: 'button', class: 'card', 'data-v': it.v, title: it.title || '', onclick: () => onCommit(it.v) }, it.img ? h('span', { class: 'card-i' }) : null, h('b', {}, it.label), it.sub ? h('small', {}, it.sub) : null));
  bs.forEach((b, i) => { const im = b.querySelector('.card-i'); if (im) { if (items[i].img.startsWith('<svg')) im.innerHTML = items[i].img; else im.style.backgroundImage = `url(${items[i].img})`; } });
  return { el: row(c, h('div', { class: 'cards ' + (c.cls || '') }, bs)), set: (x) => bs.forEach((b) => b.classList.toggle('on', b.dataset.v === String(x))) };
}

export { fmtVal };
