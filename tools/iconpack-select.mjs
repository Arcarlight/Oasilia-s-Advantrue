// iconpack-select.mjs — 生成「游戏概念 → 图标名」选型草表，并用仓库快照 + Icon_Catalog.json 逐条校验。
//
// 用法：
//   node tools/iconpack-select.mjs --svg <解压出的 svg 根>
// 产出：
//   tools/icon-semantics-draft.json   机读版草表（可直接喂给下一步接线）
//   stdout                             Markdown 表格 + 体积估算（贴进 tools/iconpack-report.md）
//
// 设计原则：候选名不是我凭空写的，全部要能在快照里找到文件，否则报 NOT-FOUND。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const svgRoot = arg('--svg', path.join(process.env.TEMP || '/tmp', 'gip', 'repo', 'game-icon-pack-main', 'svg'));

// component_name -> { category, bytes(no-padding) }
const index = new Map();
for (const variant of ['no-padding', 'padding']) {
  const base = path.join(svgRoot, variant);
  if (!fs.existsSync(base)) continue;
  for (const cat of fs.readdirSync(base)) {
    for (const f of fs.readdirSync(path.join(base, cat))) {
      if (!f.endsWith('.svg')) continue;
      const name = f.replace(/\.svg$/, '');
      const bytes = fs.statSync(path.join(base, cat, f)).size;
      if (variant === 'no-padding') index.set(name, { category: cat, bytes });
      else index.get(name).bytesPadding = bytes;
    }
  }
}

const catalog = new Map(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'icon-catalog.json'), 'utf8')).map((e) => [e.component_name, e]),
);

