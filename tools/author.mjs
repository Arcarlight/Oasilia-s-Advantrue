// 加内容的**统一入口**（用户要的「接口」）。
//
// 为什么要有它：加一样东西（道具 / 卡牌 / 敌人 / 地图）本来要动四五处 ——
// content 里的 JSON、生成的 src/data、两本字典、字体子集、还有一串门禁 ——
// 谁都得先在脑子里背一遍顺序，漏一步就会在**别的**检查里以奇怪的样子炸出来
// （「图上是个空白方块」「日语里夹着中文」「线上和本地不一样」）。
//
// 这个脚本把「顺序」写死成代码：
//   node tools/author.mjs new item  <id>     # 道具：写骨架 + 按 art 导图
//   node tools/author.mjs new card  <id>     # 卡牌：写骨架（含最常用的效果模板）
//   node tools/author.mjs new enemy <slug>   # 敌人：enemies.json + species.json 占位
//   node tools/author.mjs new map   <key>    # 地图：biomes.json 占位 + 提示要补什么
//   node tools/author.mjs todo               # 还差什么（没翻的文案 / 缺图 / 缺台词…）
//   node tools/author.mjs check              # 一键体检：按固定顺序跑完所有门禁
//
// 「check」的顺序**不能改**（每一步都为下一步准备输入）：
//   build-content → build-i18n → **subset-fonts** → check-content → check-copy → check-icons
//   → 11 套 test-*.mjs → bundle → verify-bundle → smoke-check
//
// 为什么字体子集要排在内容体检**之前**：内容体检里有一条「字体子集是不是过期了」——
// 刚改完文案时它必然是过期的（新字还没裁进子集），先裁一次再看才不会误报。
// 这条顺序是实测出来的：第一版把 subset-fonts 放在体检后面，加一条更新日志就会卡住。
// 失败时它会指出「该改哪个文件」，而不是只丢一个退出码。
//
// 各步在干什么（压缩上下文之后照这份看就够）：
//   build-content    content/*.json → src/data/*.js 的生成区块（含一切数据校验）
//   build-i18n       content/i18n/*.json → src/data/i18n.js + 待翻清单 _report.json
//   check-content    数据自洽（图 / 属性 / 效果 key / 三语覆盖率 / 现实动物 / 更新日志…）
//   check-copy       玩家读到的文案 vs 引擎实况（开发口气、旧概念、占位符、星号…）
//   check-icons      .ico-* 类名有没有定义、素材在不在
//   subset-fonts     按「现在用到的字」重裁字体子集（**内容文案一变就得跑**）
//   bundle           src/ + content/ 打成一个 oasis-game.html（线上跑的就是它）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n', 'utf8');
const [, , cmd, kind, id] = process.argv;

