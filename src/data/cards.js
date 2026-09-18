// 卡牌数据。
//
// 【数据本体不在这里】—— CARDS / CARD_ART / STARTER_DECK / ITEMS 全部由
// content/cards.json 生成（见下面的 GENERATED 区块）。要加卡牌就改那个 JSON，
// 然后跑 `node tools/build-content.mjs`，别手改生成区块。
//
// 每张卡由「效果数组」声明，战斗引擎负责解释执行，好处是 AI 也能用同一套卡。
//
// 效果种类（kind）：
//   damage    {power, hits?, ignoreDefPct?, execThreshold?, execBonus?, recoilPct?, drainPct?}
//   shield    {amount, scaleWithDef?}          —— 获得护盾，先于 HP 承受伤害
//   heal      {amount, pct?}                   —— 回复 HP（pct 为最大生命百分比 0~1）
//   draw      {n}                              —— 抽 n 张
//   ap        {n}                              —— 立刻回复 n 点 AP
//   buff      {stat:'atk'|'def'|'agi'|'luck', amount, target?}
//   status    {status:'poison'|'weak'|'burn'|'bleed', stacks, chance?, target?}
//   selfDmg   {amount}                         —— 自伤（不能低于 1 点 HP）
//   discard   {n}                              —— 弃掉**自己** n 张手牌（代价类，不是弃对手的）
//   exhaustHand                                —— 弃光自己的手牌
//
// 两个数值约定（踩过坑，加卡务必遵守）：
//   · 多段伤害的 power 是**每段**威力：{power:2, hits:3} = 「3 次，每次按 (攻击+2) 算」，
//     不是「总威力 6」。写新卡请拿 double_kick(2×2) / rock_blast(3×3) 当锚点换算。
//   · buff / status 默认作用在**自己**身上，要打到对手必须写 target: 'enemy'。

import { RARITY } from './balance.js';

