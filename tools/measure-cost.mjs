// 「费用到底买到了什么」：把每张伤害牌在给定攻防下打成实际伤害，算每点 AP 换来的伤害。
//
// 起因（玩家反馈）：「高费卡完全不如低费卡的连打招」。
// 这个脚本就是那句反馈的量化：如果每 AP 伤害随费用**下降**，那么费用越高越亏，
// 玩家最优解永远是把 0 费牌打满。
//
// 用法: node tools/measure-cost.mjs [攻击力] [敌方防御]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { CARDS } = await imp('src/data/cards.js');
const { computeHit, effectiveAtk } = await imp('src/core/battle.js');
const { BALANCE } = await imp('src/data/balance.js');

const ATK = Number(process.argv[2] ?? BALANCE.player.atk);
const DEF = Number(process.argv[3] ?? 11);

const attacker = { atk: ATK, atkMod: 0, weak: 0, strength: 0 };
const defender = { def: DEF, defMod: 0, bleed: 0 };

const rows = [];
for (const c of CARDS) {
  if (c.enemyOnly) continue;
  const dmgEffs = (c.effects ?? []).filter((e) => e.kind === 'damage');
  if (!dmgEffs.length) continue;
  let total = 0;
  let mult = 0;
  for (const e of dmgEffs) {
    total += computeHit(attacker, defender, e.power, { ignoreDefPct: e.ignoreDefPct ?? 0 }) * (e.hits ?? 1);
    mult += e.power * (e.hits ?? 1);
  }
  rows.push({ c, total, mult, perAp: total / Math.max(1, c.ap) });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`攻击 ${ATK} / 敌方防御 ${DEF}（减伤系数 ${(BALANCE.armorK / (BALANCE.armorK + DEF)).toFixed(3)}）`);
console.log('');
console.log(pad('AP', 5) + pad('张数', 6) + pad('每 AP 最低伤害', 15) + pad('每 AP 平均', 11) + pad('每 AP 最高', 12) + '最高那张');
for (const ap of [0, 1, 2, 3, 4, 5]) {
  const g = rows.filter((r) => r.c.ap === ap);
  if (!g.length) continue;
  const per = g.map((r) => r.perAp);
  const best = g.reduce((a, b) => (b.perAp > a.perAp ? b : a));
  console.log(
    pad(ap, 5) + pad(g.length, 6) +
    pad(Math.min(...per).toFixed(1), 15) + pad((per.reduce((a, b) => a + b, 0) / per.length).toFixed(1), 11) +
    pad(Math.max(...per).toFixed(1), 12) + `${best.c.name} ${best.total.toFixed(0)} 伤害`,
  );
}

console.log('\n=== 每 AP 伤害最高的 12 张 ===');
for (const r of [...rows].sort((a, b) => b.perAp - a.perAp).slice(0, 12)) {
  console.log(`  ${pad(r.c.name, 10)} ${r.c.ap}费 ${pad(r.c.rarity, 9)} 伤害 ${pad(r.total.toFixed(0), 5)} 每AP ${r.perAp.toFixed(1)}`);
}
console.log('\n=== 每 AP 伤害最低的 12 张 ===');
for (const r of [...rows].sort((a, b) => a.perAp - b.perAp).slice(0, 12)) {
  console.log(`  ${pad(r.c.name, 10)} ${r.c.ap}费 ${pad(r.c.rarity, 9)} 伤害 ${pad(r.total.toFixed(0), 5)} 每AP ${r.perAp.toFixed(1)}`);
}

// 一个回合内最能打的一套：AP 上限、出牌上限都用满，按每 AP 伤害贪心
const APMAX = BALANCE.apMax;
const PLAYS = BALANCE.playMax;
function bestTurn(allow) {
  let ap = APMAX, plays = PLAYS, dmg = 0, used = [];
  const pool = rows.filter((r) => allow(r.c)).sort((a, b) => b.perAp - a.perAp);
  let guard = 0;
  while (plays > 0 && guard++ < 50) {
    const pick = pool.find((r) => r.c.ap <= ap);
    if (!pick) break;
    ap -= pick.c.ap; plays -= 1; dmg += pick.total; used.push(pick.c.name);
  }
  return { dmg, n: used.length, used };
}
const all = bestTurn(() => true);
const expensive = bestTurn((c) => c.ap >= 2);
console.log(`\n=== 一回合（${APMAX} AP / ${PLAYS} 次出牌）最多能打多少 ===`);
console.log(`  全卡池最优：${all.dmg.toFixed(0)} 伤害，${all.n} 张 → ${all.used.join('、')}`);
console.log(`  只用 2 费以上：${expensive.dmg.toFixed(0)} 伤害，${expensive.n} 张 → ${expensive.used.join('、')}`);
console.log(`  → 高费套打出的伤害是全卡池最优的 ${(expensive.dmg / all.dmg * 100).toFixed(0)}%`);