/** 跑一条命令并把输出直接透给用户（诊断脚本本来就写得很啰嗦，拦下来反而看不见问题） */
function run(step, args, { optional = false } = {}) {
  process.stdout.write(`\n▶ ${step}  (${args.join(' ')})\n`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  const okRun = r.status === 0;
  if (!okRun && !optional) {
    console.error(`\n✗ ${step} 没过 —— 先修它再往下走（上面有具体原因）。`);
    process.exit(1);
  }
  return okRun;
}

// ============================================================
// 加内容
// ============================================================
function newItem(itemId) {
  if (!itemId) return fail('用法：node tools/author.mjs new item <id>');
  const file = 'content/items.json';
  const data = readJson(file);
  if (data.items[itemId]) return fail(`content/items.json 里已经有 ${itemId} 了`);
  data.items[itemId] = {
    id: itemId,
    name: '（中文名：优先用官方译名）',
    kind: 'hold',
    art: 'ORANBERRY',
    rarity: 'uncommon',
    price: 70,
    drop: null,
    desc: '（一句话风味描述，别写开发口气）',
    hold: { mods: [{ key: 'atk', add: 3 }] },
  };
  writeJson(file, data);
  console.log(`✓ ${file} 里加了 ${itemId}`);
  console.log(`
接下来：
  1) 改 content/items.json 里这条：
     · name 用**官方中文译名**（宝可梦系列的道具名，别自己造）
     · art 填 Generation 9 Pack 的 Graphics/Items 里的文件名（如 ORANBERRY）
     · kind = hold（拿着就生效）或 use（只能战斗外使用）
     · hold.mods 的 key 只能是 content/items.json 顶部 _modKeys 里那几个；
       引擎新加一个 key 时：build-content 的 MOD_KEYS → battle.js 的钩子 → itemtext.js 的 modLabel，
       三处都补，少一处效果会**静默不生效**。
  2) 导图：node tools/import-items.mjs
  3) 补译文：node tools/i18n-todo.mjs list → 分片翻 → node tools/i18n-todo.mjs merge
  4) 体检：node tools/author.mjs check`);
}

function newCard(cardId) {
  if (!cardId) return fail('用法：node tools/author.mjs new card <id>');
  const file = 'content/cards.json';
  const data = readJson(file);
  if (data.cards.some((c) => c.id === cardId)) return fail(`content/cards.json 里已经有 ${cardId} 了`);
  data.cards.push({
    id: cardId,
    name: '（中文卡名）',
    rarity: 'common',
    ap: 1,
    types: ['一般'],
    ico: 'ico-attack',
    fx: 'slash_1',
    text: '造成 {d} 点伤害。',
    effects: [{ kind: 'damage', power: 100 }],
  });
  writeJson(file, data);
  console.log(`✓ ${file} 里加了 ${cardId}（骨架：1 费、100 威力、一般属性）`);
  console.log(`
接下来：
  · 效果种类（kind）在 src/data/cards.js 顶部有完整清单（damage / shield / heal / draw / ap /
    buff / status / selfDmg / discard …），照现成的卡抄最稳。
  · 卡面文案里的 {d} {d2} {s} 是**引擎现算**的（见 src/ui/cardtext.js 的 resolveCardText），
    写死数字会被 check-copy 抓住。
  · 卡面图标 ico-* 必须在 content/icons.json 里注册过（否则界面上是空白方块）。
  · 想要某只敌人也用这张牌：把它加进 content/enemies.json 的某个 movePools 池子里
    （池子名 kit_t_<属性> 是「按属性组好的」——池子里的攻击牌必须同属性，build-content 会卡）。
  · 补译文 → node tools/author.mjs check`);
}

function newEnemy(slug) {
  if (!slug) return fail('用法：node tools/author.mjs new enemy <slug>');
  const ef = 'content/enemies.json';
  const sf = 'content/species.json';
  const en = readJson(ef);
  const sp = readJson(sf);
  if (en.enemies.some((e) => e.slug === slug)) return fail(`content/enemies.json 里已经有 ${slug} 了`);
  if (!sp.species[slug]) {
    sp.species[slug] = { dex: '0000', slug, name: '（中文名）', en: '（英文名）', types: ['一般'] };
    writeJson(sf, sp);
    console.log(`✓ ${sf} 里加了物种占位（dex 必须是 4 位数字）`);
  }
  en.enemies.push({
    id: slug, slug, tier: 'mob', biome: 'desert', deck: 'kit_t_一般',
    lines: ['（出场台词，1~2 句）'],
  });
  writeJson(ef, en);
  console.log(`✓ ${ef} 里加了敌人 ${slug}（野生 / 流沙之海 / 一般属性池）`);
  console.log(`
接下来（素材与台词是**分开的**几步，少一步界面上就会缺东西）：
  1) 素材：assets/pokemon/<slug>/{Idle,Attack,Hurt}.png、assets/portraits/<slug>/Normal.png、
     小图标（Generation 9 Pack 的 Icons）。缺哪个 check-content 会点名。
     有下载/导入脚本的话优先用它（tools/fetch-sprites.mjs 等），别手工拷。
  2) 图鉴简介：content/enemy-intro.json 里加一句（tools/build-enemy-intros.mjs 生成）。
  3) **口吻台词**（图鉴「它可能会这么说」，每只 3 句）：content/voice-parts/ 放分片后跑
     node tools/merge-enemy-voice.mjs —— 缺了 check-content 直接报错（这是用户点过的规矩）。
  4) 招式池：deck 指向的 kit_t_<属性> 必须和它的属性一致（每只怪至少一张本系牌）。
  5) 补译文 → node tools/author.mjs check`);
}

function newMap(key) {
  if (!key) return fail('用法：node tools/author.mjs new map <key>');
  const file = 'content/biomes.json';
  const data = readJson(file);
  if (data.biomes[key]) return fail(`content/biomes.json 里已经有 ${key} 了`);
  data.biomes[key] = {
    name: '（中文地图名）',
    desc: '（一句话：这张图什么感觉）',
    sky: ['#3a2f4a', '#6b4a5a', '#c98a63'],
    ground: '#7a5a3a',
    accent: '#f0b95c',
    slots: [],
  };
  writeJson(file, data);
  console.log(`✓ ${file} 里加了地图 ${key}（slots 为空 = 暂时不会出现在任何一章）`);
  console.log(`
接下来：
  1) slots 决定它可能出现在第几章（0-based）—— STAGE_BIOME 是每章的**默认**地图，
     中间几章会从 slots 里随机挑（见 src/data/mapgen.js 与 game.js 的 biomes 序列）。
  2) 每张图都要有：敌人（每档至少一只）、事件（≥3 个专属）、商人、
     背景配色类 .scene-bg-<key>（style.css）、地图装饰（tools/build-map-decor.mjs）。
  3) 补译文 → node tools/author.mjs check`);
}

// ============================================================
// 还差什么
// ============================================================
function todo() {
  const report = readJson('content/i18n/_report.json');
  const missing = report.missing ?? {};
  const ja = missing.ja?.length ?? 0;
  const en = missing.en?.length ?? 0;
  const items = readJson('content/items.json').items;
  const noItemArt = Object.keys(items).filter((k) => !fs.existsSync(path.join(ROOT, 'assets', 'items', `${k}.png`)));
  const enemies = readJson('content/enemies.json').enemies;
  const voice = readJson('content/enemy-voice.json').voice ?? {};
  const intros = readJson('content/enemy-intro.json').intro ?? {};
  const noVoice = enemies.filter((e) => !(voice[e.slug] ?? []).length);
  const noIntro = enemies.filter((e) => !intros[e.slug]);

  console.log('还差什么：');
  console.log(`  未翻文案      ja ${ja} 条 · en ${en} 条`);
  if (ja || en) console.log('     → node tools/i18n-todo.mjs list → 分片翻译 → node tools/i18n-todo.mjs merge');
  console.log(`  缺道具图      ${noItemArt.length} 件${noItemArt.length ? `（${noItemArt.slice(0, 5).join(', ')}…）` : ''}`);
  if (noItemArt.length) console.log('     → 改 content/items.json 的 art，然后 node tools/import-items.mjs');
  console.log(`  缺口吻台词    ${noVoice.length} 只${noVoice.length ? `（${noVoice.slice(0, 5).map((e) => e.id).join(', ')}…）` : ''}`);
  if (noVoice.length) console.log('     → content/voice-parts/ 补分片 → node tools/merge-enemy-voice.mjs');
  console.log(`  缺图鉴简介    ${noIntro.length} 只`);
  if (noIntro.length) console.log('     → content/enemy-intro.json 补一句 → node tools/build-enemy-intros.mjs');
  const orphans = (report.orphans?.ja?.length ?? 0);
  console.log(`  孤儿译文      ${orphans} 条（源文案改过 / 删过，字典里留下的死条目）`);
  console.log('\n体检：node tools/author.mjs check');
}

// ============================================================
// 一键体检
// ============================================================
function check() {
  const t0 = Date.now();
  run('内容管线（生成 + 数据校验）', ['tools/build-content.mjs']);
  run('多语言表（生成 + 待翻清单）', ['tools/build-i18n.mjs']);
  /**
   * 字体子集必须在内容体检**之前**：体检里有一条「子集是不是过期了」，
   * 刚改完文案时它必然是过期的（新字还没裁进去），先裁一次才不会误报。
   * 这一条是实测出来的 —— 第一版把 subset-fonts 放在后面，加一条更新日志就会卡住。
   */
  run('字体子集（按现在用到的字重裁）', ['tools/subset-fonts.mjs']);
  run('内容体检（数据自洽 / 三语覆盖 / 现实动物 / 字体指纹）', ['tools/check-content.mjs', '--strict']);
  run('文案体检（玩家读到的字 vs 引擎实况）', ['tools/check-copy.mjs']);
  run('图标体检（.ico-* 有没有定义）', ['tools/check-icons.mjs']);

  const tests = fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /^test-.*\.mjs$/.test(f)).sort();
  for (const t of tests) run(`回归测试 ${t}`, [`tools/${t}`]);

  run('打包（单文件 oasis-game.html）', ['tools/bundle.mjs']);
  run('验证打包产物', ['tools/verify-bundle.mjs']);
  run('冒烟（真浏览器点一遍主要流程）', ['tools/smoke-check.mjs']);

  console.log(`\n✅ 全绿：${tests.length + 9} 步，用时 ${Math.round((Date.now() - t0) / 1000)} 秒。`);
  console.log('别忘了最后那三件事：更新日志加一条 + package.json 版本号 → git commit → git push → node tools/compare-deployed.mjs');
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (cmd === 'new') {
  if (kind === 'item') newItem(id);
  else if (kind === 'card') newCard(id);
  else if (kind === 'enemy') newEnemy(id);
  else if (kind === 'map') newMap(id);
  else fail('用法：node tools/author.mjs new item|card|enemy|map <id>');
} else if (cmd === 'todo') todo();
else if (cmd === 'check') check();
else {
  console.log(`加内容 / 体检的统一入口。

  node tools/author.mjs new item  <id>    道具骨架 + 导图提示
  node tools/author.mjs new card  <id>    卡牌骨架
  node tools/author.mjs new enemy <slug>  敌人 + 物种占位
  node tools/author.mjs new map   <key>   地图占位
  node tools/author.mjs todo              还差什么（未翻文案 / 缺图 / 缺台词）
  node tools/author.mjs check             一键体检（按固定顺序跑完所有门禁）

细节与踩过的坑写在 docs/HELD-ITEMS-PROGRESS.md 与各 content/*.json 的 _comment 里。`);
}
