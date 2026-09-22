// 卡面文案 vs 引擎效果 的一致性审计。
//
// 起因（玩家反馈）：高费卡完全不如低费连打。
// 查下来有一条比「数值不平衡」更硬的原因：**一批稀有/史诗卡的文案里写着的效果，
// effects 数据里根本没有实现** —— 玩家付了 2~3 费，买到的是半张卡。
// 这个脚本把「文案承诺」逐条对到「数据实现」，跑一次就能看出漏了哪些。
//
// 用法: node tools/audit-card-text.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/cards.json'), 'utf8'));
const cards = data.cards;

const out = [];
const W = (s = '') => out.push(s);

const num = (s) => Number(s);
/**
 * 把一张牌的效果**摊平**：写在 delay（下回合生效）/ trigger（打出 N 张之后）/
 * branch（if-else）里面的，照样是「这张牌会做的事」。
 *
 * 只扫顶层会把「蓄势流」那六张牌误判成「文案承诺、数据没有」——实测假红六张：
 * 血崩 / 悬岩 / 蓄甲 / 数拍 / 龙吼 / 沙漏，效果全都包在 `delay` 或 `trigger` 里。
 */
function allEffects(card) {
  const out = [];
  const walk = (list) => {
    for (const e of list ?? []) {
      out.push(e);
      if (e.effects) walk(e.effects);
      if (e.branch) for (const b of e.branch) walk(b.effects);
      if (e.then) walk([e.then]);
      if (e.else) walk([e.else]);
    }
  };
  walk(card.effects);
  return out;
}
const has = (c, pred) => allEffects(c).some(pred);
const kind = (c, k) => has(c, (e) => e.kind === k);

const rows = [];
const add = (c, claim, ok, detail) => rows.push({ id: c.id, name: c.name, rarity: c.rarity, ap: c.ap, claim, ok, detail });

for (const c of cards) {
  const t = c.text ?? '';

  // ---- 多段攻击：文案「连续 N 次」/「造成 N 次」必须真的打 N 下 ----
  // 「岩石爆击」写的是「造成 3 次 {d} 点伤害」（蓄势牌不写「连续」），所以两种说法都认
  const multi = t.match(/连续\s*(\d+)\s*次/) ?? t.match(/造成\s*(\d+)\s*次/);
  if (multi) {
    const want = num(multi[1]);
    const got = allEffects(c).filter((e) => e.kind === 'damage').reduce((m, e) => Math.max(m, e.hits ?? 1), 0);
    add(c, `连续 ${want} 次`, got === want, `damage.hits = ${got}（应为 ${want}）`);
  } else if (allEffects(c).some((e) => e.kind === 'damage' && (e.hits ?? 1) > 1)) {
    add(c, '多段（文案未标注）', false, `effects 有 hits=${allEffects(c).find((e) => e.hits > 1).hits} 但文案没写「连续 N 次」`);
  }

  // ---- 反伤：文案「自身受到 N 点反伤」 ----
  const recoil = t.match(/自身受到\s*(\d+)\s*点反伤/);
  if (recoil) {
    const ok = has(c, (e) => e.recoilPct != null || e.kind === 'selfDmg');
    add(c, `自身受到 ${recoil[1]} 点反伤`, ok, ok ? '' : 'effects 里没有 recoilPct / selfDmg —— 文案承诺的反伤根本不存在');
  }

  // ---- 吸血 / 回复所造成伤害的一半 ----
  if (/吸取|回复所造成伤害|回复造成伤害/.test(t)) {
    const ok = has(c, (e) => e.drainPct != null) || kind(c, 'heal');
    add(c, '吸取/回血', ok, ok ? '' : 'effects 里没有 drainPct —— 吸血没实现');
  }

  // ---- 破防 ----
  const pierceAll = /无视对手全部防御/.test(t);
  const pierceHalf = /无视对手(?:一半|50%)防御/.test(t);
  if (pierceAll || pierceHalf) {
    const want = pierceAll ? 1 : 0.5;
    const dmg = allEffects(c).filter((e) => e.kind === 'damage');
    const ok = dmg.some((e) => Math.abs((e.ignoreDefPct ?? 0) - want) < 1e-6);
    add(c, pierceAll ? '无视全部防御' : '无视一半防御', ok, ok ? '' : `damage.ignoreDefPct = ${dmg.map((e) => e.ignoreDefPct ?? 0).join('/')}（应为 ${want}）`);
  }

  // ---- 斩杀阈值 ----
  const exec = t.match(/若对手\s*HP\s*低于\s*(\d+)%/);
  if (exec) {
    const want = num(exec[1]) / 100;
    const ok = allEffects(c).some((e) => e.kind === 'damage' && Math.abs((e.execThreshold ?? -1) - want) < 1e-6);
    add(c, `对手 HP < ${exec[1]}% 时强化`, ok, ok ? '' : 'effects 里没有 execThreshold —— 斩杀加成没实现');
  }

  // ---- 抽牌 ----
  const draw = t.match(/抽\s*(\d+)\s*张/);
  if (draw) {
    const want = num(draw[1]);
    const got = allEffects(c).filter((e) => e.kind === 'draw').reduce((s, e) => s + e.n, 0);
    add(c, `抽 ${want} 张`, got === want, got === want ? '' : `draw 合计 ${got}`);
  }

  // ---- 行动点 ----
  const ap = t.match(/回复\s*(\d+)\s*点\s*AP/);
  if (ap) {
    const want = num(ap[1]);
    const got = allEffects(c).filter((e) => e.kind === 'ap').reduce((s, e) => s + (e.n ?? 0), 0);
    add(c, `回复 ${want} 点 AP`, got === want, got === want ? '' : `ap 合计 ${got}`);
  }

  // ---- 护盾 ----
  if (/获得(?:大量)?护盾|获得\s*\d+\s*点护盾/.test(t)) {
    add(c, '获得护盾', kind(c, 'shield'), kind(c, 'shield') ? '' : 'effects 里没有 shield');
  }

  // ---- 属性变化：文案「防御 -5」或「防御 -35%」 ----
  for (const m of t.matchAll(/(攻击|防御|敏捷|幸运)\s*([+\-])(\d+)(%)?/g)) {
    const key = { 攻击: 'atk', 防御: 'def', 敏捷: 'agi', 幸运: 'luck' }[m[1]];
    const sign = m[2] === '-' ? -1 : 1;
    const isPct = m[4] === '%';
    const want = sign * num(m[3]);
    const got = allEffects(c).filter((e) => e.kind === 'buff' && e.stat === key)
      .reduce((s, e) => s + (isPct ? Math.round((e.pct ?? 0) * 100) : (e.amount ?? 0)), 0);
    add(c, `${m[1]} ${m[2]}${m[3]}${m[4] ?? ''}`, got === want, got === want ? '' : `buff 合计 ${got}`);
  }

  // ---- 清状态 ----
  if (/清除/.test(t) && /下降|负面状态/.test(t)) {
    add(c, '净化', kind(c, 'cleanse'), kind(c, 'cleanse') ? '' : 'effects 里没有 cleanse');
  }
}

