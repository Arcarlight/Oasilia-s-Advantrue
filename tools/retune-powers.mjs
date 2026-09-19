// 把 content/cards.json 的「威力」从旧的点数制搬到新的百分比制，并把卡面文案里的伤害数字
// 换成 {d} 占位符（由 UI 按当前攻击/防御实时算，见 src/ui/cardtext.js）。
//
// 旧制的问题（tools/measure-cost.mjs 量化过）：威力是加在攻击上的一个点数，
// 攻击长到 50+ 之后威力就被淹没了，0 费牌和 3 费牌打出来差不多疼。
// 新制：威力 = 攻击力的百分比，每个费用档位有自己的「总威力预算」，
// 档位内部保持原来的强弱排序（便宜的牌依然弱、贵的依然强）。
//
// 用法: node tools/retune-powers.mjs          # 打印对照表
//       node tools/retune-powers.mjs --write  # 写回 content/cards.json
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'content', 'cards.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const WRITE = process.argv.includes('--write');

/** 每个费用档位的「总威力预算」（攻击力百分比，含所有段数） */
const BUDGET = {
  0: [25, 45],
  1: [95, 140],
  2: [200, 260],
  3: [310, 420],
  4: [430, 560],
  5: [560, 720],
};
/** 破防要打折：无视一半防御在后期大约多打 17%，全无视多打 40% */
const PIERCE_DISCOUNT = { 0.5: 0.86, 1: 0.71 };
/** 段数越多越怕闪避（每段独立判定），给一点补偿 */
const hitsBonus = (hits) => 1 + 0.05 * Math.max(0, hits - 1);

const oldTotal = (c) => (c.effects ?? []).filter((e) => e.kind === 'damage')
  .reduce((s, e) => s + e.power * (e.hits ?? 1), 0);
const maxHits = (c) => Math.max(1, ...(c.effects ?? []).filter((e) => e.kind === 'damage').map((e) => e.hits ?? 1));

const dmgCards = data.cards.filter((c) => oldTotal(c) > 0);
const byAp = new Map();
for (const c of dmgCards) {
  if (!byAp.has(c.ap)) byAp.set(c.ap, []);
  byAp.get(c.ap).push(c);
}

const rows = [];
for (const [ap, list] of [...byAp].sort((a, b) => a[0] - b[0])) {
  const band = BUDGET[ap] ?? BUDGET[5];
  const totals = list.map(oldTotal);
  const lo = Math.min(...totals), hi = Math.max(...totals);
  for (const c of list) {
    const t = oldTotal(c);
    // 档位内部按旧总威力线性映射到新预算区间
    const k = hi > lo ? (t - lo) / (hi - lo) : 0.5;
    let budget = band[0] + (band[1] - band[0]) * k;
    const pierce = (c.effects ?? []).find((e) => e.kind === 'damage" '.trim() && e.ignoreDefPct);
    const ign = (c.effects ?? []).map((e) => e.ignoreDefPct ?? 0).sort((a, b) => b - a)[0] ?? 0;
    if (PIERCE_DISCOUNT[ign]) budget *= PIERCE_DISCOUNT[ign];
    budget *= hitsBonus(maxHits(c));
    const hits = maxHits(c);
    const per = Math.max(5, Math.round(budget / hits / 5) * 5);   // 5 的倍数，读起来干净
    rows.push({ c, ap, old: t, hits, per, total: per * hits, perAp: (per * hits) / Math.max(1, ap) });
    if (WRITE) {
      for (const e of c.effects) {
        if (e.kind === 'damage') e.power = per;
      }
      // 斩杀加成也从点数制改成百分比：文案是「改为造成原本的 ~1.5 倍」，
      // 所以加成 = 单段威力的一半（而不是把旧的 +5 点顺手乘个数）。
      for (const e of c.effects) {
        if (e.kind === 'damage' && e.execThreshold != null) e.execBonus = Math.round(per * 0.5 / 5) * 5;
      }
    }
  }
}

rows.sort((a, b) => a.ap - b.ap || b.total - a.total);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('AP', 4) + pad('名称', 12) + pad('稀有度', 10) + pad('旧总威力', 9) + pad('段数', 5) + pad('新单段', 7) + pad('新总', 6) + '每AP');
for (const r of [...rows].sort((a, b) => a.ap - b.ap || b.perAp - a.perAp)) {
  console.log(pad(r.ap, 4) + pad(r.c.name, 12) + pad(r.c.rarity, 10) + pad(r.old, 9) + pad(r.hits, 5) + pad(r.per, 7) + pad(r.total, 6) + r.perAp.toFixed(1));
}

if (WRITE) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('\n已写回 content/cards.json');
} else {
  console.log('\n（没有写文件；加 --write 才会写回）');
}
