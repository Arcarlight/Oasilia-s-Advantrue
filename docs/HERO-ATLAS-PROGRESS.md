# 3.0 双主角（暴飞龙 阿特拉斯）· 进度与设计（压缩上下文后照这份接着干）

原来的进度文档是 `docs/HELD-ITEMS-PROGRESS.md`（手持道具那一版，里面的坑与工具用法仍然有效）。

## 一、用户要什么（原话要点）

1. **第二个主角**：暴飞龙 **阿特拉斯（Atlas）**。点主界面的沙漠蜻蜓头图切换主角；
   **用欧亚西莉亚通关后给提示**（即解锁条件 = 欧亚西莉亚通关）。
2. 阿特拉斯性格：**沉稳、可靠、不拘小节**。
3. 阿特拉斯**有自己的卡组**：可以和欧亚西莉亚重叠，但**不要完全照搬**；
   允许「改名字但效果相同」的卡。
4. 用阿特拉斯时：**一关的路径是原来的两倍长**、**一关有两个 BOSS（保证两只不重样）**、
   **难度曲线更高一些**。
5. 阿特拉斯的结局：**遇见欧亚西莉亚**（本来就是一对情侣）——看见她出门、觉得靠不住的
   阿特拉斯跟了出去，两条龙回到自己的家。
6. 阿特拉斯通关后，可以**用阿特拉斯打普通难度和无尽模式**。
7. 3.0：**卡牌数较少的流派补多，保证所有流派卡牌数一致**；**减少一些非流派的可有可无的卡牌**。
8. **文案让 deepseek v4pro 写**（provider `commandcode`，model `deepseek/deepseek-v4-pro`）。
9. 文案也包括**事件文案**：但**不用全改** —— **只让阿特拉斯这边的事件不一样**（新增阿特拉斯专属事件；
   少数只对欧亚西莉亚成立的旧事件加 `if: {heroNot:'atlas'}` 挡住）。

## 二、设计定案（照这个实现，别再来回改）

### 主角数据 `content/heroes.json`（→ 生成 `src/data/heroes.js`）

- `heroes[]`：`id / name / species / speciesName / dex / types / ability / gender /
  atk / def / maxHp / agi / luck / unlock / endlessUnlock / quote / clearHint /
  ending{title,text} / map{rowsMul, bosses, enemy{hp,atk,perStage}} / titleAnim / titleScale`
- `starters`：**只放新增主角的开局卡组**（阿特拉斯那份）；欧亚西莉亚继续用
  `content/cards.json` 的 `starterDeck`（一处一份，不复制）。
- 欧亚西莉亚的数值与 `src/data/balance.js` 的 `BALANCE.player` **必须一致** → 门禁钉住。

### 阿特拉斯
- 物种 `salamence`（素材：`assets/pokemon/salamence/{Idle,Attack,Hurt,Float}.png` + 16 张表情）。
  `Float.png` 是 3.0 新抓的（他那套动画里没有 FlapAround），抓完要跑 `tools/build-sprite-meta.mjs`。
- 属性 龙/飞行、特性「威吓」、♂。
- 数值：atk 17 / def 14 / maxHp 275 / agi 9 / luck 4（比欧亚西莉亚略偏「厚」）。
- 地图：`rowsMul: 2`（一章的行数 ×2）、`bosses: 2`、`enemy: {hp: 1.08, atk: 1.06, perStage: 0.01}`
  （`perStage` = 每章再抬 1%，这才是「难度**曲线**更高」；实测 600 局通关率 10.7% → 7.0%）。
- 开局卡组（10 张）：暴冲 ×3、噬咬 ×2、鳞甲 ×2、翼连击 ×1、泼沙 ×1、电光一闪 ×1。
  前四张是 `heroOnly: 'atlas'` 的**改名同效**卡（对应 撞击 / 咬住 / 变硬 / 二连踢 —— 那四张锁给了欧亚西莉亚）。

### 卡池规则
- 卡牌新增字段 `heroOnly: "<heroId>"`（只给某个主角用）。
- **每个主角的池子各自算**：`playerPool(hero) = 卡牌.filter(c => !c.enemyOnly && (!c.heroOnly || c.heroOnly === hero))`。
  - 「同费用 + 完全同效果」的重复门禁改成**按主角分别算**（跨主角的改名同效卡是允许的）。
  - 流派数量门禁也**按主角分别算**，并要求六个流派**张数一致**（现在都是 14）。
- 抽卡入口全部加一个 `heroId` 参数（`rollCard / rollCards`，默认取当前局的 `d.hero`）。

### 流派补到一致（目标 **14 张/流派**，玩家池）
- **修正**：`screech`（刺耳声，纯敌方减防）从 `buff` 标签里拿掉 → buff 8。
- **补标签**（本来就是强化牌）：`rock_polish`(c) `quiver_dance`(u) `super_luck`(u)
  `bulk_up`(r) `agility`(r) `dragons_ascension`(e) → buff 14 ✓
- **新增 12 张双标签牌**（藏锋 / 追咬 / 血崩 / 悬岩 / 蓄势爆发 / 蓄甲 / 数拍 / 龙吼 / 沙漏 /
  压势 / 岩钉 / 崩防）：蓄势 9 张（其中 3 张带出血、1 张带削弱、1 张带单次高伤）+ 纯削弱 3 张。
