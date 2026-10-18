// Design-state schema for the Algiers designer: defaults, control metadata and grouping.
// The UI (ui/algiersPanel.js) is generated entirely from this file; to add a parameter,
// add it to DEFAULTS and to a group below, then read it in the builder.
// `look: true` marks parameters that only recolour materials (no geometry rebuild).

export const DEFAULTS = {
  type: 'haussmann', seed: 7,
  W: 26, D: 18, floors: 6, gh: 4.8, fh: 3.3, bay: 3.3,
  corner: 'chamfer', cornerSize: 3.2, sides: 'corner',
  ground: 'arcade', arch: 'round', arcDepth: 3.2, pillar: 'square', pillarW: 0.8, rustic: true, archShops: true, signs: true, shopShutters: 0.35,
  winW: 1.3, winH: 0.8, french: 'all', surround: 2, shutter: 'persienne', shutterOpen: 0.55, awnings: 0.3, mouch: false,
  balDepth: 0.85, iron: 'classic', consoles: 'scroll', programAuto: true, program: [],
  ornament: 0.6, strings: true, pilasters: false, quoins: false, cornice: 'modillion', zellige: false,
  roof: 'terrace', parapet: 'balustrade', mh: 3.2, dormers: true, dome: 'none', chimneys: true,
  wallColor: '#f4f1ea', trimColor: '#efe8db', groundColor: '#e7dfcf', shutterColor: '#2f6aa8', ironColor: '#1c1e21', frameColor: '#f3f1ea', roofColor: '#8e979c', domeColor: '#8e979c', awningColor: '#2e6fb5', weather: 0.35,
  life: { street: true, lamps: true, ac: true, dishes: true, laundry: true, plants: true, tanks: true, barriers: false },
};

export const CROWNS = [['flat', 'مستقيم'], ['cornice', 'كورنيش'], ['tri', 'جبهة مثلثة'], ['seg', 'جبهة مقوسة'], ['arch', 'قوس نصف دائري'], ['segarch', 'قوس مقطعي'], ['basket', 'قوس سلّة'], ['horse', 'حدوة حصان'], ['pointed', 'قوس مدبب']];
export const BALS = [['none', '—', 'بلا شرفة'], ['single', '▭', 'شرفات منفردة'], ['cont', '═', 'شرفة ممتدة']];
const ARCH_OPTS = [['round', '◠ نصف دائري'], ['seg', '⌒ مقطعي'], ['basket', '◡ سلّة'], ['horse', 'Ω حدوة'], ['pointed', '△ مدبب'], ['flat', '▭ مستقيم']];

const PALETTE = {
  wall: ['#f4f1ea', '#ffffff', '#efe4cf', '#e9dcc2', '#f1e6d6', '#dcd3c4'],
  trim: ['#efe8db', '#ffffff', '#e2d6bf', '#d8c9ab', '#cfc6b8'],
  shutter: ['#2f6aa8', '#1f4e86', '#4c86c6', '#2f6b4f', '#5e7f5a', '#f2f2ee', '#7a2f2f', '#3b3b3b'],
  iron: ['#1c1e21', '#2c3a4a', '#2d4535', '#f2f2ee', '#5a3a25'],
  roof: ['#8e979c', '#5f6b70', '#a4472c', '#2f6d5f', '#d9d4c7'],
  dome: ['#8e979c', '#2f6d5f', '#c9a64a', '#f2f2ee', '#a4472c', '#3e7cc0'],
  awning: ['#2e6fb5', '#2f7a4c', '#c63b3b', '#e0b43a', '#f2f2ee'],
};

