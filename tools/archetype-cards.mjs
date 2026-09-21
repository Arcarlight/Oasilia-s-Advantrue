// 流派铺卡（v2.9961）：给「毒 / 出血 / 单次高伤 / 削弱」四条线补齐**每个稀有度都有**的牌，
// 再加上用户点名的新机制（我方强化 buff / 下回合生效 / 行动 N 次后生效）。
//
// 同时也做两件「减法」：
//   ① 用户报过「现在有很多卡只是单纯造成伤害 + 削弱敌人，削弱卡到后面价值不高」——
//      移除一批最不着调的「伤害 + 降属性」牌（转成 enemyOnly，它们都在敌人招式池里，
//      敌人照样会用、图鉴照样能靠看见敌方打出解锁）；
//   ② 被移除的那些里，如果效果和某张更「沙漠蜻蜓」的牌重合，就保留后者（去重工具负责）。
//
// 用法：node tools/archetype-cards.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS = path.join(ROOT, 'content', 'cards.json');
const ENEMIES = path.join(ROOT, 'content', 'enemies.json');
const WRITE = process.argv.includes('--write');

const doc = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const enemiesDoc = JSON.parse(fs.readFileSync(ENEMIES, 'utf8'));
const by = (id) => doc.cards.find((c) => c.id === id);
const kits = new Set();
for (const v of Object.values(enemiesDoc.movePools ?? {})) for (const id of v) kits.add(id);
for (const e of enemiesDoc.enemies ?? []) for (const s of e.signature ?? []) kits.add(s);

/**
 * ① 移除一批「伤害 + 削弱」里最不像她的牌（转 enemyOnly）。
 * 选的原则：属性上跟地面 / 龙毫无关系的（水 / 冰 / 超能 / 妖精那一挂），
 * 且**必须在敌人招式池里** —— 否则它会变成谁也见不到的死卡（图鉴永远点不亮）。
 */
const REMOVE = [
  'aqua_tail', 'water_pulse', 'blizzard', 'frost_breath', 'glaciate',
  'moonblast', 'psychic', 'surf', 'whirlpool', 'hurricane',
  'energy_ball', 'fairy_wind', 'baby_doll_eyes', 'triple_axel',
];

/**
 * ② 新卡：四条流派线 + 新机制。数值按现有曲线：
 *    0 费 30 / 1 费 90 / 2 费 190 / 3 费 285（自身代价的牌可以高 20%）。
 *    tags 给门禁用：每个 tag 在每个稀有度上至少有一张，免得「一个流派的牌全在高级」。
 */
