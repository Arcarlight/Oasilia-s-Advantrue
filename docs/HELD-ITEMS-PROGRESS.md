# 手持道具改造 · 进度与交接（写给我自己，压缩上下文后照这份接着干）

> 这份文件是**中途交接**用的。用户提的是一整块大改动（背包制 → 手持制），
> 一次会话做不完。任何时候上下文被压缩、或者换了新会话，**先读这一份**再动手。
> 最后更新：道具数据层 + 引擎钩子 + 手持面板已落地，**图鉴 / 商人卖道具 / 三语 / 打包上线还没做**。

---

## 一、用户要什么（原话要点）

1. 把**背包制**改成**手持道具**机制。
2. 道具素材用 `Generation 9 Pack v3.3.7` 的 `Graphics/Items`（rar 在 `~/Downloads`，**不进仓库**）。
3. 道具分两类：**持有**（拿在手上一直生效）与**使用**（**只能在战斗外**使用）。
   用户举的例子：哞哞牛奶（恢复类卡牌回血更多）、毒毒糖（中毒不衰减 + 每回合多扣血）、
   锐利之爪（出血层数翻倍）。可以专门做个**道具图鉴**。
4. 来源：**商人买**、**宝箱开**、**敌人掉落（概率低，属性对应的掉落物权重更高）**。
5. 持有上限 **3 个，每打赢一个 boss +1**；满了要**丢掉一个**才能拿新的；也能在**商人处卖掉**。
6. 追加要求 A：**战斗中不能使用「使用道具」**（「那样太 imba 了」）——引擎与界面两处都要拦。
7. 追加要求 B：**不要强人造物**（伤药 / 解毒药那类）。回血的改成**橙橙果**这类果子；
   护符可以保留，做成持有型。
8. 追加要求 C：给「以后加道具 / 敌人 / 地图 / 卡牌」做**一个接口**（见下面第五节）。
9. 追加要求 D：**留下的工具必须自带说明**，让压缩上下文后的我也看得懂（这份文件 + 每个工具头部注释）。

已定的四个设计选择（问过用户）：
* 旧道具：护符 → 持有型；伤药 / 活力药 → 果子 / 自然物；id 不变的那四个护符直接复用。
* **同名可以拿多件**：数值型按件数叠加，开关型（中毒不衰减 / 濒死保命 / 开局净化）重复无效。
* 规模：**豪华约 60 件** → 实际做了 **69 件**（36 属性掉落 + 23 通用持有 + 10 使用）。
* 道具图鉴：**和敌人图鉴同一套规则**（没见过的剪影 + ？？？）。

---

## 二、已经做完的（可以直接跑）

