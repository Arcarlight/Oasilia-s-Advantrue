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
const { CARD_BY_ID } = await imp('src/data/cards.js');
const { BALANCE } = await imp('src/data/balance.js');
const { eventOption } = await imp('src/core/eventfx.js');

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

group('⑧ 手持栏满了：商店不能成交（用户报的「钱消失了」）');
{
  /**
   * 用户的原话：「身上道具满了的时候还能买道具，但是不光没有钱还消失了」。
   * 根因：`buy()` 里「先扣钱 → 标售出 → 再看栏位满不满」——
   * 满栏位时一买就是**钱扣掉、货卖掉、东西没拿到**。
   * 这条门禁把顺序钉死：栏位满 → 什么都没发生。
   */
  g.newRun(1007);
  g.data.gold = 500;
  const ids = Object.keys(ITEMS).slice(0, 3);   // 任意三件都能占满栏位（kind 是 hold / use，不是 item）
  g.data.held = [...ids];
  g.invalidateMods();
  g.data.bossKills = 0;
  ok(g.data.held.length === g.heldMax(), '前提：手上正好拿满', `${g.data.held.length} / ${g.heldMax()}`);

  const shop = g.startShop();
  const idx = (shop?.stock ?? []).findIndex((s) => s.kind === 'item');
  ok(idx >= 0, '货架上有道具可买', `第 ${idx} 项`);
  if (idx >= 0) {
    const gold0 = g.data.gold;
    const held0 = g.data.held.length;
    const res = g.buy(idx);
    ok(res.ok === false && res.heldFull === true, '满栏位时买道具被拦住（heldFull）', res.text?.slice(0, 24));
    ok(g.data.gold === gold0, '**一分钱都没扣**', `${gold0} → ${g.data.gold}`);
    ok(g.data.held.length === held0, '手上也没多出东西');
    ok(!g.shop.soldOut.includes(idx), '这件货还挂在货架上（没被白标成售出）');
    // 丢掉一件之后应该就能正常买
    g.dropItem(g.data.held[0]);
    const res2 = g.buy(idx);
    ok(res2.ok === true && g.data.gold === gold0 - g.shop.stock[idx].price,
      '丢掉一件之后能正常买、并且照价扣钱', `${gold0} → ${g.data.gold}`);
  }
}

group('⑨ 掉落「不要这件」之后不许再问一遍');
{
  /**
   * 用户报的：「两个选项都会弹出让你丢东西的页面，而且两个选项的意思都是拿下，不能选择不拿」。
   * 引擎这一侧的责任是：**拒绝之后不留 `awaitingOverflow`**（否则地图页会再弹一次）。
   */
  g.newRun(1008);
  g.data.held = Object.keys(ITEMS).slice(0, 3);
  g.invalidateMods();
  g.data.bossKills = 0;
  /**
   * 用**普通战斗**造「拿不下」：首领那一条会先把栏位 +1（那是另一条规则，见 ⑦），
   * 所以首领掉落永远放得下 —— 想测溢出只能用普通怪。
   */
  g.startBattle('normal', 0, 'direct');
  const fresh = Object.keys(ITEMS).find((id) => !g.data.held.includes(id));
  g.rollItemDrop = () => ({ id: fresh, reason: 'random' });
  g.battle.enemy.hp = 0;
  g.battle.winner = 'player';
  g.battle.over = true;
  const r = g.finishBattle();
  ok(r?.itemDrop && r.itemDrop.stored === false, '前提：这次是真的拿不下（overflow）', `${g.data.held.length} / ${g.heldMax()}`);
  // 模拟界面点「丢掉一件，收下它」那条路：把 pending 交给丢弃弹窗
  g.awaitingOverflow = { id: r.itemDrop.id, text: r.itemDrop.text };
  ok(!!g.awaitingOverflow, '选择「丢掉一件」时会把待处理项交给弹窗');
  /**
   * 模拟界面点「不要，就这样」：界面会把三个标记一次写好（见 src/ui/screens.js 的 renderItemDrop），
   * 然后走结算 —— 结算**不许**再把它塞回 awaitingOverflow。
   */
  r.itemDrop.overflow = false;
  r.itemDrop.declined = true;
  r.itemDrop.seen = true;
  g.awaitingOverflow = null;
  g.takeRewardCard(null);
  ok(!g.awaitingOverflow, '拒绝之后没有遗留的待处理项（地图页不会第二次弹「丢掉一件」）');
  ok(!g.data.held.includes(fresh), '拒绝的那件确实没进手持栏', `${ITEMS[fresh]?.name}`);
}