// ---------------------------------------------------------------- 选型草表
// [分组, 概念, [候选 component_name...（第一个是首选）], 备注]
const DRAFT = [
  ['卡牌语义', '物理攻击', ['sword', 'broadsword', 'axe'], '包里没有「拳头/徒手」，sword 语义最正；broadsword 更重，axe 偏劈砍'],
  ['卡牌语义', '连击', ['double', 'triple', 'hit-effect'], 'double/triple 是纯文本 2x/3x（和 AP/HP 同款），hit-effect 是爆炸星'],
  ['卡牌语义', '远程/投掷', ['bow', 'missile', 'spear'], '弓/导弹/长矛；没有飞刀、没有投石'],
  ['卡牌语义', '龙息', ['volcanic-eruption', 'fire', 'thunderstorm'], '包里没有龙/喷火生物，火山喷发是最接近的「大口喷出」形态'],
  ['卡牌语义', '火焰', ['fire', 'volcanic-eruption', 'temperature-up'], 'fire 是干净火焰剪影，首选'],
  ['卡牌语义', '地震', ['earthquake', 'stone', 'mountain'], 'earthquake = 石头中间裂开，语义精准'],
  ['卡牌语义', '落石', ['meteor', 'stone', 'mountain'], 'meteor 陨石/流星，用来表示砸落最直观'],
  ['卡牌语义', '沙暴/风', ['wind', 'drought', 'fog'], 'wind 是气流线；drought 是枯裂土地（更像「流沙」）'],
  ['卡牌语义', '虫鸣/音波', ['bug', 'audio-waves', 'bullhorn'], 'bug = 甲虫（视觉是虫子），audio-waves = 声波'],
  ['卡牌语义', '毒', ['potion', 'radiation', 'pill'], '包里没有骷髅瓶/毒液，药水瓶+辐射标志是最近语义'],
  ['卡牌语义', '治疗', ['medical-kit', 'heart', 'potion'], 'medical-kit 红十字急救包语义最正'],
  ['卡牌语义', '护盾', ['shield', 'shield-02', 'shield-03'], '三款盾牌都是独立造型，可分别给不同卡'],
  ['卡牌语义', '格挡', ['shield-02', 'bulletproof-vest', 'protect'], '要跟「护盾」区分开：防弹衣/保护盾'],
  ['卡牌语义', '反击', ['rotate-left', 'refresh', 'change'], '没有「反弹」图标，用回转箭头表达「打了回去」'],
  ['卡牌语义', '抽牌', ['card', 'cards', 'spade-card'], 'card=两张牌，cards=三张牌'],
  ['卡牌语义', '洗牌/换牌', ['random-dice', 'refresh', 'rotate-right'], 'random-dice = 带问号的骰子，「随机」语义最贴'],
  ['卡牌语义', '增益（攻击）', ['temperature-up', 'arrow-up', 'battery-positive'], 'temperature-up 是「升温」箭头，比纯箭头更有「变强」感'],
  ['卡牌语义', '增益（敏捷）', ['shoe', 'warrior-boots-lv3', 'arrow-up-right'], '鞋=移动/速度'],
  ['卡牌语义', '削弱（降防）', ['temperature-down', 'arrow-down', 'heart-break'], 'temperature-down = 降温箭头'],
  ['卡牌语义', '削弱（降攻）', ['battery-negative', 'arrow-down', 'heart-break-02'], '电池负号表示「掉」'],
  ['卡牌语义', '命中下降', ['target', 'prohibited', 'fog'], '靶子 + 禁止符号；fog 表示看不清'],
  ['卡牌语义', '终结技/大招', ['trophy', 'five-pointed-star', 'crown'], '奖杯/星/王冠，都有「最高级」含义'],
  ['卡牌语义', '道具类', ['backpack', 'tool-kit', 'plastic-bag'], '背包/工具箱；没有 pouch 钱袋'],
  ['属性与状态', '攻击属性', ['sword', 'hit-effect', 'mace'], '属性行小图标（16px）不要用复杂造型'],
  ['属性与状态', '防御属性', ['shield', 'bulletproof-vest', 'protect'], ''],
  ['属性与状态', '敏捷属性', ['shoe', 'wind', 'warrior-boots-lv3'], 'shoe 在 16px 下仍可读'],
  ['属性与状态', '幸运属性', ['clover', 'four-pointed-star', 'dice'], 'clover = 三叶草 = 幸运，语义精准'],
  ['属性与状态', '中毒', ['potion', 'radiation', 'bug'], ''],
  ['属性与状态', '灼伤', ['fire', 'temperature-up', 'volcanic-eruption'], ''],
  ['属性与状态', '虚弱', ['temperature-down', 'battery-negative', 'heart-break'], ''],
  ['属性与状态', '流血', ['heart-break-02', 'medical-kit', 'dagger'], '包里没有血滴；heart-break-02 是心彻底裂开，最贴「持续掉血」'],
  ['属性与状态', '护盾值', ['shield-02', 'shield-03', 'protect'], '和「护盾卡」用不同变体，避免歧义'],
  ['属性与状态', 'AP', ['action-points', 'stamina', 'lightning'], 'action-points 就是纯文本「AP」，和游戏里 AP 字样完全一致'],
  ['属性与状态', '回合', ['clock', 'time', 'rotate-right'], 'clock 表盘最直观'],
  ['界面与地图', '战斗节点', ['hit-effect', 'sword', 'target'], ''],
  ['界面与地图', '强敌节点', ['demon', 'skull', 'wolf'], ''],
  ['界面与地图', '精英节点', ['viking-helmet', 'crown', 'demon-02'], ''],
  ['界面与地图', '事件节点', ['question-mark', 'random-dice', 'sign'], ''],
  ['界面与地图', '宝箱/奖励', ['chest', 'key', 'ingot'], 'chest = 宝箱，语义精准'],
  ['界面与地图', '商店', ['shop', 'star-coin', 'sycee'], 'shop 是店铺造型；货币类给价格标签'],
  ['界面与地图', '营地', ['tent', 'bed', 'lantern'], ''],
  ['界面与地图', '首领', ['boss', 'demon-02', 'skull'], 'boss = 三牙两角凶恶脸，就是给 boss 画的'],
  ['界面与地图', '地图·流沙之海', ['drought', 'sea', 'cloud'], 'drought 枯裂土地 + sea 海，拼「沙海」概念'],
  ['界面与地图', '地图·赤岩峡谷', ['mountain', 'stone', 'acute-triangle'], ''],
  ['界面与地图', '地图·藤蔓密林', ['forest', 'bamboo', 'leaves'], ''],
  ['界面与地图', '地图·潮汐盐海', ['sea', 'water', 'anchor'], 'anchor 锚，很有「海」味'],
  ['界面与地图', '地图·风蚀峭壁', ['wind', 'mountain', 'acute-triangle'], ''],
  ['界面与地图', '地图·夜砂墓原', ['gravestone', 'night', 'drought'], 'gravestone 墓碑 + night 夜'],
  ['界面与地图', '金币', ['star-coin', 'sycee', 'ingot'], '⚠ 不要用 coin：它的实际造型是字母「C」不是硬币（已截图验证）'],
  ['界面与地图', '卡组', ['cards', 'card', 'spade-card'], ''],
  ['界面与地图', '背包', ['backpack', 'tool-kit', 'chest'], ''],
  ['界面与地图', '存档', ['save', 'memory-card', 'document'], 'save = 软盘，语义精准'],
  ['界面与地图', '设置', ['settings', 'settings-02', 'slider'], ''],
  ['界面与地图', '音量', ['volume', 'mute', 'audio-waves'], 'volume 开声 / mute 静音，成对替换现有 audio_on/audio_off'],
  ['界面与地图', '帮助', ['question-mark', 'info-02', 'info'], 'question-mark 是独立问号，和现有 question.png 同义'],
  ['界面与地图', '胜利', ['trophy', 'crown', 'five-pointed-star'], ''],
  ['界面与地图', '失败', ['death', 'skull', 'heart-break'], 'death = 骷髅头，语义精准'],
];

