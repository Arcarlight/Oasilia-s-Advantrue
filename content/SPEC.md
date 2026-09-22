# 《Oasis》内容扩展：数据规范（写内容前必读）

工作目录 `D:\ToolsSoftware\DSH_GameTsukuru`。这是一个**内容驱动**的宝可梦卡牌 roguelike：
所有卡牌 / 敌人 / 事件 / 商人都在 `content/*.json` 里，`node tools/build-content.mjs` 校验并生成 `src/data/*.js`。
**改完内容必须跑通这三条**（它们就是验收标准）：

```powershell
node tools/build-content.mjs      # 校验 + 生成；错一条就整批不改源码
node tools/check-content.mjs      # 结构 / 平衡 / 写法体检
node tools/check-copy.mjs         # 文案与数值对不对得上（卡面写的数字 vs effects）
```

## 世界观硬规矩

1. **只有宝可梦，没有现实动物**（鸟 / 鱼 / 螃蟹 / 蜥蜴 / 秃鹫 / 蜂 / 老鼠…一律不许写；贝壳这类景物可以）。
2. 招式名用**官方中文译名**（撞击 / 咬住 / 泼沙 / 二连踢…），自造招式要像真招式。
3. 语气：轻松、有画面感、偶尔俏皮（女主是沙漠蜻蜓**欧亚西莉亚**，自称「我」，爱开玩笑）。
4. 中文文案里**用「」包角色台词**，数值行写「HP +{heal}，幸运 +2。」这种格式。

## 卡牌 `content/cards.json`

```jsonc
{
  "id": "rend",                 // 唯一，小写蛇形
  "name": "撕裂",               // 卡名（2~5 字最好；日文会翻成假名）
  "ap": 1,                      // 0~5 的整数
  "rarity": "uncommon",         // common / uncommon / rare / epic
  "targeting": "enemy",         // enemy / self
  "text": "给对手 3 层出血。",   // 卡面文案：**数字必须和 effects 对得上**（check-copy 会核）
  "effects": [ { "kind": "status", "status": "bleed", "stacks": 3 } ],
  "ico": "ico-slash",           // 图标名，必须是 content/icons.json 里已有的
  "fx": "slash_1",              // 粒子特效资源名
  "range": "接触",              // 必填：接触（演「撞上去」）/ 远隔（演「放招」）
  "exhaust": true               // 可选：使用后销毁
}
```

**`range` 怎么判**（门禁在 `tools/check-content.mjs`，判错玩家一眼能看出来，因为战斗界面按它挑动作）：
起点是属性 —— 火水电冰超草妖幽恶龙飞默认**远隔**，一般 / 格斗 / 地面 / 岩石 / 钢 / 毒 / 虫默认**接触**；
但**名字和属性矛盾的以名字为准**：咬住 / 龙爪 / 铁头 / 勇鸟猛攻 是接触，落石 / 高速星星 / 污泥炸弹 是远隔；
只作用在自己身上的（护盾 / 强化 / 抽牌 / 治疗 / 原地蓄力）一律**接触**。

### 引擎支持的效果（`kind` 只能从这里面挑）

| kind | 字段 | 说明 |
|---|---|---|
| `damage` | `power`（威力＝攻击力的百分比）、`hits`、`ignoreDefPct`、`drainPct`、`recoilPct`、`execThreshold`+`execBonus`、`bonusPerStack:{status,per,max}`、`bonusIfDot`、`plusShield`、`chance` | 伤害类。`bonusPerStack` 就是「对手每有 1 层 X，威力 +per%」 |
| `status` | `status`（`poison`/`toxic`/`burn`/`weak`/`bleed`）、`stacks`、`target`（默认对手，`self` 是自己）、`chance` | 挂状态层数 |
| `statusDouble` | `target`（默认对手） | **本次新增的机制：把目标身上已有的持续伤害层数 ×2**（中毒/剧毒/灼伤/出血） |
| `detonate` | `perStack`（默认 3） | 引爆对手身上的持续伤害层数 |
| `buff` | `stat`（`atk`/`def`/`agi`/`luck`）、`amount` 或 `pct`、`target` | 属性增减（负数是削弱） |
| `shield` | `amount`、`scaleWithDef` | 护盾；`scaleWithDef:true` 时量随防御成长 |
| `heal` | `amount` 或 `hpPct` | 回血 |
| `cleanse` | — | 清掉自身负面 |
| `strength` | `n` | 本场战斗所有攻击 +n% 威力 |
| `draw` / `ap` / `apBonus` / `plays` | `n` | 抽牌 / 回 AP / 下回合 AP / 本回合多出牌次数 |
| `discard` / `exhaustHand` | `n` | 弃牌 / 销毁手牌 |
| `selfDmg` | `amount` 或 `pct`、`reason` | 自伤（代价） |
| `luckPoint` | `n` | 幸运点 |

