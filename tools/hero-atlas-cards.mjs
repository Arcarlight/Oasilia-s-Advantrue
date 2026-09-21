// 3.0 的内容改动（一份可复跑的脚本，和 tools/archetype-cards.mjs 同一套路）：
//
//   ① **阿特拉斯（暴飞龙）的牌**：4 张开局基础牌（改名字、效果和欧亚西莉亚那套完全一样 ——
//      用户明确允许「改名字但效果相同」）+ 4 张他自己的专属牌。全部标 `heroOnly: 'atlas'`，
//      所以它们不会进欧亚西莉亚的抽卡池。
//   ② **流派补齐**：用户要「保证所有流派卡牌数一致」。现状 poison 14 / burst 13 / bleed 11 /
//      weaken 10 / buff 9 / timing 5 → 目标一律 **14**。做法：
//        · 修正一个错标：刺耳声（纯敌方减防）从 buff 标签里拿掉；
//        · 六张**本来就是强化牌、只是没打标签**的牌补上 buff（健美 / 高速移动 / 蝶舞 /
//          岩石打磨 / 幸运咒语 / 龙之升华）；
//        · 新增 12 张**双标签**牌（蓄势 9 张，其中 3 张带出血、1 张带削弱、1 张带单次高伤，
//          另加 3 张纯削弱）—— 一张牌同时喂两条线，免得为了凑数字硬造雷同卡。
//   ③ **减法**：14 张「同费用、纯伤害、被同费用另一张牌完全压住」的无流派水牌转 `enemyOnly`
//      （它们都在敌人招式池里，敌人照样用、图鉴照样能靠「看见敌方打出」解锁）。
//
// 用法：node tools/hero-atlas-cards.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_FILE = path.join(ROOT, 'content', 'cards.json');
const ENEMIES_FILE = path.join(ROOT, 'content', 'enemies.json');
const WRITE = process.argv.includes('--write');

const doc = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
const enemiesDoc = JSON.parse(fs.readFileSync(ENEMIES_FILE, 'utf8'));
const by = (id) => doc.cards.find((c) => c.id === id);

const kits = new Set();
for (const v of Object.values(enemiesDoc.movePools ?? {})) for (const id of v) kits.add(id);
const sigs = new Set();
for (const e of enemiesDoc.enemies ?? []) for (const s of e.signature ?? []) sigs.add(s);
const reachable = (id) => kits.has(id) || sigs.has(id);

/** 招式池按属性命名（两套：kit_t_<中文> 与 kit_<英文>） */
const KIT_OF_TYPE = {
  一般: 'kit_t_一般', 冰: 'kit_t_冰', 地面: 'kit_t_地面', 妖精: 'kit_t_妖精', 岩石: 'kit_t_岩石',
  幽灵: 'kit_t_幽灵', 恶: 'kit_t_恶', 格斗: 'kit_t_格斗', 毒: 'kit_t_毒', 水: 'kit_t_水',
  火: 'kit_t_火', 电: 'kit_t_电', 草: 'kit_t_草', 虫: 'kit_t_虫', 超能: 'kit_t_超能',
  钢: 'kit_t_钢', 飞行: 'kit_t_飞行', 龙: 'kit_t_龙',
};

/** 这张牌是打对手还是给自己（引擎要求 targeting，递归看 delay / trigger 里预约的那串） */
function needsFoe(effects) {
  return (effects ?? []).some((e) => {
    if (e.kind === 'damage') return true;
    if (e.kind === 'status') return e.target !== 'self';
    if (e.kind === 'buff') return e.target === 'enemy';
    if (e.kind === 'delay' || e.kind === 'trigger') return needsFoe(e.effects);
    return false;
  });
}

