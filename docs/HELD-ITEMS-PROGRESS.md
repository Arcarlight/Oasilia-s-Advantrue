# 手持道具改造 · 进度与交接（写给我自己，压缩上下文后照这份接着干）

> **状态：已完成并上线（v2.0，提交 5c43fdc）。** 这份文件留着当**参考手册**：
> 道具系统长什么样、每个工具干什么、以后加内容走哪条路、踩过哪些坑。
> 最后更新：全部做完（图鉴 / 买卖 / 掉落 / 丢弃 / 三语 / 体检 / 打包 / 上线）。
>
> 一句话回顾：**背包制 → 手持制**。手里最多 3 件（每打赢一个首领 +1），
> 道具分「持有生效」与「战斗外使用」两类；来源是商人买 / 卖、宝箱、敌人掉落；
> 有独立的道具图鉴；**战斗中不能使用使用型道具**（用户点名：太 imba）。

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

## 三、后面又做完的部分（原计划里的第 1~7 条，全部落地）

1. **道具图鉴**：`src/ui/codex.js` 的 `showItemCodex()` / `showItemDetail()`；
   标题页第 4 个入口（`ico-backpack`）。规则和敌人图鉴一样：没拿过 = 压暗剪影 + ？？？。
   「见过」记在 `save.js` 的 `meta.seenItems`，**只在 `Game.giveItem()` 里记一次**
   （买到 / 开箱 / 掉落都走它，散着记一定会漏一处）。
2. **商人卖道具**：`screens.js` 的商店里多一栏「卖掉手上的道具」
   （`game.sellItem(id)`，价钱 `itemSellPrice` = 售价 40%），卖完刷新顶部金币。
3. **手持栏满的「丢掉哪一件」**：`overlays.js` 的 `showHeldOverflow(game)`，
   由 `renderMap()` 在回到地图时弹（奖励 / 宝箱 / 掉落三条路都会经过地图，挂一处就够）。
   数据侧是 `game.awaitingOverflow = { id, text }`。
4. **三语**：工具做成了 `tools/i18n-todo.mjs`（`list` → 分片翻 → `merge`），
   这批一共补了 **250 条**（206 + 39 + 5），现在 **ja / en 各 3509/3509（100%）**。
   道具名要求用**官方译名**（见下面第五节的核对办法）。
5. **测试与诊断**：`tools/test-items.mjs`（28 条）与 `tools/diag-items.js`（25 条）按新机制重写。
   诊断抓到一个真 bug：**战斗里「使用」按钮没禁用**（`blocked` 里 inBattle 写反了）。
6. **平衡**：`itemDropChance` 从 `{.06,.08,.18,.35}` 提到 `{.10,.12,.26,.45}`
   （战斗中不能嗑药，道具成了唯一的战外续航）。400 局模拟：通关率 **13.5% / 14.5%**、
   平均第 **3.94 / 4.08** 章 —— 和基线（13.5% / 4.04）一致，**没有系统性回归**。
7. **更新日志 v2.0** + `package.json` 2.0，bundle → verify → smoke → 提交 → 推送 →
   `compare-deployed` 全部一致。

### 已知的小瑕疵（不影响交付，看到了别慌）

* `tools/test-deck-growth.mjs` 极偶尔会红一条（概率型断言，5 次里偶发 1 次）——
  重跑就好；改奖励 / RNG 流之后更容易撞上。
* `diag-events.js` 里还留着 `items: JSON.stringify(g.data.items)` 这行**日志文本**
  （不影响判定，但打出来是 undefined）—— 顺手可改成 `g.data.held`。
   → commit → push → `compare-deployed.mjs`。
8. **README / 交接文档**：README 的「道具」一节已改成手持制，并指向 `tools/author.mjs`。

---

## 四、门禁状态（**交付时的快照，全绿**）