const NEW = [
  // ---- 新机制：我方强化（buff）----
  {
    id: 'echoed_voice', name: '回声', ap: 1, rarity: 'common', types: ['一般'], ico: 'ico-audio_waves', fx: 'magic_2',
    tags: ['buff'],
    text: '抽 1 张。本场战斗里，再次打出**同一张牌**时，它的伤害与附加状态层数 ×2（持续 3 回合）。',
    effects: [{ kind: 'draw', n: 1 }, { kind: 'grantBuff', buff: 'echo', n: 1, turns: 3 }],
  },
  {
    id: 'sand_beat', name: '沙之节拍', ap: 1, rarity: 'uncommon', types: ['地面'], ico: 'ico-earthquake', fx: 'dirt_1',
    tags: ['buff'],
    text: '行动点上限 +1（持续 3 回合），抽 1 张。',
    effects: [{ kind: 'grantBuff', buff: 'apMax', n: 1, turns: 3 }, { kind: 'draw', n: 1 }],
  },
  {
    id: 'hone_claws', name: '磨爪', ap: 1, rarity: 'common', types: ['地面'], ico: 'ico-dagger', fx: 'slash_1',
    tags: ['buff', 'poison', 'bleed'],
    text: '给对手附加状态时，层数 +1（持续 3 回合）。',
    effects: [{ kind: 'grantBuff', buff: 'stacks', n: 1, turns: 3 }],
  },
  {
    id: 'swords_dance', name: '剑舞', ap: 2, rarity: 'rare', types: ['一般'], ico: 'ico-sword', fx: 'flare_1',
    tags: ['buff', 'burst'],
    text: '攻击牌威力 +70%（持续 2 回合），本场战斗威力 +40%。',
    effects: [{ kind: 'strength', n: 40 }, { kind: 'grantBuff', buff: 'power', n: 70, turns: 2 }],
  },
  {
    id: 'draco_meteor', name: '龙星群', ap: 3, rarity: 'epic', types: ['龙'], ico: 'ico-meteor', fx: 'star_01',
    tags: ['buff', 'burst'],
    text: '造成 {d} 点伤害；攻击牌威力 +100%（持续 2 回合）；自身攻击 -30%（本场战斗）。',
    effects: [
      { kind: 'damage', power: 285 },
      { kind: 'grantBuff', buff: 'power', n: 100, turns: 2 },
      { kind: 'buff', stat: 'atk', pct: -0.3 },
    ],
  },
  // ---- 新机制：下回合生效 / 行动 N 次后生效 ----
  {
    id: 'dual_chop', name: '二连劈', ap: 1, rarity: 'common', types: ['龙'], ico: 'ico-double', fx: 'slash_1',
    tags: ['timing', 'burst'],
    text: '打出这张牌之后，再打出 2 张牌时造成 {d} 点伤害。',
    effects: [{ kind: 'trigger', on: 'plays', count: 2, name: '二连劈', effects: [{ kind: 'damage', power: 150 }] }],
  },
  {
    id: 'rock_blast', name: '岩石爆击', ap: 2, rarity: 'uncommon', types: ['岩石'], ico: 'ico-stone', fx: 'dirt_2',
    tags: ['timing'],
    text: '2 个回合后，造成 3 次 {d} 点伤害。',
    effects: [{ kind: 'trigger', on: 'turn', count: 2, name: '岩石爆击', effects: [{ kind: 'damage', power: 95, hits: 3 }] }],
  },
  {
    id: 'dig', name: '挖洞', ap: 2, rarity: 'rare', types: ['地面'], ico: 'ico-earthquake', fx: 'dirt_1',
    tags: ['timing', 'weaken'],
    text: '下回合开始时造成 {d} 点伤害，并给对手 2 层虚弱。',
    effects: [{
      kind: 'delay', turns: 1, name: '挖洞',
      effects: [{ kind: 'damage', power: 250 }, { kind: 'status', status: 'weak', stacks: 2 }],
    }],
  },
  // ---- 削弱流的收尾：把「削掉的防御」换成伤害 ----
  {
    id: 'rock_tomb', name: '岩石封锁', ap: 1, rarity: 'uncommon', types: ['岩石'], ico: 'ico-stone', fx: 'dirt_1',
    tags: ['weaken'],
    text: '造成 {d} 点伤害，对手防御 -3；对手每损失 1 点防御，这张牌威力 +6%。',
    effects: [
      { kind: 'damage', power: 90, powerPerDefLost: 6 },
      { kind: 'buff', stat: 'def', amount: -3, target: 'enemy' },
    ],
  },
  {
    id: 'breaking_swipe', name: '广域破坏', ap: 2, rarity: 'rare', types: ['龙'], ico: 'ico-sword', fx: 'slash_1',
    tags: ['weaken'],
    text: '造成 {d} 点伤害，对手攻击 -25%（按基础值）。',
    effects: [
      { kind: 'damage', power: 190 },
      { kind: 'buff', stat: 'atk', pct: -0.25, target: 'enemy' },
    ],
  },
  // ---- 出血 / 单次高伤的补位（保证每个稀有度都有） ----
  {
    id: 'cut', name: '居合斩', ap: 1, rarity: 'common', types: ['一般'], ico: 'ico-sword', fx: 'slash_1',
    tags: ['bleed'],
    text: '造成 {d} 点伤害，并给对手 1 层出血。',
    effects: [{ kind: 'damage', power: 90 }, { kind: 'status', status: 'bleed', stacks: 1 }],
  },
  {
    id: 'take_down', name: '猛撞', ap: 2, rarity: 'common', types: ['一般'], ico: 'ico-mace', fx: 'dirt_1',
    tags: ['burst'],
    text: '造成 {d} 点伤害，自身受到伤害的 25% 反伤。',
    effects: [{ kind: 'damage', power: 190, recoilPct: 0.25 }],
  },
  // ---- 毒流的低费铺毒（原来只有毒牙一张普通档） ----
  {
    id: 'sand_toxin', name: '沙中毒', ap: 0, rarity: 'common', types: ['地面'], ico: 'ico-poison', fx: 'smoke_1',
    tags: ['poison'],
    text: '造成 {d} 点伤害，并给对手 1 层中毒。',
    effects: [{ kind: 'damage', power: 30 }, { kind: 'status', status: 'poison', stacks: 1 }],
  },
  // ---- 补 timing 的中档与高档（不然「蓄一手」这条线只有低费牌） ----
  {
    id: 'sand_burst', name: '沙尘卷', ap: 1, rarity: 'uncommon', types: ['地面'], ico: 'ico-wind', fx: 'smoke_1',
    tags: ['timing'],
    text: '打出这张牌之后，再打出 3 张牌时造成 {d} 点伤害并给对手 2 层出血。',
    effects: [{
      kind: 'trigger', on: 'plays', count: 3, name: '沙尘卷',
      effects: [{ kind: 'damage', power: 190 }, { kind: 'status', status: 'bleed', stacks: 2 }],
    }],
  },
  {
    id: 'giga_impact', name: '终极冲击', ap: 3, rarity: 'epic', types: ['一般'], ico: 'ico-volcanic_eruption', fx: 'flare_1',
    tags: ['timing', 'burst'],
    text: '下回合开始时造成 {d} 点伤害（这一回合只做蓄力）。',
    effects: [{ kind: 'delay', turns: 1, name: '终极冲击', effects: [{ kind: 'damage', power: 420 }] }],
  },
];

