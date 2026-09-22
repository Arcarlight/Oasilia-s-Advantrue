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
  // 图鉴 / 记录 / 卡牌详情：三块都是**新加的玩家可见界面**，一律纳入这份体检
  'src/ui/codex.js', 'src/ui/records.js', 'src/ui/carddetail.js',
  // HUD 上那几个图标的悬停文字（`title="…"`）也在这里 —— 它同样会被玩家读到，
  // 而且**单文件包里的那份是 tools/bundle.mjs 里抄的第二份**（见下面第 ⑦ 条）
  'index.html',
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
  const STALE = /(回到?卡组最?底端|洗回牌堆最?底端|塞回牌堆|多出来的?直接进弃牌|自动进弃牌堆|出战卡组|出战卡牌|挑选出战)/;
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

console.log('\n⑦ HUD 的按钮、网页标题与标签页图标：index.html 与单文件包模板不许走散');
/**
 * 这条是踩出来的：`index.html` 里 `#btn-deck` 的悬停文字早就改成了
 * 「查看卡组（只读：排序 / 卡牌详情 / 图鉴）」—— 那句话里原本写着**早就删掉的
 * 「挑选出战卡牌」**（玩家一悬停就会读到）。而单文件包里的 HTML 是
 * `tools/bundle.mjs` 里**另抄的一份**，那份一直没跟着改：
 * 线上（GitHub Pages 跑的正是单文件包）和本地开发页显示的是两套话。
 *
 * 判据：两边所有 `<button id="…" title="…">` 的 id → title 映射必须一致。
 * 新增 HUD 按钮时只改一处，这条就会红。
 *
 * 第二起（用户点出来的）：「网页标题到现在都没改」—— 顺带把 `<title>` 与
 * `<link rel="icon">` 也钉在这里，而且**图标文件必须真的存在**：
 * 换图标时只改一处、或者删了文件忘了改引用，都会红。
 */
{
  const hudButtons = (text) => {
    const out = new Map();
    for (const m of text.matchAll(/<button\b[^>]*>/g)) {
      const tag = m[0];
      const id = /\bid="([^"]+)"/.exec(tag)?.[1];
      if (!id) continue;
      out.set(id, /\btitle="([^"]*)"/.exec(tag)?.[1] ?? '');
    }
    return out;
  };
  const devHtml = rd('index.html');
  const bundleSrc = rd('tools/bundle.mjs');
  const dev = hudButtons(devHtml);
  const bundled = hudButtons(bundleSrc);
  const ids = [...new Set([...dev.keys(), ...bundled.keys()])].sort();
  const drift = ids.filter((id) => dev.get(id) !== bundled.get(id))
    .map((id) => `${id}：index.html「${dev.get(id) ?? '（没有）'}」vs bundle.mjs「${bundled.get(id) ?? '（没有）'}」`);
  ok(!drift.length, `index.html 与 tools/bundle.mjs 的 ${ids.length} 个按钮 id / 悬停文字完全一致`,
    drift.join(' ｜ ') || ids.join('、'));

  // 标题：两处必须一模一样（标题里带语言，切语言时的第二份由 langswitch.js 现取）
  const titleOf = (text) => /<title>([^<]*)<\/title>/.exec(text)?.[1] ?? '';
  const devTitle = titleOf(devHtml);
  const bndTitle = titleOf(bundleSrc);
  ok(devTitle && devTitle === bndTitle, '两处的网页标题一字不差', `「${devTitle}」vs「${bndTitle}」`);
  ok(!/Oasis · 流沙卡牌冒险/.test(devTitle), '标题不再是早期那一版占位文案', devTitle);

  // 标签页图标：引用一致 + 文件真的在（.ico 而不是精灵图条）
  const iconOf = (text) => /<link[^>]*rel="icon"[^>]*href="([^"]+)"/.exec(text)?.[1]
    ?? /<link[^>]*href="([^"]+)"[^>]*rel="icon"/.exec(text)?.[1] ?? '';
  const devIcon = iconOf(devHtml);
  const bndIcon = iconOf(bundleSrc);
  ok(devIcon && devIcon === bndIcon, '两处的标签页图标指向同一个文件', `${devIcon} vs ${bndIcon}`);
  ok(/\.ico$/.test(devIcon), '图标用的是 .ico（不是拿精灵图的整张图条当图标）', devIcon);
  ok(fs.existsSync(path.join(ROOT, devIcon)), '图标文件真的在', devIcon);
}