const rows = [];
const missing = [];
const usedNames = new Set();
for (const [group, concept, cands, note] of DRAFT) {
  const out = { group, concept, note, candidates: [] };
  for (const [i, name] of cands.entries()) {
    const meta = index.get(name);
    const cat = catalog.get(name);
    if (!meta) { missing.push(`${group}/${concept} -> ${name}`); continue; }
    out.candidates.push({
      component_name: name,
      primary: i === 0,
      category: meta.category,
      svg_nopadding_bytes: meta.bytes,
      svg_padding_bytes: meta.bytesPadding ?? null,
      core_semantic: cat?.core_semantic ?? '',
      visual_features: cat?.visual_features ?? '',
      path_nopadding: `svg/no-padding/${meta.category}/${name}.svg`,
      path_padding: `svg/padding/${meta.category}/${name}.svg`,
    });
    if (i === 0) usedNames.add(name);
  }
  rows.push(out);
}

const primaryBytes = [...usedNames].reduce((a, n) => a + (index.get(n)?.bytes ?? 0), 0);
const allCandBytes = rows.flatMap((r) => r.candidates).reduce((a, c) => a + c.svg_nopadding_bytes, 0);
const allCandCount = rows.flatMap((r) => r.candidates).length;

const outJson = {
  generated_by: 'tools/iconpack-select.mjs',
  source_snapshot: 'Nieobie/game-icon-pack @ main（svg/ 目录，1630 个文件 = 815 图标 × padding/no-padding）',
  icon_pack_license: 'CC0 1.0',
  url_template_nopadding: 'https://nieobie.github.io/game-icon-pack/svg/no-padding/<category>/<component_name>.svg',
  url_template_padding: 'https://nieobie.github.io/game-icon-pack/svg/padding/<category>/<component_name>.svg',
  counts: { concepts: rows.length, candidates: allCandCount, distinct_primary: usedNames.size },
  bundle_size_estimate: {
    primary_only_bytes_svg: primaryBytes,
    primary_only_bytes_base64: Math.ceil(primaryBytes / 3) * 4,
    all_candidates_bytes_svg: allCandBytes,
    all_candidates_bytes_base64: Math.ceil(allCandBytes / 3) * 4,
    note: 'base64 内联大约是原始字节 ×1.37（data:image/svg+xml;base64, 前缀另计）',
  },
  table: rows,
};
fs.writeFileSync(path.join(ROOT, 'tools', 'icon-semantics-draft.json'), JSON.stringify(outJson, null, 2), 'utf8');