// ============================================================
// ① 阿特拉斯的牌
// ============================================================
const ATLAS = [
  {
    // 「改名字、效果相同」的那一类：和欧亚西莉亚的撞击一模一样
    id: 'atlas_charge', name: '暴冲', ap: 0, rarity: 'common', types: ['一般'], heroOnly: 'atlas',
    ico: 'ico-fist', fx: 'dirt_1', tags: [],
    text: '造成 {d} 点伤害。',
    effects: [{ kind: 'damage', power: 30 }],
  },
  {
    id: 'atlas_bite', name: '噬咬', ap: 1, rarity: 'common', types: ['恶'], heroOnly: 'atlas',
    ico: 'ico-dagger', fx: 'slash_1', tags: [],
    text: '造成 {d} 点伤害。',
    effects: [{ kind: 'damage', power: 90 }],
  },
  {
    id: 'atlas_scales', name: '鳞甲', ap: 1, rarity: 'common', types: ['一般'], heroOnly: 'atlas',
    ico: 'ico-shield', fx: 'trace_1', tags: [],
    text: '获得护盾（随防御成长，约 9 + 防御×0.75）。',
    effects: [{ kind: 'shield', amount: 9, scaleWithDef: true }],
  },
  {
    id: 'atlas_wingbeat', name: '翼连击', ap: 1, rarity: 'common', types: ['格斗'], heroOnly: 'atlas',
    ico: 'ico-double', fx: 'slash_1', tags: [],
    text: '连续 2 次造成 {d} 点伤害。',
    effects: [{ kind: 'damage', power: 45, hits: 2 }],
  },
  // ---- 他自己的专属牌（沉稳、可靠、不爱废话） ----
  {
    id: 'atlas_roar', name: '龙威', ap: 1, rarity: 'uncommon', types: ['龙'], heroOnly: 'atlas',
    ico: 'ico-audio_waves', fx: 'light_1', tags: [],
    text: '给对手 2 层虚弱，本场战斗自身攻击 +2。',
    effects: [{ kind: 'status', status: 'weak', stacks: 2 }, { kind: 'buff', stat: 'atk', amount: 2 }],
  },
  {
    id: 'atlas_dive', name: '俯冲', ap: 2, rarity: 'rare', types: ['飞行'], heroOnly: 'atlas',
    ico: 'ico-arrow_down_blue', fx: 'trace_01', tags: [],
    text: '造成 {d} 点伤害（无视对手 40% 的防御）。',
    effects: [{ kind: 'damage', power: 190, ignoreDefPct: 0.4 }],
  },
  {
    id: 'atlas_steadfast', name: '稳守', ap: 1, rarity: 'rare', types: ['一般'], heroOnly: 'atlas',
    ico: 'ico-shield_02', fx: 'light_1', tags: [],
    text: '获得护盾（随防御成长），抽 1 张。',
    effects: [{ kind: 'shield', amount: 14, scaleWithDef: true }, { kind: 'draw', n: 1 }],
  },
  {
    id: 'atlas_homeward', name: '归途', ap: 3, rarity: 'epic', types: ['龙'], heroOnly: 'atlas',
    ico: 'ico-heart', fx: 'star_01', tags: [],
    text: '造成 {d} 点伤害，并回复最大生命的 12%。',
    effects: [{ kind: 'damage', power: 285 }, { kind: 'heal', pct: 0.12 }],
  },
];

