// 收紧**削弱类**卡牌（玩家反馈：「现在削弱敌人属性的卡非常强力，有很多百分比减攻击、防的，消耗还非常低」）。
//
// 量出来的根因有两处，都不在卡面数字上：
//   ① `BALANCE.debuffFloorPct` = { atk: 0.25, def: 0.25, agi: 0.5, luck: 0.5 } ——
//      也就是对手的攻击 / 防御**最多能被削到 25%**（-75%）。削弱牌大多是 1 费、
//      一次 -3~-5，攒三四张就把敌人打回原形：它打你几乎不掉血，你打它刀刀见骨。
//      「消耗还非常低」说的就是这个：**卡本身不贵，攒起来的效果没上限**。
//      改法：atk / def 的底线抬到 0.5（最多 -50%）、agi / luck 抬到 0.6。
//      这条**不动任何卡面文案**（文案只说「让对手攻击 -3」，没说底线）。
//   ② 0 费伤害牌的漏网之鱼：开局那几张 0 费是 30 威力（撞击那一档），
//      但池子里有 0 费 90 威力的（蛛网）。上一版按费用表抬威力时只覆盖了 1~4 费，
//      0 费整档没管到。
//      改法：0 费伤害牌超过 45 威力的一律**改成 1 费**（AP 徽章会跟着变，卡面文案不用改）。
//
// 用法：
//   node tools/rescale-debuff-cards.mjs            # 只报告
//   node tools/rescale-debuff-cards.mjs --apply    # 写回
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

/** ① 属性削减底线（越小越狠） */
const FLOOR = { atk: 0.5, def: 0.5, agi: 0.6, luck: 0.6 };

const cardsFile = path.join(ROOT, 'content', 'cards.json');
const data = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

/** ② 0 费伤害牌的水位（开局的撞击是 30，留一点余量到 45） */
const FREE_POWER_CAP = 45;
const costFix = [];
for (const card of data.cards) {
  if (card.enemyOnly || card.ap !== 0) continue;
  const dmg = (card.effects ?? []).filter((e) => e.kind === 'damage')
    .reduce((n, e) => n + (e.power ?? 0) * (e.hits ?? 1), 0);
  if (dmg > FREE_POWER_CAP) costFix.push({ id: card.id, name: card.name, dmg, from: 0, to: 1 });
}

console.log('=== ① 属性削减底线（debuffFloorPct）===');
const balFile = path.join(ROOT, 'src', 'data', 'balance.js');
const balSrc = fs.readFileSync(balFile, 'utf8');
const line = /debuffFloorPct:\s*\{[^}]*\}/.exec(balSrc)?.[0] ?? '(没找到)';
console.log(`  现在：${line}`);
console.log(`  改成：{ atk: 0.5, def: 0.5, agi: 0.6, luck: 0.6 } —— 攻击 / 防御最多只能削到一半`);

console.log(`\n=== ② 0 费却打出高伤害的卡（改成 1 费）===\n`);
for (const c of costFix) console.log(`  ${c.name.padEnd(8)} 0 费 ${String(c.dmg).padStart(4)} 威力 → 改成 1 费`);

if (!APPLY) {
  console.log('\n（dry run：加 --apply 才写回）');
  process.exit(0);
}

// 写回
fs.writeFileSync(balFile, balSrc.replace(/debuffFloorPct:\s*\{[^}]*\}/,
  'debuffFloorPct: { atk: 0.5, def: 0.5, agi: 0.6, luck: 0.6 }'), 'utf8');
for (const c of costFix) {
  const card = data.cards.find((x) => x.id === c.id);
  if (card) card.ap = 1;
}
fs.writeFileSync(cardsFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`\n✓ 已写回（底线 1 处 + ${costFix.length} 张卡的费）`);
console.log('  接着跑：node tools/build-content.mjs && node tools/simulate-run.mjs 400');