const bad = rows.filter((r) => !r.ok);

W('=== 文案承诺但数据没实现 / 对不上 ===');
W('');
if (!bad.length) W('（无）');
for (const r of bad) W(`[${r.rarity} ${r.ap}费] ${r.id} ${r.name} · ${r.claim} → ${r.detail}`);
W('');
W(`合计 ${bad.length} 条问题，涉及 ${new Set(bad.map((r) => r.id)).size} 张卡（全部卡牌 ${cards.length} 张，检查项 ${rows.length} 条）`);
W('');
W('=== 按稀有度统计 ===');
const byRar = {};
for (const r of bad) byRar[r.rarity] = (byRar[r.rarity] ?? 0) + 1;
for (const [k, v] of Object.entries(byRar)) W(`  ${k}: ${v} 条`);
W('');
W('=== 全部检查项（含通过的，用来核对检查器本身没瞎报） ===');
for (const r of rows) W(`${r.ok ? 'OK  ' : 'BAD '} ${r.id} ${r.claim}${r.ok ? '' : ' → ' + r.detail}`);

fs.writeFileSync(path.join(root, 'tools', '.audit-card-text.txt'), out.join('\n'), 'utf8');
console.log(`问题 ${bad.length} 条 / ${new Set(bad.map((r) => r.id)).size} 张卡；检查项 ${rows.length} 条 → tools/.audit-card-text.txt`);
/**
 * 退出码：有对不上的就非 0 —— 这一份从 3.1.13 起进了 `author check`（卡面承诺 vs 数据）。
 * 以前它只写报告不看退出码，所以「卡面写 2 个回合、数据是 3」这种问题一直没人拦
 * （那三张蓄势牌就是这么烂掉的）。
 */
if (bad.length) {
  console.log(`❌ 有 ${bad.length} 条卡面文案和效果数据对不上（上面那份报告里有逐条明细）。`);
  process.exitCode = 1;
}
