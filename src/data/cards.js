// 卡牌数据。
//
// 【数据本体不在这里】—— CARDS / CARD_ART / STARTER_DECK / ITEMS 全部由
// content/cards.json 生成（见下面的 GENERATED 区块）。要加卡牌就改那个 JSON，
// 然后跑 `node tools/build-content.mjs`，别手改生成区块。
//
// 每张卡由「效果数组」声明，战斗引擎负责解释执行，好处是 AI 也能用同一套卡。
//
// 效果种类（kind）：
//   damage    {power, hits?, ignoreDefPct?, execThreshold?, execBonus?, recoilPct?, drainPct?,
//              bonusPerStack?{status,per,max}, bonusIfDot?, plusShield?}
//   shield    {amount, scaleWithDef?, keep?}   —— 获得护盾，先于 HP 承受伤害（keep=下回合不清空）
//   heal      {amount, pct?}                   —— 回复 HP（pct 为最大生命百分比 0~1）
//   draw      {n}                              —— 抽 n 张
//   ap        {n}                              —— 立刻回复 n 点 AP
//   apBonus   {n}                              —— **下回合**额外 n 点 AP
//   plays     {n}                              —— 本回合多出 n 次出牌机会
//   strength  {n}                              —— 本场战斗每一次攻击威力 +n%
//   detonate  {perStack}                       —— 引爆对手身上的中毒/剧毒/灼伤层数（立刻结算并清空）
//   buff      {stat:'atk'|'def'|'agi'|'luck', amount | pct, target?}
//   status    {status:'poison'|'toxic'|'burn'|'weak'|'bleed', stacks, chance?, target?}
//   selfDmg   {amount | pct, reason?}          —— 自伤（不能低于 1 点 HP）
//   discard   {n}                              —— 弃掉**自己** n 张手牌（代价类，不是弃对手的）
//   exhaustHand                                —— 弃光自己的手牌
//
// 三个数值约定（踩过坑，加卡务必遵守）：
//   · **power 是「攻击力的百分比」**，不是点数：power 110 = 打出 1.1 倍攻击。
//     费用预算：0 费 25~45% / 1 费 95~140% / 2 费 200~260% / 3 费 310~420% / 4 费 430~560%。
//     多段伤害的 power 是**每段**威力（{power:45, hits:3} = 3 次，每次按 45% 攻击算）。
//     为什么改成乘法：见 battle.js 的 computeHit —— 加法版本下攻击长到 50+ 之后
//     0 费牌和 3 费牌打出来差不多疼（玩家实测「高费卡不如低费连打」）。
//   · buff / status 默认作用在**自己**身上，要打到对手必须写 target: 'enemy'。
//   · pct 类削弱（-0.3 = 削 30% 基础值）后期永远有效，固定值会被「削弱下限」卡住。

import { RARITY } from './balance.js';

