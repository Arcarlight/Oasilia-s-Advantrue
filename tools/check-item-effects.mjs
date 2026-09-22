// 门禁：**每一件道具写的持有效果，引擎里都得真的有一行代码读它。**
//
// 为什么要有这一条：玩家报「战后恢复的道具（大根茎等）都不起效」，查下去发现
// `healAfterBattlePct` 这个 key 从加进游戏那天起就**没有任何代码读过** ——
// content/items.json 里写着、道具说明里也印着「战斗胜利后回复最大生命 10%」，
// 玩家拿到手却什么都不会发生。而且它不是孤例：同一批还有 4 个 key 是死的
// （goldPct / rewardChoices / eventHealPct / buffTurns，共 9 件道具）。
//
// 这类 bug 靠肉眼是抓不住的（数据、文案、图鉴、掉落权重全都正常），
// 所以这里把它变成静态可查的：**声明了 → src 里必须有人读**。
//
// 判据是下面那三种读法（也就是引擎里唯一的三种读法，见 game.js 的 modAdd/modMul/modFlag）：
//   modAdd('key') / modMul('key') / modFlag('key')      —— game 那一层
//   modAdd(side, 'key') / modMul(side, 'key') / modFlag(side, 'key')  —— battle 那一层
// 只认**字符串字面量**：`modAdd(cond.key)` 这种动态读法算“没人读”（宁可漏报也别假绿）。
//
// 用法：node tools/check-item-effects.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

/** 只声明、不消费的文件（它们本来就会出现这些 key，别把声明当实现） */
const DECLARATION_ONLY = new Set([
  'src/data/items.js',        // 生成的 ITEMS 数据
  'src/core/itemtext.js',     // 把 key 翻成玩家读的那句话
  'src/data/i18n.js',         // 生成的译文表
]);

const content = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'items.json'), 'utf8'));
const declared = content._modKeys ?? {};
const items = Object.values(content.items ?? {});

/** key → 哪些道具写了它 */
const declaredBy = new Map();
for (const item of items) {
  for (const mod of item.hold?.mods ?? []) {
    if (!declaredBy.has(mod.key)) declaredBy.set(mod.key, []);
    declaredBy.get(mod.key).push(item.name ?? item.id);
  }
}

/** src 里真的被读的 key → 读它的地方 */
const consumed = new Map();
async function walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (DECLARATION_ONLY.has(rel)) continue;
    const text = await fs.readFile(p, 'utf8');
    // ① 两个参数（battle.js 那一层：modAdd(side, 'key')）
    for (const m of text.matchAll(/mod(?:Add|Mul|Flag)\(\s*[A-Za-z_$][\w$.]*\s*,\s*'([A-Za-z]+)'/g)) note(m[1], rel);
    // ② 一个参数（game.js 那一层：this.modAdd('key')）
    for (const m of text.matchAll(/mod(?:Add|Mul|Flag)\(\s*'([A-Za-z]+)'/g)) note(m[1], rel);
  }
}
function note(key, rel) {
  if (!consumed.has(key)) consumed.set(key, new Set());
  consumed.get(key).add(rel);
}
await walk(path.join(ROOT, 'src'));

const dead = [];
for (const [key, who] of declaredBy) {
  if (!consumed.has(key)) dead.push({ key, who, doc: declared[key] });
}
/** 反过来：代码读了、内容那本「key 说明书」里却没登记（新人不知道该写什么） */
const undocumented = [...consumed.keys()].filter((k) => !(k in declared) && k !== 'echo').sort();
/** 登记了但一件道具都没用（不算错，只是货架上的空位） */
const unused = Object.keys(declared).filter((k) => !declaredBy.has(k)).sort();

console.log(`道具持有效果：content/items.json 登记了 ${Object.keys(declared).length} 个 key，`
  + `${items.length} 件道具里用到 ${declaredBy.size} 个，src 里有 ${consumed.size} 个被真的读过。`);

if (dead.length) {
  console.log('\n❌ 下列 key 写了效果、**却没有任何代码读它**（拿在手上等于没有这件道具）：');
  for (const d of dead) {
    console.log(`   ${d.key}  —— 写在：${d.who.join('、')}`);
    console.log(`        说明书上写的是「${d.doc ?? '(未登记)'}」，但 src/ 里没有一处 modAdd/modMul/modFlag 读它。`);
    for (const who of d.who) {
      const it = items.find((i) => i.name === who);
      if (it) console.log(`        · ${it.name}：${(it.hold?.mods ?? []).map((m) => m.key).join(' + ')}（${it.rarity}，${it.price} 金）`);
    }
  }
} else {
  console.log('\n✅ 每一件道具的持有效果都有代码在读它。');
}

if (undocumented.length) console.log(`\n⚠ 代码里读了、但说明书（_modKeys）里没登记的 key：${undocumented.join(', ')}`);
if (unused.length) console.log(`\n（登记了、暂时没有道具用：${unused.length} 个 —— ${unused.join(', ')}）`);

if (dead.length) {
  console.log(`\n❌ 检查未通过：${dead.length} 个持有效果是死的。`);
  process.exitCode = 1;
}
