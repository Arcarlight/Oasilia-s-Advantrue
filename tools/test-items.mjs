// 回归测试：手持道具（这一版把「背包制」换成了「手持制」）。
//
// 上一版这份测试盯的是「背包里的药水能不能用」；现在道具分成两类，所以整份重写：
//   ① **持有型**（kind: 'hold'）拿在手上就一直生效 —— 效果必须真的汇总进 heldMods()，
//      战斗里读得到（攻击 +N、恢复量 +X%、中毒不衰减…）；
//   ② **使用型**（kind: 'use'）**只能在战斗外使用** —— 战斗里必须被拒绝（用户点名：
//      「战斗中不能使用使用道具，那样太 imba」），用掉之后从手上消失；
//   ③ 栏位规则：3 个 + 每打赢一个 boss +1；满了 giveItem 要返回 overflow（不能静默吞掉）；
//   ④ 丢掉 / 卖掉：卖掉按售价 40% 换金币；
//   ⑤ 数值型叠加、开关型不叠加；
//   ⑥ 每一件道具都得有图（assets/items/<id>.png），也得记进「见过」清单（图鉴用）。
//
// 用法：node tools/test-items.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game, itemSellPrice, itemUseEffect } = await imp('src/core/game.js');
const { ITEMS } = await imp('src/data/items.js');
const { effectiveAtk, Battle } = await imp('src/core/battle.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};
const group = (name) => console.log(`\n${name}`);

const g = new Game({ seed: 4242 });

// ---------- ① 数据本身站得住 ----------
group('① 道具数据');
{
  const list = Object.values(ITEMS);
  ok(list.length >= 60, '道具总数够一局玩的（≥60 件）', `${list.length} 件`);
  const noArt = list.filter((i) => !fs.existsSync(path.join(ROOT, 'assets', 'items', `${i.id}.png`)));
  ok(!noArt.length, '每件道具都有自己的图（assets/items/<id>.png）', noArt.map((i) => i.id).join(', ') || '全部就位');
  const noKind = list.filter((i) => !['hold', 'use'].includes(i.kind));
  ok(!noKind.length, '每件道具都声明了 hold / use', noKind.map((i) => i.id).join(', ') || '全部就位');
  const dropTypes = new Set(list.filter((i) => i.drop).map((i) => i.drop));
  ok(dropTypes.size >= 18, '18 种属性都有对应的掉落物（「打对应属性的敌人更容易掉」才成立）', `${dropTypes.size} 种`);
  const hold = list.filter((i) => i.kind === 'hold');
  const use = list.filter((i) => i.kind === 'use');
  ok(hold.every((i) => (i.hold?.mods ?? []).length), '持有型都有 mods', `${hold.length} 件`);
  ok(use.every((i) => itemUseEffect(i)), '使用型都有 use 效果', `${use.length} 件`);
}

// ---------- ② 持有型：效果真的汇总得出来 ----------
group('② 持有型：拿在手上一直生效');
{
  g.newRun(1001);
  const atkItem = Object.values(ITEMS).find((i) => i.kind === 'hold' && (i.hold.mods ?? []).some((m) => m.key === 'atk'));
  ok(!!atkItem, '找得到一件「攻击 +N」的持有道具', atkItem?.name);
  const add = atkItem.hold.mods.find((m) => m.key === 'atk').add;
  g.data.held = [atkItem.id, atkItem.id];
  g.invalidateMods();
  ok(g.modAdd('atk') === add * 2, '同名两件：数值型**叠加**', `${atkItem.name} ×2 → 攻击 +${g.modAdd('atk')}（单件 +${add}）`);

  const flagItem = Object.values(ITEMS).find((i) => i.kind === 'hold' && (i.hold.mods ?? []).some((m) => m.key === 'poisonNoDecay'));
  ok(!!flagItem, '找得到一件开关型（中毒不衰减）的持有道具', flagItem?.name);
  g.data.held = [flagItem.id, flagItem.id];
  g.invalidateMods();
  ok(g.modFlag('poisonNoDecay') === true, '同名两件：开关型**不叠加**（仍然只是「成立」）', `${flagItem.name} ×2`);

  // 战斗里读得到：把 mods 交给 Battle 之后，攻击力真的上去了
  const mkBattle = () => new Battle({
    seed: 7, mods: g.heldMods(),
    player: { name: 'T', slug: 'flygon', hp: 300, maxHp: 300, atk: 30, def: 10, agi: 10, luck: 5 },
    deck: ['tackle', 'tackle', 'tackle', 'tackle', 'tackle'],
    enemy: { id: 'e', slug: 'sandshrew', name: 'E', maxHp: 200, atk: 10, def: 2, agi: 5, tier: 'mob', deck: ['tackle'] },
  });
  g.data.held = [];
  g.invalidateMods();
  const b0 = mkBattle();
  g.data.held = [atkItem.id];
  g.invalidateMods();
  const b1 = mkBattle();
  ok(effectiveAtk(b1.player) === effectiveAtk(b0.player) + add,
    '战斗里读得到：攻击力 = 基础 + 道具加成', `${effectiveAtk(b0.player)} → ${effectiveAtk(b1.player)}`);
}

// ---------- ③ 使用型：战斗外能用、战斗里不能用 ----------
group('③ 使用型：战斗外使用');
{
  g.newRun(1002);
  const berry = ITEMS.oran_berry;
  ok(!!berry && berry.kind === 'use', '橙橙果是使用型', berry?.name);
  g.data.held = [berry.id];
  g.invalidateMods();
  g.data.hp = 10;
  const r = g.useItem(berry.id);
  ok(r?.ok === true, '战斗外使用成功（回血）', r?.text);
  ok(g.data.hp > 10, '血真的回了', `10 → ${g.data.hp}`);
  ok(!g.data.held.includes(berry.id), '用掉之后从手上消失');

  g.data.held = [berry.id];
  g.phase = 'battle';
  g.data.hp = 10;
  const inBattle = g.useItem(berry.id);
  ok(inBattle?.ok === false, '战斗中拒绝使用', inBattle?.text);
  ok(g.data.held.includes(berry.id) && g.data.hp === 10, '拒绝时不消耗、不回血');
  g.phase = 'map';

  const hold = Object.values(ITEMS).find((i) => i.kind === 'hold');
  g.data.held = [hold.id];
  const r2 = g.useItem(hold.id);
  ok(r2?.ok === false, '持有型拒绝「使用」（它是拿在手上生效的）', `${hold.name}：${r2?.text}`);
}

// ---------- ④ 栏位：3 + boss，满了要能察觉 ----------
group('④ 手持栏上限');
{
  g.newRun(1003);
  ok(g.heldMax() === 3, '开局 3 个栏位', String(g.heldMax()));
  g.data.bossKills = 2;
  ok(g.heldMax() === 5, '每打赢一个 boss +1', `2 个 boss → ${g.heldMax()}`);

  g.data.held = [];
  g.invalidateMods();
  const ids = Object.keys(ITEMS).slice(0, 6);
  let overflowAt = null;
  for (const id of ids) {
    const res = g.giveItem(id, 1);
    if (res.overflow) { overflowAt = id; break; }
  }
  ok(overflowAt !== null, '拿满了之后 giveItem 会返回 overflow（不会静默吞掉）',
    `第 ${g.data.held.length + 1} 件：${ITEMS[overflowAt]?.name}`);
  ok(g.data.held.length === g.heldMax(), 'overflow 时手上就是满的', `${g.data.held.length} / ${g.heldMax()}`);

  const dropped = g.data.held[0];
  g.dropItem(dropped);
  const again = g.giveItem(overflowAt, 1);
  ok(again.stored && g.data.held.includes(overflowAt), '丢掉一件之后就能收下新的',
    `丢掉 ${ITEMS[dropped]?.name}，收下 ${ITEMS[overflowAt]?.name}`);
}

// ---------- ⑤ 卖掉 ----------
group('⑤ 卖给商人');
{
  g.newRun(1004);
  const it = Object.values(ITEMS).find((i) => i.price >= 60);
  g.data.held = [it.id];
  g.invalidateMods();
  const gold0 = g.data.gold;
  const sold = g.sellItem(it.id);
  const want = itemSellPrice(it);
  ok(sold?.gold === want, '卖价 = 售价的 40%', `${it.name}（售价 ${it.price}）→ ${sold?.gold} 金币`);
  ok(g.data.gold === gold0 + want, '金币真的进账了', `${gold0} → ${g.data.gold}`);
  ok(!g.data.held.includes(it.id), '卖掉之后从手上消失');
  ok(g.sellItem(it.id) === null, '再卖一次返回 null（手上没有这件了）');
}

// ---------- ⑥ 图鉴记录 ----------
group('⑥ 道具图鉴记录');
{
  g.newRun(1005);
  const id = Object.keys(ITEMS)[3];
  g.data.held = [];
  g.invalidateMods();
  g.giveItem(id, 1);
  const meta = JSON.parse(globalThis.localStorage.getItem('oasis_desert_spirit_meta_v1') ?? '{}');
  ok((meta.seenItems ?? []).includes(id), '拿到手就记进「见过」清单（图鉴靠它分剪影 / 已获得）',
    `${ITEMS[id].name}；seenItems ${meta.seenItems?.length ?? 0} 条`);
}

// ---------- ⑦ 首领掉落：这次打赢换来的栏位要先生效 ----------
/**
 * 用户报的原话：「打败 boss 之后要是掉落物品，虽然背包已经扩充，
 * 但还是会提示拿不下要求丢东西」。
 *
 * 原因：`bossKills + 1` 写在「玩家点掉奖励页」的时候，而掉落是在那之前发的 ——
 * 于是首领掉的东西按**扩容前**的上限判定，明明栏位要 +1 却说你拿不下。
 * 现在 `bossKills + 1` 挪进 finishBattle（发掉落之前），掉落也提前在 finishBattle 里发。
 */
group('⑦ 首领掉落：先扩容再发掉落');
{
  g.newRun(1006);
  const ids = Object.keys(ITEMS).slice(0, 3);
  g.data.held = [...ids];                 // 3 件 = 开局上限，正好拿满
  g.invalidateMods();
  g.data.bossKills = 0;
  g.data.stage = 2;
  g.data.map = { ...g.data.map, biome: 'desert' };
  ok(g.data.held.length === g.heldMax(), '前提：手上正好拿满（3 / 3）', `${g.data.held.length} / ${g.heldMax()}`);

  g.startBattle('boss', 0, 'direct');
  // 掉落是概率事件：这里打桩让它**必定**掉一件，测的才是"拿不拿得下"
  g.rollItemDrop = () => ({ id: 'oran_berry', reason: 'random' });
  g.battle.enemy.hp = 0;
  g.battle.winner = 'player';
  g.battle.over = true;
  const r = g.finishBattle();

  ok(g.data.bossKills === 1, '打赢首领当场就把栏位 +1（不等玩家点奖励页）', `bossKills = ${g.data.bossKills}`);
  ok(g.heldMax() === 4, '上限真的变成 4', String(g.heldMax()));
  ok(r?.itemDrop?.stored === true && r?.itemDrop?.overflow === false,
    '首领掉的那件东西**收下了**（不再误报拿不下）',
    `${ITEMS.oran_berry.name}：held ${g.data.held.length} / ${g.heldMax()}`);
  ok(g.data.held.includes('oran_berry'), '东西真的在手上');
  g.takeRewardCard(null);
  ok(!g.awaitingOverflow, '奖励结清之后也没有遗留的「丢掉一件」提示');
}

console.log(`\n道具（手持）回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
