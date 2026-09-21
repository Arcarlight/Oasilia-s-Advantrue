// 收紧**治疗经济**（玩家反馈：「战后回复比太高，局内治疗卡又成本非常低，全程下来玩家在血量上几乎没有压力」）。
//
// 先把现状量出来（这个脚本跑起来会打印）：
//   · 战斗外，一章能回 ≈296% 最大生命 —— 光「战后回复」12% × 8 场就 96%，
//     再加营地 40% + 首领前 60% + 首领后满血；
//   · 局内，1 费治疗卡能回 20~25% 最大生命（光合作用 25%/AP、羽栖 22%/AP），
//     还有「生命之泉」这种 2 费回 45% **再还你 2 点 AP** 的（等于白送）。
//   两头都太松，血量就不是资源了。
//
// 改法（规则写在 _FIELDS 里，改数字就改这一处）：
//   ① 战斗外：战后回复 12% → 6%、营地 40% → 30%、首领前 60% → 35%
//      （首领后仍然满血：那是「下一章按满血设计」的锚点）；
//   ② 局内治疗卡：**每 AP 回复 ≤ 15% 最大生命**，而且「还 AP」的那几张只还 1 点；
//   ③ 持有效果里与「战后 / 每回合回血」相关的两件（大根茎 / 元气根）同步减半 ——
//      不然战斗外那部分被削弱之后，这些道具会显得比原来强一倍。
//
// 用法：
//   node tools/rescale-heal-cards.mjs            # 只报告
//   node tools/rescale-heal-cards.mjs --apply    # 写回 content/cards.json / items.json / src/data/balance.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

/** ① 战斗外的固定回血（src/data/balance.js 是手写区，直接替换那一行） */
const BALANCE_FIX = [
  ['healAfterBattlePct', 0.12, 0.06],
  ['restHealPct', 0.40, 0.30],
  ['preBossHealPct', 0.60, 0.35],
];

/**
 * ② 局内治疗卡：`id → [新效果, 新文案]`
 * 规则：每 AP 回复 ≤ 15% 最大生命；还 AP 的最多还 1 点。
 * 文案里的数字是印给玩家看的，所以**必须跟着改**（check-copy 会核对公式数字）。
 */
const CARD_FIX = {
  synthesis: [{ pct: 0.15 }, '回复最大生命的 15%，本场战斗攻击 +2。'],
  roost: [{ pct: 0.15 }, '回复最大生命的 15%。'],
  aqua_ring: [{ pct: 0.13 }, '回复最大生命的 13%，并获得护盾（随防御成长）。'],
  life_dew: [{ amount: 15 }, '回复 15 点 HP，并回复 1 点 AP。'],
  life_spring: [{ pct: 0.30 }, '回复最大生命的 30%，并回复 1 点 AP。使用后销毁。'],
  rest: [{ pct: 0.45 }, '回复最大生命的 45%，并抽 2 张。使用后销毁。'],
  first_aid: [{ pct: 0.10 }, '回复最大生命的 10%，并抽 1 张。使用后销毁。'],
  moonlight: [{ pct: 0.28 }, '回复最大生命的 28%，并清除自身所有负面。'],
  potion_berry: [{ amount: 14 }, '回复 14 点 HP。'],
};

/** ③ 道具：回血相关的持有效果同步减半 */
const ITEM_FIX = {
  big_root: [['healAfterBattlePct', 0.2, 0.1]],
  energy_root: [['healAfterBattlePct', 0.25, 0.12]],
};

// ---------- 报告 ----------
console.log('=== ① 战斗外固定回血 ===');
for (const [k, from, to] of BALANCE_FIX) console.log(`  ${k.padEnd(20)} ${Math.round(from * 100)}% → ${Math.round(to * 100)}%`);

const cardsFile = path.join(ROOT, 'content', 'cards.json');
const cardsData = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
console.log('\n=== ② 局内治疗卡（每 AP 回复 ≤ 15%） ===');
const rows = [];
for (const [id, [patch, text]] of Object.entries(CARD_FIX)) {
  const card = cardsData.cards.find((c) => c.id === id);
  if (!card) { console.log(`  ✗ 找不到卡 ${id}`); continue; }
  const heal = (card.effects ?? []).find((e) => e.kind === 'heal');
  const before = heal.pct != null ? `${Math.round(heal.pct * 100)}%` : `${heal.amount} HP`;
  const after = patch.pct != null ? `${Math.round(patch.pct * 100)}%` : `${patch.amount} HP`;
  // 「还 AP」的那几张：最多还 1 点
  const apEff = (card.effects ?? []).find((e) => e.kind === 'ap');
  const apBefore = apEff?.n ?? 0;
  const apAfter = Math.min(1, apBefore);
  rows.push(`  ${card.name.padEnd(8)} ${card.ap}费 回复 ${before.padStart(5)} → ${after.padStart(5)}` +
    `${apBefore ? ` · 还 AP ${apBefore} → ${apAfter}` : ''} · ${card.rarity}`);
}
console.log(rows.join('\n'));

const itemsFile = path.join(ROOT, 'content', 'items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
console.log('\n=== ③ 回血向的持有效果 ===');
for (const [id, fixes] of Object.entries(ITEM_FIX)) {
  const item = itemsData.items[id];
  if (!item) { console.log(`  ✗ 找不到道具 ${id}`); continue; }
  for (const [key, from, to] of fixes) console.log(`  ${item.name.padEnd(8)} ${key} ${from} → ${to}`);
}

if (!APPLY) {
  console.log('\n（dry run：加 --apply 才写回）');
  process.exit(0);
}

// ---------- 写回 ----------
{
  const file = path.join(ROOT, 'src', 'data', 'balance.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const [k, from, to] of BALANCE_FIX) {
    const re = new RegExp(`(^\\s*${k}:\\s*)${String(from).replace('.', '\\.')}`, 'm');
    if (!re.test(src)) { console.error(`✗ balance.js 里没找到 ${k}: ${from}`); continue; }
    src = src.replace(re, `$1${to}`);
  }
  fs.writeFileSync(file, src, 'utf8');
  console.log('✓ 已写回 src/data/balance.js');
}
{
  for (const [id, [patch, text]] of Object.entries(CARD_FIX)) {
    const card = cardsData.cards.find((c) => c.id === id);
    if (!card) continue;
    const heal = (card.effects ?? []).find((e) => e.kind === 'heal');
    if (patch.pct != null) { delete heal.amount; heal.pct = patch.pct; } else { delete heal.pct; heal.amount = patch.amount; }
    const apEff = (card.effects ?? []).find((e) => e.kind === 'ap');
    if (apEff) apEff.n = Math.min(1, apEff.n ?? 1);
    card.text = text;
  }
  fs.writeFileSync(cardsFile, JSON.stringify(cardsData, null, 2) + '\n', 'utf8');
  console.log('✓ 已写回 content/cards.json（含文案）');
}
{
  for (const [id, fixes] of Object.entries(ITEM_FIX)) {
    const item = itemsData.items[id];
    if (!item) continue;
    for (const [key, from, to] of fixes) {
      const mod = (item.hold?.mods ?? []).find((m) => m.key === key);
      if (mod && mod.add === from) mod.add = to;
    }
  }
  fs.writeFileSync(itemsFile, JSON.stringify(itemsData, null, 2) + '\n', 'utf8');
  console.log('✓ 已写回 content/items.json');
}
console.log('\n接着跑：node tools/build-content.mjs → node tools/i18n-todo.mjs list（改过的文案要补译文）');
