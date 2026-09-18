// 回归测试：背包道具真的能用。
//
// 起因（玩家反馈）：「背包系统到现在都没有作用，道具都写着已生效，像好伤药那种完全没法用」。
// 根因：背包界面自己判断「这件道具能不能用」，写的是 `item.heal`，
// 而药水的数据字段叫 `healPct` —— 于是**七件道具全部显示「已生效」、一个「使用」按钮都没有**。
// 修法：把「这件道具用下去会发生什么」抽成唯一的 itemEffect()，界面和引擎共用。
//
// 这份测试盯住：
//   ① 每一件道具都必须被 itemEffect() 认出来（不能又出现「谁都不知道它能干什么」的死道具）；
//   ② 药水：能回血、数量会减少、血满时拒绝且不消耗；
//   ③ 护符 / 活力药：**拿到手就生效**，不进背包（界面上的「已生效」才是真的）；
//   ④ 老存档里已经躺在背包里的护符，仍然能用掉（不能变成永远卡在背包里的死物）。
//
// 用法：node tools/test-items.mjs
import path from 'node:path';
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

const { Game, itemEffect, inventoryEntries } = await imp('src/core/game.js');
const { ITEMS } = await imp('src/data/cards.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};

const newGame = (seed = 1) => {
  const g = new Game({ seed });
  g.newRun();
  // 开局自带 STARTER_ITEMS（好伤药 ×2、厉害伤药 ×0）——先清空，免得每个断言都要减去它
  g.data.items = {};
  return g;
};

console.log('\n① 每一件道具都必须被 itemEffect() 认出来');
{
  const all = Object.values(ITEMS);
  const inert = all.filter((it) => !itemEffect(it));
  ok(inert.length === 0, `全部 ${all.length} 件道具都有明确的使用效果（没有「谁都不知道它能干什么」的死道具）`,
    inert.length ? `死道具：${inert.map((i) => i.name).join('、')}` : all.map((i) => `${i.name}=${itemEffect(i).kind}`).join(' '));
  const heals = all.filter((it) => itemEffect(it)?.kind === 'heal');
  ok(heals.length >= 2, '两瓶药水都被识别成回血类', heals.map((i) => i.name).join('、'));
  const stats = all.filter((it) => itemEffect(it)?.kind === 'stat');
  ok(stats.length >= 5, '护符 + 活力药都被识别成属性类', stats.map((i) => i.name).join('、'));
}

console.log('\n② 药水：能回血、数量减少、血满时拒绝且不消耗');
for (const id of ['potion_small', 'potion_big']) {
  const g = newGame(11);
  const it = ITEMS[id];
  g.giveItem(id, 2);
  g.data.hp = 10;                       // 故意压低，不然「血满」会挡住
  const before = g.data.hp;
  const res = g.useItem(id);
  const want = Math.round(g.data.maxHp * it.healPct);
  ok(res?.ok && g.data.hp === Math.min(g.data.maxHp, before + want), `「${it.name}」能回血`,
    `HP ${before} → ${g.data.hp}（期望回 ${want}）`);
  ok(g.data.items[id] === 1, `「${it.name}」用掉一瓶，还剩 1 瓶`, `剩 ${g.data.items[id] ?? 0}`);

  // 血满时：拒绝、且**不能消耗**
  g.data.hp = g.data.maxHp;
  const r2 = g.useItem(id);
  ok(r2?.ok === false && g.data.items[id] === 1, `「${it.name}」血满时拒绝使用且不消耗`,
    `${r2?.text}；剩 ${g.data.items[id]}`);

  // 用完最后一瓶
  g.data.hp = 10;
  g.useItem(id);
  ok(!g.data.items[id], `「${it.name}」用完最后一瓶后从背包里消失`, JSON.stringify(g.data.items));
}

console.log('\n③ 护符 / 活力药：拿到手就生效，不进背包');
for (const id of ['charm_atk', 'charm_def', 'charm_agi', 'charm_luck', 'elixir']) {
  const g = newGame(22);
  const it = ITEMS[id];
  const eff = itemEffect(it);
  const before = g.data[eff.key];
  const got = g.giveItem(id, 1);
  const after = g.data[eff.key];
  ok(after === before + eff.amount, `「${it.name}」拿到就 ${eff.key} +${eff.amount}`, `${before} → ${after}`);
  ok(got.applied?.key === eff.key, `「${it.name}」的返回值说明了生效了什么`, JSON.stringify(got.applied));
  ok(!g.data.items[id], `「${it.name}」不会留在背包里（界面上写「已生效」才是真的）`,
    JSON.stringify(g.data.items));
}

console.log('\n④ 老存档：背包里已经躺着的护符仍然能用掉');
{
  const g = newGame(33);
  // 模拟旧版本存下来的存档：护符躺在 data.items 里
  g.data.items.charm_atk = 1;
  const before = g.data.atk;
  const res = g.useItem('charm_atk');
  ok(res?.ok && g.data.atk === before + ITEMS.charm_atk.stat.atk, '背包里的旧护符能用掉并真的加属性',
    `${res?.text}（攻击 ${before} → ${g.data.atk}）`);
  ok(!g.data.items.charm_atk, '用掉之后从背包里消失');
}

console.log('\n⑤ 边界：没有的道具 / 数量为 0 的道具');
{
  const g = newGame(44);
  ok(g.useItem('potion_small') === null, '背包里没有的药用不了（返回 null，不会崩）');
  g.data.items.potion_small = 0;
  ok(g.useItem('potion_small') === null, '数量为 0 时也用不了');
  ok(g.useItem('不存在的道具') === null, '未知 id 用不了');
}

console.log('\n⑦ 开局数据里那个 ×0 的道具不该出现在背包里');
{
  const g = new Game({ seed: 77 });
  g.newRun();
  const raw = Object.entries(g.data.items ?? {}).filter(([, n]) => n <= 0);
  ok(raw.length > 0, '开局数据里确实带着数量为 0 的条目（这就是要过滤掉的东西）',
    JSON.stringify(g.data.items));
  const listed = inventoryEntries(g.data.items).map(([id]) => id);
  ok(!listed.includes('potion_big'), 'inventoryEntries() 会把 ×0 的厉害伤药滤掉', `留下：${listed.join('、') || '（空）'}`);
  // 未知 id 也要滤掉（旧存档 / 内容改过时别让背包崩）
  const weird = inventoryEntries({ potion_small: 1, 不存在的道具: 3, potion_big: 0 });
  ok(weird.length === 1 && weird[0][0] === 'potion_small', '未知 id 也会被滤掉', JSON.stringify(weird));
}

console.log('\n⑥ 战斗中也能喝药（不占出牌次数）');
{
  const g = newGame(55);
  g.giveItem('potion_big', 1);
  g.startBattle('normal', 0);
  const b = g.battle;
  g.data.hp = Math.max(1, Math.floor(g.data.maxHp * 0.3));
  const playsLeft = b.player.playsLeft;
  const before = g.data.hp;
  const res = g.useItem('potion_big');
  ok(res?.ok && g.data.hp > before, '战斗中喝药真的回血', `HP ${before} → ${g.data.hp}`);
  ok(b.player.playsLeft === playsLeft, '喝药不消耗出牌次数', `playsLeft ${playsLeft} → ${b.player.playsLeft}`);
}

console.log(`\n道具（背包）回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