/** groups → controls. `when(state)` hides irrelevant controls. */
export const GROUPS = [
  { id: 'type', icon: '🏛️', title: 'نوع المبنى', open: true, controls: [{ k: 'type', t: 'types' }, { k: 'seed', t: 'seed', label: 'البذرة (Seed)' }] },
  { id: 'mass', icon: '📐', title: 'الكتلة والأبعاد', open: true, controls: [
    { k: 'W', t: 'range', label: 'طول الواجهة', min: 8, max: 70, step: 0.5, unit: 'م' },
    { k: 'D', t: 'range', label: 'طول الجانب', min: 8, max: 40, step: 0.5, unit: 'م' },
    { k: 'floors', t: 'stepper', label: 'عدد الطوابق', min: 2, max: 12 },
    { k: 'gh', t: 'range', label: 'ارتفاع الأرضي', min: 3.2, max: 7, step: 0.1, unit: 'م' },
    { k: 'fh', t: 'range', label: 'ارتفاع الطابق', min: 2.8, max: 4.4, step: 0.05, unit: 'م' },
    { k: 'bay', t: 'range', label: 'عرض الفتحة (Bay)', min: 2.2, max: 5, step: 0.1, unit: 'م' },
    { k: 'corner', t: 'seg', label: 'الزاوية', opts: [['sharp', '┐ حادة'], ['chamfer', '◸ مشطوفة'], ['round', '◜ مستديرة']] },
    { k: 'cornerSize', t: 'range', label: 'حجم الزاوية', min: 1, max: 8, step: 0.1, unit: 'م', when: (s) => s.corner !== 'sharp' },
    { k: 'sides', t: 'seg', label: 'الواجهات المزخرفة', opts: [['front', 'أمامية'], ['corner', 'زاوية شارعين'], ['all', 'كل الجهات']] },
  ] },
  { id: 'ground', icon: '🏬', title: 'الطابق الأرضي', controls: [
    { k: 'ground', t: 'seg', label: 'النوع', opts: [['arcade', '⌓ أروقة'], ['shops', '🛍 محلات'], ['plain', '▯ بسيط']] },
    { k: 'arch', t: 'select', label: 'شكل القوس', opts: ARCH_OPTS, when: (s) => s.ground !== 'plain' },
    { k: 'archShops', t: 'toggle', label: 'محلات مقوّسة', when: (s) => s.ground === 'shops' },
    { k: 'arcDepth', t: 'range', label: 'عمق الرواق', min: 1.8, max: 5, step: 0.1, unit: 'م', when: (s) => s.ground === 'arcade' },
    { k: 'pillar', t: 'seg', label: 'الأعمدة', opts: [['square', '▮ دعامة'], ['round', '● أسطوانية']], when: (s) => s.ground === 'arcade' },
    { k: 'pillarW', t: 'range', label: 'سماكة العمود', min: 0.45, max: 1.3, step: 0.05, unit: 'م', when: (s) => s.ground === 'arcade' },
    { k: 'rustic', t: 'toggle', label: 'حجارة بارزة (Bossage)', when: (s) => s.ground === 'arcade' && s.pillar === 'square' },
    { k: 'signs', t: 'toggle', label: 'لافتات المحلات' },
    { k: 'shopShutters', t: 'range', label: 'ستائر المحلات المنزلة', min: 0, max: 1, step: 0.05, fmt: 'pct' },
  ] },
  { id: 'win', icon: '🪟', title: 'النوافذ والمصاريع', controls: [
    { k: 'winW', t: 'range', label: 'عرض النافذة', min: 0.8, max: 2.2, step: 0.05, unit: 'م' },
    { k: 'winH', t: 'range', label: 'ارتفاع النافذة', min: 0.55, max: 0.9, step: 0.01, fmt: 'pct' },
    { k: 'french', t: 'seg', label: 'أبواب-نوافذ', opts: [['all', 'كلها حتى الأرض'], ['balcony', 'عند الشرفات فقط']] },
    { k: 'surround', t: 'seg', label: 'الإطار الحجري', opts: [[0, 'بلا'], [1, 'بسيط'], [2, 'منحوت'], [3, 'غني']] },
    { k: 'shutter', t: 'seg', label: 'المصاريع', opts: [['persienne', '▤ شيش'], ['roller', '▭ رولو'], ['none', 'بلا']] },
    { k: 'shutterOpen', t: 'range', label: 'نسبة المصاريع المفتوحة', min: 0, max: 1, step: 0.05, fmt: 'pct', when: (s) => s.shutter !== 'none' },
    { k: 'awnings', t: 'range', label: 'ستائر قماشية (Stores)', min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { k: 'mouch', t: 'toggle', label: 'مشربيات خشبية' },
  ] },
  { id: 'bal', icon: '🧱', title: 'الشرفات والحديد المشغول', controls: [
    { k: 'program', t: 'program', label: 'برنامج الطوابق' },
    { k: 'balDepth', t: 'range', label: 'عمق الشرفة', min: 0.4, max: 1.6, step: 0.05, unit: 'م' },
    { k: 'iron', t: 'iron', label: 'نقش الحديد', look: true },
    { k: 'consoles', t: 'seg', label: 'الكوابيل', opts: [['none', 'بلا'], ['simple', 'بسيط'], ['scroll', 'لولبي'], ['heavy', 'ضخم']] },
  ] },
  { id: 'orn', icon: '👑', title: 'الزخرفة والسطح', controls: [
    { k: 'ornament', t: 'range', label: 'كثافة الزخرفة', min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { k: 'cornice', t: 'seg', label: 'الكورنيش', opts: [['none', 'بلا'], ['simple', 'بسيط'], ['dentil', 'مسنّن'], ['modillion', 'بكوابيل']] },
    { k: 'strings', t: 'toggle', label: 'أشرطة الطوابق' },
    { k: 'pilasters', t: 'toggle', label: 'أعمدة ملتصقة (Pilasters)' },
    { k: 'quoins', t: 'toggle', label: 'حجارة الزوايا' },
    { k: 'zellige', t: 'toggle', label: 'إفريز زليج' },
    { k: 'roof', t: 'seg', label: 'السطح', opts: [['terrace', 'سطح مسطح'], ['mansard', 'مانسارد'], ['attic', 'طابق متراجع']] },
    { k: 'parapet', t: 'select', label: 'الدرابزين', opts: [['none', 'بلا'], ['solid', 'جدار'], ['balustrade', 'درابزين حجري'], ['iron', 'حديد مشغول'], ['crenel', 'شرفات مسننة (موريسك)']], when: (s) => s.roof !== 'mansard' },
    { k: 'mh', t: 'range', label: 'ارتفاع المانسارد', min: 1.8, max: 4.5, step: 0.1, unit: 'م', when: (s) => s.roof === 'mansard' },
    { k: 'dormers', t: 'toggle', label: 'نوافذ السطح', when: (s) => s.roof === 'mansard' },
    { k: 'dome', t: 'seg', label: 'قبة الزاوية', opts: [['none', 'بلا'], ['imperial', 'إمبراطورية'], ['hemi', 'نصف كروية'], ['onion', 'بصلية']] },
    { k: 'chimneys', t: 'toggle', label: 'مداخن' },
  ] },
  { id: 'color', icon: '🎨', title: 'الألوان والقِدم', controls: [
    { k: 'wallColor', t: 'color', label: 'الجدران', sw: PALETTE.wall, look: true },
    { k: 'trimColor', t: 'color', label: 'الحجر والزخارف', sw: PALETTE.trim, look: true },
    { k: 'groundColor', t: 'color', label: 'الطابق الأرضي', sw: PALETTE.trim, look: true },
    { k: 'shutterColor', t: 'color', label: 'المصاريع', sw: PALETTE.shutter, look: true },
    { k: 'ironColor', t: 'color', label: 'الحديد', sw: PALETTE.iron, look: true },
    { k: 'roofColor', t: 'color', label: 'السطح / الزنك', sw: PALETTE.roof, look: true },
    { k: 'domeColor', t: 'color', label: 'القبة', sw: PALETTE.dome, look: true, when: (s) => s.dome !== 'none' },
    { k: 'awningColor', t: 'color', label: 'الستائر القماشية', sw: PALETTE.awning, look: true },
    { k: 'weather', t: 'range', label: 'القِدم والاتساخ', min: 0, max: 1, step: 0.05, fmt: 'pct', look: true },
  ] },
  { id: 'life', icon: '🌆', title: 'حياة الشارع', controls: [
    { k: 'life', t: 'chips', opts: [['street', '🛣 رصيف وطريق'], ['lamps', '🏮 أعمدة إنارة'], ['barriers', '🚧 حواجز'], ['ac', '❄️ مكيفات'], ['dishes', '📡 صحون'], ['laundry', '👕 غسيل'], ['plants', '🪴 نباتات'], ['tanks', '🛢 خزانات']] },
  ] },
];

export const LOOK_KEYS = new Set(GROUPS.flatMap((g) => g.controls.filter((c) => c.look).map((c) => c.k)));