// ---------- ⑩ 持有效果的「死 key」：一件都不许再出现 ----------
/**
 * 用户报的原话：「有玩家发现目前战后恢复的道具（大根茎等）都不起效，请你进行 bug 查询，
 * 还有哪些没有生效的道具」。
 *
 * 查下去是 5 个 key 从头到尾**没有一行代码读过**（大根茎 / 元气根 / 幸运蛋 / 贵重骨头 /
 * 彗星碎片 / 甜甜蜜 / 炽热岩石 / 妖精宝石 / 沙沙岩石 共 9 件）——
 * 数据、文案、图鉴、掉落全都正常，所以肉眼完全看不出来。
 * 静态那一份门禁在 tools/check-item-effects.mjs，这里测的是**行为**：
 * 每一类效果都真的在引擎里产出可观测的变化。
 */
group('⑩ 战后回复：大根茎 / 元气根（玩家报的那个）');
{
  /** 打一场必胜的普通战斗，返回这一场的结果（掉落打桩成不掉，免得干扰） */
  const fightOnce = (held, seed) => {
    const gg = new Game({ seed: 1 });
    gg.newRun(seed);
    gg.data.held = [...held];
    gg.invalidateMods();
    gg.rollItemDrop = () => null;
    gg.data.hp = Math.round(gg.data.maxHp * 0.2);   // 血够低，回复不会被最大生命夹住
    gg.startBattle('normal', 0, 'direct');
    gg.battle.enemy.hp = 0;
    gg.battle.winner = 'player';
    gg.battle.over = true;
    /**
     * ⚠ 最大生命要**在打完之前**抄下来：战后成长（applyGrowth）可能加最大生命，
     * 打完再读 `data.maxHp` 会比结算那一刻大一点，算出来的期望值就差了 1 点
     * （第一版就是这么假红的：268 × 16% = 42.88 → 43，而结算时是 265 × 16% = 42.4 → 42）。
     */
    const maxHp = gg.data.maxHp;
    return { g: gg, maxHp, r: gg.finishBattle() };
  };

  const plain = fightOnce([], 2001);
  const base = Math.round(plain.maxHp * BALANCE.healAfterBattlePct);
  ok(plain.r.healed === base, '空手：战后回复 = 基础比例', `${plain.r.healed}（最大生命 ${plain.maxHp} 的 ${Math.round(BALANCE.healAfterBattlePct * 100)}%）`);

  const root = ITEMS.big_root;
  const withRoot = fightOnce([root.id], 2001);
  const add = root.hold.mods.find((m) => m.key === 'healAfterBattlePct').add;
  const want = Math.round(withRoot.maxHp * (BALANCE.healAfterBattlePct + add));
  ok(withRoot.r.healed === want, `拿着「${root.name}」真的多回了`, `${plain.r.healed} → ${withRoot.r.healed}（+${Math.round(add * 100)}%）`);
  ok(withRoot.r.healed > plain.r.healed, '比空手回得多（这就是玩家说「不起效」的那一件事）');

  const energy = ITEMS.energy_root;
  const withEnergy = fightOnce([energy.id], 2001);
  const add2 = energy.hold.mods.find((m) => m.key === 'healAfterBattlePct').add;
  ok(withEnergy.r.healed === Math.round(withEnergy.maxHp * (BALANCE.healAfterBattlePct + add2)),
    `「${energy.name}」同样生效`, `+${Math.round(add2 * 100)}% → ${withEnergy.r.healed}`);

  // 两件一起拿 = 相加（不是相乘、也不是只算一件）
  const both = fightOnce([root.id, energy.id], 2001);
  ok(both.r.healed === Math.round(both.maxHp * (BALANCE.healAfterBattlePct + add + add2)),
    '两件一起拿：加成相加', `${both.r.healed} ≈ 基础 ${base} + ${Math.round((add + add2) * 100)}%`);
}