| 做的事 | 文件 | 说明 |
|---|---|---|
| 道具内容（69 件，唯一数据源） | `content/items.json` | `_comment` / `_fields` / `_modKeys` 写在文件顶部，看一眼就懂字段含义 |
| 道具图导入 | `tools/import-items.mjs` | 按 `art` 字段从 `%TEMP%\gen9items\Graphics\Items` 复制成 `assets/items/<id>.png`，并写 `assets/data/items.json`（尺寸表）。`--check` 只报缺图 |
| 生成数据 | `src/data/items.js`（GENERATED-ITEMS 区块） | `ITEMS` / `ITEM_ART` / `STARTER_ITEMS`；文件尾部还有 `isHeldItem` / `isUsableItem` / `itemArtUrl` 三个小工具 |
| 生成 + 校验 | `tools/build-content.mjs` | `validateItems()`：art 有图、rarity 认识、hold.mods 的 key 在引擎认识的那套里、开关型不许带 add/mul、use 效果认识、`drop` 必须是 18 属性之一、id 一致 |
| 引擎：手持栏 | `src/core/game.js` | `heldMax()`=3+bossKills、`heldMods()/modAdd/modMul/modFlag`、`giveItem`（满了返回 `overflow`）、`dropItem`、`sellItem`、`useItem`（**战斗里直接拒绝**）、`cleanseStatuses`、`itemPrice`（含折扣） |
| 引擎：掉落 / 宝箱 / 奖励 | `src/core/game.js` | `rollItemDrop()`（按属性 ×4 权重、稀有度权重）、`rollChestItem()`、`takeRewardCard()` 里发掉落并把 `overflow` 存进 `awaitingOverflow` |
| 数值开关 | `src/data/balance.js` | `itemDropChance {mob .06, normal .08, elite .18, boss .35}`、`itemDropTypeWeight 4`；旧的 `potionDropChance` 已删 |
| 引擎：持有效果接入战斗 | `src/core/battle.js` | 顶部 `modAdd/modMul/modFlag` 三个函数 + `side.mods`（只挂玩家）。已接：攻击力/防御/敏捷/幸运、`attackPct`、`firstAttackPct`、`damageTakenPct`、`shieldPct`、`healPct`、`dotPct`、`poisonTickPct`、`poisonNoDecay`、`poisonStacks/burnStacks/bleedStacksMult/debuffStacks`、`apPerTurn/apFirstTurn`、`drawPerTurn`、`lifestealPct`、`selfDamagePct`、`surviveOnce`、`battleStartShieldPct`、`battleStartCleanse`、`healPerTurnPct`、`healOnKillPct` |
| 效果说人话 | `src/core/itemtext.js` | `modLabel(key, v)` / `holdLines(item)` / `useLine(item)`：**唯一一份**把效果翻成玩家语言的表（手持面板 / 商店 / 图鉴都用它） |
| 手持面板（取代背包） | `src/ui/overlays.js` 的 `showItems()` | 一排格子 + 「现在生效的持有效果」汇总 + 每件的使用 / 丢掉；**战斗中不给用** |
| 面板样式 | `src/ui/style.css` | `.held-*` / `.shop-item-art` / `.reward-item-art` 一组 |
| 迁移旧引用 | `content/cards.json`（删掉 items/starterItems）、`content/events/*.json`、`content/merchants.json` | 旧 id → 新 id：`potion_small→oran_berry`、`potion_big→sitrus_berry`、`elixir→sweet_apple`；四个护符 id 不变 |

**备份**（用户要求）：`D:\ToolsSoftware\DSH_GameTsukuru_backup_20260920`（491.8MB / 14569 文件）
+ git tag **`backup-before-held-items`**（已推到 GitHub）。

---

## 三、还没做的（按建议顺序）

1. **道具图鉴**（用户明确要）：标题页第 5 个入口 `ico-backpack`；`src/ui/codex.js` 里照
   `showEnemyCodex` 的模式加 `showItemCodex` / `showItemDetail`；没拿过的显示剪影 + ？？？。
   数据要记「见过 / 拿到过」：`save.js` 的 meta 加 `seenItems: []`（拿到或买过就记），
   `game.js` 在 `giveItem` / `buy` 里调 `save.noteItem(id)`。
2. **商人卖道具**：`screens.js` 的商店界面加「卖掉手上的道具」一栏（`game.sellItem(id)` 已经写好，
   价钱 `itemSellPrice` = 售价 40%）；卖出后要刷新顶部金币与手持栏。
3. **手持栏满的「丢掉哪一件」选择**：`game.awaitingOverflow` 已经会带 `{id, text}`，
   需要在 `screens.js` 的地图 / 宝箱 / 奖励流程里弹一个选择框（列出当前手持的 + 「丢掉这件新拿的」）。
4. **三语**：`node tools/build-i18n.mjs` 之后会看到 **ja / en 各缺 206 条**（69 个道具名 +
   69 条 desc + 新增界面文案），另有 32 条**孤儿译文**要清。日 / 英的道具名建议：
   官方译名优先（橙橙果 = オレンのみ / Oran Berry），效果文案照 `itemtext.js` 的口吻直译。
   **翻完必须** `node tools/subset-fonts.mjs`（新汉字会掉兜底字体）。
5. **测试与诊断**：
   * `tools/diag-items.js` 还是**旧背包制**的（它读 `game.data.items`、点「使用」按钮）——
     要按新机制重写：手持栏上限、战斗里不能使用、丢掉 / 卖掉、掉落按属性加权。
   * `tools/diag-events.js` 里 `items: JSON.stringify(g.data.items)` 也要改成 `g.data.held`。
   * `tools/test-items.mjs`（回归套件之一）同样要按新 API 重写。
   * 建议新增：`node tools/autorun`（第五节）的一键体检里带上它们。