/* ------------------------------------------------------------------ 打印 */
console.log(`图标索引: ${index.size} 个 component_name`);
console.log(`概念条数: ${rows.length}，候选总数: ${allCandCount}，首选去重: ${usedNames.size}`);
if (missing.length) { console.log('!! 找不到的候选（必须修掉）:'); missing.forEach((m) => console.log('   ' + m)); }
else console.log('全部候选名都在快照里找到文件 ✓');
console.log(`\n体积估算：首选 ${usedNames.size} 个 = ${primaryBytes} B SVG → base64 约 ${(Math.ceil(primaryBytes / 3) * 4 / 1024).toFixed(1)} KB`);
console.log(`          全部候选 ${allCandCount} 个 = ${(allCandBytes / 1024).toFixed(1)} KB SVG → base64 约 ${(Math.ceil(allCandBytes / 3) * 4 / 1024).toFixed(1)} KB\n`);

console.log('| 分组 | 游戏概念 | 候选（首选加粗） | 语义 / 外形 | 路径 |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  const c = r.candidates.map((x) => (x.primary ? `**${x.component_name}**` : x.component_name)).join(' / ');
  const sem = r.candidates.map((x) => x.core_semantic).filter(Boolean).slice(0, 3).join(' / ');
  console.log(`| ${r.group} | ${r.concept} | ${c} | ${sem} | ${r.candidates.map((x) => x.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')} |`);
}

/* --------------------------------------------------- 候选一览图（--shot） */
if (argv.includes('--shot')) {
  const { spawn } = await import('node:child_process');
  const EDGE = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((p) => fs.existsSync(p));
  const svgOf = (name) => {
    const m = index.get(name);
    return fs.readFileSync(path.join(svgRoot, 'no-padding', m.category, `${name}.svg`));
  };
  // 只画首选 + 一两个易混淆的对照（coin 是重灾区，必须露脸）
  const gallery = rows.map((r) => ({
    concept: `${r.group} · ${r.concept}`,
    icons: r.candidates.map((c) => ({ name: c.component_name, uri: `data:image/svg+xml;base64,${svgOf(c.component_name).toString('base64')}` })),
  }));
  gallery.push({ concept: '⚠ 反面教材：coin 的真实造型是字母「C」', icons: [{ name: 'coin', uri: `data:image/svg+xml;base64,${svgOf('coin').toString('base64')}` }] });

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>icon candidates</title><style>
  body{margin:0;background:#f3e7cf;color:#3a2a1a;font:12px/1.4 "Segoe UI",system-ui,sans-serif;padding:14px 18px}
  h1{font-size:17px;margin:0 0 10px}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .c{background:#fffdf7;border:1px solid #cbb894;border-radius:6px;padding:6px 8px}
  .c .t{font-size:11px;color:#6b5636;margin-bottom:4px}
  .r{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
  .i{text-align:center;width:54px}
  .m{width:44px;height:44px;margin:0 auto;background-color:#4a3524;
    -webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
    -webkit-mask-size:contain;mask-size:contain;}
  .n{font-size:9px;color:#7a6444;word-break:break-all;line-height:1.15;margin-top:2px}
  .p .m{background-color:#8a5a1e}
  </style></head><body>
  <h1>选型候选一览（no-padding，mask + currentColor 渲染，深色=首选）</h1>
  <div class="g">${gallery.map((g) => `<div class="c"><div class="t">${g.concept}</div><div class="r">${g.icons.map((i, k) => `<div class="i${k ? '' : ' p'}"><div class="m" style="mask-image:url(${JSON.stringify(i.uri)});-webkit-mask-image:url(${JSON.stringify(i.uri)})"></div><div class="n">${i.name}</div></div>`).join('')}</div></div>`).join('')}</div>
  </body></html>`;
  const outHtml = path.join(ROOT, 'tools', 'iconpack-candidates.html');
  fs.writeFileSync(outHtml, html, 'utf8');
  const shot = path.join(ROOT, 'tools', 'shots', 'iconpack-candidates.png');
  fs.mkdirSync(path.dirname(shot), { recursive: true });
  await new Promise((res) => {
    const c = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1.6',
      '--window-size=1200,1180', '--virtual-time-budget=6000', '--no-first-run', '--no-default-browser-check',
      '--allow-file-access-from-files', '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-profile-verify'),
      '--screenshot=' + shot, 'file:///' + outHtml.replace(/\\/g, '/'),
    ], { stdio: 'ignore' });
    c.on('close', res);
  });
  console.log(`\n候选一览图 -> ${path.relative(ROOT, shot)}`);
}