/**
 * ⑧ 文案**渲染出来**以后不许还剩占位符 / `**`
 *
 * 两起用户实测：
 *   · 商店里那张「薄雾场地」印着「シールドを {s} 得て」—— `resolveCardText` 当时只替换 {d}/{d2}；
 *   · 卡牌图鉴里「转嫁」的描述原样印出 `**全部转移给对手**` —— 高亮规则把 `**` 从中间切开了，
 *     逐段 replace 谁都匹配不上。
 * 这里把**全部卡牌 + 物品 + 事件 + 敌人台词**按当前语言的模板跑一遍（用假值填占位符），
 * 检查渲染结果里没有残留的 `{x}` 与 `**`。三语各跑一次。
 */
{
  const { setLang, dictOf } = await import('../src/core/i18n.js');
  const { refreshI18nTables } = await import('../src/core/i18n-tables.js');
  const { resolveCardText, richHTML } = await import('../src/ui/cardtext.js');
  const { CARDS } = await import('../src/data/cards.js');
// 道具（手持道具）已经搬进自己的模块：这里的 desc / use 效果文案也要一起过一遍
const { ITEMS } = await import('../src/data/items.js');
  const { EVENTS } = await import('../src/data/events.js');
  const { ENEMIES } = await import('../src/data/enemies.js');

  /**
   * 占位符的假值表：**字典里出现过的每一个占位符都要在这里**（98 个），
   * 少一个就会误报「残留占位符」—— 所以下面用 1 / 'X' 兜底，只要求「填得进去」。
   * 真正要抓的是「译文里有、代码里没传」的占位符（那种在界面上就是原样印出来的 `{x}`）。
   */
  const sample = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? (/^(n|s|d|d2|per|hits|pct|ap|cost|hp|gold|amount|total|…|\w*[Nn]um|\w*[Cc]ount)$/.test(k) ? 3 : 'X') : undefined), has: () => true });
  const bad = [];
  for (const lang of ['zh', 'ja', 'en']) {
    if (lang === 'zh') setLang('zh', { silent: true });
    else { setLang(lang, { silent: true }); refreshI18nTables(); }
    const scan = (where, text) => {
      if (typeof text !== 'string' || !text) return;
      // 属性文本（data-tip）里的 `**` 由 tips.js 负责转，不算「印在界面上的星号」
      const body = text.replace(/data-tip="[^"]*"/g, '');
      if (/\{[a-zA-Z_]\w*\}/.test(body)) bad.push(`${lang} ${where} 残留占位符 ${/\{[a-zA-Z_]\w*\}/.exec(body)[0]}`);
      else if (body.includes('**')) bad.push(`${lang} ${where} 残留 **`);
    };
    for (const c of CARDS) scan(`card:${c.id}`, richHTML(resolveCardText(c)));
    for (const [id, it] of Object.entries(ITEMS)) scan(`item:${id}`, richHTML(it.desc ?? ''));
    for (const ev of EVENTS) {
      scan(`event:${ev.id}`, richHTML(ev.text ?? ''));
      for (const o of ev.options ?? []) scan(`event:${ev.id}`, richHTML(o.text ?? o.hint ?? ''));
    }
    for (const e of ENEMIES) for (const l of e.lines ?? []) scan(`enemy:${e.id}`, richHTML(l));
    // 字典里每一条也过一遍（填上假值再看残留）
    for (const [zh, tr] of Object.entries(dictOf(lang))) {
      scan(`dict:${zh.slice(0, 14)}`, richHTML(String(tr).replace(/\{(\w+)\}/g, (m, k) => (k in sample ? String(sample[k]) : m))));
    }
  }
  setLang('zh', { silent: true });
  refreshI18nTables();
  ok(bad.length === 0, '三语渲染后都没有残留的 {占位符} / **（卡牌 · 物品 · 事件 · 台词 · 字典）',
    bad.slice(0, 4).join(' ｜ ') || '全部干净');
}

