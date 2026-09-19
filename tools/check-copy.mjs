// 文案体检：把**玩家能读到的字**跟引擎实际情况对一遍。
//
// 起因（用户要求）：「检查所有文案，检查是否有不一致的情况，并把额外的类似
// 『以前是XXX现在是XXX』这种莫名其妙的文案删掉。」
// 一次手工扫下来，真找出好几类问题：
//   · 规则改了、文案没跟着改（「抽满后多出来的直接进弃牌堆」—— 那条规则当天刚改成
//     「抽到手牌满为止」，一处改了两处漏）；
//   · 机制公式在文案里手抄了一份（护盾的「防御 × 0.75」抄了三处，其中两处是错的）；
//   · 开发口气漏进玩家界面（「以前能只带两张…」）；
//   · 早就删掉的概念还挂在文案里（「出战卡组」）；
//   · 结算页把章节数写死成 3（实际 6 章）；
//   · 同一件事在界面上有两套说法（阵亡页同时写「回家洗澡下次再来」和「风把痕迹吹平了」）。
// 这份门禁把这几类钉住 —— 它们都不会让游戏崩，只会让玩家读到不对的话。
//
// 用法：node tools/check-copy.mjs        （有 FAIL 时退出码 1）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
let pass = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

// ---------------------------------------------------------------- 1. 玩家可见的字符串
/** 从 JS 源码里抠出**用户可见**的中文串（跳过注释行） */
function uiStrings(file) {
  const out = [];
  rd(file).split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    for (const m of line.matchAll(/`([^`]*)`|'([^']*)'|"([^"]*)"/g)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (s && /[\u4e00-\u9fa5]/.test(s)) out.push({ file, line: i + 1, s });
    }
  });
  return out;
}

const UI_FILES = [
  'src/ui/battle-view.js', 'src/ui/cards.js', 'src/ui/cardtext.js', 'src/ui/hud.js',
  'src/ui/overlays.js', 'src/ui/screens.js', 'src/ui/tips.js',
];
const strings = UI_FILES.flatMap(uiStrings);

console.log('\n① 界面文案里不该出现的口气');
/** 开发口气 / 更新日志：玩家不该读到「以前是 X 现在是 Y」 */
const META = /(以前(?!.{0,4}(很久|有人|的路标))|曾经|旧版|旧写法|早先|第一版|第二版|已回退|玩家反馈|用户反馈|有人反馈)/;
{
  const hits = strings.filter((x) => META.test(x.s));
  ok(!hits.length, '界面文案里没有「以前是…现在是…」这类开发口气',
    hits.map((h) => `${h.file}:${h.line} ${h.s.slice(0, 50)}`).join(' ｜ ') || `扫了 ${strings.length} 条字符串`);
}

console.log('\n② 已经改掉的旧规则');
{
  const STALE = /(回到?卡组最?底端|洗回牌堆最?底端|塞回牌堆|多出来的?直接进弃牌|自动进弃牌堆|出战卡组)/;
  const hits = strings.filter((x) => STALE.test(x.s));
  ok(!hits.length, '界面文案里没有旧规则 / 旧概念的残留（「牌回到卡组最底端」「出战卡组」…）',
    hits.map((h) => `${h.file}:${h.line} ${h.s.slice(0, 60)}`).join(' ｜ ') || '');
}

console.log('\n③ 机制公式不在文案里手抄第二份');
{
  // BALANCE 里的值一旦改了，文案里写死的数字就会悄悄过期 —— 一律要求用 ${BALANCE.x}
  const HARD = [
    { re: /\d\s*[+＋]\s*敏捷|敏捷\s*[÷/]\s*\d/, name: '敏捷公式里写死了数字（应取 BALANCE.*Base / *PerAgi）' },
    { re: /上限\s*\d/, name: '「上限 N」写死了（应取 BALANCE.*Max）' },
    { re: /×\s*1\.6/, name: '暴击倍率 ×1.6（应取 BALANCE.luckCritMult）' },
    { re: /防御\s*×\s*0\.75/, name: '护盾系数 ×0.75（应现算 amount ÷ 12）' },
    { re: /威力%\s*×\s*40|×\s*40\s*[÷/]/, name: 'armorK 40（应取 BALANCE.armorK）' },
  ];
  const hits = [];
  for (const x of strings) for (const h of HARD) if (h.re.test(x.s)) hits.push(`${x.file}:${x.line} ${h.name}`);
  ok(!hits.length, '文案里的公式数字全部取自 BALANCE / 引擎常量', hits.join(' ｜ ') || '');
}

console.log('\n④ 卡面护盾公式 vs 引擎（amount × (1 + 防御 ÷ 12)）');
{
  const DEF_DIVISOR = 12;
  const cards = JSON.parse(rd('content/cards.json')).cards;
  const bad = [];
  let n = 0;
  for (const c of cards) {
    const m = (c.text ?? '').match(/随防御成长[^）]*?约\s*(\d+)\s*\+\s*防御\s*×\s*([\d.]+)/);
    if (!m) continue;
    n++;
    const sh = (c.effects ?? []).find((e) => e.kind === 'shield');
    if (!sh) { bad.push(`【${c.name}】文案有护盾公式但没 shield 效果`); continue; }
    if (Number(m[1]) !== sh.amount) bad.push(`【${c.name}】基数：文案 ${m[1]} vs 数据 ${sh.amount}`);
    const real = sh.amount / DEF_DIVISOR;
    if (Math.abs(real - Number(m[2])) > 0.005) bad.push(`【${c.name}】系数：文案 ×${m[2]} vs 实际 ×${real.toFixed(2)}`);
  }
  ok(!bad.length, `卡面印了护盾公式的 ${n} 张卡，基数和系数都和引擎一致`, bad.join(' ｜ '));
}

console.log('\n⑤ 事件文案里的数值 vs effects');
{
  const dir = path.join(ROOT, 'content/events');
  const STAT_CN = { maxHp: '最大生命', atk: '攻击', def: '防御', agi: '敏捷', luck: '幸运' };
  const bad = [];
  let n = 0;
  const flatten = (fxs, gain) => {
    for (const fx of fxs ?? []) {
      for (const [k, v] of Object.entries(fx.stat ?? {})) if (gain[k] != null) gain[k] += v;
      if (fx.hp != null) gain.hp += fx.hp;
      // goldRange 是区间，没法逐一比对，跳过
      if (fx.branch) for (const b of fx.branch) flatten(b.effects, gain);
    }
  };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;   // _checklist.json 是设计清单，不加载
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const e of (data.events ?? data)) {
      for (const o of (e.options ?? [])) {
        if ((o.effects ?? []).some((x) => x.branch)) continue;   // 分支选项的写法是「60% … / 40% …」
        const gain = { maxHp: 0, atk: 0, def: 0, agi: 0, luck: 0, hp: 0 };
        flatten(o.effects, gain);
        const where = `${f}【${e.name ?? e.id}】`;
        for (const m of (o.label ?? '').matchAll(/（\s*(最大生命|攻击|防御|敏捷|幸运)\s*([+-]\d+)\s*）/g)) {
          const key = Object.entries(STAT_CN).find(([, cn]) => cn === m[1])[0];
          n++;
          if (gain[key] !== Number(m[2])) bad.push(`${where}标签「${m[1]} ${m[2]}」vs 数据 ${gain[key]}`);
        }
        for (const m of (o.label ?? '').matchAll(/回复\s*(\d+)\s*HP/g)) {
          n++;
          if (gain.hp !== Number(m[1])) bad.push(`${where}标签「回复 ${m[1]} HP」vs 数据 ${gain.hp}`);
        }
        for (const m of (o.text ?? '').matchAll(/(最大生命|攻击|防御|敏捷|幸运)\s*\+(\d+)/g)) {
          const key = Object.entries(STAT_CN).find(([, cn]) => cn === m[1])[0];
          n++;
          if (gain[key] !== Number(m[2])) bad.push(`${where}正文「${m[1]} +${m[2]}」vs 数据 +${gain[key]}`);
        }
      }
    }
  }
  ok(!bad.length, `${n} 条事件数值声明全部和 effects 对得上`, bad.slice(0, 6).join(' ｜ '));
}

console.log('\n⑥ 结算页里的章节数取自 stageCount()');
{
  const src = rd('src/ui/screens.js');
  const hard = [...src.matchAll(/推进章节[^\n]*?\/\s*(\d+)/g)].map((m) => m[1]);
  ok(!hard.length, '「推进章节」用的是 stageCount()，没有把章节数写死',
    hard.length ? `写死成 ${hard.join(' / ')}` : '');
}

console.log(`\n文案体检：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