* `node tools/author.mjs check` → **✅ 全绿：20 步，用时 41 秒**（一键跑完下面这一串）。
* `build-content` → 通过（69 件道具全过校验）· `build-i18n` → **ja / en 各 3509/3509（100%）**。
* `check-content --strict` → 通过（含「道具图 69 张齐全」的备注）。
* `check-copy` → 13/13 · `check-icons` → 通过 · `subset-fonts` → 通过。
* 11 套 `test-*.mjs` 全过（其中 test-items 28 条）· diag-items 25 条全过 · diag-codex 全过。
* `bundle` → `verify-bundle` → **VERIFY_OK** → `smoke-check` → **SMOKE_OK / ERRORS=[]**。
* 平衡：400 局模拟 **通关率 13.5%（另一次 14.5%）· 平均第 3.94 章**（基线 13.5% / 4.04）。
* 上线：`git push` → `compare-deployed` → **全部一致**。

---

## 五、以后加内容怎么加（用户要的「接口」）

**入口就是 `tools/author.mjs`**（已经写好，不是计划）：

```
node tools/author.mjs new item  <id>     # 道具：写 content/items.json 骨架 + 导图提示
node tools/author.mjs new card  <id>     # 卡牌：cards.json 骨架（含最常用的效果模板）
node tools/author.mjs new enemy <slug>   # 敌人：enemies.json + species.json 占位 + 五步清单
node tools/author.mjs new map   <key>    # 地图：biomes.json 占位 + 要补什么
node tools/author.mjs todo               # 还差什么（未翻文案 / 缺图 / 缺口吻台词 / 孤儿译文）
node tools/author.mjs check              # 一键体检：按固定顺序跑完 20 步
```

`check` 的顺序（**写死在脚本里，别改**）：
`build-content` → `build-i18n` → **`subset-fonts`** → `check-content --strict` → `check-copy`
→ `check-icons` → 11 套 `test-*.mjs` → `bundle` → `verify-bundle` → `smoke-check`。

> 为什么字体子集排在内容体检**之前**：体检里有一条「字体子集是不是过期了」，
> 刚改完文案时它必然过期（新字还没裁进去）。第一版顺序写反了，加一条更新日志就卡住。

### 补译文的标准流程（`tools/i18n-todo.mjs`）

```
node tools/i18n-todo.mjs list        # 把待翻清单写成 content/i18n/_todo.json（权威清单来自 _report.json）
node tools/i18n-todo.mjs slice 0 20  # 读第 0~19 条（写手读这个，不用把整份塞进提示里）
# 写手把结果写成 content/i18n/parts/qNN.json：{ "<中文原文>": { "ja": "…", "en": "…" } }
node tools/i18n-todo.mjs merge       # 校验（条数 / 占位符 / 非空）后并进 ja.json / en.json
```
合并完记得删掉 `content/i18n/parts/` 与 `_todo.json`（它们是中间产物，别提交）。

### 道具名怎么保证是**官方译名**（用户专门盯过这条）

别凭记忆写。用 52poke 的 API 逐条核（**英文名 → 官方中文条目标题**）：

```js
// 搜条目：拿到的第一条「xxx（道具）」就是官方中文名
https://wiki.52poke.com/api.php?action=query&format=json&list=search&srlimit=5&srsearch=<英文名>
// 判存在：一次问一批，看 missing 字段
https://wiki.52poke.com/api.php?action=query&format=json&redirects=1&titles=<中文名（道具）|…>
```
（本机要走代理：`$env:NODE_USE_ENV_PROXY=1; $env:HTTPS_PROXY=http://127.0.0.1:7897`。
这一轮就是这么查出 19 个错的：甜甜苹果 / 冰冷岩石 / 达人带 / 美丽之羽 / 妖怪石板 / 恶颜石板 /
钢之宝石 / 妖精之羽 / 沙沙岩石 / 肌力之羽 / 硬石头 / 龙之鳞片 / 哞哞鲜奶 / 贝壳之铃 /
光粉 / 紧缠钩爪 / 元气根 / 光苔 / 甜甜蜜。）
改名字时**三处一起改**：`content/items.json` 的 `name`、两本字典的**键**（键就是中文原文，
用脚本移动键并删掉旧键），然后 `build-content` + `build-i18n`。
→ `subset-fonts` → `check-content --strict`（字体指纹会变，要复查一次）→ 11 套 `test-*.mjs`
→ 相关 `diag2.mjs` → `bundle` → `verify-bundle` → `smoke-check`。
每一项失败时就地打印「该改哪个文件 / 哪一行」，别只给退出码。