/**
 * ⑨ 已经删掉 / 改名的东西，不许再出现在玩家读得到的字里
 *
 * 用户报的：「有些事件还有好伤药、伤药之类的已经没了的东西，以及卡牌名之类的」——
 * 一查一串：9 条事件标签还在发「好伤药 / 厉害伤药 / 活力药」（那三件道具早就改名成了
 * 橙橙果 / 文柚果 / 甜甜苹果），一条事件正文写着「一瓶高级伤药」，
 * 一条更新日志写着「哞哞牛奶」（现在是哞哞鲜奶），说明页整栏还写着药水与「战斗中随时能用」。
 *
 * 这份清单是**手写**的：只有「真的删掉 / 改名过」的名字才进来。
 * 判据细节：
 *   · 命中处若正好落在**现役名字**里（「甜苹果」⊂「甜甜苹果」）不算；
 *   · 同一行里有 `→` 的算**改名说明**（更新日志里「毒液吸取 → 剧毒汲取」那种），不算。
 */
{
  const DEAD = [
    // 道具：旧版药水三条 + 其它改名过的
    '好伤药', '厉害伤药', '活力药', '高级伤药', '哞哞牛奶', '专家腰带', '元气之根', '光之粉',
    '光滑岩石', '力量之羽', '发光苔', '坚硬石头', '妖异石板', '妖精羽毛', '寒冷岩石', '恶之石板',
    '漂亮羽毛', '甜苹果', '紧绑之爪', '蜂蜜', '贝壳铃', '钢铁宝石', '龙之鳞',
    // 卡牌：改名过的两张
    '毒液吸取', '毒针连刺',
  ];
  /** 现在还在用的名字（命中落在这些里面就不算） */
  const liveCards = JSON.parse(rd('content/cards.json')).cards.map((c) => c.name);
  const liveItems = Object.values(JSON.parse(rd('content/items.json')).items).map((i) => i.name);
  const live = [...liveCards, ...liveItems];
  const SCAN = [
    ...fs.readdirSync(path.join(ROOT, 'content/events')).filter((f) => f.endsWith('.json')).map((f) => `content/events/${f}`),
    'content/cards.json', 'content/items.json', 'content/enemy-voice.json', 'content/enemy-intro.json',
    'content/merchants.json', 'content/biomes.json',
    'src/core/changelog-data.js', 'src/ui/overlays.js', 'src/ui/screens.js', 'src/ui/codex.js',
    'src/ui/cardtext.js', 'src/ui/cards.js', 'src/ui/carddetail.js', 'src/ui/records.js', 'src/ui/tips.js',
    'index.html',
  ];
  const hits = [];
  for (const rel of SCAN) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    rd(rel).split('\n').forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
      for (const dead of DEAD) {
        let at = line.indexOf(dead);
        while (at >= 0) {
          /** 命中处是不是正落在某个现役名字里？（「甜苹果」在「甜甜苹果」里） */
          const insideLive = live.some((n) => {
            let p = line.indexOf(n);
            while (p >= 0) {
              if (p <= at && at + dead.length <= p + n.length) return true;
              p = line.indexOf(n, p + 1);
            }
            return false;
          });
          if (!insideLive && !line.includes('→')) hits.push(`${rel}:${i + 1} 「${dead}」`);
          at = line.indexOf(dead, at + 1);
        }
      }
    });
  }
  ok(!hits.length, `删掉 / 改名过的 ${DEAD.length} 个名字没有残留在玩家读得到的字里`,
    hits.slice(0, 6).join(' ｜ ') || `扫了 ${SCAN.length} 个文件`);
}

