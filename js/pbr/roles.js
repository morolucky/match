// Material roles: which materials of the scene get which generated PBR set.
// `mt` = keys of MT that receive the maps, `tile` = metres per texture repeat,
// `weather` = how strongly the weathering slider drives mould / stains / cracks for this role,
// `metal` = metalness written to the ORM map, `tint` = keep the palette colour as albedo multiplier.

export const ROLES = {
  wall:   { label: 'الجدران (جص)',        mt: ['a_wall'],              def: 'stucco',     tile: 3,   weather: 1,   tint: true,  opts: ['stucco', 'plaster', 'concrete', 'whitebrick', 'sandstone'] },
  ground: { label: 'الطابق الأرضي (حجر)', mt: ['a_ground'],            def: 'ashlar',     tile: 2,   weather: 1,   tint: true,  opts: ['ashlar', 'limestone', 'rough', 'sandstone', 'granite'] },
  trim:   { label: 'الزخارف والكورنيش',   mt: ['a_trim'],              def: 'limestone',  tile: 1.5, weather: 0.7, tint: true,  opts: ['limestone', 'ashlar', 'cornice', 'marble', 'sandstone'] },
  zinc:   { label: 'سطح الزنك',           mt: ['a_zinc'],              def: 'galv',       tile: 1.5, weather: 0.4, tint: true,  metal: 0.5, opts: ['galv', 'rustmetal', 'slate', 'clayroof'] },
  pave:   { label: 'الرصيف',              mt: ['a_pave'],              def: 'flagstone',  tile: 1.6, weather: 1,   tint: false, opts: ['flagstone', 'cobble', 'granite', 'concrete', 'ceramic'] },
  curb:   { label: 'الحافة (Curb)',       mt: ['a_curb'],              def: 'granite',    tile: 1.5, weather: 1,   tint: false, opts: ['granite', 'limestone', 'concrete'] },
  asph:   { label: 'الأسفلت',             mt: ['a_asph'],              def: 'asphalt',    tile: 3,   weather: 1,   tint: false, opts: ['asphalt', 'concrete', 'cobble'] },
  zel:    { half: true, label: 'الزليج',              mt: ['a_zel'],               def: 'mosaic',     tile: 0.8, weather: 0.1, tint: false, opts: ['mosaic', 'ceramic', 'terracotta', 'marble'] },
  wood:   { label: 'الخشب (أبواب/مقاعد)', mt: ['a_wood', 'p_wood'],    def: 'oak',        tile: 1.2, weather: 0.5, tint: true,  opts: ['oak', 'darkoak', 'fence'] },
  metal:  { half: true, label: 'معدن الأثاث',         mt: ['a_metal', 'p_metal'],  def: 'galv',       tile: 1.2, weather: 0.3, tint: true,  metal: 0.65, opts: ['galv', 'rustmetal'] },
  conc:   { half: true, label: 'خرسانة (حواجز/أحواض)', mt: ['p_conc'],             def: 'concrete',   tile: 1.5, weather: 1,   tint: true,  opts: ['concrete', 'granite', 'limestone'] },
  pot:    { half: true, label: 'فخار الأصص',          mt: ['p_pot'],               def: 'terracotta', tile: 0.8, weather: 0.3, tint: false, opts: ['terracotta', 'clayroof', 'ceramic'] },
  bark:   { half: true, label: 'لحاء الأشجار',        mt: ['p_bark'],              def: 'fence',      tile: 0.7, weather: 0.2, tint: true,  opts: ['fence', 'darkoak', 'rough'] },
  gnd:    { label: 'الأرض المحيطة',       mt: [],                      def: 'concrete',   tile: 3,   weather: 1,   tint: false, opts: ['concrete', 'asphalt', 'flagstone', 'mud'] },
};

export const DEFAULT_MATS = Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.def]));