group('⑪ 金币加成：幸运蛋 / 贵重骨头');
{
  g.newRun(2002);
  g.data.held = [];
  g.invalidateMods();
  g.data.gold = 0;
  ok(g.gainGold(100) === 100, '空手：拿多少是多少', '100 → 100');

  const egg = ITEMS.lucky_egg;
  const eggAdd = egg.hold.mods.find((m) => m.key === 'goldPct').add;
  g.data.held = [egg.id];
  g.invalidateMods();
  ok(g.gainGold(100) === Math.round(100 * (1 + eggAdd)), `拿着「${egg.name}」拿钱变多`,
    `100 → ${g.gainGold(0) === 0 ? Math.round(100 * (1 + eggAdd)) : '?'}（+${Math.round(eggAdd * 100)}%）`);

  // 战斗奖励那条路也真的走 gainGold（不是只在这一个函数里成立）
  const battleGold = (held) => {
    const gg = new Game({ seed: 1 });
    gg.newRun(2002);
    gg.data.held = [...held];
    gg.invalidateMods();
    gg.rollItemDrop = () => null;
    gg.startBattle('normal', 0, 'direct');
    gg.battle.enemy.hp = 0;
    gg.battle.winner = 'player';
    gg.battle.over = true;
    return gg.finishBattle().gold;
  };
  const g0 = battleGold([]);
  const g1 = battleGold([egg.id]);
  ok(g1 > g0 && Math.abs(g1 - g0 * (1 + eggAdd)) <= 1, '战斗金币也吃这个加成（两次同种子的战斗对比）',
    `${g0} → ${g1}`);

  const bone = ITEMS.rare_bone;
  const boneAdd = bone.hold.mods.find((m) => m.key === 'goldPct').add;
  g.data.held = [bone.id];
  g.invalidateMods();
  ok(g.gainGold(100) === Math.round(100 * (1 + boneAdd)), `「${bone.name}」同样生效`, `+${Math.round(boneAdd * 100)}%`);

  /**
   * **卖东西不吃这个加成**（故意的）：卖价由 itemSellPrice 定死，
   * 否则「买进来再卖出去」就成了一台印钞机。
   */
  g.data.held = [egg.id, bone.id];
  g.invalidateMods();
  const goldBefore = g.data.gold;
  const sold = g.sellItem(bone.id);
  ok(sold.gold === itemSellPrice(bone) && g.data.gold === goldBefore + itemSellPrice(bone),
    '卖道具照原价（不被金币加成放大：那会变成刷钱的口子）', `${sold.gold} 金`);
}

group('⑫ 卡牌奖励多一个选项：彗星碎片');
{
  const choicesFor = (held, kind, seed) => {
    const gg = new Game({ seed: 1 });
    gg.newRun(seed);
    gg.data.held = [...held];
    gg.invalidateMods();
    gg.rollItemDrop = () => null;
    gg.startBattle(kind, 0, 'direct');
    gg.data.cardDrought = 9;                  // 保底：这一场必定出卡
    gg.battle.enemy.hp = 0;
    gg.battle.winner = 'player';
    gg.battle.over = true;
    return gg.finishBattle().cardChoices.length;
  };
  const shard = ITEMS.comet_shard;
  const plainNormal = choicesFor([], 'normal', 2003);
  const shardNormal = choicesFor([shard.id], 'normal', 2003);
  ok(plainNormal === 3, '普通战斗：3 个选项', String(plainNormal));
  ok(shardNormal === plainNormal + 1, `拿着「${shard.name}」多一个选项`, `${plainNormal} → ${shardNormal}`);
  const plainElite = choicesFor([], 'elite', 2003);
  const shardElite = choicesFor([shard.id], 'elite', 2003);
  ok(plainElite === 4 && shardElite === 5, '精英 / 首领（本来就 4 个）同样 +1', `${plainElite} → ${shardElite}`);
}

