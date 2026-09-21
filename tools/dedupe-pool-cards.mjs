// 卡池去重：**玩家抽卡池里不该有「同费用 + 完全同效果」的两张牌**。
//
// 起因（用户原话）：
//   「为什么像啄这种卡还是能进入到抽卡池里？之前不是说不要让这种比碰撞还弱的卡污染卡池吗」
//   →「我的意思是，这和撞击完全是一样的效果，就没有必要加入玩家抽卡池污染卡池了。」
//
// 实测：玩家池 233 张里藏着 35 组「同费用 + 效果逐字节相同」的牌（48 张是多余的），
// 例如啄 / 水流喷射 / 木枝突刺 和起始卡「撞击」完全一样（0 费 30 威力 纯伤害），
// 于是抽卡奖励里经常出现「和你开局就带着的那张牌一模一样」的选项 —— 这一格等于白给。
// 类型在这游戏里**只是外观**（没有属性克制，见 battle.js 里没有任何属性倍率），所以
// 「换个名字的同一张牌」在玩法上就是同一张牌。
//
// 做法：每组只留一张给玩家，其余标 `enemyOnly`（它们几乎都已经在敌人的招式池 /
// 专属招里，敌人照样会用；图鉴也能靠「看见敌方打出」解锁，见 v2.4 的规则）。
// 留哪张：① 起始卡组里的必须留；② **不在任何招式池里的优先留**（留在池里才不会变成
// 永远见不到的死卡）；③ 稀有度低的优先（避免「把普通档全删掉、只留史诗」而抬高卡池稀有度）；
// ④ 内容顺序。
// 万一要转成 enemyOnly 的那张**既不在招式池、也不是专属招**，就把它按属性补进对应的
// 招式池（否则它会变成没人会用、图鉴永远点不亮的死卡）。
//
// 用法：
//   node tools/dedupe-pool-cards.mjs          # 只报告（dry run）
//   node tools/dedupe-pool-cards.mjs --write  # 真的写进 content/cards.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_FILE = path.join(ROOT, 'content', 'cards.json');
const ENEMIES_FILE = path.join(ROOT, 'content', 'enemies.json');
const WRITE = process.argv.includes('--write');

const cardsDoc = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
const enemiesDoc = JSON.parse(fs.readFileSync(ENEMIES_FILE, 'utf8'));
const cards = cardsDoc.cards;
const pools = enemiesDoc.movePools ?? {};
const starterDeck = cardsDoc.starterDeck ?? [];

const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3 };

const inAnyKit = new Set();
for (const ids of Object.values(pools)) for (const id of ids) inAnyKit.add(id);
const signatureMoves = new Set();
for (const e of enemiesDoc.enemies ?? []) for (const s of e.signature ?? []) signatureMoves.add(s);
/** 招式池按属性命名（内容里有两套：kit_t_<中文> 与 kit_<英文>，这里都用得上） */
const KIT_OF_TYPE = {
  一般: 'kit_t_一般', 冰: 'kit_t_冰', 地面: 'kit_t_地面', 妖精: 'kit_t_妖精', 岩石: 'kit_t_岩石',
  幽灵: 'kit_t_幽灵', 恶: 'kit_t_恶', 格斗: 'kit_t_格斗', 毒: 'kit_t_毒', 水: 'kit_t_水',
  火: 'kit_t_火', 电: 'kit_t_电', 草: 'kit_t_草', 虫: 'kit_t_虫', 超能: 'kit_t_超能',
  钢: 'kit_t_钢', 飞行: 'kit_t_飞行', 龙: 'kit_t_龙',
};

const reachable = (id) => inAnyKit.has(id) || signatureMoves.has(id);
const signature = (c) => `${c.ap}|${JSON.stringify(c.effects ?? [])}`;

const groups = new Map();
for (const c of cards) {
  if (c.enemyOnly) continue;
  const key = signature(c);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dupes = [...groups.values()].filter((g) => g.length > 1);

const pick = (g) => [...g].sort((a, b) => (
  (Number(starterDeck.includes(b.id)) - Number(starterDeck.includes(a.id)))
  || (Number(!inAnyKit.has(b.id)) - Number(!inAnyKit.has(a.id)))
  || ((RANK[a.rarity] ?? 9) - (RANK[b.rarity] ?? 9))
))[0];

let converted = 0;
const kitPatches = [];
const unhandled = [];
console.log(`玩家池重复组：${dupes.length} 组（共 ${dupes.reduce((s, g) => s + g.length, 0)} 张）\n`);
for (const g of dupes) {
  const keep = pick(g);
  const rest = g.filter((c) => c !== keep);
  const sample = keep.effects.filter((e) => e.kind === 'damage').reduce((s, e) => s + (e.power ?? 0) * (e.hits ?? 1), 0);
  console.log(`ap${keep.ap} 威力${sample || '—'} 「${keep.name}」留；转 enemyOnly：`);
  for (const c of rest) {
    let note = '（已在招式池）';
    if (!reachable(c.id)) {
      const type = (c.types ?? [])[0];
      const kit = KIT_OF_TYPE[type];
      if (kit && pools[kit]) {
        kitPatches.push({ kit, id: c.id, name: c.name, type });
        note = `（补进 ${kit}，否则没人会用）`;
      } else {
        unhandled.push(c);
        note = `（⚠ 不在招式池、也没有 ${type} 的池子 —— 保持现状）`;
      }
    }
    if (!note.includes('⚠')) { c.enemyOnly = true; converted += 1; }
    console.log(`    ${c.name}${note}`);
  }
}

for (const p of kitPatches) {
  if (!pools[p.kit].includes(p.id)) {
    pools[p.kit].push(p.id);
    inAnyKit.add(p.id);
  }
}

console.log(`\n合计：转成 enemyOnly ${converted} 张 · 补进招式池 ${kitPatches.length} 张 · 没法处理 ${unhandled.length} 张`);
const playerPool = cards.filter((c) => !c.enemyOnly);
console.log(`玩家抽卡池：233 → ${playerPool.length} 张（只给敌人用：${cards.length - playerPool.length} 张）`);
byRarity(playerPool);

function byRarity(list) {
  const out = {};
  for (const c of list) out[c.rarity] = (out[c.rarity] ?? 0) + 1;
  console.log('卡池稀有度分布：', JSON.stringify(out));
}

if (WRITE) {
  fs.writeFileSync(CARDS_FILE, JSON.stringify(cardsDoc, null, 2) + '\n', 'utf8');
  fs.writeFileSync(ENEMIES_FILE, JSON.stringify(enemiesDoc, null, 2) + '\n', 'utf8');
  console.log('\n✓ 已写入 content/cards.json 与 content/enemies.json（接着跑 node tools/author.mjs check）');
} else {
  console.log('\n（dry run：加 --write 才会真的写文件）');
}