// ============================================================
// ② 流派补齐（12 张，全部可以在两位主角的池子里抽到）
// ============================================================
const ARCHETYPE = [
  // ---- 蓄势 × 出血 ----
  {
    id: 'bleed_wait', name: '藏锋', ap: 1, rarity: 'common', types: ['恶'], tags: ['timing', 'bleed'],
    ico: 'ico-heart_break_02', fx: 'smoke_1',
    text: '下回合开始时给对手 2 层出血。',
    effects: [{ kind: 'delay', turns: 1, name: '藏锋', effects: [{ kind: 'status', status: 'bleed', stacks: 2 }] }],
  },
  {
    id: 'bleed_chase', name: '追咬', ap: 2, rarity: 'uncommon', types: ['一般'], tags: ['timing', 'bleed'],
    ico: 'ico-sword', fx: 'slash_1',
    text: '打出这张牌之后，再打出 2 张牌时造成 {d} 点伤害，并给对手 1 层出血。',
    effects: [{
      kind: 'trigger', on: 'plays', count: 2, name: '追咬',
      effects: [{ kind: 'damage', power: 120 }, { kind: 'status', status: 'bleed', stacks: 1 }],
    }],
  },
  {
    id: 'bleed_avalanche', name: '血崩', ap: 3, rarity: 'rare', types: ['龙'], tags: ['timing', 'bleed'],
    ico: 'ico-triple', fx: 'slash_1',
    text: '2 个回合后，连续 3 次造成 {d} 点伤害，并给对手 2 层出血。',
    effects: [{
      kind: 'trigger', on: 'turn', count: 3, name: '血崩',
      effects: [{ kind: 'damage', power: 130, hits: 3 }, { kind: 'status', status: 'bleed', stacks: 2 }],
    }],
  },
  // ---- 蓄势 × 削弱 ----
  {
    id: 'weaken_wait', name: '悬岩', ap: 2, rarity: 'rare', types: ['岩石'], tags: ['timing', 'weaken'],
    ico: 'ico-stone', fx: 'dirt_1',
    text: '2 个回合后造成 {d} 点伤害，并让对手防御 -4。',
    effects: [{
      kind: 'delay', turns: 3, name: '悬岩',
      effects: [{ kind: 'damage', power: 190 }, { kind: 'buff', stat: 'def', amount: -4, target: 'enemy' }],
    }],
  },
  // ---- 蓄势 × 单次高伤 ----
  {
    id: 'burst_wait', name: '蓄势爆发', ap: 4, rarity: 'epic', types: ['一般'], tags: ['timing', 'burst'],
    ico: 'ico-meteor', fx: 'flare_1',
    text: '打出这张牌之后，再打出 2 张牌时造成 {d} 点伤害。',
    effects: [{ kind: 'trigger', on: 'plays', count: 2, name: '蓄势爆发', effects: [{ kind: 'damage', power: 480 }] }],
  },
  // ---- 纯蓄势 ----
  {
    id: 'guard_wait', name: '蓄甲', ap: 1, rarity: 'common', types: ['一般'], tags: ['timing'],
    ico: 'ico-shield', fx: 'light_1',
    text: '下回合开始时获得护盾（随防御成长）。',
    effects: [{ kind: 'delay', turns: 1, name: '蓄甲', effects: [{ kind: 'shield', amount: 12, scaleWithDef: true }] }],
  },
  {
    id: 'tempo_draw', name: '数拍', ap: 1, rarity: 'common', types: ['一般'], tags: ['timing'],
    ico: 'ico-card', fx: 'magic_1',
    text: '打出这张牌之后，再打出 3 张牌时抽 2 张。',
    effects: [{ kind: 'trigger', on: 'plays', count: 3, name: '数拍', effects: [{ kind: 'draw', n: 2 }] }],
  },
  {
    id: 'power_wait', name: '龙吼', ap: 2, rarity: 'uncommon', types: ['龙'], tags: ['timing'],
    ico: 'ico-arrow_up_red', fx: 'spark_02',
    text: '下回合开始时攻击牌威力 +60%（持续 2 回合），抽 1 张。',
    effects: [{
      kind: 'delay', turns: 1, name: '龙吼',
      effects: [{ kind: 'grantBuff', buff: 'power', n: 60, turns: 2 }, { kind: 'draw', n: 1 }],
    }],
  },
  {
    id: 'ap_wait', name: '沙漏', ap: 3, rarity: 'epic', types: ['一般'], tags: ['timing'],
    ico: 'ico-action_points', fx: 'magic_2',
    text: '打出这张牌之后，再打出 2 张牌时行动点上限 +2（持续 3 回合），抽 2 张。',
    effects: [{
      kind: 'trigger', on: 'plays', count: 2, name: '沙漏',
      effects: [{ kind: 'grantBuff', buff: 'apMax', n: 2, turns: 3 }, { kind: 'draw', n: 2 }],
    }],
  },
  // ---- 纯削弱 ----
  {
    id: 'weaken_press', name: '压势', ap: 1, rarity: 'uncommon', types: ['恶'], tags: ['weaken'],
    ico: 'ico-arrow_down_blue', fx: 'smoke_1',
    text: '给对手 1 层虚弱，并让对手防御 -3。',
    effects: [{ kind: 'status', status: 'weak', stacks: 1 }, { kind: 'buff', stat: 'def', amount: -3, target: 'enemy' }],
  },
  {
    id: 'weaken_bind', name: '岩钉', ap: 2, rarity: 'uncommon', types: ['岩石'], tags: ['weaken'],
    ico: 'ico-dagger', fx: 'trace_02',
    text: '让对手防御 -35%、敏捷 -3。',
    effects: [
      { kind: 'buff', stat: 'def', pct: -0.35, target: 'enemy' },
      { kind: 'buff', stat: 'agi', amount: -3, target: 'enemy' },
    ],
  },
  {
    id: 'weaken_crush', name: '崩防', ap: 3, rarity: 'epic', types: ['恶'], tags: ['weaken'],
    ico: 'ico-mace', fx: 'dirt_2',
    text: '让对手攻击 -4、防御 -4，并给对手 2 层虚弱。',
    effects: [
      { kind: 'buff', stat: 'atk', amount: -4, target: 'enemy' },
      { kind: 'buff', stat: 'def', amount: -4, target: 'enemy' },
      { kind: 'status', status: 'weak', stacks: 2 },
    ],
  },
];