// #region GENERATED-CARDS
export const CARDS = [
  {
    "id": "absorb",
    "name": "吸取",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，回复 5 点 HP。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "drainPct": 0.5
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "accelrock",
    "name": "加速岩石",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "岩石"
    ],
    "text": "造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "acid_armor",
    "name": "酸液护甲",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得护盾（随防御成长），并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "acrobatics",
    "name": "杂技",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 {d} 点伤害，并让对手防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 63,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "飞行"
    ]
  },
  {
    "id": "aerial_ace",
    "name": "燕返",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "飞行"
    ],
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "agility",
    "name": "高速移动",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "art": "spark_1",
    "text": "本场战斗敏捷 +5，抽 1 张，回复 1 点 AP。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 5
      },
      {
        "kind": "draw",
        "n": 1
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "air_slash",
    "name": "空气利刃",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，无视对手 70% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "ignoreDefPct": 0.7
      }
    ],
    "types": [
      "飞行"
    ]
  },
  {
    "id": "aqua_jet",
    "name": "水流喷射",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "水"
    ],
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "aqua_ring",
    "name": "水流环",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "magic_2",
    "text": "回复最大生命的 13%，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.13
      },
      {
        "kind": "shield",
        "amount": 6,
        "scaleWithDef": true
      }
    ],
    "types": [
      "水"
    ]
  },
  {
    "id": "aqua_tail",
    "name": "水流尾",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_2",
    "types": [
      "水"
    ],
    "text": "造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "aurora_veil",
    "name": "极光幕",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得 {s} 点护盾，本场战斗防御 +4。",
    "effects": [
      {
        "kind": "shield",
        "amount": 12,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4,
        "target": "self"
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "baby_doll_eyes",
    "name": "撒娇凝视",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "barrier",
    "name": "屏障",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "获得 {s} 点护盾，本场战斗防御 +2。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 2,
        "target": "self"
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "bite",
    "name": "咬住",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      }
    ],
    "types": [
      "恶"
    ]
  },
  {
    "id": "blizzard",
    "name": "暴风雪",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 4 次造成 {d} 点伤害，并让对手攻击 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 71,
        "hits": 4
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "blood_price",
    "name": "血祭",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "自身失去最大生命 10% 的 HP，本场战斗攻击威力 +80%。使用后销毁。",
    "effects": [
      {
        "kind": "selfDmg",
        "pct": 0.1,
        "reason": "血祭"
      },
      {
        "kind": "strength",
        "n": 80
      }
    ],
    "exhaust": true,
    "types": [
      "恶"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "blood_toxins",
    "name": "毒血交融",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "给对手 2 层出血和 2 层剧毒。",
    "effects": [
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "bloodletting",
    "name": "放血",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "types": [
      "恶"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "body_press",
    "name": "重磅冲撞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，威力随你当前的护盾提升 —— 护盾越厚打得越疼。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "plusShield": 1.2
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "body_slam",
    "name": "泰山压顶",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 {d} 点伤害，40% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.4
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "boomburst",
    "name": "爆音波",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 285
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "branch_poke",
    "name": "木枝突刺",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "草"
    ],
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "brick_break",
    "name": "劈瓦",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，并让对手防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "brine",
    "name": "盐水",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害；若对手 HP 低于 40%，改为造成 {d2} 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "execThreshold": 0.4,
        "execBonus": 100
      }
    ],
    "types": [
      "水"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "browbeat",
    "name": "压制",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 1 层虚弱，并让对手攻击 -2。",
    "effects": [
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ]
  },
  {
    "id": "bug_buzz",
    "name": "虫鸣",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "magic_2",
    "text": "抽 2 张。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "bulk_up",
    "name": "健美",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "fist",
    "text": "本场战斗攻击 +4、防御 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "bulldoze",
    "name": "重踏",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "地面"
    ]
  },
  {
    "id": "bullet_punch",
    "name": "子弹拳",
    "ap": 0,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，无视对手 30% 的防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 30,
        "ignoreDefPct": 0.3
      }
    ],
    "types": [
      "钢"
    ],
    "enemyOnly": true
  },
  {
    "id": "bullet_seed",
    "name": "种子机枪",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 4 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 48,
        "hits": 4
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "calm_mind",
    "name": "冥想",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "magic_1",
    "text": "本场战斗攻击 +4、幸运 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "超能"
    ],
    "tags": [
      "buff"
    ]
  },
  {
    "id": "charge_beam",
    "name": "充电光束",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "电"
    ],
    "enemyOnly": true
  },
  {
    "id": "charm",
    "name": "撒娇",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手攻击 -35%。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.35,
        "target": "enemy"
      }
    ],
    "types": [
      "妖精"
    ]
  },
  {
    "id": "close_combat",
    "name": "近身战",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，本场战斗防御 -4。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 342
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "self"
      }
    ],
    "exhaust": true,
    "types": [
      "格斗"
    ]
  },
  {
    "id": "confusion",
    "name": "念力",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "corrode",
    "name": "腐蚀",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 210
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "corrosive_touch",
    "name": "腐蚀之触",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "让对手防御 -3，并给对手 2 层中毒。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "cotton_guard",
    "name": "棉花防守",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "本场战斗防御 +8。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 8
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "crimson_pact",
    "name": "血之契约",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "自身失去最大生命 8% 的 HP，给对手 3 层出血。使用后销毁。",
    "effects": [
      {
        "kind": "selfDmg",
        "pct": 0.08,
        "reason": "血之契约"
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 3
      }
    ],
    "exhaust": true,
    "types": [
      "恶"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "cross_chop",
    "name": "十字劈",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 2
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "crunch",
    "name": "咬碎",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ],
    "enemyOnly": true
  },
  {
    "id": "crush_grip",
    "name": "硬压",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -40%。",
    "effects": [
      {
        "kind": "damage",
        "power": 200
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.4,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "crystal_wall",
    "name": "水晶壁",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "text": "本场战斗防御 +3，获得护盾（随防御成长，约 12 + 防御×1.00）。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 3
      },
      {
        "kind": "shield",
        "amount": 12,
        "scaleWithDef": true
      }
    ],
    "types": [
      "岩石"
    ]
  },
  {
    "id": "curse",
    "name": "诅咒",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 2 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      }
    ],
    "types": [
      "幽灵"
    ],
    "enemyOnly": true
  },
  {
    "id": "dark_pulse",
    "name": "恶之波动",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "恶"
    ]
  },
  {
    "id": "dazzling_gleam",
    "name": "魔法闪耀",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 2
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "defense_curl",
    "name": "变圆",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "获得护盾（随防御成长），本场战斗防御 +2。",
    "effects": [
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 2
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "disarming_voice",
    "name": "魅惑之声",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手攻击 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "discharge",
    "name": "放电",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "types": [
      "电"
    ]
  },
  {
    "id": "doom_desire",
    "name": "破灭之愿",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，无视对手全部防御。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "ignoreDefPct": 1
      }
    ],
    "exhaust": true,
    "types": [
      "钢"
    ]
  },
  {
    "id": "double_edge",
    "name": "舍身冲撞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，自身受到 8 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 228,
        "recoilPct": 0.2
      }
    ],
    "types": [
      "一般"
    ],
    "enemyOnly": true
  },
  {
    "id": "double_kick",
    "name": "二连踢",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 45,
        "hits": 2
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "draco_meteor",
    "name": "龙星群",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "star_1",
    "text": "造成 {d} 点伤害；攻击牌威力 +100%（持续 2 回合）；自身攻击 -30%（本场战斗）。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "grantBuff",
        "buff": "power",
        "n": 100,
        "turns": 2
      },
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.3
      }
    ],
    "types": [
      "龙"
    ],
    "tags": [
      "buff",
      "burst"
    ],
    "enemyOnly": false
  },
  {
    "id": "dragon_ascension",
    "name": "龙之升华",
    "ap": 3,
    "rarity": "epic",
    "targeting": "self",
    "text": "本场战斗攻击 +8、敏捷 +4、幸运 +6，抽 2 张。使用后销毁。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 8
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 6
      },
      {
        "kind": "draw",
        "n": 2
      }
    ],
    "exhaust": true,
    "types": [
      "龙"
    ]
  },
  {
    "id": "dragon_breath",
    "name": "龙息",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      }
    ],
    "types": [
      "龙"
    ]
  },
  {
    "id": "dragon_claw",
    "name": "龙爪",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190
      }
    ],
    "types": [
      "龙"
    ],
    "enemyOnly": true
  },
  {
    "id": "dragon_dance",
    "name": "龙之舞",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "star_1",
    "text": "本场战斗攻击 +3、敏捷 +3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      }
    ],
    "types": [
      "龙"
    ],
    "tags": [
      "buff"
    ]
  },
  {
    "id": "dragon_darts",
    "name": "龙箭",
    "ap": 1,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "连续 4 次造成 {d} 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 23,
        "hits": 4
      }
    ],
    "types": [
      "龙"
    ]
  },
  {
    "id": "dragon_rush",
    "name": "龙之俯冲",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害；若对手 HP 低于 40%，改为造成 {d2} 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "execThreshold": 0.4,
        "execBonus": 115
      }
    ],
    "types": [
      "龙"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "dragon_tail",
    "name": "龙尾",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "龙"
    ]
  },
  {
    "id": "drain_punch",
    "name": "吸取拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 75%。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "drainPct": 0.75
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "draining_kiss",
    "name": "吸取之吻",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并回复造成伤害一半的 HP。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "drainPct": 0.5
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "dynamax_cannon",
    "name": "极巨炮",
    "ap": 4,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，无视对手 70% 防御。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 450,
        "ignoreDefPct": 0.7
      }
    ],
    "exhaust": true,
    "types": [
      "钢"
    ]
  },
  {
    "id": "earth_power",
    "name": "大地之力",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 {d} 点伤害，无视对手 70% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "ignoreDefPct": 0.7
      }
    ],
    "types": [
      "地面"
    ],
    "enemyOnly": true
  },
  {
    "id": "earthquake",
    "name": "地震",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "地面"
    ],
    "enemyOnly": true
  },
  {
    "id": "ember",
    "name": "火花",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "火"
    ],
    "text": "造成 {d} 点伤害，20% 概率给对手 1 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 1,
        "chance": 0.2
      }
    ]
  },
  {
    "id": "endure",
    "name": "挺住",
    "ap": 0,
    "rarity": "epic",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长），回复 3 点 AP。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      },
      {
        "kind": "ap",
        "n": 3
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "energy_ball",
    "name": "能量球",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "草"
    ],
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "exploit_weak",
    "name": "趁虚而入",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层虚弱，这一下额外 +45% 威力（最多 +180%）。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "bonusPerStack": {
          "status": "weak",
          "per": 45,
          "max": 180
        }
      }
    ],
    "types": [
      "恶"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "extrasensory",
    "name": "神通力",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "超能"
    ],
    "enemyOnly": true
  },
  {
    "id": "fairy_wind",
    "name": "妖精之风",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手攻击 -1。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -1,
        "target": "enemy"
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "feather_dance",
    "name": "羽毛舞",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "twirl_1",
    "text": "获得护盾（随防御成长，约 9 + 防御×0.75），并让对手攻击 -3。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "飞行"
    ]
  },
  {
    "id": "feint_attack",
    "name": "出奇一击",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "恶"
    ],
    "text": "造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "fire_blast",
    "name": "大字爆炎",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "types": [
      "火"
    ],
    "text": "造成 {d} 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ]
  },
  {
    "id": "fire_fang",
    "name": "火焰牙",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ],
    "types": [
      "火"
    ]
  },
  {
    "id": "first_aid",
    "name": "急救",
    "ap": 0,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 10%，并抽 1 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.1
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "fissure",
    "name": "地裂",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 {d} 点伤害，无视对手全部防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "ignoreDefPct": 1
      }
    ],
    "types": [
      "地面"
    ]
  },
  {
    "id": "flame_charge",
    "name": "蓄能焰袭",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗敏捷 +2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 2
      }
    ],
    "types": [
      "火"
    ]
  },
  {
    "id": "flamethrower",
    "name": "喷射火焰",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "types": [
      "火"
    ],
    "text": "造成 {d} 点伤害，30% 概率给对手 1 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 1,
        "chance": 0.3
      }
    ]
  },
  {
    "id": "flash_cannon",
    "name": "加农光炮",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "钢"
    ],
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "focus_energy",
    "name": "聚气",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "magic_1",
    "text": "本场战斗攻击 +4。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "buff"
    ]
  },
  {
    "id": "focus_punch",
    "name": "真气拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，本场战斗敏捷 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 228
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "foul_play",
    "name": "欺诈",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "恶"
    ],
    "enemyOnly": true
  },
  {
    "id": "freeze_dry",
    "name": "冷冻干燥",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 63,
        "hits": 3
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "frost_breath",
    "name": "冰冻之风",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "fury_cutter",
    "name": "连切",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30,
        "hits": 3
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "fury_swipes",
    "name": "狂抓",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 1 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 50,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 1
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "future_sight",
    "name": "预知未来",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "star_1",
    "text": "造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "giga_drain",
    "name": "终极吸取",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，回复所造成伤害的一半。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "drainPct": 0.5
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "giga_impact",
    "name": "终极冲击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "exploding",
    "text": "下回合开始时造成 {d} 点伤害（这一回合只做蓄力）。",
    "exhaust": true,
    "effects": [
      {
        "kind": "delay",
        "turns": 1,
        "name": "终极冲击",
        "effects": [
          {
            "kind": "damage",
            "power": 420
          }
        ]
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "timing",
      "burst"
    ],
    "enemyOnly": false
  },
  {
    "id": "glaciate",
    "name": "冰封世界",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层虚弱。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      }
    ],
    "exhaust": true,
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "guardian_oath",
    "name": "守护誓约",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "获得大量护盾（随防御成长），本场防御 +6，并清除自身负面。使用后销毁。",
    "effects": [
      {
        "kind": "shield",
        "amount": 20,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 6
      },
      {
        "kind": "cleanse",
        "statuses": true
      }
    ],
    "exhaust": true,
    "types": [
      "钢"
    ]
  },
  {
    "id": "gunk_shot",
    "name": "垃圾射击",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "毒"
    ],
    "text": "造成 {d} 点伤害，并给对手 2 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ]
  },
  {
    "id": "gyro_ball",
    "name": "陀螺球",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "钢"
    ],
    "text": "造成 {d} 点伤害，并让对手敏捷 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "hail",
    "name": "冰雹",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "获得 {s} 点护盾，抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "harden",
    "name": "变硬",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长，约 9 + 防御×0.75）。",
    "effects": [
      {
        "kind": "shield",
        "amount": 9,
        "scaleWithDef": true
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "head_smash",
    "name": "双刃头锤",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "岩石"
    ],
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "ignoreDefPct": 0.5
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "headbutt",
    "name": "头锤",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "heat_wave",
    "name": "热风",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，并给对手 3 层灼伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 3
      }
    ],
    "types": [
      "火"
    ]
  },
  {
    "id": "hex",
    "name": "祸不单行",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层中毒 / 灼伤 / 出血，威力 +25%（最多 +100%）。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "bonusPerStack": {
          "status": [
            "poison",
            "toxic",
            "burn",
            "bleed"
          ],
          "per": 25,
          "max": 100
        }
      }
    ],
    "types": [
      "幽灵"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "howl",
    "name": "长嚎",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "本场战斗攻击威力 +40%。抽 1 张。",
    "effects": [
      {
        "kind": "strength",
        "n": 40
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "hurricane",
    "name": "暴风",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "飞行"
    ],
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "hydro_pump",
    "name": "水炮",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "types": [
      "水"
    ],
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "hyper_beam",
    "name": "破坏死光",
    "ap": 4,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 520
      }
    ],
    "exhaust": true,
    "types": [
      "一般"
    ]
  },
  {
    "id": "hypnosis",
    "name": "催眠术",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "超能"
    ],
    "enemyOnly": true
  },
  {
    "id": "ice_fang",
    "name": "冰冻牙",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "ice_shard",
    "name": "冰砾",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "ice_wall",
    "name": "冰墙",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得 {s} 点护盾，防御 +2。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 2,
        "target": "self"
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "inferno_overdrive",
    "name": "烈火超载",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "types": [
      "火"
    ],
    "text": "造成 {d} 点伤害，本场战斗攻击 -4。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 342
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "self"
      }
    ],
    "exhaust": true
  },
  {
    "id": "intimidate",
    "name": "威吓",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "给对手 2 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "iron_barbs",
    "name": "铁刺",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得护盾（随防御成长），并给对手 2 层出血。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "types": [
      "钢"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "iron_defense",
    "name": "铁壁",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长），本场战斗防御 +3。",
    "effects": [
      {
        "kind": "shield",
        "amount": 13,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 3
      }
    ],
    "types": [
      "钢"
    ]
  },
  {
    "id": "iron_head",
    "name": "铁头",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "shield",
    "text": "造成 {d} 点伤害，无视对手 70% 防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "ignoreDefPct": 0.7
      }
    ],
    "types": [
      "钢"
    ]
  },
  {
    "id": "iron_tail",
    "name": "铁尾",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "钢"
    ],
    "text": "造成 {d} 点伤害，本场战斗防御 +2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 2,
        "target": "self"
      }
    ]
  },
  {
    "id": "knock_off",
    "name": "拍落",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -4、防御 -3。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "enemy"
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "exhaust": true,
    "types": [
      "恶"
    ]
  },
  {
    "id": "languor",
    "name": "迟缓",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "让对手敏捷 -3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "毒"
    ]
  },
  {
    "id": "last_stand",
    "name": "背水一战",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "本场战斗攻击威力 +150%，防御 -8。使用后销毁。",
    "effects": [
      {
        "kind": "strength",
        "n": 150
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -8
      }
    ],
    "exhaust": true,
    "types": [
      "格斗"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "leaf_storm",
    "name": "飞叶风暴",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 4 次造成 {d} 点伤害，本场战斗攻击 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 86,
        "hits": 4
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -5
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "leech_life",
    "name": "吸血",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 60%，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "drainPct": 0.6
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "leech_seed",
    "name": "寄生种子",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "给对手 1 层中毒，并回复 8 点 HP。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      },
      {
        "kind": "heal",
        "amount": 8
      }
    ],
    "types": [
      "草"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "life_dew",
    "name": "生命水滴",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复 15 点 HP，并回复 1 点 AP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 15
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "types": [
      "水"
    ]
  },
  {
    "id": "life_spring",
    "name": "生命之泉",
    "ap": 2,
    "rarity": "epic",
    "targeting": "self",
    "text": "回复最大生命的 30%，并回复 1 点 AP。使用后销毁。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.3
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "exhaust": true,
    "types": [
      "水"
    ]
  },
  {
    "id": "light_of_ruin",
    "name": "破灭之光",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层虚弱。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      }
    ],
    "exhaust": true,
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "lunge",
    "name": "猛扑",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "虫"
    ],
    "text": "造成 {d} 点伤害，并让对手攻击 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "mach_punch",
    "name": "音速拳",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，并让对手攻击 -1。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -1,
        "target": "enemy"
      }
    ],
    "types": [
      "格斗"
    ],
    "enemyOnly": true
  },
  {
    "id": "megahorn",
    "name": "超级角击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "exhaust": true,
    "types": [
      "虫"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "metal_claw",
    "name": "金属爪",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "钢"
    ],
    "text": "造成 {d} 点伤害，并让对手防御 -1。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -1,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "metal_sound",
    "name": "金属音",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手防御 -35%。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.35,
        "target": "enemy"
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "钢"
    ]
  },
  {
    "id": "mind_reader",
    "name": "读心",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "抽 3 张，本回合多出 2 次出牌机会。",
    "effects": [
      {
        "kind": "draw",
        "n": 3
      },
      {
        "kind": "plays",
        "n": 2
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "mist",
    "name": "白雾",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "smoke_1",
    "text": "清除自己身上所有的属性下降与负面状态，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "cleanse",
        "statuses": true
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "misty_terrain",
    "name": "薄雾场地",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "获得 {s} 点护盾，抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "妖精"
    ]
  },
  {
    "id": "mob_growl",
    "name": "低吼",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "smoke_1",
    "enemyOnly": true,
    "text": "本场战斗攻击 +2。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "mob_guard",
    "name": "缩壳",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "art": "trace_1",
    "enemyOnly": true,
    "text": "获得 5 点护盾。",
    "effects": [
      {
        "kind": "shield",
        "amount": 5
      }
    ],
    "types": [
      "水"
    ]
  },
  {
    "id": "mob_sand",
    "name": "扬沙",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_2",
    "enemyOnly": true,
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "地面"
    ]
  },
  {
    "id": "mob_scratch",
    "name": "抓挠",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_1",
    "enemyOnly": true,
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 25
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "mob_stare",
    "name": "瞪眼",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_1",
    "enemyOnly": true,
    "text": "让对手防御 -1。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -1,
        "target": "enemy"
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "moonblast",
    "name": "月亮之力",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "star_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "妖精"
    ],
    "enemyOnly": true
  },
  {
    "id": "moonlight",
    "name": "月光",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "text": "回复最大生命的 28%，并清除自身所有负面。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.28
      },
      {
        "kind": "cleanse",
        "statuses": true
      }
    ],
    "types": [
      "妖精"
    ]
  },
  {
    "id": "night_daze",
    "name": "暗黑爆破",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "恶"
    ],
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "night_slash",
    "name": "暗影爪",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层出血，这一下额外 +20% 威力（最多 +240%）。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "bonusPerStack": {
          "status": "bleed",
          "per": 20,
          "max": 240
        }
      }
    ],
    "types": [
      "幽灵"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "nuzzle",
    "name": "蹭蹭脸颊",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 100
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "电"
    ]
  },
  {
    "id": "outrage",
    "name": "逆鳞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 {d} 点伤害，自身受到 6 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 228,
        "recoilPct": 0.2
      }
    ],
    "types": [
      "龙"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "overclock",
    "name": "超频",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "回复 3 点 AP，本回合多出 1 次出牌机会。使用后销毁。",
    "effects": [
      {
        "kind": "ap",
        "n": 3
      },
      {
        "kind": "plays",
        "n": 1
      }
    ],
    "exhaust": true,
    "types": [
      "电"
    ]
  },
  {
    "id": "overheat",
    "name": "过热",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，本场战斗攻击威力 +120%。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "strength",
        "n": 120
      }
    ],
    "exhaust": true,
    "types": [
      "火"
    ],
    "tags": [
      "burst"
    ]
  },
  {
    "id": "peck",
    "name": "啄",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "飞行"
    ],
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "phantom_force",
    "name": "潜灵奇袭",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "ignoreDefPct": 0.5
      }
    ],
    "exhaust": true,
    "types": [
      "幽灵"
    ],
    "enemyOnly": true
  },
  {
    "id": "pin_missile",
    "name": "飞弹针",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "虫"
    ],
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 63,
        "hits": 3
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "plague",
    "name": "疫病",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "给对手 3 层中毒和 3 层剧毒。使用后销毁。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 3
      }
    ],
    "exhaust": true,
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "play_rough",
    "name": "嬉闹",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "造成 {d} 点伤害，本场战斗攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 228
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "self"
      }
    ],
    "types": [
      "妖精"
    ]
  },
  {
    "id": "poison_fang",
    "name": "毒牙",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "poison_sting",
    "name": "毒针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ],
    "types": [
      "毒"
    ],
    "enemyOnly": true
  },
  {
    "id": "potion_berry",
    "name": "文柚果",
    "ap": 0,
    "rarity": "common",
    "targeting": "self",
    "art": "flask_half",
    "text": "回复 14 点 HP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 14
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "power_gem",
    "name": "力量宝石",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "岩石"
    ],
    "text": "造成 {d} 点伤害，并让对手敏捷 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "precipice_blades",
    "name": "断崖之剑",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "types": [
      "地面"
    ],
    "text": "造成 {d} 点伤害，并让对手防御 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "protect",
    "name": "守住",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "shield",
    "text": "获得大量护盾（随防御成长）。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "shield",
        "amount": 18,
        "scaleWithDef": true
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "psybeam",
    "name": "幻象光线",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "超能"
    ],
    "enemyOnly": true
  },
  {
    "id": "psychic",
    "name": "精神强念",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -5。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -5,
        "target": "enemy"
      }
    ],
    "types": [
      "超能"
    ],
    "enemyOnly": true
  },
  {
    "id": "psyshock",
    "name": "精神冲击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "ignoreDefPct": 0.5
      }
    ],
    "types": [
      "超能"
    ],
    "enemyOnly": true
  },
  {
    "id": "quick_attack",
    "name": "电光一闪",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "quick_draw",
    "name": "快速抽牌",
    "ap": 0,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "抽 2 张，本回合多出 1 次出牌机会。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "plays",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "quiver_dance",
    "name": "蝶舞",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "twirl_1",
    "text": "本场战斗攻击 +3、敏捷 +3、幸运 +3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "razor_leaf",
    "name": "飞叶快刀",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 {d} 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "recycle",
    "name": "回收",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "抽 2 张，回复 1 点 AP。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "refresh",
    "name": "焕然一新",
    "ap": 0,
    "rarity": "rare",
    "targeting": "self",
    "art": "spark_1",
    "text": "清除自己所有的属性下降与负面状态，抽 1 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "cleanse",
        "statuses": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "rend",
    "name": "撕裂",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 3 层出血。",
    "effects": [
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 3
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "rest",
    "name": "睡觉",
    "ap": 3,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 45%，并抽 2 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.45
      },
      {
        "kind": "draw",
        "n": 2
      }
    ],
    "types": [
      "超能"
    ]
  },
  {
    "id": "rock_blast",
    "name": "岩石爆击",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "2 个回合后，造成 3 次 {d} 点伤害。",
    "effects": [
      {
        "kind": "trigger",
        "on": "turn",
        "count": 2,
        "name": "岩石爆击",
        "effects": [
          {
            "kind": "damage",
            "power": 95,
            "hits": 3
          }
        ]
      }
    ],
    "types": [
      "岩石"
    ],
    "enemyOnly": false,
    "tags": [
      "timing"
    ]
  },
  {
    "id": "rock_polish",
    "name": "岩石打磨",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "本场战斗攻击 +2、敏捷 +2。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "岩石"
    ]
  },
  {
    "id": "rock_slide",
    "name": "岩崩",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，40% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.4
      }
    ],
    "types": [
      "岩石"
    ],
    "enemyOnly": true
  },
  {
    "id": "rock_throw",
    "name": "落石",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "岩石"
    ]
  },
  {
    "id": "rolling_kick",
    "name": "滚动",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "连续 2 次造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 45,
        "hits": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "roost",
    "name": "羽栖",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 15%。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.15
      }
    ],
    "types": [
      "飞行"
    ]
  },
  {
    "id": "safeguard",
    "name": "神秘守护",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "本场战斗防御 +4，获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "salt_cure",
    "name": "盐腌",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "给对手 2 层中毒和 2 层虚弱，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "岩石"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "sand_attack",
    "name": "泼沙",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "地面"
    ],
    "tags": [
      "weaken"
    ]
  },
  {
    "id": "sand_tomb",
    "name": "流沙地狱",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "地面"
    ]
  },
  {
    "id": "sand_veil",
    "name": "沙隐",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "本场战斗幸运 +5，获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 5
      },
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      }
    ],
    "types": [
      "地面"
    ]
  },
  {
    "id": "sandstorm",
    "name": "沙暴",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "smoke_1",
    "text": "本场战斗防御 +4、幸运 +3。抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4
      },
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "岩石"
    ]
  },
  {
    "id": "scale_shot",
    "name": "鳞射",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。本场战斗防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 36,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3
      }
    ],
    "types": [
      "龙"
    ]
  },
  {
    "id": "scary_face",
    "name": "鬼脸",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手敏捷 -35%。",
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "pct": -0.35,
        "target": "enemy"
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "screech",
    "name": "刺耳声",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "ui_glitch",
    "text": "对手防御 -5，本场战斗有效。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "weaken",
      "buff"
    ]
  },
  {
    "id": "seed_bomb",
    "name": "种子炸弹",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "types": [
      "草"
    ],
    "text": "造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "shadow_ball",
    "name": "暗影球",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "幽灵"
    ],
    "enemyOnly": true
  },
  {
    "id": "shadow_bone",
    "name": "暗影骨",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "types": [
      "幽灵"
    ],
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "shadow_punch",
    "name": "暗影拳",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "幽灵"
    ],
    "enemyOnly": true
  },
  {
    "id": "shadow_sneak",
    "name": "影子偷袭",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "types": [
      "幽灵"
    ],
    "enemyOnly": true
  },
  {
    "id": "sig_ancient_beam",
    "name": "古代射线",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "types": [
      "岩石"
    ]
  },
  {
    "id": "sig_brave_bird",
    "name": "勇鸟猛攻",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，自身也受到一部分反冲。",
    "effects": [
      {
        "kind": "damage",
        "power": 330,
        "recoilPct": 0.2
      }
    ],
    "enemyOnly": true,
    "types": [
      "飞行"
    ]
  },
  {
    "id": "sig_bullet_slash",
    "name": "子弹斩",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。本场战斗攻击 +3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      }
    ],
    "enemyOnly": true,
    "types": [
      "钢"
    ]
  },
  {
    "id": "sig_crystal_fang",
    "name": "晶牙撕咬",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 3 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 200
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 3
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "druddigon_alpha",
    "types": [
      "冰"
    ]
  },
  {
    "id": "sig_crystal_jaw",
    "name": "晶颚碎击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -7。",
    "effects": [
      {
        "kind": "damage",
        "power": 300
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -7,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "tyrantrum_crystal",
    "types": [
      "岩石"
    ]
  },
  {
    "id": "sig_curse_mummy",
    "name": "诅咒棺",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 3 层中毒，并让对手攻击 -35%。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.35,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "types": [
      "幽灵"
    ]
  },
  {
    "id": "sig_double_claw",
    "name": "双钳斩",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 130,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "scizor_warden",
    "types": [
      "钢"
    ]
  },
  {
    "id": "sig_dragon_water",
    "name": "龙水炮",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 300
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "types": [
      "龙"
    ]
  },
  {
    "id": "sig_dual_chomp",
    "name": "烈咬突袭",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 1 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 135,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 1
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "garchomp",
    "types": [
      "龙"
    ]
  },
  {
    "id": "sig_heavy_slam",
    "name": "重锤坠落",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -30%。",
    "effects": [
      {
        "kind": "damage",
        "power": 280
      },
      {
        "kind": "buff",
        "stat": "def",
        "pct": -0.3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "aggron",
    "types": [
      "钢"
    ]
  },
  {
    "id": "sig_horn_drill",
    "name": "岩钉钻",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 225
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "rhydon_warden",
    "types": [
      "地面"
    ]
  },
  {
    "id": "sig_iron_tail_wall",
    "name": "铁尾壁垒",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "damage",
        "power": 210
      },
      {
        "kind": "shield",
        "amount": 10,
        "scaleWithDef": true
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "steelix",
    "types": [
      "钢"
    ]
  },
  {
    "id": "sig_land_wrath",
    "name": "大地神力",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 320
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "zygarde",
    "types": [
      "地面"
    ]
  },
  {
    "id": "sig_leaf_blade",
    "name": "叶刃",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 250
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "sceptile",
    "types": [
      "草"
    ]
  },
  {
    "id": "sig_lighthouse",
    "name": "灯塔之光",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，给对手 2 层虚弱，本场战斗防御 +4。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 4
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "ampharos_storm",
    "types": [
      "超能"
    ]
  },
  {
    "id": "sig_magma_erupt",
    "name": "熔岩喷发",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 140,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "types": [
      "火"
    ]
  },
  {
    "id": "sig_megahorn_charge",
    "name": "巨角突击",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层中毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "enemyOnly": true,
    "types": [
      "虫"
    ]
  },
  {
    "id": "sig_meteor_mash",
    "name": "彗星拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗攻击 +4。",
    "effects": [
      {
        "kind": "damage",
        "power": 160
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 4
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "metagross",
    "types": [
      "钢"
    ]
  },
  {
    "id": "sig_origin_pulse",
    "name": "根源波动",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "kyogre",
    "types": [
      "水"
    ]
  },
  {
    "id": "sig_pharaoh_curse",
    "name": "遗迹的诅咒",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "给对手 3 层虚弱，并让对手攻击 -4。",
    "effects": [
      {
        "kind": "status",
        "status": "weak",
        "stacks": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "tyranitar_ruins",
    "types": [
      "幽灵"
    ]
  },
  {
    "id": "sig_rage_wave",
    "name": "暴怒巨浪",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗攻击 +3。",
    "effects": [
      {
        "kind": "damage",
        "power": 220
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 3
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "gyarados",
    "types": [
      "水"
    ]
  },
  {
    "id": "sig_rock_slide_wing",
    "name": "岩翼俯冲",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "types": [
      "岩石"
    ]
  },
  {
    "id": "sig_root_bind",
    "name": "根须缠绕",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，让对手敏捷 -3，并给对手 2 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 200
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "trevenant_fungal",
    "types": [
      "草"
    ]
  },
  {
    "id": "sig_sand_fang",
    "name": "流沙獠牙",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害。本场战斗防御 +5。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": 5
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "tyranitar",
    "types": [
      "地面"
    ]
  },
  {
    "id": "sig_sand_pit",
    "name": "流沙陷坑",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 230
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "types": [
      "地面"
    ]
  },
  {
    "id": "sig_sky_dive",
    "name": "天空俯冲",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；无视对手一半防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 230,
        "ignoreDefPct": 0.5
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "aerodactyl_alpha",
    "types": [
      "飞行"
    ]
  },
  {
    "id": "sig_soul_flame",
    "name": "魂之火",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层灼伤和 1 层剧毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 1
      }
    ],
    "enemyOnly": true,
    "types": [
      "幽灵"
    ]
  },
  {
    "id": "sig_soul_lantern",
    "name": "魂灯",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 3 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 205
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 3
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "chandelure_warden",
    "types": [
      "幽灵"
    ]
  },
  {
    "id": "sig_spark_ball",
    "name": "电刺爆球",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -5。",
    "effects": [
      {
        "kind": "damage",
        "power": 235
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -5,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "togedemaru_alpha",
    "types": [
      "电"
    ]
  },
  {
    "id": "sig_spore_fist",
    "name": "孢子拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并给对手 2 层中毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 115,
        "hits": 2
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "breloom_alpha",
    "types": [
      "草"
    ]
  },
  {
    "id": "sig_tidal_rage",
    "name": "怒潮",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 240
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "gyarados_warden",
    "types": [
      "水"
    ]
  },
  {
    "id": "sig_tide_ride",
    "name": "乘浪滑翔",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "获得护盾（随防御成长），抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 14,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "enemyOnly": true,
    "types": [
      "水"
    ]
  },
  {
    "id": "sig_tomb_curse",
    "name": "法老的诅咒",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "给对手 2 层虚弱，并让对手攻击 -5、防御 -3。",
    "effects": [
      {
        "kind": "status",
        "status": "weak",
        "stacks": 2
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -5,
        "target": "enemy"
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "cofagrigus_pharaoh",
    "types": [
      "幽灵"
    ]
  },
  {
    "id": "sig_war_banner",
    "name": "战旗突击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，本场战斗攻击 +6。",
    "effects": [
      {
        "kind": "damage",
        "power": 215
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 6
      }
    ],
    "enemyOnly": true,
    "enemySpecies": "braviary_warden",
    "types": [
      "格斗"
    ]
  },
  {
    "id": "sig_white_smoke",
    "name": "白烟",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "获得护盾（随防御成长），并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "shield",
        "amount": 12,
        "scaleWithDef": true
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ],
    "enemyOnly": true,
    "types": [
      "火"
    ]
  },
  {
    "id": "silver_wind",
    "name": "银色旋风",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 {d} 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "slam",
    "name": "摔打",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "一般"
    ],
    "enemyOnly": true
  },
  {
    "id": "slash",
    "name": "劈开",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 95
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 2
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "bleed"
    ]
  },
  {
    "id": "sludge_bomb",
    "name": "污泥炸弹",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 {d} 点伤害，并给对手 3 层中毒，无视对手 70% 防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "ignoreDefPct": 0.7
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "snarl",
    "name": "大声咆哮",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手攻击 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -2,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ]
  },
  {
    "id": "snow_cloak",
    "name": "雪隐",
    "ap": 1,
    "rarity": "common",
    "targeting": "self",
    "text": "获得 {s} 点护盾，敏捷 +2。",
    "effects": [
      {
        "kind": "shield",
        "amount": 8,
        "scaleWithDef": true
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 2,
        "target": "self"
      }
    ],
    "types": [
      "冰"
    ]
  },
  {
    "id": "snow_grave",
    "name": "雪葬",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，30% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.3
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "solar_beam",
    "name": "日光束",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 143,
        "hits": 2
      }
    ],
    "exhaust": true,
    "types": [
      "草"
    ]
  },
  {
    "id": "spark",
    "name": "电光",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，20% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.2
      }
    ],
    "types": [
      "电"
    ]
  },
  {
    "id": "spider_web",
    "name": "蛛网",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "trace_1",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "spore",
    "name": "蘑菇孢子",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "smoke_1",
    "text": "给对手 1 层中毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "草"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "stone_edge",
    "name": "尖石攻击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 {d} 点伤害，并让对手防御 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ],
    "types": [
      "岩石"
    ]
  },
  {
    "id": "storm_throw",
    "name": "狂风投掷",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 2 次造成 {d} 点伤害，并让对手敏捷 -4。",
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 2
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -4,
        "target": "enemy"
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "sunder",
    "name": "碎甲",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "让对手防御 -5。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ],
    "enemyOnly": true
  },
  {
    "id": "super_luck",
    "name": "幸运咒语",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "star_1",
    "text": "本场战斗幸运 +4，抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "luck",
        "amount": 4
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "superpower",
    "name": "蛮力",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害，本场战斗攻击 -3、防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 228
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3
      }
    ],
    "types": [
      "格斗"
    ]
  },
  {
    "id": "surf",
    "name": "冲浪",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "水"
    ],
    "enemyOnly": true
  },
  {
    "id": "swift",
    "name": "高速星星",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30,
        "hits": 3
      }
    ],
    "types": [
      "一般"
    ],
    "enemyOnly": true
  },
  {
    "id": "swords_dance",
    "name": "剑舞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "art": "sword",
    "text": "攻击牌威力 +70%（持续 2 回合），本场战斗威力 +40%。",
    "exhaust": true,
    "effects": [
      {
        "kind": "strength",
        "n": 40
      },
      {
        "kind": "grantBuff",
        "buff": "power",
        "n": 70,
        "turns": 2
      }
    ],
    "types": [
      "一般"
    ],
    "tags": [
      "buff",
      "burst"
    ],
    "enemyOnly": false
  },
  {
    "id": "synthesis",
    "name": "光合作用",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "text": "回复最大生命的 15%，本场战斗攻击 +2。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.15
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 2
      }
    ],
    "types": [
      "草"
    ]
  },
  {
    "id": "tackle",
    "name": "撞击",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "tail_whip",
    "name": "摇尾巴",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "text": "让对手防御 -3，抽 1 张。",
    "effects": [
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "tailwind",
    "name": "顺风",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "twirl_1",
    "text": "本场战斗敏捷 +3，回复 1 点 AP。",
    "effects": [
      {
        "kind": "buff",
        "stat": "agi",
        "amount": 3
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "types": [
      "飞行"
    ]
  },
  {
    "id": "thunder",
    "name": "打雷",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "spark_1",
    "types": [
      "电"
    ],
    "text": "造成 {d} 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "thunder_shock",
    "name": "电击",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -1。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -1,
        "target": "enemy"
      }
    ],
    "types": [
      "电"
    ]
  },
  {
    "id": "thunder_wave",
    "name": "电磁波",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "电"
    ],
    "enemyOnly": true
  },
  {
    "id": "thunderbolt",
    "name": "十万伏特",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 {d} 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 285
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "电"
    ],
    "enemyOnly": true
  },
  {
    "id": "total_suppression",
    "name": "全面压制",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "让对手攻击 -3、防御 -3、敏捷 -3。",
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "恶"
    ]
  },
  {
    "id": "toxic",
    "name": "剧毒",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "给对手 3 层剧毒：每回合流失最大生命的 0.6%×层数，不衰减、每回合 +1。",
    "effects": [
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 3
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "toxic_cloud",
    "name": "毒雾",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "给对手 2 层剧毒和 2 层中毒。",
    "effects": [
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 2
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "toxic_overflow",
    "name": "剧毒泛滥",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手每有 1 层中毒或剧毒，额外 +25% 威力（上限 +250%）。销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "bonusPerStack": {
          "status": [
            "poison",
            "toxic"
          ],
          "per": 25,
          "max": 250
        }
      }
    ],
    "exhaust": true,
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "toxic_spikes",
    "name": "毒菱",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 2 层中毒（每回合流失「最大生命的 0.8% × 层数」，之后层数 -1）。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "toxic_thread",
    "name": "毒丝",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "给对手 1 层剧毒和 1 层虚弱。",
    "effects": [
      {
        "kind": "status",
        "status": "toxic",
        "stacks": 1
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "毒"
    ]
  },
  {
    "id": "transference",
    "name": "转嫁",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "text": "把自己身上的中毒 / 剧毒 / 灼伤 / 出血层数**全部转移给对手**（自己清零）。使用后销毁。",
    "effects": [
      {
        "kind": "statusSteal"
      }
    ],
    "exhaust": true,
    "types": [
      "超能"
    ]
  },
  {
    "id": "triple_axel",
    "name": "三旋击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 63,
        "hits": 3
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "冰"
    ],
    "enemyOnly": true
  },
  {
    "id": "twineedle",
    "name": "双针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 45,
        "hits": 2
      }
    ],
    "types": [
      "虫"
    ],
    "enemyOnly": true
  },
  {
    "id": "u_turn",
    "name": "急速折返",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "cards_return",
    "text": "抽 2 张，回复 1 点 AP。",
    "effects": [
      {
        "kind": "draw",
        "n": 2
      },
      {
        "kind": "ap",
        "n": 1
      }
    ],
    "types": [
      "虫"
    ],
    "enemyOnly": true
  },
  {
    "id": "u_turn_dance",
    "name": "虫之抵抗",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 {d} 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 105
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "虫"
    ]
  },
  {
    "id": "venom_burst",
    "name": "毒爆",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "引爆对手身上所有中毒 / 剧毒 / 灼伤层数，立刻结算并清空。使用后销毁。",
    "effects": [
      {
        "kind": "detonate",
        "perStack": 3
      }
    ],
    "exhaust": true,
    "types": [
      "毒"
    ]
  },
  {
    "id": "venom_dart",
    "name": "毒针连刺",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，并给对手 2 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 2
      }
    ],
    "types": [
      "毒"
    ],
    "tags": [
      "poison"
    ]
  },
  {
    "id": "venom_drain",
    "name": "毒液吸取",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害，回复所造成伤害的 50%。",
    "effects": [
      {
        "kind": "damage",
        "power": 200,
        "drainPct": 0.5
      }
    ],
    "types": [
      "毒"
    ]
  },
  {
    "id": "venoshock",
    "name": "毒液冲击",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "造成 {d} 点伤害；对手身上有中毒或剧毒时，这一下额外 +90% 威力。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "bonusIfDot": 90
      }
    ],
    "types": [
      "毒"
    ]
  },
  {
    "id": "volt_tackle",
    "name": "闪电强袭",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "types": [
      "电"
    ],
    "text": "造成 {d} 点伤害，并对自己造成 6 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 228
      },
      {
        "kind": "selfDmg",
        "amount": 6
      }
    ]
  },
  {
    "id": "water_pulse",
    "name": "水之波动",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ],
    "types": [
      "水"
    ],
    "enemyOnly": true
  },
  {
    "id": "water_shuriken",
    "name": "水手里剑",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "text": "连续 3 次造成 {d} 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 30,
        "hits": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "水"
    ]
  },
  {
    "id": "whirlpool",
    "name": "潮旋",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 {d} 点伤害，并让对手攻击 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 95,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "types": [
      "水"
    ],
    "enemyOnly": true
  },
  {
    "id": "wicked_blow",
    "name": "暗冥强击",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 {d} 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 285,
        "ignoreDefPct": 0.5
      }
    ],
    "types": [
      "恶"
    ],
    "enemyOnly": true
  },
  {
    "id": "wide_guard",
    "name": "广域防守",
    "ap": 2,
    "rarity": "rare",
    "targeting": "self",
    "text": "获得护盾（随防御成长），这一份护盾下回合不会消失。",
    "effects": [
      {
        "kind": "shield",
        "amount": 14,
        "scaleWithDef": true,
        "keep": true
      }
    ],
    "types": [
      "一般"
    ]
  },
  {
    "id": "wing_attack",
    "name": "翅膀攻击",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "types": [
      "飞行"
    ],
    "text": "造成 {d} 点伤害，并让对手敏捷 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "withdraw",
    "name": "缩入壳中",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "shield",
    "text": "获得护盾（随防御成长，约 13 + 防御×1.08），并抽 1 张。",
    "effects": [
      {
        "kind": "shield",
        "amount": 13,
        "scaleWithDef": true
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "types": [
      "水"
    ]
  },
  {
    "id": "worsen",
    "name": "恶化",
    "ap": 1,
    "rarity": "epic",
    "targeting": "enemy",
    "text": "把对手身上已有的中毒 / 剧毒 / 灼伤 / 出血层数全部翻倍。层数得先铺起来，空着翻不出东西。使用后销毁。",
    "effects": [
      {
        "kind": "statusDouble"
      }
    ],
    "exhaust": true,
    "types": [
      "毒"
    ]
  },
  {
    "id": "x_scissor",
    "name": "十字剪",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "types": [
      "虫"
    ],
    "text": "连续 2 次造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 143,
        "hits": 2
      }
    ],
    "enemyOnly": true
  },
  {
    "id": "echoed_voice",
    "name": "回声",
    "ap": 1,
    "rarity": "common",
    "types": [
      "一般"
    ],
    "tags": [
      "buff"
    ],
    "text": "抽 1 张。本场战斗里，再次打出**同一张牌**时，它的伤害与附加状态层数 ×2（持续 3 回合）。",
    "effects": [
      {
        "kind": "draw",
        "n": 1
      },
      {
        "kind": "grantBuff",
        "buff": "echo",
        "n": 1,
        "turns": 3
      }
    ],
    "enemyOnly": false,
    "targeting": "self"
  },
  {
    "id": "sand_beat",
    "name": "沙之节拍",
    "ap": 1,
    "rarity": "uncommon",
    "types": [
      "地面"
    ],
    "tags": [
      "buff"
    ],
    "text": "行动点上限 +1（持续 3 回合），抽 1 张。",
    "effects": [
      {
        "kind": "grantBuff",
        "buff": "apMax",
        "n": 1,
        "turns": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ],
    "enemyOnly": false,
    "targeting": "self"
  },
  {
    "id": "hone_claws",
    "name": "磨爪",
    "ap": 1,
    "rarity": "common",
    "types": [
      "地面"
    ],
    "tags": [
      "buff",
      "poison",
      "bleed"
    ],
    "text": "给对手附加状态时，层数 +1（持续 3 回合）。",
    "effects": [
      {
        "kind": "grantBuff",
        "buff": "stacks",
        "n": 1,
        "turns": 3
      }
    ],
    "enemyOnly": false,
    "targeting": "self"
  },
  {
    "id": "dual_chop",
    "name": "二连劈",
    "ap": 1,
    "rarity": "common",
    "types": [
      "龙"
    ],
    "tags": [
      "timing",
      "burst"
    ],
    "text": "打出这张牌之后，再打出 2 张牌时造成 {d} 点伤害。",
    "effects": [
      {
        "kind": "trigger",
        "on": "plays",
        "count": 2,
        "name": "二连劈",
        "effects": [
          {
            "kind": "damage",
            "power": 150
          }
        ]
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "dig",
    "name": "挖洞",
    "ap": 2,
    "rarity": "rare",
    "types": [
      "地面"
    ],
    "tags": [
      "timing",
      "weaken"
    ],
    "text": "下回合开始时造成 {d} 点伤害，并给对手 2 层虚弱。",
    "effects": [
      {
        "kind": "delay",
        "turns": 1,
        "name": "挖洞",
        "effects": [
          {
            "kind": "damage",
            "power": 250
          },
          {
            "kind": "status",
            "status": "weak",
            "stacks": 2
          }
        ]
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "rock_tomb",
    "name": "岩石封锁",
    "ap": 1,
    "rarity": "uncommon",
    "types": [
      "岩石"
    ],
    "tags": [
      "weaken"
    ],
    "text": "造成 {d} 点伤害，对手防御 -3；对手每损失 1 点防御，这张牌威力 +6%。",
    "effects": [
      {
        "kind": "damage",
        "power": 90,
        "powerPerDefLost": 6
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "breaking_swipe",
    "name": "广域破坏",
    "ap": 2,
    "rarity": "rare",
    "types": [
      "龙"
    ],
    "tags": [
      "weaken"
    ],
    "text": "造成 {d} 点伤害，对手攻击 -25%（按基础值）。",
    "effects": [
      {
        "kind": "damage",
        "power": 190
      },
      {
        "kind": "buff",
        "stat": "atk",
        "pct": -0.25,
        "target": "enemy"
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "cut",
    "name": "居合斩",
    "ap": 1,
    "rarity": "common",
    "types": [
      "一般"
    ],
    "tags": [
      "bleed"
    ],
    "text": "造成 {d} 点伤害，并给对手 1 层出血。",
    "effects": [
      {
        "kind": "damage",
        "power": 90
      },
      {
        "kind": "status",
        "status": "bleed",
        "stacks": 1
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "take_down",
    "name": "猛撞",
    "ap": 2,
    "rarity": "common",
    "types": [
      "一般"
    ],
    "tags": [
      "burst"
    ],
    "text": "造成 {d} 点伤害，自身受到伤害的 25% 反伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 190,
        "recoilPct": 0.25
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "sand_toxin",
    "name": "沙中毒",
    "ap": 0,
    "rarity": "common",
    "types": [
      "地面"
    ],
    "tags": [
      "poison"
    ],
    "text": "造成 {d} 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 30
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  },
  {
    "id": "sand_burst",
    "name": "沙尘卷",
    "ap": 1,
    "rarity": "uncommon",
    "types": [
      "地面"
    ],
    "tags": [
      "timing"
    ],
    "text": "打出这张牌之后，再打出 3 张牌时造成 {d} 点伤害并给对手 2 层出血。",
    "effects": [
      {
        "kind": "trigger",
        "on": "plays",
        "count": 3,
        "name": "沙尘卷",
        "effects": [
          {
            "kind": "damage",
            "power": 190
          },
          {
            "kind": "status",
            "status": "bleed",
            "stacks": 2
          }
        ]
      }
    ],
    "enemyOnly": false,
    "targeting": "enemy"
  }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** 卡面美术：图标 mask 类名 + 背景特效图（写在 content/cards.json 的 ico / fx 字段里） */
export const CARD_ART = {
  "absorb": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "accelrock": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "acid_armor": {
    "ico": "ico-shield_02",
    "fx": "magic_1"
  },
  "acrobatics": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "aerial_ace": {
    "ico": "ico-wind",
    "fx": "slash_1"
  },
  "agility": {
    "ico": "ico-shoe",
    "fx": "spark_1"
  },
  "air_slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "aqua_jet": {
    "ico": "ico-water",
    "fx": "magic_2"
  },
  "aqua_ring": {
    "ico": "ico-water",
    "fx": "magic_2"
  },
  "aqua_tail": {
    "ico": "ico-water",
    "fx": "magic_2"
  },
  "aurora_veil": {
    "ico": "ico-shield_03",
    "fx": "magic_1"
  },
  "baby_doll_eyes": {
    "ico": "ico-target",
    "fx": "magic_1"
  },
  "barrier": {
    "ico": "ico-shield_02",
    "fx": "magic_2"
  },
  "bite": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "blizzard": {
    "ico": "ico-temperature_down",
    "fx": "twirl_02"
  },
  "blood_price": {
    "ico": "ico-heart_break_02",
    "fx": "slash_1"
  },
  "blood_toxins": {
    "ico": "ico-flask",
    "fx": "magic_2"
  },
  "bloodletting": {
    "ico": "ico-heart_break_02",
    "fx": "slash_1"
  },
  "body_press": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "body_slam": {
    "ico": "ico-cards",
    "fx": "dirt_2"
  },
  "boomburst": {
    "ico": "ico-audio_waves",
    "fx": "flare_1"
  },
  "branch_poke": {
    "ico": "ico-leaves",
    "fx": "dirt_2"
  },
  "brick_break": {
    "ico": "ico-mace",
    "fx": "dirt_2"
  },
  "brine": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "browbeat": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "bug_buzz": {
    "ico": "ico-bug",
    "fx": "magic_2"
  },
  "bulk_up": {
    "ico": "ico-arrow_up_red",
    "fx": "twirl_1"
  },
  "bulldoze": {
    "ico": "ico-arrow_down_blue",
    "fx": "dirt_1"
  },
  "bullet_punch": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "bullet_seed": {
    "ico": "ico-leaves",
    "fx": "trace_01"
  },
  "calm_mind": {
    "ico": "ico-clover",
    "fx": "magic_1"
  },
  "charge_beam": {
    "ico": "ico-battery_negative",
    "fx": "spark_03"
  },
  "charm": {
    "ico": "ico-heart",
    "fx": "twirl_03"
  },
  "close_combat": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "confusion": {
    "ico": "ico-star",
    "fx": "magic_1"
  },
  "corrode": {
    "ico": "ico-poison",
    "fx": "magic_2"
  },
  "corrosive_touch": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "cotton_guard": {
    "ico": "ico-heart",
    "fx": "smoke_1"
  },
  "crimson_pact": {
    "ico": "ico-heart_break_02",
    "fx": "magic_2"
  },
  "cross_chop": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "crunch": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "crush_grip": {
    "ico": "ico-mace",
    "fx": "dirt_2"
  },
  "crystal_wall": {
    "ico": "ico-diamond",
    "fx": "star_02"
  },
  "curse": {
    "ico": "ico-gravestone",
    "fx": "trace_01"
  },
  "dark_pulse": {
    "ico": "ico-demon",
    "fx": "magic_2"
  },
  "dazzling_gleam": {
    "ico": "ico-star",
    "fx": "star_01"
  },
  "defense_curl": {
    "ico": "ico-shield",
    "fx": "smoke_1"
  },
  "disarming_voice": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "discharge": {
    "ico": "ico-lightning",
    "fx": "spark_04"
  },
  "doom_desire": {
    "ico": "ico-meteor",
    "fx": "star_06"
  },
  "double_edge": {
    "ico": "ico-counter",
    "fx": "flare_1"
  },
  "double_kick": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "draco_meteor": {
    "ico": "ico-meteor",
    "fx": "star_01"
  },
  "dragon_ascension": {
    "ico": "ico-star",
    "fx": "star_05"
  },
  "dragon_breath": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "dragon_claw": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "dragon_dance": {
    "ico": "ico-arrow_up_red",
    "fx": "twirl_1"
  },
  "dragon_darts": {
    "ico": "ico-triple",
    "fx": "spark_1"
  },
  "dragon_rush": {
    "ico": "ico-meteor",
    "fx": "spark_1"
  },
  "dragon_tail": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "drain_punch": {
    "ico": "ico-fist",
    "fx": "spark_02"
  },
  "draining_kiss": {
    "ico": "ico-heart",
    "fx": "magic_1"
  },
  "dynamax_cannon": {
    "ico": "ico-mace",
    "fx": "flare_1"
  },
  "earth_power": {
    "ico": "ico-earthquake",
    "fx": "magic_1"
  },
  "earthquake": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "ember": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "endure": {
    "ico": "ico-action_points",
    "fx": "trace_1"
  },
  "energy_ball": {
    "ico": "ico-leaves",
    "fx": "magic_2"
  },
  "exploit_weak": {
    "ico": "ico-target",
    "fx": "slash_1"
  },
  "extrasensory": {
    "ico": "ico-diamond",
    "fx": "magic_1"
  },
  "fairy_wind": {
    "ico": "ico-wind",
    "fx": "twirl_01"
  },
  "feather_dance": {
    "ico": "ico-battery_negative",
    "fx": "twirl_1"
  },
  "feint_attack": {
    "ico": "ico-demon",
    "fx": "magic_2"
  },
  "fire_blast": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "fire_fang": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "first_aid": {
    "ico": "ico-heal",
    "fx": "spark_1"
  },
  "fissure": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "flame_charge": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "flamethrower": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "flash_cannon": {
    "ico": "ico-gear",
    "fx": "light_1"
  },
  "focus_energy": {
    "ico": "ico-arrow_up_red",
    "fx": "magic_1"
  },
  "focus_punch": {
    "ico": "ico-mace",
    "fx": "smoke_1"
  },
  "foul_play": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "freeze_dry": {
    "ico": "ico-temperature_down",
    "fx": "trace_01"
  },
  "frost_breath": {
    "ico": "ico-water",
    "fx": "light_1"
  },
  "fury_cutter": {
    "ico": "ico-triple",
    "fx": "slash_1"
  },
  "fury_swipes": {
    "ico": "ico-fist",
    "fx": "slash_1"
  },
  "future_sight": {
    "ico": "ico-star",
    "fx": "star_1"
  },
  "giga_drain": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "giga_impact": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "glaciate": {
    "ico": "ico-temperature_down",
    "fx": "twirl_03"
  },
  "guardian_oath": {
    "ico": "ico-shield",
    "fx": "light_1"
  },
  "gunk_shot": {
    "ico": "ico-flask",
    "fx": "magic_1"
  },
  "gyro_ball": {
    "ico": "ico-gear",
    "fx": "twirl_02"
  },
  "hail": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "harden": {
    "ico": "ico-shield",
    "fx": "trace_1"
  },
  "head_smash": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "headbutt": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "heat_wave": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "hex": {
    "ico": "ico-skull",
    "fx": "magic_1"
  },
  "howl": {
    "ico": "ico-wolf",
    "fx": "twirl_02"
  },
  "hurricane": {
    "ico": "ico-wind",
    "fx": "twirl_01"
  },
  "hydro_pump": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "hyper_beam": {
    "ico": "ico-lightning",
    "fx": "spark_05"
  },
  "hypnosis": {
    "ico": "ico-night",
    "fx": "magic_1"
  },
  "ice_fang": {
    "ico": "ico-temperature_down",
    "fx": "light_1"
  },
  "ice_shard": {
    "ico": "ico-triple",
    "fx": "spark_03"
  },
  "ice_wall": {
    "ico": "ico-shield_02",
    "fx": "magic_2"
  },
  "inferno_overdrive": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "intimidate": {
    "ico": "ico-arrow_down_blue",
    "fx": "trace_1"
  },
  "iron_barbs": {
    "ico": "ico-shield_03",
    "fx": "spark_06"
  },
  "iron_defense": {
    "ico": "ico-shield_02",
    "fx": "trace_1"
  },
  "iron_head": {
    "ico": "ico-gear",
    "fx": "spark_1"
  },
  "iron_tail": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "knock_off": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "languor": {
    "ico": "ico-shoe",
    "fx": "trace_1"
  },
  "last_stand": {
    "ico": "ico-demon",
    "fx": "slash_1"
  },
  "leaf_storm": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "leech_life": {
    "ico": "ico-bug",
    "fx": "magic_1"
  },
  "leech_seed": {
    "ico": "ico-leaves",
    "fx": "magic_2"
  },
  "life_dew": {
    "ico": "ico-water",
    "fx": "spark_1"
  },
  "life_spring": {
    "ico": "ico-heal",
    "fx": "star_04"
  },
  "light_of_ruin": {
    "ico": "ico-star",
    "fx": "star_04"
  },
  "lunge": {
    "ico": "ico-bug",
    "fx": "dirt_1"
  },
  "mach_punch": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "megahorn": {
    "ico": "ico-bug",
    "fx": "spark_06"
  },
  "metal_claw": {
    "ico": "ico-mace",
    "fx": "slash_1"
  },
  "metal_sound": {
    "ico": "ico-battery_negative",
    "fx": "spark_05"
  },
  "mind_reader": {
    "ico": "ico-target",
    "fx": "trace_03"
  },
  "mist": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "misty_terrain": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "mob_growl": {
    "ico": "ico-audio_waves",
    "fx": "smoke_1"
  },
  "mob_guard": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "mob_sand": {
    "ico": "ico-fog",
    "fx": "dirt_2"
  },
  "mob_scratch": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "mob_stare": {
    "ico": "ico-arrow_down_blue",
    "fx": "magic_1"
  },
  "moonblast": {
    "ico": "ico-meteor",
    "fx": "star_03"
  },
  "moonlight": {
    "ico": "ico-night",
    "fx": "star_02"
  },
  "night_daze": {
    "ico": "ico-demon_02",
    "fx": "magic_1"
  },
  "night_slash": {
    "ico": "ico-demon_02",
    "fx": "slash_1"
  },
  "nuzzle": {
    "ico": "ico-lightning",
    "fx": "spark_03"
  },
  "outrage": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "overclock": {
    "ico": "ico-lightning",
    "fx": "spark_01"
  },
  "overheat": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "peck": {
    "ico": "ico-wind",
    "fx": "slash_1"
  },
  "phantom_force": {
    "ico": "ico-night",
    "fx": "magic_2"
  },
  "pin_missile": {
    "ico": "ico-triple",
    "fx": "dirt_2"
  },
  "plague": {
    "ico": "ico-skull",
    "fx": "magic_2"
  },
  "play_rough": {
    "ico": "ico-star",
    "fx": "twirl_01"
  },
  "poison_fang": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "poison_sting": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "potion_berry": {
    "ico": "ico-pill",
    "fx": "spark_1"
  },
  "power_gem": {
    "ico": "ico-diamond",
    "fx": "light_1"
  },
  "precipice_blades": {
    "ico": "ico-earthquake",
    "fx": "dirt_1"
  },
  "protect": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "psybeam": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "psychic": {
    "ico": "ico-diamond",
    "fx": "magic_2"
  },
  "psyshock": {
    "ico": "ico-double",
    "fx": "magic_1"
  },
  "quick_attack": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "quick_draw": {
    "ico": "ico-cards",
    "fx": "light_1"
  },
  "quiver_dance": {
    "ico": "ico-clover",
    "fx": "twirl_1"
  },
  "razor_leaf": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "recycle": {
    "ico": "ico-refresh",
    "fx": "magic_2"
  },
  "refresh": {
    "ico": "ico-refresh",
    "fx": "spark_1"
  },
  "rend": {
    "ico": "ico-heart_break_02",
    "fx": "slash_1"
  },
  "rest": {
    "ico": "ico-bed",
    "fx": "light_1"
  },
  "rock_blast": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "rock_polish": {
    "ico": "ico-stone",
    "fx": "spark_02"
  },
  "rock_slide": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "rock_throw": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "rolling_kick": {
    "ico": "ico-double",
    "fx": "dirt_2"
  },
  "roost": {
    "ico": "ico-heart",
    "fx": "spark_1"
  },
  "safeguard": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "salt_cure": {
    "ico": "ico-poison",
    "fx": "dirt_1"
  },
  "sand_attack": {
    "ico": "ico-target",
    "fx": "dirt_2"
  },
  "sand_tomb": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "sand_veil": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "sandstorm": {
    "ico": "ico-wind",
    "fx": "smoke_1"
  },
  "scale_shot": {
    "ico": "ico-dagger",
    "fx": "spark_04"
  },
  "scary_face": {
    "ico": "ico-demon",
    "fx": "smoke_1"
  },
  "screech": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "seed_bomb": {
    "ico": "ico-leaves",
    "fx": "dirt_1"
  },
  "shadow_ball": {
    "ico": "ico-skull",
    "fx": "magic_1"
  },
  "shadow_bone": {
    "ico": "ico-gravestone",
    "fx": "magic_1"
  },
  "shadow_punch": {
    "ico": "ico-night",
    "fx": "magic_2"
  },
  "shadow_sneak": {
    "ico": "ico-night",
    "fx": "magic_2"
  },
  "sig_ancient_beam": {
    "ico": "ico-demon_02",
    "fx": "magic_2"
  },
  "sig_brave_bird": {
    "ico": "ico-bow",
    "fx": "slash_1"
  },
  "sig_bullet_slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "sig_crystal_fang": {
    "ico": "ico-diamond",
    "fx": "slash_1"
  },
  "sig_crystal_jaw": {
    "ico": "ico-demon_02",
    "fx": "spark_02"
  },
  "sig_curse_mummy": {
    "ico": "ico-gravestone",
    "fx": "magic_1"
  },
  "sig_double_claw": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "sig_dragon_water": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "sig_dual_chomp": {
    "ico": "ico-demon_02",
    "fx": "slash_1"
  },
  "sig_heavy_slam": {
    "ico": "ico-mace",
    "fx": "dirt_2"
  },
  "sig_horn_drill": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "sig_iron_tail_wall": {
    "ico": "ico-shield_03",
    "fx": "spark_02"
  },
  "sig_land_wrath": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "sig_leaf_blade": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "sig_lighthouse": {
    "ico": "ico-lightning",
    "fx": "light_1"
  },
  "sig_magma_erupt": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "sig_megahorn_charge": {
    "ico": "ico-spear",
    "fx": "spark_06"
  },
  "sig_meteor_mash": {
    "ico": "ico-meteor",
    "fx": "spark_05"
  },
  "sig_origin_pulse": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "sig_pharaoh_curse": {
    "ico": "ico-gravestone",
    "fx": "magic_1"
  },
  "sig_rage_wave": {
    "ico": "ico-water",
    "fx": "twirl_1"
  },
  "sig_rock_slide_wing": {
    "ico": "ico-stone",
    "fx": "spark_02"
  },
  "sig_root_bind": {
    "ico": "ico-leaves",
    "fx": "dirt_2"
  },
  "sig_sand_fang": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "sig_sand_pit": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "sig_sky_dive": {
    "ico": "ico-wind",
    "fx": "dirt_1"
  },
  "sig_soul_flame": {
    "ico": "ico-flame",
    "fx": "magic_2"
  },
  "sig_soul_lantern": {
    "ico": "ico-lantern",
    "fx": "flare_1"
  },
  "sig_spark_ball": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "sig_spore_fist": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "sig_tidal_rage": {
    "ico": "ico-water",
    "fx": "twirl_1"
  },
  "sig_tide_ride": {
    "ico": "ico-wind",
    "fx": "twirl_02"
  },
  "sig_tomb_curse": {
    "ico": "ico-skull",
    "fx": "magic_1"
  },
  "sig_war_banner": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "sig_white_smoke": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "silver_wind": {
    "ico": "ico-wind",
    "fx": "twirl_1"
  },
  "slam": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "sludge_bomb": {
    "ico": "ico-skull",
    "fx": "smoke_1"
  },
  "snarl": {
    "ico": "ico-demon_02",
    "fx": "magic_1"
  },
  "snow_cloak": {
    "ico": "ico-shield",
    "fx": "magic_1"
  },
  "snow_grave": {
    "ico": "ico-gravestone",
    "fx": "dirt_1"
  },
  "solar_beam": {
    "ico": "ico-leaves",
    "fx": "star_03"
  },
  "spark": {
    "ico": "ico-lightning",
    "fx": "spark_02"
  },
  "spider_web": {
    "ico": "ico-fog",
    "fx": "trace_1"
  },
  "spore": {
    "ico": "ico-poison",
    "fx": "smoke_1"
  },
  "stone_edge": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "storm_throw": {
    "ico": "ico-wind",
    "fx": "twirl_02"
  },
  "sunder": {
    "ico": "ico-shield_03",
    "fx": "dirt_2"
  },
  "super_luck": {
    "ico": "ico-clover",
    "fx": "star_1"
  },
  "superpower": {
    "ico": "ico-mace",
    "fx": "spark_1"
  },
  "surf": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "swift": {
    "ico": "ico-triple",
    "fx": "star_01"
  },
  "swords_dance": {
    "ico": "ico-sword",
    "fx": "flare_1"
  },
  "synthesis": {
    "ico": "ico-leaves",
    "fx": "star_01"
  },
  "tackle": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "tail_whip": {
    "ico": "ico-target",
    "fx": "twirl_1"
  },
  "tailwind": {
    "ico": "ico-shoe",
    "fx": "twirl_1"
  },
  "thunder": {
    "ico": "ico-lightning",
    "fx": "spark_05"
  },
  "thunder_shock": {
    "ico": "ico-lightning",
    "fx": "spark_01"
  },
  "thunder_wave": {
    "ico": "ico-audio_waves",
    "fx": "spark_06"
  },
  "thunderbolt": {
    "ico": "ico-lightning",
    "fx": "spark_05"
  },
  "total_suppression": {
    "ico": "ico-battery_negative",
    "fx": "magic_2"
  },
  "toxic": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "toxic_cloud": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "toxic_overflow": {
    "ico": "ico-flask",
    "fx": "magic_2"
  },
  "toxic_spikes": {
    "ico": "ico-poison",
    "fx": "magic_2"
  },
  "toxic_thread": {
    "ico": "ico-bug",
    "fx": "trace_02"
  },
  "transference": {
    "ico": "ico-refresh",
    "fx": "magic_1"
  },
  "triple_axel": {
    "ico": "ico-wind",
    "fx": "twirl_1"
  },
  "twineedle": {
    "ico": "ico-spear",
    "fx": "slash_1"
  },
  "u_turn": {
    "ico": "ico-change",
    "fx": "trace_1"
  },
  "u_turn_dance": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "venom_burst": {
    "ico": "ico-poison",
    "fx": "flare_1"
  },
  "venom_dart": {
    "ico": "ico-poison",
    "fx": "spark_03"
  },
  "venom_drain": {
    "ico": "ico-flask",
    "fx": "magic_1"
  },
  "venoshock": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "volt_tackle": {
    "ico": "ico-lightning",
    "fx": "spark_02"
  },
  "water_pulse": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "water_shuriken": {
    "ico": "ico-water",
    "fx": "spark_07"
  },
  "whirlpool": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "wicked_blow": {
    "ico": "ico-skull",
    "fx": "magic_2"
  },
  "wide_guard": {
    "ico": "ico-protect",
    "fx": "light_1"
  },
  "wing_attack": {
    "ico": "ico-wind",
    "fx": "slash_1"
  },
  "withdraw": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "worsen": {
    "ico": "ico-skull",
    "fx": "magic_2"
  },
  "x_scissor": {
    "ico": "ico-bug",
    "fx": "slash_1"
  },
  "echoed_voice": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "sand_beat": {
    "ico": "ico-earthquake",
    "fx": "dirt_1"
  },
  "hone_claws": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "dual_chop": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "dig": {
    "ico": "ico-earthquake",
    "fx": "dirt_1"
  },
  "rock_tomb": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "breaking_swipe": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "cut": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "take_down": {
    "ico": "ico-mace",
    "fx": "dirt_1"
  },
  "sand_toxin": {
    "ico": "ico-poison",
    "fx": "smoke_1"
  },
  "sand_burst": {
    "ico": "ico-wind",
    "fx": "smoke_1"
  }
};

export const STARTER_DECK = [
  "tackle",
  "tackle",
  "tackle",
  "tackle",
  "sand_attack",
  "bite",
  "bite",
  "bite",
  "harden",
  "double_kick"
];
// #endregion GENERATED-CARDS

function weightedPick(pool) {
  const total = pool.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of pool) {
    r -= w;
    if (r <= 0) return v;
  }
  return pool[pool.length - 1][1];
}

/**
 * 按稀有度权重抽一张卡（排除 exclude 里的 id）；敌人专用牌不会进玩家的奖励池。
 *
 * @param {number} rarityBoost 稀有度加成系数（事件 / 商店用）
 * @param {string[]} exclude    不要抽到的卡 id
 * @param {object|null} weights 显式稀有度权重（战斗奖励按敌人档位给的那张表）；
 *                              给了它就完全按它抽，不再叠 rarityBoost
 */
export function rollCard(rarityBoost = 0, exclude = [], weights = null) {
  const pool = [];
  for (const card of CARDS) {
    if (exclude.includes(card.id)) continue;
    // 敌人专用弱招（content/cards.json 里 enemyOnly: true）只给敌人用，别发给玩家
    if (card.enemyOnly) continue;
    const base = weights ? (weights[card.rarity] ?? 0) : RARITY[card.rarity].weight;
    if (!base) continue;
    /**
     * rarityBoost 提高稀有卡出现概率 —— **越稀有，加成越大**。
     *
     * 这里以前是反着写的（史诗 ×0.5、稀有 ×0.7、精良 ×1、普通 ×1），
     * 等于「越稀有越不涨」，加成几乎全被精良吃掉了。实测后果：打完首领给的史诗占比
     * 3.5%，和路边杂兵**一模一样**（玩家直接看出来了：「boss 和精英给的卡并没有更好」）。
     * 现在史诗 ×2、稀有 ×1.5、精良 ×0.8、普通 ×0，系数才真的有档位感。
     */
    const mult = weights ? 1
      : 1 + rarityBoost * (card.rarity === 'epic' ? 2 : card.rarity === 'rare' ? 1.5 : card.rarity === 'uncommon' ? 0.8 : 0);
    pool.push([base * mult, card]);
  }
  return weightedPick(pool);
}

/** 随机抽 n 张不重复的卡 */
export function rollCards(n, rarityBoost = 0, exclude = [], weights = null) {
  const out = [];
  const used = [...exclude];
  for (let i = 0; i < n; i++) {
    const c = rollCard(rarityBoost, used, weights);
    out.push(c);
    used.push(c.id);
  }
  return out;
}

/** 把效果里的数字套用到描述文本（供 UI 显示动态数值） */
export function cardDamagePreview(card, atk, enemyDef, strengthBonus = 0) {
  const dmg = card.effects.filter((e) => e.kind === 'damage');
  if (!dmg.length) return null;
  let total = 0;
  for (const e of dmg) {
    const mult = e.hits ?? 1;
    const raw = Math.max(1, atk + strengthBonus + e.power);
    const def = Math.max(0, Math.round(enemyDef * (1 - (e.ignoreDefPct ?? 0))));
    total += mult * Math.max(1, Math.round((raw * 100) / (100 + def)));
  }
  return total;
}