**费用－威力曲线**（`check-balance` 会看）：1 费 ≈ 95~140%、2 费 ≈ 200~260%、3 费 ≈ 310~420%、4 费 ≈ 430~560%；0 费只有 25~45%（它卖的是附加效果）。

**首领专属卡**：`"enemyOnly": true` + `"enemySpecies": "<敌人 id>"`，只给那只首领用，不进玩家奖励池。

## 敌人 `content/enemies.json`

```jsonc
{
  "enemies": [
    { "id": "carbink", "slug": "carbink", "tier": "mob", "biome": "crystal",
      "deck": "kit_fairy", "lines": ["一枚会眨眼的石头从水晶后面滚出来。"] },
    { "id": "tyrantrum", "slug": "tyrantrum", "tier": "boss", "biome": "crystal",
      "deck": "kit_dragon_hi", "bossTitle": "结晶的暴君", "signature": ["sig_crystal_jaw"],
      "lines": ["整片水晶一起亮了。有个东西正从最亮的那块后面站起来。"] }
  ],
  "movePools": { "kit_fairy": ["...卡牌 id..."] }
}
```

- `tier`：`mob` / `normal` / `elite` / `boss`。**每张地图每个档位至少 1 个**（mob/normal/elite 建议 ≥3 个，不然重复度高）。
- `biome`：必须是 `content/biomes.json` 里已有的地图 key。
- `slug`：物种必须在 `content/species.json` 里**且素材齐全**（`assets/pokemon/<slug>/{Idle,Attack,Hurt}.png`）。
- `deck`：必须指向 `movePools` 里已定义的池子。
- `lines`：1~2 句出场台词（纯中文，不带「」也行，但台词要像台词）。
- `boss` 必须有 `bossTitle`（霓虹灯上的称号，4~7 字）与 `signature`（专属卡 id 数组）。
- 同一只物种可以出现在**多张地图**（用不同的 `id`，例如 `sandshrew` 与 `sandshrew_ruins`），但出场台词要跟着地图换。

## 事件 `content/events/<biome>.json`

```jsonc
[
  { "id": "crystal_hum", "biome": "crystal", "name": "会应声的水晶",
    "text": "你走近的时候，整片水晶嗡了一下。\n「诶……它在应我？」",
    "options": [
      { "label": "跟着哼（幸运 +2）", "tone": "good", "hint": "哼回去。",
        "effects": [ { "stat": { "luck": 2 } } ],
        "text": "你哼回去。水晶震了一下，声音比刚才长。\n「好听。再来一次。」\n幸运 +2。" }
    ] }
]
```

- `biome` 省略 = 通用事件（所有地图都会出）；写了 = 只在那个地图出。
- `effects` 支持：`hp`、`hpPct`、`fullHeal`、`stat`、`gold`、`goldRange`、`item`、`card`、`cardRandom`、`cardRarity`、`removeCard`、`branch`（随机权重分支）、`if`（条件）、`special`。
- **选项的 `text` 里出现的数字必须和 effects 对得上**（`check-content` 有专门的门禁）。
- 结果的随机分支写成：`{ "kind": ... }` 不行 —— 用 `{ "branch": [ { "weight": 50, "tone": "good", "text": "...", "effects": [...] }, { "weight": 50, "tone": "bad", "text": "...", "effects": [...] } ] }`。

## 写完之后

1. 跑 `node tools/build-content.mjs`（有错它会一条条列出来，改到没有为止）。
2. 跑 `node tools/check-content.mjs` 与 `node tools/check-copy.mjs`。
3. 报告里贴命令的原样输出尾部。
4. **不要**动 `content/i18n/**`（译文由另一批人写）、**不要** commit。