/**
 * ⑩ 同一个名字不许对应两种东西（三语各查一遍）
 *
 * 用户让「把文案都对齐一下」时顺手挖出来的：日文里**橙橙果和文柚果都叫「オレンのみ」**、
 * 木子果和桃桃果都叫「モモンのみ」，英文里木子果和桃桃果都叫「Pecha Berry」——
 * 玩家看到的是「两种不一样的果子挂着同一个名字」，而中文 / 数据 / 掉落全都是对的，
 * 所以任何数据门禁都抓不到它。
 *
 * 判据：**同一类东西内部**（道具 / 卡牌 / 物种）译名必须唯一。
 * 跨类允许重名（道具「文柚果」和卡牌「文柚果」是两件不同的东西，这是设计）。
 */
{
  const dicts = { ja: JSON.parse(rd('content/i18n/ja.json')), en: JSON.parse(rd('content/i18n/en.json')) };
  const groups = {
    道具: Object.values(JSON.parse(rd('content/items.json')).items).map((i) => i.name),
    卡牌: JSON.parse(rd('content/cards.json')).cards.map((c) => c.name),
    物种: Object.values(JSON.parse(rd('content/species.json')).species).map((s) => s.name),
  };
  const bad = [];
  for (const [lang, dict] of Object.entries(dicts)) {
    for (const [label, names] of Object.entries(groups)) {
      const seen = new Map();
      for (const zh of names) {
        const v = dict[zh];
        if (!v) continue;
        if (!seen.has(v)) seen.set(v, []);
        seen.get(v).push(zh);
      }
      for (const [v, list] of seen) if (list.length > 1) bad.push(`${lang} ${label}：${v} ← ${list.join(' + ')}`);
    }
  }
  ok(!bad.length, '三语里每一件道具 / 每一张卡 / 每一只宝可梦的名字都唯一', bad.slice(0, 6).join(' ｜ ') || '没有重名');
}

/**
 * ⑪ 事件标签说的那件东西，必须就是它真正发的那件
 *
 * 「（获得好伤药 ×2）」这种标签是**手写的**，而实际发什么由 effects.item 决定 ——
 * 两者对不上时玩家会看到「标题说给好伤药、结算说拿到橙橙果」（用户报的就是这个）。
 * 这里把 21 个发道具的事件选项全查一遍：标签里点名的东西和数量都要对得上。
 */
{
  const byId = new Map(Object.entries(JSON.parse(rd('content/items.json')).items));
  const dir = path.join(ROOT, 'content/events');
  const bad = [];
  let n = 0;
  const collect = (fxs, out) => {
    for (const fx of fxs ?? []) {
      if (fx.item) out.push(typeof fx.item === 'string' ? { id: fx.item, n: 1 } : { id: fx.item.id, n: fx.item.n ?? 1 });
      if (fx.branch) for (const b of fx.branch) collect(b.effects, out);
      if (fx.then) collect([fx.then], out);
      if (fx.else) collect([fx.else], out);
    }
    return out;
  };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;   // _checklist 是设计清单，不加载
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const e of (data.events ?? data)) {
      for (const o of (e.options ?? [])) {
        const grants = collect(o.effects, []);
        if (!grants.length) continue;
        const m = /获得([^\s（），、×]{2,8})(?:\s*×\s*(\d+))?/.exec(o.label ?? '');
        if (!m) continue;
        /**
         * 只查「标签点名了一件**现役道具**」的情况：
         * 「获得道具与金币」「获得一件道具」这类笼统说法是故意的（不剧透掉什么），跳过。
         * 标签点名了**已经不存在的**道具时，由第 ⑨ 条（删掉的名字）负责抓。
         */
        const named = [...byId.values()].find((it) => it.name === m[1]);
        if (!named) continue;
        n++;
        const want = byId.get(grants[0].id);
        if (!want) { bad.push(`${f}【${e.id}】标签发的是一张不存在的道具 id：${grants[0].id}`); continue; }
        if (m[1] !== want.name) bad.push(`${f}【${e.id}】标签写「${m[1]}」、实际发「${want.name}」`);
        const labelN = m[2] ? Number(m[2]) : 1;
        const granted = grants.filter((g) => g.id === grants[0].id).reduce((s, g) => s + g.n, 0);
        if (labelN !== granted) bad.push(`${f}【${e.id}】标签写 ×${labelN}、实际给 ×${granted}`);
      }
    }
  }
  ok(!bad.length, `点名了道具的 ${n} 条事件标签，名字与数量都和实际发放一致`, bad.slice(0, 6).join(' ｜ '));
}

console.log(`\n文案体检：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
