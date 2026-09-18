// 平衡核对表：打印各章各档敌人的实际数值、双方每回合输出、击杀/存活回合。
// 用法: node tools/check-balance.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { playsFromAgi, apFromAgi, drawFromAgi, handFromAgi, BALANCE } = await imp('src/data/balance.js');
const { ENEMY_BY_ID, scaleEnemy, TIERS } = await imp('src/data/enemies.js');
const TIER_DEF = { mob: 2, normal: 3, elite: 5, boss: 8 };
const { computeHit, effectiveAtk } = await imp('src/core/battle.js');
const { CARD_BY_ID, STARTER_DECK } = await imp('src/data/cards.js');

// 玩家成长曲线（设计目标，与 solve-cards.mjs 一致）
const P = [
  { atk: 12, def: 12, maxHp: 140, agi: 10, luck: 5, deck: STARTER_DECK, label: '起始卡组' },
  { atk: 22, def: 18, maxHp: 170, agi: 15, luck: 9, deck: [...STARTER_DECK, 'dragon_breath', 'crunch', 'rock_blast', 'bulk_up', 'iron_defense', 'roost'], label: '+中阶卡' },
  { atk: 32, def: 26, maxHp: 210, agi: 19, luck: 12, deck: [...STARTER_DECK, 'dragon_claw', 'earthquake', 'boomburst', 'superpower', 'dragon_darts', 'fire_fang', 'rock_slide', 'crunch', 'bulk_up', 'protect', 'roost'], label: '+高阶卡' },
];

const AVG_ENEMY_POWER = 6; // 敌方常见招式（地震 10 / 龙爪 10 / 咬住 4 / 落石 3）的平均威力
const ENEMY_PLAYS = 3;

function playerDamagePerTurn(stage, enemyDef) {
  const p = P[stage];
  const plays = playsFromAgi(p.agi);
  const dmgCards = p.deck.map((id) => CARD_BY_ID[id]).filter((c) => c && c.effects.some((e) => e.kind === 'damage'));
  // 取卡组里伤害最高的 plays 张（贪心 AI 的近似），费用不够时打折
  const withPower = dmgCards
    .map((c) => c.effects.filter((e) => e.kind === 'damage').reduce((s, e) => s + e.power * (e.hits ?? 1), 0))
    .sort((a, b) => b - a);
  const top = withPower.slice(0, plays);
  const avgPower = top.reduce((a, b) => a + b, 0) / top.length;
  const raw = effectiveAtk({ atk: p.atk, strength: 0 }) + avgPower;
  const dmg = Math.round((raw * BALANCE.armorK) / (BALANCE.armorK + enemyDef));
  return { dpt: plays * dmg, plays, avgPower: avgPower.toFixed(1), perHit: dmg };
}

function enemyDamagePerTurn(stage, tier) {
  const p = P[stage];
  const id = { mob: 'sandshrew', normal: 'sandslash', elite: 'steelix', boss: 'tyranitar' }[tier];
  const s = scaleEnemy(ENEMY_BY_ID[id], stage, 4);
  const raw = s.atk + AVG_ENEMY_POWER;
  const dmg = Math.round((raw * BALANCE.armorK) / (BALANCE.armorK + p.def));
  return { dpt: ENEMY_PLAYS * dmg, perHit: dmg, stat: s };
}

const pad = (s, n) => String(s).padEnd(n);
console.log('玩家成长曲线：');
for (const p of P) {
  console.log(`  ATK${String(p.atk).padStart(2)} DEF${p.def} HP${String(p.maxHp).padStart(3)} AGI${p.agi} 运${p.luck} → ${playsFromAgi(p.agi)}出牌/${apFromAgi(p.agi)}AP/抽${drawFromAgi(p.agi)}/手牌${handFromAgi(p.agi)}  （${p.label}，${p.deck.length} 张）`);
}

console.log('\n' + pad('章节', 6) + pad('档位', 8) + pad('敌人HP', 8) + pad('敌攻', 6) + pad('敌防', 6) + pad('敌DPT', 8) + pad('占玩家HP', 10) + pad('玩家DPT', 9) + pad('击杀回合', 10) + '存活回合');
for (let stage = 0; stage < 3; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const e = enemyDamagePerTurn(stage, tier);
    const p = playerDamagePerTurn(stage, TIER_DEF[tier] + stage * 1.5);
    console.log(
      pad('第' + (stage + 1) + '章', 6) + pad(TIERS[tier].name, 8) +
      pad(e.stat.hp, 8) + pad(e.stat.atk, 6) + pad(e.stat.def, 6) +
      pad(e.dpt, 8) + pad((e.dpt / P[stage].maxHp * 100).toFixed(0) + '%', 10) +
      pad(Math.round(p.dpt), 9) + pad((e.stat.hp / p.dpt).toFixed(1), 10) +
      (P[stage].maxHp / e.dpt).toFixed(1),
    );
  }
}

console.log('\n细节：');
for (let stage = 0; stage < 3; stage++) {
  const e = enemyDamagePerTurn(stage, 'normal');
  const p = playerDamagePerTurn(stage, e.stat.def);
  console.log(`  第${stage + 1}章 普通怪：玩家每回合 ${p.plays} 张，平均威力 ${p.avgPower}，单次 ${p.perHit}；敌人单次 ${e.perHit}（攻 ${e.stat.atk} + 牌均威力 ${AVG_ENEMY_POWER}，减去玩家 DF ${P[stage].def}）`);
}
