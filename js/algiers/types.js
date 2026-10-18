// Catalogue of Algiers (El Djazaïr) building types. Each type = a state patch over DEFAULTS
// plus a floor-program rule (balcony + window crown for every upper floor).

const P = (bal, crown) => ({ bal, crown });

export const TYPES = {
  haussmann: {
    name: 'هوسماني بأروقة', where: 'شارع العربي بن مهيدي · زيغود يوسف',
    patch: { W: 26, D: 18, floors: 6, gh: 4.8, fh: 3.3, bay: 3.3, corner: 'chamfer', cornerSize: 3.2, sides: 'corner', ground: 'arcade', arch: 'round', pillar: 'square', rustic: true, surround: 2, shutter: 'persienne', iron: 'classic', consoles: 'scroll', ornament: 0.6, cornice: 'modillion', strings: true, pilasters: false, quoins: false, zellige: false, roof: 'terrace', parapet: 'balustrade', dome: 'none', mouch: false, wallColor: '#f4f1ea', shutterColor: '#2f6aa8', awnings: 0.25 },
    program: (n) => Array.from({ length: n }, (_, i) => i === 0 ? P('cont', 'seg') : i === n - 1 && n > 2 ? P('cont', 'flat') : P('single', i === 1 ? 'cornice' : 'flat')),
  },
  rotonde: {
    name: 'عمارة الزاوية المستديرة', where: 'ساحة أودان · شارع حسيبة',
    patch: { W: 24, D: 20, floors: 7, gh: 5.0, fh: 3.25, bay: 3.1, corner: 'round', cornerSize: 4.5, sides: 'corner', ground: 'arcade', arch: 'basket', pillar: 'square', rustic: true, surround: 2, shutter: 'persienne', iron: 'classic', consoles: 'heavy', ornament: 0.7, cornice: 'dentil', strings: true, pilasters: false, quoins: false, zellige: false, roof: 'terrace', parapet: 'iron', dome: 'imperial', domeColor: '#8e979c', mouch: false, wallColor: '#f2eee6', shutterColor: '#2a5f9a', awnings: 0.45 },
    program: (n) => Array.from({ length: n }, (_, i) => i === 0 ? P('cont', 'segarch') : i === n - 1 ? P('cont', 'flat') : P('single', i % 2 ? 'arch' : 'flat')),
  },
  artdeco: {
    name: 'آرت ديكو (الثلاثينات)', where: 'ديدوش مراد · تيليملي',
    patch: { W: 22, D: 16, floors: 7, gh: 4.2, fh: 3.05, bay: 3.4, corner: 'round', cornerSize: 3.4, sides: 'corner', ground: 'shops', arch: 'flat', archShops: false, surround: 1, shutter: 'roller', iron: 'deco', consoles: 'none', ornament: 0.2, cornice: 'simple', strings: true, pilasters: false, quoins: false, zellige: false, roof: 'attic', parapet: 'iron', dome: 'none', mouch: false, wallColor: '#ffffff', shutterColor: '#f2f2ee', ironColor: '#1c1e21', balDepth: 1.1, awnings: 0.2 },
    program: (n) => Array.from({ length: n }, () => P('cont', 'flat')),
  },
  moorish: {
    name: 'نيو-موريسكي', where: 'البريد المركزي · دار عزيزة',
    patch: { W: 24, D: 18, floors: 5, gh: 5.4, fh: 3.6, bay: 3.2, corner: 'chamfer', cornerSize: 3.0, sides: 'corner', ground: 'arcade', arch: 'horse', pillar: 'round', rustic: false, surround: 2, shutter: 'persienne', iron: 'moorish', consoles: 'simple', ornament: 0.8, cornice: 'simple', strings: true, pilasters: false, quoins: false, zellige: true, roof: 'terrace', parapet: 'crenel', dome: 'onion', domeColor: '#2f6d5f', mouch: true, wallColor: '#ffffff', shutterColor: '#2f6b4f', awnings: 0.05 },
    program: (n) => Array.from({ length: n }, (_, i) => i === 0 ? P('cont', 'horse') : i === n - 1 ? P('none', 'pointed') : P(i % 2 ? 'single' : 'none', i % 2 ? 'horse' : 'pointed')),
  },
  baroque: {
    name: 'باروكي مزخرف (أواخر ق19)', where: 'شارع بن بولعيد · العربي التبسي',
    patch: { W: 18, D: 14, floors: 6, gh: 4.6, fh: 3.4, bay: 3.0, corner: 'sharp', cornerSize: 2, sides: 'corner', ground: 'shops', arch: 'seg', archShops: true, surround: 3, shutter: 'persienne', iron: 'nouveau', consoles: 'heavy', ornament: 0.95, cornice: 'modillion', strings: true, pilasters: true, quoins: true, zellige: false, roof: 'mansard', mh: 3.2, dormers: true, parapet: 'none', dome: 'none', mouch: false, wallColor: '#efe8dc', trimColor: '#e8dfcd', shutterColor: '#3b3b3b', awnings: 0.1 },
    program: (n) => Array.from({ length: n }, (_, i) => i === 0 ? P('cont', 'seg') : i === n - 1 ? P('cont', 'flat') : P('single', i === 1 ? 'tri' : 'cornice')),
  },
  seafront: {
    name: 'واجهة البحر', where: 'شارع زيغود يوسف · الأميرالية',
    patch: { W: 60, D: 16, floors: 6, gh: 5.2, fh: 3.3, bay: 3.6, corner: 'round', cornerSize: 2.5, sides: 'front', ground: 'arcade', arch: 'round', pillar: 'square', rustic: true, surround: 2, shutter: 'persienne', iron: 'classic', consoles: 'scroll', ornament: 0.5, cornice: 'modillion', strings: true, pilasters: true, quoins: false, zellige: false, roof: 'terrace', parapet: 'balustrade', dome: 'none', mouch: false, wallColor: '#ffffff', shutterColor: '#2f6aa8', awnings: 0.35 },
    program: (n) => Array.from({ length: n }, (_, i) => i === 0 || i === n - 1 ? P('cont', i ? 'flat' : 'segarch') : P('single', 'flat')),
  },
  popular: {
    name: 'عمارة شعبية', where: 'باب الواد · بلكور',
    patch: { W: 14, D: 12, floors: 5, gh: 3.8, fh: 3.0, bay: 2.9, corner: 'sharp', cornerSize: 1, sides: 'corner', ground: 'shops', arch: 'flat', archShops: false, surround: 1, shutter: 'persienne', iron: 'grille', consoles: 'simple', ornament: 0.15, cornice: 'simple', strings: false, pilasters: false, quoins: false, zellige: false, roof: 'terrace', parapet: 'solid', dome: 'none', mouch: false, wallColor: '#efe4cf', shutterColor: '#4c86c6', awnings: 0.4, weather: 0.7 },
    program: (n) => Array.from({ length: n }, () => P('single', 'flat')),
  },
};