// ============================================================
// ③ 标签修正 + 减法
// ============================================================
/** 本来就是「强化牌」却没有 buff 标签的六张（全部是纯自我强化，没有伤害 / 护盾之外的东西） */
const ADD_TAG = {
  buff: ['rock_polish', 'quiver_dance', 'super_luck', 'bulk_up', 'agility', 'dragon_ascension'],
};
/** 错标的流派：刺耳声是**纯敌方减防**，是削弱牌不是强化牌 */
const REMOVE_TAG = { buff: ['screech'] };

/**
 * **把欧亚西莉亚那四张开局基础牌锁给她**（`heroOnly: 'oasilia'`）。
 *
 * 为什么必须锁：阿特拉斯那四张是「改名字、效果完全一样」的版本，
 * 如果原版还留在共用池里，**他的抽卡池里就会同时出现「咬住」和「撕咬」**——
 * 同费用同效果的两张牌，抽到等于白给一格（用户点名过的「污染卡池」）。
 * 锁给她之后：她的池子里是撞击 / 咬住 / 变硬 / 二连踢，他的池子里是冲撞 / 撕咬 / 鳞甲 / 双翼拍击，
 * 两边各自干净。敌人照样能用（它们都在招式池里，图鉴也照样能靠「看见敌方打出」解锁）。
 */
const HERO_LOCK = { oasilia: ['tackle', 'bite', 'harden', 'double_kick'] };

/**
 * 减法：同费用、纯伤害、被另一张同费用牌完全压住的无流派水牌。
 * 判据写在脚本头部注释里；每一张都必须已经在敌人招式池 / 专属招里，否则跳过（会变成死卡）。
 */
const TRIM = [
  'accelrock', 'water_shuriken', 'cross_chop', 'bullet_seed', 'dragon_breath', 'freeze_dry',
  'body_press', 'drain_punch', 'iron_head', 'venoshock', 'fissure', 'doom_desire',
  'night_daze', 'dynamax_cannon',
];

// ============================================================
// 执行
// ============================================================
let added = 0;
for (const card of [...ATLAS, ...ARCHETYPE]) {
  const withTarget = { ...card, targeting: needsFoe(card.effects) ? 'enemy' : 'self' };
  const exists = by(card.id);
  if (exists) { Object.assign(exists, withTarget, { enemyOnly: false }); console.log(`  改用现有牌：${card.name}（${card.id}）`); continue; }
  doc.cards.push(withTarget);
  added += 1;
  console.log(`  新增：${card.name}（${card.id} · ${card.ap}费 · ${card.rarity} · ${withTarget.targeting}${card.heroOnly ? ' · 专属 ' + card.heroOnly : ''}${card.tags.length ? ' · ' + card.tags.join('/') : ''}）`);
}