// #region GENERATED-CARDS
export const CARDS = [
  {
    "id": "tackle",
    "name": "撞击",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 6 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 2
      }
    ]
  },
  {
    "id": "sand_attack",
    "name": "泼沙",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 4 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 2
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "bite",
    "name": "咬住",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 12 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 4
      }
    ]
  },
  {
    "id": "quick_attack",
    "name": "电光一闪",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 3 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "rock_throw",
    "name": "落石",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 9 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ]
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
    ]
  },
  {
    "id": "double_kick",
    "name": "二连踢",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "fist",
    "text": "连续 2 次造成 7 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 2,
        "hits": 2
      }
    ]
  },
  {
    "id": "potion_berry",
    "name": "文柚果",
    "ap": 0,
    "rarity": "common",
    "targeting": "self",
    "art": "flask_half",
    "text": "回复 22 点 HP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 22
      }
    ]
  },
  {
    "id": "dragon_breath",
    "name": "龙息",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 21 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 8
      }
    ]
  },
  {
    "id": "rock_slide",
    "name": "岩崩",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 19 点伤害，40% 概率使对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 7
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1,
        "chance": 0.4
      }
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
    ]
  },
  {
    "id": "roost",
    "name": "羽栖",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 22%。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.22
      }
    ]
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
    ]
  },
  {
    "id": "rock_blast",
    "name": "岩石爆击",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "连续 3 次造成 8 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 3,
        "hits": 3
      }
    ]
  },
  {
    "id": "toxic",
    "name": "剧毒",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "给对手 3 层中毒（每回合流失中毒层数的生命，之后减 1）。",
    "effects": [
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      }
    ]
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
    ]
  },
  {
    "id": "fire_fang",
    "name": "火焰牙",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 17 点伤害，并给对手 2 层灼伤。",
    "effects": [
      {
        "kind": "damage",
        "power": 6
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 2
      }
    ]
  },
  {
    "id": "crunch",
    "name": "咬碎",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 13 点伤害，并使对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 5
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "dragon_claw",
    "name": "龙爪",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 26 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 10
      }
    ]
  },
  {
    "id": "earthquake",
    "name": "地震",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 29 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 10
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
    "id": "earth_power",
    "name": "大地之力",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 17 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 6,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "boomburst",
    "name": "爆音波",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 48 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 17
      }
    ]
  },
  {
    "id": "outrage",
    "name": "逆鳞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 30 点伤害，自身受到 6 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 11,
        "recoilPct": 0.2
      }
    ]
  },
  {
    "id": "dragon_rush",
    "name": "龙之俯冲",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "造成 25 点伤害；若对手 HP 低于 40%，改为造成 38 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 9,
        "execThreshold": 0.4,
        "execBonus": 5
      }
    ]
  },
  {
    "id": "heat_wave",
    "name": "热风",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "flare_1",
    "text": "造成 22 点伤害，并给对手 3 层灼伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 8
      },
      {
        "kind": "status",
        "status": "burn",
        "stacks": 3
      }
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
    ]
  },
  {
    "id": "draco_meteor",
    "name": "流星群",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "star_1",
    "text": "造成 62 点伤害，本场战斗攻击 -8。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 22
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -8
      }
    ]
  },
  {
    "id": "fissure",
    "name": "地裂",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 40 点伤害，无视对手全部防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 14,
        "ignoreDefPct": 1
      }
    ]
  },
  {
    "id": "superpower",
    "name": "蛮力",
    "ap": 2,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 36 点伤害，本场战斗攻击 -3、防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 13
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
    ]
  },
  {
    "id": "first_aid",
    "name": "急救",
    "ap": 0,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 16%，并抽 1 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.16
      },
      {
        "kind": "draw",
        "n": 1
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
    ]
  },
  {
    "id": "dragon_darts",
    "name": "龙箭",
    "ap": 1,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "spark_1",
    "text": "连续 4 次造成 9 点伤害。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 3,
        "hits": 4
      }
    ]
  },
  {
    "id": "absorb",
    "name": "吸取",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 11 点伤害，回复 5 点 HP。",
    "effects": [
      {
        "kind": "damage",
        "power": 4,
        "drainPct": 0.5
      }
    ]
  },
  {
    "id": "twineedle",
    "name": "双针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 5 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 1,
        "hits": 2
      }
    ]
  },
  {
    "id": "poison_sting",
    "name": "毒针",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 8 点伤害，并给对手 1 层中毒。",
    "effects": [
      {
        "kind": "damage",
        "power": 3
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 1
      }
    ]
  },
  {
    "id": "fury_cutter",
    "name": "连切",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 3 次造成 4 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 1,
        "hits": 3
      }
    ]
  },
  {
    "id": "silver_wind",
    "name": "银色旋风",
    "ap": 1,
    "rarity": "common",
    "targeting": "enemy",
    "art": "magic_2",
    "text": "造成 10 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 4
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "spider_web",
    "name": "蛛网",
    "ap": 0,
    "rarity": "common",
    "targeting": "enemy",
    "art": "trace_1",
    "text": "造成 4 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 2
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "razor_leaf",
    "name": "飞叶快刀",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 2 次造成 15 点伤害，并抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 4,
        "hits": 2
      },
      {
        "kind": "draw",
        "n": 1
      }
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
    ]
  },
  {
    "id": "giga_drain",
    "name": "终极吸取",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 14 点伤害，回复所造成伤害的一半。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 5,
        "drainPct": 0.5
      }
    ]
  },
  {
    "id": "u_turn_dance",
    "name": "虫之抵抗",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 10 点伤害，并让对手攻击 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 4
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
    "id": "water_pulse",
    "name": "水之波动",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 17 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 6
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "aqua_ring",
    "name": "水流环",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "magic_2",
    "text": "回复最大生命的 20%，并获得护盾（随防御成长）。",
    "effects": [
      {
        "kind": "heal",
        "pct": 0.2
      },
      {
        "kind": "shield",
        "amount": 6,
        "scaleWithDef": true
      }
    ]
  },
  {
    "id": "life_dew",
    "name": "生命水滴",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复 22 点 HP，并回复 1 点 AP。",
    "effects": [
      {
        "kind": "heal",
        "amount": 22
      },
      {
        "kind": "ap",
        "n": 1
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
    "text": "获得护盾（随防御成长，约 13 + 防御×0.75），并抽 1 张。",
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
    ]
  },
  {
    "id": "brine",
    "name": "盐水",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 15 点伤害；若对手 HP 低于 40%，改为造成 25 点。",
    "effects": [
      {
        "kind": "damage",
        "power": 5,
        "execThreshold": 0.4,
        "execBonus": 4
      }
    ]
  },
  {
    "id": "bulldoze",
    "name": "重踏",
    "ap": 2,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_1",
    "text": "造成 15 点伤害，并让对手敏捷 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 5
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "rolling_kick",
    "name": "滚动",
    "ap": 1,
    "rarity": "uncommon",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "连续 2 次造成 5 点伤害，并让对手防御 -2。",
    "effects": [
      {
        "kind": "damage",
        "power": 1,
        "hits": 2
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -2,
        "target": "enemy"
      }
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
    ]
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
    ]
  },
  {
    "id": "leaf_storm",
    "name": "飞叶风暴",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "连续 4 次造成 20 点伤害，本场战斗攻击 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 4,
        "hits": 4
      },
      {
        "kind": "buff",
        "stat": "atk",
        "amount": -5
      }
    ]
  },
  {
    "id": "rest",
    "name": "睡觉",
    "ap": 3,
    "rarity": "epic",
    "targeting": "self",
    "art": "flask_full",
    "text": "回复最大生命的 50%，并抽 2 张。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "heal",
        "pct": 0.5
      },
      {
        "kind": "draw",
        "n": 2
      }
    ]
  },
  {
    "id": "sludge_bomb",
    "name": "污泥炸弹",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "flask_half",
    "text": "造成 33 点伤害，并给对手 3 层中毒，无视对手一半防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 12,
        "ignoreDefPct": 0.5
      },
      {
        "kind": "status",
        "status": "poison",
        "stacks": 3
      }
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
    ]
  },
  {
    "id": "stone_edge",
    "name": "尖石攻击",
    "ap": 3,
    "rarity": "epic",
    "targeting": "enemy",
    "art": "dirt_2",
    "text": "造成 52 点伤害，并让对手防御 -5。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 18
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -5,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "surf",
    "name": "冲浪",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "magic_1",
    "text": "造成 35 点伤害，并让对手获得 1 层虚弱。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 13
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
    ]
  },
  {
    "id": "whirlpool",
    "name": "潮旋",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 8 点伤害，并让对手攻击 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 3,
        "hits": 3
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
    "id": "knock_off",
    "name": "拍落",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 18 点伤害，并让对手攻击 -4、防御 -3。使用后销毁。",
    "effects": [
      {
        "kind": "damage",
        "power": 6
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
    "exhaust": true
  },
  {
    "id": "double_edge",
    "name": "舍身冲撞",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 41 点伤害，自身受到 8 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 15,
        "recoilPct": 0.2
      }
    ]
  },
  {
    "id": "giga_impact",
    "name": "终极冲击",
    "ap": 3,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "exploding",
    "text": "造成 48 点伤害，自身受到 5 点反伤。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 17,
        "recoilPct": 0.1
      }
    ]
  },
  {
    "id": "dragon_tail",
    "name": "龙尾",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 29 点伤害，并让对手防御 -4。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 10
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
    "id": "swords_dance",
    "name": "剑舞",
    "ap": 1,
    "rarity": "rare",
    "targeting": "self",
    "art": "sword",
    "text": "本场战斗攻击 +6。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "buff",
        "stat": "atk",
        "amount": 6
      }
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
    ]
  },
  {
    "id": "bullet_punch",
    "name": "子弹拳",
    "ap": 0,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 7 点伤害，抽 1 张。",
    "effects": [
      {
        "kind": "damage",
        "power": 3
      },
      {
        "kind": "draw",
        "n": 1
      }
    ]
  },
  {
    "id": "focus_punch",
    "name": "真气拳",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "fist",
    "text": "造成 36 点伤害，本场战斗敏捷 -3。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 13
      },
      {
        "kind": "buff",
        "stat": "agi",
        "amount": -3
      }
    ]
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
    ]
  },
  {
    "id": "acrobatics",
    "name": "杂技",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "twirl_1",
    "text": "连续 3 次造成 9 点伤害，并让对手防御 -3。",
    "effects": [
      {
        "kind": "damage",
        "power": 2,
        "hits": 3
      },
      {
        "kind": "buff",
        "stat": "def",
        "amount": -3,
        "target": "enemy"
      }
    ]
  },
  {
    "id": "iron_head",
    "name": "铁头",
    "ap": 2,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "shield",
    "text": "造成 26 点伤害，无视对手 50% 防御。使用后销毁。",
    "exhaust": true,
    "effects": [
      {
        "kind": "damage",
        "power": 10,
        "ignoreDefPct": 0.5
      }
    ]
  },
  {
    "id": "air_slash",
    "name": "空气利刃",
    "ap": 1,
    "rarity": "rare",
    "targeting": "enemy",
    "art": "slash_1",
    "text": "造成 11 点伤害，无视对手 50% 防御。",
    "effects": [
      {
        "kind": "damage",
        "power": 4,
        "ignoreDefPct": 0.5
      }
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
    "text": "造成 6 点伤害。",
    "effects": [
      {
        "kind": "damage",
        "power": 2
      }
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
    "text": "造成 4 点伤害，并让对手获得 1 层虚弱。",
    "effects": [
      {
        "kind": "damage",
        "power": 1
      },
      {
        "kind": "status",
        "status": "weak",
        "stacks": 1
      }
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
    ]
  }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** 卡面美术：图标 mask 类名 + 背景特效图（写在 content/cards.json 的 ico / fx 字段里） */
export const CARD_ART = {
  "tackle": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "sand_attack": {
    "ico": "ico-target",
    "fx": "dirt_2"
  },
  "bite": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "quick_attack": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "rock_throw": {
    "ico": "ico-stone",
    "fx": "dirt_1"
  },
  "focus_energy": {
    "ico": "ico-temperature_up",
    "fx": "magic_1"
  },
  "harden": {
    "ico": "ico-shield",
    "fx": "trace_1"
  },
  "double_kick": {
    "ico": "ico-double",
    "fx": "slash_1"
  },
  "potion_berry": {
    "ico": "ico-pill",
    "fx": "spark_1"
  },
  "dragon_breath": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "rock_slide": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "bug_buzz": {
    "ico": "ico-bug",
    "fx": "magic_2"
  },
  "roost": {
    "ico": "ico-heart",
    "fx": "spark_1"
  },
  "dragon_dance": {
    "ico": "ico-temperature_up",
    "fx": "twirl_1"
  },
  "screech": {
    "ico": "ico-audio_waves",
    "fx": "magic_2"
  },
  "iron_defense": {
    "ico": "ico-shield_02",
    "fx": "trace_1"
  },
  "rock_blast": {
    "ico": "ico-triple",
    "fx": "dirt_1"
  },
  "toxic": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "u_turn": {
    "ico": "ico-change",
    "fx": "trace_1"
  },
  "fire_fang": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "crunch": {
    "ico": "ico-dagger",
    "fx": "slash_1"
  },
  "dragon_claw": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "earthquake": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "earth_power": {
    "ico": "ico-earthquake",
    "fx": "magic_1"
  },
  "boomburst": {
    "ico": "ico-audio_waves",
    "fx": "flare_1"
  },
  "outrage": {
    "ico": "ico-volcanic_eruption",
    "fx": "flare_1"
  },
  "dragon_rush": {
    "ico": "ico-meteor",
    "fx": "spark_1"
  },
  "heat_wave": {
    "ico": "ico-flame",
    "fx": "flare_1"
  },
  "bulk_up": {
    "ico": "ico-temperature_up",
    "fx": "twirl_1"
  },
  "sandstorm": {
    "ico": "ico-wind",
    "fx": "smoke_1"
  },
  "protect": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "draco_meteor": {
    "ico": "ico-meteor",
    "fx": "star_1"
  },
  "fissure": {
    "ico": "ico-earthquake",
    "fx": "dirt_2"
  },
  "superpower": {
    "ico": "ico-mace",
    "fx": "spark_1"
  },
  "first_aid": {
    "ico": "ico-heal",
    "fx": "spark_1"
  },
  "endure": {
    "ico": "ico-action_points",
    "fx": "trace_1"
  },
  "dragon_darts": {
    "ico": "ico-triple",
    "fx": "spark_1"
  },
  "absorb": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "twineedle": {
    "ico": "ico-spear",
    "fx": "slash_1"
  },
  "poison_sting": {
    "ico": "ico-poison",
    "fx": "magic_1"
  },
  "fury_cutter": {
    "ico": "ico-triple",
    "fx": "slash_1"
  },
  "silver_wind": {
    "ico": "ico-wind",
    "fx": "twirl_1"
  },
  "spider_web": {
    "ico": "ico-fog",
    "fx": "trace_1"
  },
  "razor_leaf": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "spore": {
    "ico": "ico-poison",
    "fx": "smoke_1"
  },
  "quiver_dance": {
    "ico": "ico-clover",
    "fx": "twirl_1"
  },
  "leech_seed": {
    "ico": "ico-leaves",
    "fx": "magic_2"
  },
  "giga_drain": {
    "ico": "ico-heart_break_02",
    "fx": "magic_1"
  },
  "u_turn_dance": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "water_pulse": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "aqua_ring": {
    "ico": "ico-water",
    "fx": "magic_2"
  },
  "life_dew": {
    "ico": "ico-water",
    "fx": "spark_1"
  },
  "withdraw": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "brine": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "bulldoze": {
    "ico": "ico-temperature_down",
    "fx": "dirt_1"
  },
  "rolling_kick": {
    "ico": "ico-double",
    "fx": "dirt_2"
  },
  "tailwind": {
    "ico": "ico-shoe",
    "fx": "twirl_1"
  },
  "safeguard": {
    "ico": "ico-protect",
    "fx": "trace_1"
  },
  "super_luck": {
    "ico": "ico-clover",
    "fx": "star_1"
  },
  "leaf_storm": {
    "ico": "ico-leaves",
    "fx": "slash_1"
  },
  "rest": {
    "ico": "ico-bed",
    "fx": "light_1"
  },
  "sludge_bomb": {
    "ico": "ico-skull",
    "fx": "smoke_1"
  },
  "salt_cure": {
    "ico": "ico-poison",
    "fx": "dirt_1"
  },
  "stone_edge": {
    "ico": "ico-stone",
    "fx": "dirt_2"
  },
  "surf": {
    "ico": "ico-water",
    "fx": "magic_1"
  },
  "whirlpool": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "knock_off": {
    "ico": "ico-battery_negative",
    "fx": "slash_1"
  },
  "double_edge": {
    "ico": "ico-counter",
    "fx": "flare_1"
  },
  "giga_impact": {
    "ico": "ico-counter",
    "fx": "dirt_2"
  },
  "dragon_tail": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "swords_dance": {
    "ico": "ico-sword",
    "fx": "twirl_1"
  },
  "calm_mind": {
    "ico": "ico-clover",
    "fx": "magic_1"
  },
  "agility": {
    "ico": "ico-shoe",
    "fx": "spark_1"
  },
  "bullet_punch": {
    "ico": "ico-lightning",
    "fx": "spark_1"
  },
  "focus_punch": {
    "ico": "ico-mace",
    "fx": "smoke_1"
  },
  "feather_dance": {
    "ico": "ico-battery_negative",
    "fx": "twirl_1"
  },
  "acrobatics": {
    "ico": "ico-triple",
    "fx": "twirl_1"
  },
  "iron_head": {
    "ico": "ico-gear",
    "fx": "spark_1"
  },
  "air_slash": {
    "ico": "ico-sword",
    "fx": "slash_1"
  },
  "mist": {
    "ico": "ico-fog",
    "fx": "smoke_1"
  },
  "refresh": {
    "ico": "ico-refresh",
    "fx": "spark_1"
  },
  "mob_scratch": {
    "ico": "ico-fist",
    "fx": "dirt_1"
  },
  "mob_sand": {
    "ico": "ico-fog",
    "fx": "dirt_2"
  },
  "mob_guard": {
    "ico": "ico-shield_03",
    "fx": "trace_1"
  },
  "mob_growl": {
    "ico": "ico-audio_waves",
    "fx": "smoke_1"
  },
  "mob_stare": {
    "ico": "ico-temperature_down",
    "fx": "magic_1"
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

export const STARTER_ITEMS = {
  "potion_small": 2,
  "potion_big": 0
};

export const ITEMS = {
  "potion_small": {
    "id": "potion_small",
    "name": "好伤药",
    "art": "flask_half",
    "ico": "ico-pill",
    "desc": "回复最大生命的 25%。",
    "healPct": 0.25,
    "price": 34
  },
  "potion_big": {
    "id": "potion_big",
    "name": "厉害伤药",
    "art": "flask_full",
    "ico": "ico-flask",
    "desc": "回复最大生命的 50%。",
    "healPct": 0.5,
    "price": 60
  },
  "charm_luck": {
    "id": "charm_luck",
    "name": "幸运护符",
    "art": "shield",
    "ico": "ico-clover",
    "desc": "本局幸运 +3。",
    "price": 70,
    "stat": {
      "luck": 3
    }
  },
  "charm_atk": {
    "id": "charm_atk",
    "name": "锐爪护符",
    "art": "sword",
    "ico": "ico-sword",
    "desc": "本局攻击 +4。",
    "price": 78,
    "stat": {
      "atk": 4
    }
  },
  "charm_def": {
    "id": "charm_def",
    "name": "硬壳护符",
    "art": "shield",
    "ico": "ico-shield",
    "desc": "本局防御 +3。",
    "price": 70,
    "stat": {
      "def": 3
    }
  },
  "charm_agi": {
    "id": "charm_agi",
    "name": "疾风护符",
    "art": "shield",
    "ico": "ico-shoe",
    "desc": "本局敏捷 +3。",
    "price": 82,
    "stat": {
      "agi": 3
    }
  },
  "elixir": {
    "id": "elixir",
    "name": "活力药",
    "art": "flask_full",
    "ico": "ico-heal",
    "desc": "本局最大生命 +18。",
    "price": 66,
    "stat": {
      "maxHp": 18
    }
  }
};
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

/** 按稀有度权重抽一张卡（排除 exclude 里的 id）；敌人专用牌不会进玩家的奖励池 */
export function rollCard(rarityBoost = 0, exclude = []) {
  const pool = [];
  for (const card of CARDS) {
    if (exclude.includes(card.id)) continue;
    // 敌人专用弱招（content/cards.json 里 enemyOnly: true）只给敌人用，别发给玩家
    if (card.enemyOnly) continue;
    const base = RARITY[card.rarity].weight;
    // rarityBoost 提高稀有卡出现概率
    const mult = card.rarity === 'common' ? 1 : 1 + rarityBoost * (card.rarity === 'epic' ? 0.5 : card.rarity === 'rare' ? 0.7 : 1);
    pool.push([base * mult, card]);
  }
  return weightedPick(pool);
}

/** 随机抽 n 张不重复的卡 */
export function rollCards(n, rarityBoost = 0, exclude = []) {
  const out = [];
  const used = [...exclude];
  for (let i = 0; i < n; i++) {
    const c = rollCard(rarityBoost, used);
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