group('⑬ 事件与营地的回复量：甜甜蜜');
{
  /** 直接造一个事件选项跑一遍（走的是真的 eventfx 执行链） */
  const runOption = (held, effects, seed) => {
    const gg = new Game({ seed: 1 });
    gg.newRun(seed);
    gg.data.held = [...held];
    gg.invalidateMods();
    gg.data.hp = 10;
    gg.data.gold = 200;          // 留够钱：付得起才看得到「付了多少」
    const gold0 = gg.data.gold;
    gg.event = { id: 'test_event', options: [eventOption({ label: 't', effects, text: 't' })] };
    gg.phase = 'event';
    gg.chooseEventOption(0);
    return { heal: gg.data.hp - 10, gold: gg.data.gold - gold0, g: gg };
  };
  const honey = ITEMS.honey;
  const add = honey.hold.mods.find((m) => m.key === 'eventHealPct').add;
  ok(!!honey, `甜甜蜜在道具表里`, honey.name);

  const plain = runOption([], [{ hp: 100 }], 2004);
  const sweet = runOption([honey.id], [{ hp: 100 }], 2004);
  ok(plain.heal === 100, '空手：事件回 100 就是 100', String(plain.heal));
  ok(sweet.heal === Math.round(100 * (1 + add)), `拿着「${honey.name}」事件回血变多`, `${plain.heal} → ${sweet.heal}（+${Math.round(add * 100)}%）`);

  const plainGold = runOption([], [{ gold: 100 }], 2005);
  const honeyGold = runOption([honey.id], [{ gold: 100 }], 2005);
  ok(honeyGold.gold === 100, '事件里的金币**不吃**这个加成（甜甜蜜只管回复量）', `+${honeyGold.gold} 金`);
  const eggGold = runOption([ITEMS.lucky_egg.id], [{ gold: 100 }], 2005);
  const eggAdd = ITEMS.lucky_egg.hold.mods.find((m) => m.key === 'goldPct').add;
  ok(eggGold.gold === Math.round(100 * (1 + eggAdd)), '事件里的金币吃的是「获得的金币 +X%」（幸运蛋）', `+${eggGold.gold} 金`);
  ok(plainGold.gold === 100, '空手：事件给 100 就是 100', `+${plainGold.gold} 金`);
  const pay = runOption([ITEMS.lucky_egg.id], [{ gold: -45 }], 2006);
  ok(pay.gold === -45, '事件里要付的钱照付（不会被道具加成放大）', `${pay.gold} 金`);

  g.newRun(2007);
  g.data.held = [];
  g.invalidateMods();
  const restPlain = g.startRest().healAmount;
  g.data.held = [honey.id];
  g.invalidateMods();
  const restSweet = g.startRest().healAmount;
  ok(restPlain === Math.round(g.data.maxHp * BALANCE.restHealPct), '营地：空手按基础比例回', `${restPlain}`);
  ok(restSweet === Math.round(g.data.maxHp * BALANCE.restHealPct * (1 + add)),
    `营地也吃这个加成`, `${restPlain} → ${restSweet}`);
}

group('⑭ 自身增益持续 +1 回合：炽热岩石');
{
  const buffBattle = (mods) => new Battle({
    seed: 11, mods,
    player: { name: 'T', slug: 'flygon', hp: 300, maxHp: 300, atk: 30, def: 10, agi: 10, luck: 0 },
    deck: ['sand_beat'],
    enemy: { id: 'e', slug: 'sandile', name: 'E', maxHp: 400, atk: 10, def: 2, agi: 5, luck: 0, tier: 'mob', deck: ['sand_beat'] },
  });
  const rock = ITEMS.heat_rock;
  const add = rock.hold.mods.find((m) => m.key === 'buffTurns').add;
  const card = CARD_BY_ID.sand_beat;                 // 行动点上限 +1（持续 3 回合）
  ok(!!card && card.effects.some((e) => e.kind === 'grantBuff'), '找到一张给自己挂强化的牌', card?.name);

  const b0 = buffBattle(undefined);
  b0.start();
  b0.resolveCard('player', card, {});
  const t0 = b0.player.buffs.apMax?.turns;
  ok(t0 === 3, '空手：强化持续 3 回合（卡面写的数）', `turns=${t0}`);

  const g2 = new Game({ seed: 1 });
  g2.newRun(2008);
  g2.data.held = [rock.id];
  g2.invalidateMods();
  const b1 = buffBattle(g2.heldMods());
  b1.start();
  b1.resolveCard('player', card, {});
  const t1 = b1.player.buffs.apMax?.turns;
  ok(t1 === t0 + add, `拿着「${rock.name}」持续回合 +${add}`, `${t0} → ${t1}`);

  // 负面：敌人给自己挂的强化**不许**被玩家的道具拉长
  const b2 = buffBattle(g2.heldMods());
  b2.start();
  b2.resolveCard('enemy', card, {});
  ok(b2.enemy.buffs.apMax?.turns === 3, '对手给自己挂的强化不受玩家道具影响', `turns=${b2.enemy.buffs.apMax?.turns}`);
}

console.log(`\n道具（手持）回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