export function programFor(type, floors) { return (TYPES[type] || TYPES.haussmann).program(Math.max(0, floors - 1)); }

/** small SVG façade icon derived from the type's own parameters */
export function typeIcon(id) {
  const p = TYPES[id].patch, n = Math.min(p.floors, 8), W = 64, H = 64, fl = 40 / n, x0 = 8, x1 = 56;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect x="${x0}" y="${60 - n * fl}" width="${x1 - x0}" height="${n * fl}" rx="${p.corner === 'round' ? 6 : 1}" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="1.2"/>`;
  const top = 60 - n * fl;
  if (p.roof === 'mansard') s += `<path d="M${x0} ${top} L${x0 + 5} ${top - 7} L${x1 - 5} ${top - 7} L${x1} ${top}Z" fill="currentColor" opacity=".45"/>`;
  if (p.dome !== 'none') s += `<path d="M${x1 - 14} ${top} q7 -${p.dome === 'onion' ? 18 : 13} 14 0Z" fill="currentColor" opacity=".7"/>`;
  for (let i = 1; i < n; i++) { const y = 60 - i * fl; for (let k = 0; k < 5; k++) s += `<rect x="${x0 + 3 + k * 9.6}" y="${y - fl + 2}" width="4" height="${fl - 4}" fill="currentColor" opacity=".7"/>`; s += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width=".6" opacity=".6"/>`; }
  if (p.ground === 'arcade') for (let k = 0; k < 5; k++) s += `<path d="M${x0 + 2 + k * 9.6} 60 v-${fl * 0.6} a3.6 3.6 0 0 1 7.2 0 v${fl * 0.6}" fill="currentColor" opacity=".55"/>`;
  else for (let k = 0; k < 5; k++) s += `<rect x="${x0 + 2 + k * 9.6}" y="${60 - fl * 0.8}" width="7" height="${fl * 0.8}" fill="currentColor" opacity=".45"/>`;
  return s + '</svg>';
}