/** ③ 给已有的牌补 tags（门禁要按流派点每个稀有度） */
const TAGS = {
  poison: ['poison_fang', 'toxic', 'toxic_spikes', 'venom_dart', 'hex', 'toxic_cloud', 'toxic_overflow', 'plague', 'sludge_bomb', 'acid_armor', 'leech_seed', 'spore'],
  bleed: ['fury_swipes', 'rend', 'slash', 'bloodletting', 'night_slash', 'crimson_pact', 'megahorn', 'blood_toxins', 'iron_barbs'],
  burst: ['blood_price', 'howl', 'overheat', 'last_stand', 'dragon_rush', 'brine', 'outrage', 'boomburst'],
  weaken: ['sand_attack', 'screech', 'corrosive_touch', 'exploit_weak', 'salt_cure', 'corrode', 'crush_grip'],
  buff: ['dragon_dance', 'calm_mind', 'focus_energy', 'screech'],
  timing: [],
};

let removed = 0;
const skipped = [];
for (const id of REMOVE) {
  const c = by(id);
  if (!c) { skipped.push(`${id}（内容里没有）`); continue; }
  if (!kits.has(id)) { skipped.push(`${c.name}（不在敌人招式池里 —— 移出去就没人用了）`); continue; }
  if (c.enemyOnly) continue;
  c.enemyOnly = true;
  removed += 1;
  console.log(`  移出玩家池：${c.name}（${id}）`);
}

let added = 0;
/** 这张牌是打对手还是给自己（引擎要求 targeting 字段：enemy / self）——
 *  递归看 delay / trigger 里预约的那串效果，免得「下回合打人」被当成给自己加 buff 的牌 */
function needsFoe(effects) {
  return (effects ?? []).some((e) => {
    if (e.kind === 'damage') return true;
    if (e.kind === 'status') return e.target !== 'self';
    if (e.kind === 'buff') return e.target === 'enemy';
    if (e.kind === 'delay' || e.kind === 'trigger') return needsFoe(e.effects);
    return false;
  });
}
for (const card of NEW) {
  const withTarget = { ...card, targeting: needsFoe(card.effects) ? 'enemy' : 'self' };
  const exists = by(card.id);
  if (exists) {
    // 已存在（可能是被去重工具移出去的牌）：按新定义改回来，并且**收回玩家池**
    Object.assign(exists, withTarget, { enemyOnly: false });
    console.log(`  改用现有牌：${card.name}（${card.id}）`);
    continue;
  }
  doc.cards.push(withTarget);
  added += 1;
  console.log(`  新增：${card.name}（ap${card.ap} · ${card.rarity} · ${withTarget.targeting} · ${card.tags.join('/')}）`);
}

let tagged = 0;
for (const [tag, ids] of Object.entries(TAGS)) {
  for (const id of ids) {
    const c = by(id);
    if (!c) continue;
    c.tags = [...new Set([...(c.tags ?? []), tag])];
    tagged += 1;
  }
}

console.log(`\n移除 ${removed} 张 · 新增 ${added} 张 · 补 tag ${tagged} 处${skipped.length ? `\n跳过：${skipped.join('；')}` : ''}`);

/** ④ 门禁要的那张表：每个 tag 在每个稀有度上各有几张（0 就是「这个流派成型困难」） */
const RARITIES = ['common', 'uncommon', 'rare', 'epic'];
console.log('\n流派 × 稀有度（数字 = 玩家池里的张数）：');
const allTags = [...new Set([...Object.keys(TAGS), ...NEW.flatMap((c) => c.tags)])];
const bad = [];
for (const tag of allTags) {
  const row = RARITIES.map((r) => doc.cards.filter((c) => !c.enemyOnly && (c.tags ?? []).includes(tag) && c.rarity === r).length);
  console.log(`  ${tag.padEnd(8)} ${row.join(' / ')}`);
  if (row.some((n) => n === 0)) bad.push(`${tag}（缺 ${RARITIES.filter((r, i) => row[i] === 0).join('/')}）`);
}
if (bad.length) console.log(`  ⚠ 还有流派缺稀有度：${bad.join('、')}`);

if (WRITE) {
  fs.writeFileSync(CARDS, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('\n✓ 已写入 content/cards.json');
} else {
  console.log('\n（dry run：加 --write 才写文件）');
}