- **减法**：14 张「同费用、纯伤害、被另一张同费用牌完全压住」的无流派水牌转 `enemyOnly`
  （accelrock / water_shuriken / cross_chop / bullet_seed / dragon_breath / freeze_dry /
  body_press / drain_punch / iron_head / venoshock / fissure / doom_desire / night_daze / dynamax_cannon）。
- 全部由 `tools/hero-atlas-cards.mjs`（可复跑）落地；**卡名与卡面文案由 deepseek-v4-pro 写**，
  我负责效果与数值（`{d}` 占位符、层数、费用曲线）。

### 事件
- `content/events/hero.json` 三个**阿特拉斯专属事件**（`hero: 'atlas'`）：
  沙上脚印 / 石上记号 / 沙螺蟒老友；`rival_meet` 加 `heroNot: 'atlas'` 挡住
  （它通篇是「另一只沙漠蜻蜓」「你也是……欧亚西莉亚？」）。
- 过滤在 `Game.startEvent()` 一处做（`e.hero` / `e.heroNot`），`emitEvents` 要把这两个字段带进生成文件。

## 三、门禁与验收

`node tools/author.mjs check` → **23 步全绿**（新增 `tools/test-heroes.mjs`，54 条断言：
解锁 / 开局 / 池子切分 / 两倍长与双首领不重样 / 倍率相乘 / 事件不串场）。
冒烟里也加了「点头图换主角」这一段（锁着时点不动、通关后换得动、换完开局是暴飞龙）。

## 四、版本与交付

版本 **3.0**（`package.json` 与更新日志最新一条一致）；三语 3727/3727（100%）；
截图见 `tools/shots/`：`title-atlas.png`、`title-locked.png`、`map-atlas.png`、`deck-atlas.png`、
`battle-atlas.png`、`victory-atlas.png`、`victory-unlock.png`。
截图用的调试参数：`?hero=atlas`（指定主角）、`?unlock=1` / `?lock=1`（内存里假装已通关 / 还没通关）。

## 五、3.0.1：用户实测报回来的七个问题（都修了）

| # | 用户的话 | 根因 | 修法 |
|---|---|---|---|
| 1 | 「最后一关的精英怪 400dmg/回合把人推死」 | **敌人数值表按「每回合 3 张」推的，但引擎给敌人和玩家一样的 8 点 AP、配 0~1 费牌能连打 5~7 张**（实测第 6 章精英平均 3.95 张、最凶一回合打掉玩家 89% 血） | 新增 `BALANCE.enemyPlaysCap`（野生/较强/精英 3 张、首领 4 张），在 `beginEnemyTurn` 里封顶；实测每回合压力 35%→27%、最凶 417→337、「一回合过半血」的回合 28%→9% |
| 2 | 「那条『敌人最多造成多少伤害』非常不准」 | 预判和 `enemyAct()` **各写一套**，而且没算「先挂强化再输出」；还撞到 `overridesAfter` 把「威力 +70%」当倍率用（→ 预测出 7627 伤害），敌我 AI 也跟着算错 | 抽出 `planThreatDamage()`（和真 AI 同一条路径）；`powBuff` 改成 ÷100；界面改成同时报**预计**（按随机抽牌平均）与**最多** |
| 3 | 「再打两张牌就能触发的卡，现在打一张就可以了」 | `resolveCard` 末尾那次 `fireTimers('plays')` 把**这张牌自己**也数进去了 | 新增 `playSeq` + `triggers[].seq`：创建它的那一次出牌不计数 |
| 4 | 「两回合后发动的也是，包含本回合了」 | 计时格数写的是 N，而玩家读「N 个回合后」= 当前回合之后再完整过去 N 个回合 | 三张牌的数据改成 N+1 格，并在 `check-content` 加门禁钉住「卡面文字 ↔ 格数」 |
| 5 | 「两个选项都会弹出让你丢东西的页面……不能选择不拿」 | 手持栏满时第二个按钮写着「收下」其实什么都没收下，`takeRewardCard` 之后又会再问一遍 | 掉落屏改成两条清楚的路（「丢掉一件，收下它」/「不要，就这样」），拒绝时清 `overflow` 并置 `declined` |
| 6 | 「身上道具满了还能买道具，钱还消失了」 | `buy()` 里「先扣钱 → 标售出 → 再看栏位」（注释写了要先看，代码写在后面） | 把栏位判断挪到扣钱之前；商店按钮满栏位时直接禁用并写明原因 |
| 7 | 「完全没有听到龙之交响乐的 bgm」 | 第 7~10 张地图在 `content/biomes.json` 里写了 `bgm` 借用别的地图的曲子 → 属于它们的 **12 首 DS 曲子一次都放不出来** | 去掉那 4 处借用，10 张地图各自用 `map_/battle_/elite_` 三首 |

修完之后：`node tools/author.mjs check` 仍是 23 步全绿（新增 8 条道具断言、6 条计时/封顶断言、
冒烟里加了掉落屏两个按钮与「满栏容不扣钱」两段）；实测通关率（各 700 局）
**欧亚西莉亚 32.4% · 阿特拉斯 21.9%** —— 3.0 之前那个 ~10% 有很大一部分是第 1 条那个 bug 造成的。