写 `author.mjs` 时**照抄 `tools/import-items.mjs` 的头部格式**：用法、为什么要有它、
依赖的解包目录、以及「改哪个字段就够」。这就是用户要的「未来的我看得懂」。
（`tools/author.mjs` 已经按这个格式写好了，可以直接当模板。）

---

## 六、几个容易踩的坑（这次踩过的）

* **在 `tools/smoke-script.js` 里改断言没用** —— 那个文件是 `tools/smoke-check.mjs`
  每次运行时**生成**的（内嵌的 SCRIPT 字符串才是真身），手改会被下次运行覆盖。
  改断言去改 `smoke-check.mjs`。
* **循环 import 只在单文件包里炸**：`game.js → events → eventfx.js → game.js` 这种环，
  开发时（浏览器逐个模块加载）看不出问题，`bundle` 之后变成
  `Cannot destructure property 'heldCount' … as it is undefined`。所以**纯规则放叶子模块**
  （`src/core/item-rules.js`），`verify-bundle` 是唯一能抓到这个的关卡，别跳过它。
* **PowerShell 里 `git show > 文件` 会写成 UTF-16**，node 直接读不了 —— 用
  `git checkout <rev> -- <路径>` 或 write 工具，别用重定向。
* 带引号 / 花括号的 `node -e` 在 PowerShell 下会被拆坏 —— 复杂逻辑写成临时 `.mjs` 再跑。
* `content/items.json` 的图名 = 包里的文件名（如 `ORANBERRY`）；换图只改 `art` + 重跑
  `node tools/import-items.mjs`，**不要手工往 assets/items 里丢文件**（否则尺寸表会对不上，
  `build-content` 会报「art 和 assets/data/items.json 记的不一致」）。
* 道具的 `hold.mods` 写错 key = **静默不生效**（玩家花了钱什么都没得到），所以校验卡得很死；
  加新效果时**先**在 `build-content.mjs` 的 `MOD_KEYS` 里登记，再加 `battle.js` 的钩子，
  最后在 `itemtext.js` 的 `modLabel` 里加一句人话。
* **改中文原文 = 改字典的键**：两本字典都以中文原文为键，改名字 / 改句子时要把键**搬过去**
  （旧键留着会变成「孤儿译文」，`check-content` 会列出来）。
* **界面别自己往 `#stage` 里画屏**（v2.5 修的坑，很贵）：战斗界面结算时曾经自己
  `import('./screens.js')` 调 `renderReward/renderGameOver` 直接画屏，绕过了 `UI.render()`
  的换屏记账 `ui.current`。于是只要记账和实际屏幕对不上（实测 `ui.current === 'map'`），
  奖励页就成了"没人认领"的一屏：点「拿卡」时引擎照常推进（卡进卡组、进下一章），
  但重画在地图那一支被 `this.current === 'map' && !g.mapDirty` 的早退挡掉 ——
  屏幕永远停在已经作废的奖励页，再点什么都不动（用户报的「打完 boss 卡在奖励页」）。
  两条规矩：**① 换屏只走 `UI.render()` 按 phase 分发**（`mapDirty` 从来没被置位过，
  所以那个早退现在还要额外确认 `.map-screen` 真的在屏幕上）；**② `reward` 为空时
  绝不画奖励页**，直接退回地图。
* **冒烟脚本里的断言以前是白写的**：`tools/smoke-check.mjs` 只找 `SMOKE_OK` 这一行，
  页面里 `errors.push(...)` 出来的 `ERRORS=[...]` 没人看，退出码照样 0 ——
  一键体检"全绿"而 bug 还在。现在 `smoke-check.mjs` 会解析 `ERRORS` 并以退出码 1 失败
  （用「首领奖励页必须点得掉」那条断言 A/B 验过：去掉修复 → exit 1）。
  加浏览器级断言就往 `smoke-check.mjs` 的内嵌 SCRIPT 里加，**别忘了它是个模板字符串**：
  注释里不能出现反引号和 `${`。