6. **平衡**：`node tools/measure-balance.mjs 300` + `node tools/simulate-run.mjs 400`。
   ⚠ 这一次的机制变化**主观上变难了**：战斗里不能嗑药、道具要靠掉落 / 购买、栏位只有 3 个。
   跑完和基线比（基线：通关率 ~13.5%、平均到第 4.04 章），差得多就把
   `itemDropChance` 调高一点（这是唯一该动的旋钮 —— 用户说过**当前平衡是基准**）。
7. **更新日志 + 版本号**：`src/core/changelog-data.js` 加一条 **v2.0**（这是一次大改版），
   `package.json` 同步;然后 `node tools/bundle.mjs` → `verify-bundle.mjs` → `smoke-check.mjs`
   → commit → push → `compare-deployed.mjs`。
8. **README**：把「道具」那一节改成手持制，并写上第六节那份「怎么加内容」的入口。

---

## 四、当前门禁状态（中途快照，别被吓到）

* `node tools/smoke-check.mjs` → **SMOKE_OK / ERRORS=[]**（界面能跑，手持面板能用）。
* `node tools/build-content.mjs --check` → **通过**（69 件道具全过校验）。
* `node tools/build-i18n.mjs` → **ja / en 各 3261 / 3467（94%）**，缺的 206 条就是第 3 节第 4 条那些。
* `node tools/check-content.mjs --strict` → **红的**，原因就是上面那 206 条未翻 + 孤儿译文。
  这些**在翻完之前不用管**，别去改门禁把它变绿。

---

## 五、以后加内容怎么加（用户要的「接口」）

现状：加内容要动好几处（content JSON → `build-content.mjs` 生成 → 三语 → 字体子集 → 门禁 → 打包），
文件头的注释都写了各自的作用，但**没有统一入口**。计划做一个 `tools/author.mjs`：

```
node tools/author.mjs item  <id>     # 道具：写 content/items.json 骨架 + 按 art 导图 + 提示补三语
node tools/author.mjs card  <id>     # 卡牌：写 content/cards.json 骨架（含效果模板）
node tools/author.mjs enemy <slug>   # 敌人：enemies.json + species.json + 简介 + 口吻台词 + 招式池
node tools/author.mjs map   <key>    # 地图：biomes.json + STAGE_BIOME + CSS 配色类 + 装饰
node tools/author.mjs check          # 一键体检：见下
```

`check` 应当按顺序跑（**顺序有讲究**）：
`build-content` → `build-i18n` → `check-content --strict` → `check-copy` → `check-icons`
→ `subset-fonts` → `check-content --strict`（字体指纹会变，要复查一次）→ 11 套 `test-*.mjs`
→ 相关 `diag2.mjs` → `bundle` → `verify-bundle` → `smoke-check`。
每一项失败时就地打印「该改哪个文件 / 哪一行」，别只给退出码。

写 `author.mjs` 时**照抄 `tools/import-items.mjs` 的头部格式**：用法、为什么要有它、
依赖的解包目录、以及「改哪个字段就够」。这就是用户要的「未来的我看得懂」。

---

## 六、几个容易踩的坑（这次踩过的）

* **PowerShell 里 `git show > 文件` 会写成 UTF-16**，node 直接读不了 —— 用
  `git checkout <rev> -- <路径>` 或 write 工具，别用重定向。
* 带引号 / 花括号的 `node -e` 在 PowerShell 下会被拆坏 —— 复杂逻辑写成临时 `.mjs` 再跑。
* `content/items.json` 的图名 = 包里的文件名（如 `ORANBERRY`）；换图只改 `art` + 重跑
  `node tools/import-items.mjs`，**不要手工往 assets/items 里丢文件**（否则尺寸表会对不上，
  `build-content` 会报「art 和 assets/data/items.json 记的不一致」）。
* 道具的 `hold.mods` 写错 key = **静默不生效**（玩家花了钱什么都没得到），所以校验卡得很死；
  加新效果时**先**在 `build-content.mjs` 的 `MOD_KEYS` 里登记，再加 `battle.js` 的钩子，
  最后在 `itemtext.js` 的 `modLabel` 里加一句人话。
