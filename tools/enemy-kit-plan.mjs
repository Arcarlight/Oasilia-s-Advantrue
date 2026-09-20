// 敌人招式池的「属性归属」与手动指派表（tools/apply-enemy-kits.mjs 读它）。
//
// 池子本身由 tools/build-enemy-kits.mjs 生成（`kit_t_<属性>` / `kit_t_<属性>_hi`，
// 攻击牌一律本系 + 两张通用小工具）。这里只放两样东西：
//
//   1. KIT_TYPE —— 池子名字里的属性（新池子名字自带属性，这份表是给**老池子**留的，
//      它们还在被个别招牌怪用着，check-content 靠它核对「池子的属性 = 里面攻击牌的属性」）
//   2. SPECIES_OVERRIDE —— 不按属性走的招牌怪（准神 / 传说 / 有专属卡的精英）
//
// ⚠ 数值口径：属性池的强度必须落在**现有池子的同档中位数**上（用户要求：现在的平衡就是标准）。
//   对账：node tools/measure-kit-profile.mjs ；改完再跑 node tools/measure-balance.mjs 看胜率有没有漂。

/** 池子服务的属性。`kit_t_*` 的名字自带属性，这里写的是**老池子**（还在用的）与个别例外。 */
export const KIT_TYPE = {
  kit_ground: '地面', kit_rock: '岩石', kit_steel: '钢', kit_bug: '虫', kit_grass: '草',
  kit_poison: '毒', kit_water: '水', kit_flying: '飞行', kit_fire: '火', kit_dark: '恶',
  kit_dragon: '龙', kit_ghost: '幽灵', kit_fighting: '格斗', kit_normal: '一般',
  kit_crystal: '岩石', kit_electric: '电', kit_fungal: '草', kit_ruins: '岩石',
  kit_bleed: '恶', kit_weaken: '毒', kit_debuff: '恶',
};

/**
 * 通用小工具：不带伤害、也不属于任何属性，任何池子都可以放（缩壳 / 瞪眼 / 守住 / 抓挠 / 撞击 / 扬沙）。
 * 写在数据里是因为 `diag-kits` 要把「本系牌」和「谁都能用的通用牌」分开算：
 * 一只地面系用「撞击」不算跑题，用「暗影爪」才算。
 */
export const UNIVERSAL_CARDS = ['mob_scratch', 'tackle', 'mob_sand', 'mob_guard', 'mob_stare', 'protect'];

/**
 * 招牌怪：不按属性走的那些。准神 / 传说 / 有专属卡的精英，指定它用哪个池子。
 * 写在这里而不是靠「按属性自动挑」，是为了让这类例外一眼能数出来。
 *
 * ⚠ 一律指向纯本系的 `kit_t_*` —— 老池子（kit_ground 这种）是当年手挑的混合池，
 * 里面掺着「撞击 / 抓挠」这类通用牌，也有真的跑题的（kit_ground_hi 里有重磅冲撞、kit_rock_hi 里有勇鸟猛攻）。
 */
export const SPECIES_OVERRIDE = {
  // 准神与传说
  garchomp: 'kit_t_龙_hi', zygarde: 'kit_t_龙_hi', tyrantrum: 'kit_t_龙_hi',
  kyurem: 'kit_t_冰_hi', tyranitar: 'kit_t_恶_hi', darkrai: 'kit_t_恶_hi',
  zeraora: 'kit_t_电_hi', ampharos: 'kit_t_电_hi', regigigas: 'kit_t_一般_hi',
  metagross: 'kit_t_钢_hi', aggron: 'kit_t_钢_hi', corviknight: 'kit_t_钢_hi',
  diancie: 'kit_t_妖精_hi', mimikyu: 'kit_t_幽灵_hi', kingdra: 'kit_t_水_hi',
  trevenant: 'kit_t_幽灵_hi', breloom: 'kit_t_格斗_hi', aegislash: 'kit_t_钢_hi',
  lunatone: 'kit_t_超能_hi', solrock: 'kit_t_岩石_hi', claydol: 'kit_t_超能_hi',
  bastiodon: 'kit_t_钢_hi', rampardos: 'kit_t_岩石_hi', avalugg: 'kit_t_冰_hi',
  glalie: 'kit_t_冰_hi', froslass: 'kit_t_冰_hi', aurorus: 'kit_t_冰_hi',
  // 地面系精英／首领
  hippowdon: 'kit_t_地面_hi', mudsdale: 'kit_t_地面_hi', rhyperior: 'kit_t_地面_hi',
  excadrill: 'kit_t_钢_hi', steelix: 'kit_t_钢_hi', golem: 'kit_t_岩石_hi',
  gigalith: 'kit_t_岩石_hi', regirock: 'kit_t_岩石_hi',
  // 岩石 / 飞行 系的招牌
  aerodactyl: 'kit_t_飞行_hi', gliscor: 'kit_t_飞行_hi',
  // 火系（火焰鸡那一批本来写的是岩 / 格斗池）
  talonflame: 'kit_t_火_hi', arcanine: 'kit_t_火_hi', camerupt: 'kit_t_火_hi', torkoal: 'kit_t_火_hi',
};
