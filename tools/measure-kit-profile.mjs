// Profile every enemy move pool: how many cards, how many are attacks, their average
// cost, their average power (hits folded in) and how much of the pool is same-type.
//
// 这是「余额没漂」的对账工具：改属性池 / 加招式之后跑一遍，和下面的基线比。
// 基线（改动前的 50 个手挑池子，200 场/档实测的基准）：
//   低档池  8 张 / 6~7 张攻击 / 攻击牌平均费 1.00 / 攻击牌平均威力 105
//   高档池 11 张 / 7~9 张攻击 / 攻击牌平均费 1.25 / 攻击牌平均威力 145
//
// Usage: node tools/measure-kit-profile.mjs [--type 地面] [--kit kit_t_地面]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'enemies.json'), 'utf8'));
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cards.json'), 'utf8')).cards;
const species = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const byId = new Map(cards.map((c) => [c.id, c]));
const args = process.argv.slice(2);
const onlyType = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const onlyKit = args.includes('--kit') ? args[args.indexOf('--kit') + 1] : null;

const rows = [];
for (const [kit, pool] of Object.entries(data.movePools)) {
  if (onlyKit && kit !== onlyKit) continue;
  const type = kit.startsWith('kit_t_') ? kit.replace(/^kit_t_/, '').replace(/_hi$/, '') : null;
  if (onlyType && type !== onlyType) continue;
  // 谁在用这个池子（第一只就够，用来看它到底配给谁了）
  const users = data.enemies.filter((e) => e.deck === kit).map((e) => e.id);
  const stats = pool.map((id) => {
    const c = byId.get(id);
    if (!c) return { id, missing: true };
    const dmg = (c.effects ?? []).filter((e) => e.kind === 'damage').reduce((s, e) => s + (e.power ?? 0) * (e.hits ?? 1), 0);
    return { id, ap: c.ap, dmg, cardType: (c.types ?? [])[0] ?? null };
  });
  const atk = stats.filter((s) => s.dmg > 0);
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const userTypes = [...new Set(users.flatMap((u) => species[u.split('_')[0]]?.types ?? []))];
  rows.push({
    kit, n: pool.length, atk: atk.length,
    avgAp: avg(atk.map((s) => s.ap)),
    avgDmg: avg(atk.map((s) => Math.min(s.dmg, 450))),
    dmgPerAp: avg(atk.filter((s) => s.ap > 0).map((s) => s.dmg / s.ap)),
    missing: stats.filter((s) => s.missing).map((s) => s.id),
    sameType: type ? stats.filter((s) => s.cardType === type).length : null,
    users: users.length,
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('池子', 22) + pad('张数', 5) + pad('攻击', 5) + pad('平均费', 8) + pad('平均威力', 10) + pad('每AP', 7) + pad('本系', 6) + '用它的人');
for (const r of rows) {
  console.log(pad(r.kit, 22) + pad(r.n, 5) + pad(r.atk, 5) +
    pad(r.avgAp.toFixed(2), 8) + pad(r.avgDmg.toFixed(0), 10) + pad(r.dmgPerAp.toFixed(0), 7) +
    pad(r.sameType == null ? '-' : `${r.sameType}/${r.n}`, 6) + r.users +
    (r.missing.length ? `  ⚠ 缺牌 ${r.missing.join(',')}` : ''));
}
const typed = rows.filter((r) => r.sameType != null);
const low = typed.filter((r) => !r.kit.endsWith('_hi'));
const hi = typed.filter((r) => r.kit.endsWith('_hi'));
const mean = (a, f) => (a.length ? (a.reduce((s, r) => s + f(r), 0) / a.length).toFixed(1) : '-');
console.log('');
console.log(`属性池 低档 ${low.length} 个：平均 ${mean(low, (r) => r.n)} 张 / 攻击 ${mean(low, (r) => r.atk)} 张 / 费 ${mean(low, (r) => r.avgAp)} / 威力 ${mean(low, (r) => r.avgDmg)} / 每AP ${mean(low, (r) => r.dmgPerAp)}`);
console.log(`属性池 高档 ${hi.length} 个：平均 ${mean(hi, (r) => r.n)} 张 / 攻击 ${mean(hi, (r) => r.atk)} 张 / 费 ${mean(hi, (r) => r.avgAp)} / 威力 ${mean(hi, (r) => r.avgDmg)} / 每AP ${mean(hi, (r) => r.dmgPerAp)}`);
console.log('基线参考：低档 8 张 / 攻击 6~7 / 费 1.00 / 威力 105 ｜ 高档 11 张 / 攻击 7~9 / 费 1.25 / 威力 145');