let tagged = 0;
for (const [heroId, ids] of Object.entries(HERO_LOCK)) {
  for (const id of ids) {
    const c = by(id);
    if (!c) { console.log(`  ⚠ 锁给 ${heroId}：找不到 ${id}`); continue; }
    if (c.heroOnly === heroId) continue;
    c.heroOnly = heroId;
    console.log(`  锁给 ${heroId}：${c.name}（${id}）`);
  }
}
for (const [tag, ids] of Object.entries(ADD_TAG)) {
  for (const id of ids) {
    const c = by(id);
    if (!c) { console.log(`  ⚠ 补标签：找不到 ${id}`); continue; }
    c.tags = [...new Set([...(c.tags ?? []), tag])];
    tagged += 1;
  }
}
for (const [tag, ids] of Object.entries(REMOVE_TAG)) {
  for (const id of ids) {
    const c = by(id);
    if (!c?.tags?.includes(tag)) { console.log(`  ⚠ 去掉标签：${id} 本来就没有 ${tag}`); continue; }
    c.tags = c.tags.filter((t) => t !== tag);
    if (!c.tags.length) delete c.tags;
    tagged += 1;
  }
}

/** 减出去的水牌如果没人用，就按属性补进对应的招式池（否则图鉴永远点不亮） */
const kitPatches = [];
let trimmed = 0;
for (const id of TRIM) {
  const c = by(id);
  if (!c) { console.log(`  ⚠ 减法：找不到 ${id}`); continue; }
  if (c.enemyOnly) continue;
  if (!reachable(id)) {
    const type = (c.types ?? [])[0];
    const kit = KIT_OF_TYPE[type];
    if (!kit || !enemiesDoc.movePools?.[kit]) { console.log(`  ⚠ 减法：${c.name} 不在招式池里、也没有 ${type} 的池子 —— 跳过`); continue; }
    kitPatches.push({ kit, id, name: c.name });
  }
  c.enemyOnly = true;
  trimmed += 1;
  console.log(`  移出玩家池：${c.name}（${id}）`);
}
for (const p of kitPatches) {
  if (!enemiesDoc.movePools[p.kit].includes(p.id)) {
    enemiesDoc.movePools[p.kit].push(p.id);
    console.log(`    补进 ${p.kit}：${p.name}（否则没人会用）`);
  }
}

// ---- 报告：每个主角的池子里，六个流派各几张 ----
const RARITIES = ['common', 'uncommon', 'rare', 'epic'];
const TAGS = ['poison', 'bleed', 'burst', 'weaken', 'buff', 'timing'];
const HEROES = ['oasilia', 'atlas'];
console.log('\n流派 × 稀有度（数字 = 该主角池子里的张数）：');
const bad = [];
for (const hero of HEROES) {
  const pool = doc.cards.filter((c) => !c.enemyOnly && (!c.heroOnly || c.heroOnly === hero));
  console.log(`  ${hero}：玩家池 ${pool.length} 张`);
  for (const tag of TAGS) {
    const row = RARITIES.map((r) => pool.filter((c) => (c.tags ?? []).includes(tag) && c.rarity === r).length);
    const total = row.reduce((a, b) => a + b, 0);
    console.log(`    ${tag.padEnd(8)} ${row.join(' / ')}  共 ${total}`);
    if (row.some((n) => n === 0)) bad.push(`${hero}/${tag} 缺 ${RARITIES.filter((r, i) => row[i] === 0).join('/')}`);
  }
}
if (bad.length) console.log(`  ⚠ ${bad.join('、')}`);

console.log(`\n新增 ${added} 张 · 改标签 ${tagged} 处 · 移出玩家池 ${trimmed} 张 · 补招式池 ${kitPatches.length} 张`);
console.log(`玩家池：${doc.cards.filter((c) => !c.enemyOnly).length} 张 · 只给敌人用：${doc.cards.filter((c) => c.enemyOnly).length} 张 · 全部 ${doc.cards.length} 张`);

if (WRITE) {
  fs.writeFileSync(CARDS_FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  fs.writeFileSync(ENEMIES_FILE, JSON.stringify(enemiesDoc, null, 2) + '\n', 'utf8');
  console.log('\n✓ 已写入 content/cards.json 与 content/enemies.json（接着跑 node tools/author.mjs check）');
} else {
  console.log('\n（dry run：加 --write 才会真的写文件）');
}
