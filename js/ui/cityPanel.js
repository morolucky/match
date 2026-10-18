// «المدينة» tab: OSM import around the Grande Poste, manual performance toggles
// (Lumina GI / DLSS / LOD are OFF by default) and the numbered-sector list.
import { $ } from '../core/dom.js';
import { ll } from '../scene/scene.js';
import { S } from '../core/state.js';
import { later } from '../app/build.js';
import { drs } from '../app/loop.js';
import { GRANDE_POSTE, fetchElevation, importCity } from '../city/osm.js';
import { CITY, applyCityData, cityRelight, flyToSector, refetchSector, setLOD, setLabelsVisible, setSectorHidden } from '../city/mode.js';

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

export function initCityPanel() {
  const root = $('city'); if (!root) return;
  const saved = JSON.parse(localStorage.getItem('city-import-v1') || '{}');
  const lat = h('input', { type: 'number', step: '0.0001', value: saved.lat ?? GRANDE_POSTE.lat, style: 'width:90px' });
  const lon = h('input', { type: 'number', step: '0.0001', value: saved.lon ?? GRANDE_POSTE.lon, style: 'width:90px' });
  const rad = h('input', { type: 'range', min: 150, max: 700, step: 25, value: saved.radius ?? 400 });
  const radOut = h('span', {}, String(saved.radius ?? 400));
  rad.oninput = () => { radOut.textContent = rad.value; };
  const demOn = h('input', { type: 'checkbox', checked: '' });
  const status = h('div', { style: 'font-size:11px;white-space:pre-line;opacity:.9;margin:6px 0;min-height:28px' }, 'المركز الافتراضي: البريد المركزي (Grande Poste).');
  const say = (m) => { status.textContent = m; };

  const btn = h('button', { style: 'width:100%' }, '⬇ بناء مدينة الجزائر (طرق + مبانٍ + تضاريس)');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const la = +lat.value, lo = +lon.value, R = +rad.value;
      localStorage.setItem('city-import-v1', JSON.stringify({ lat: la, lon: lo, radius: R }));
      const data = await importCity(la, lo, R, say);
      say(`وصلت البيانات: ${data.buildings.length} مبنى · ${data.roads.length} طريق.`);
      let dem = null;
      if (demOn.checked) { try { dem = await fetchElevation(data.origin, R, say); } catch (e) { say('تعذّر جلب الارتفاعات، سيُبنى على أرض مستوية: ' + e.message); } }
      applyCityData(data, dem);
      S.mode = 'city'; document.body.dataset.mode = 'city';
      later();
      say(`تم الاستيراد: ${data.buildings.length} مبنى · ${data.roads.length} طريق · ${CITY.sectors.size} قطاع` + (dem ? ` · تضاريس ${dem.n}×${dem.n}` : ' · بدون تضاريس'));
    } catch (e) { say('❌ ' + (e && e.message || e)); } finally { btn.disabled = false; }
  };

  // manual performance toggles — everything OFF until the user enables it
  const tgl = (label, onChange) => {
    const i = h('input', { type: 'checkbox' }); i.onchange = () => onChange(i.checked);
    return { row: h('div', { class: 'r' }, h('label', {}, label), i), i };
  };
  const giT = tgl('Lumina GI (يدوي)', (on) => { CITY.flags.gi = on; if (S.mode === 'city') cityRelight(); });
  const dlT = tgl('DLSS ديناميكي (يدوي)', (on) => { CITY.flags.dlssAuto = on; drs.on = on; if (!on) ll.setDlss(1); if ($('dl')) $('dl').value = on ? 'auto' : '1'; });
  const lodT = tgl('LOD للمسافات (يدوي)', (on) => setLOD(on));
  const lblT = tgl('إظهار أرقام القطاعات', (on) => setLabelsVisible(on)); lblT.i.checked = true; CITY.flags.labels = true;

  const list = h('div', { style: 'max-height:260px;overflow:auto;border:1px solid var(--b);border-radius:6px;padding:4px;margin-top:4px' });
  CITY.onSectors = () => {
    list.replaceChildren();
    const secs = [...CITY.sectors.values()].sort((a, b) => a.id - b.id);
    if (!secs.length) { list.append('لا قطاعات بعد — استورد المدينة أولاً.'); return; }
    for (const sec of secs) {
      const eye = h('button', { title: 'إخفاء / إظهار' }, sec.hidden ? '🚫' : '👁');
      eye.onclick = () => { setSectorHidden(sec.id, !sec.hidden); eye.textContent = sec.hidden ? '🚫' : '👁'; };
      const go = h('button', { title: 'انتقال بالكاميرا' }, '🎯'); go.onclick = () => flyToSector(sec.id);
      const fix = h('button', { title: 'إعادة جلب هذا القطاع من OSM وتصحيحه' }, '🔄');
      fix.onclick = async () => { fix.disabled = true; try { await refetchSector(sec.id, say); CITY.onSectors(); } catch (e) { say('❌ ' + e.message); } finally { fix.disabled = false; } };
      list.append(h('div', { class: 'r', style: 'justify-content:space-between' },
        h('span', { style: 'flex:1' }, `قطاع ${sec.id} — ${sec.buildings.length} مبنى / ${sec.roads.length} طريق`), go, fix, eye));
    }
  };

  root.append(
    h('h4', {}, 'استيراد من OpenStreetMap'),
    h('div', { class: 'r' }, h('label', {}, 'خط العرض'), lat),
    h('div', { class: 'r' }, h('label', {}, 'خط الطول'), lon),
    h('div', { class: 'r' }, h('label', {}, 'نصف القطر (م)'), rad, radOut),
    h('div', { class: 'r' }, h('label', {}, 'تضاريس DEM'), demOn),
    btn, status,
    h('h4', {}, 'الأداء — تفعيل يدوي فقط'),
    giT.row, dlT.row, lodT.row,
    h('h4', {}, 'القطاعات المرقّمة (للتصحيح)'),
    lblT.row, list,
    h('p', { style: 'font-size:10px;opacity:.65;margin:6px 0 0' }, 'البيانات: © OpenStreetMap contributors (ODbL) · الارتفاعات: Copernicus GLO-90 عبر Open-Meteo.'),
  );
  CITY.onSectors();
}
