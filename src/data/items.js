// 道具数据（手持道具）。
//
// 【数据本体不在这里】—— ITEMS / ITEM_ART / STARTER_ITEMS 由 content/items.json 生成
// （见下面的 GENERATED 区块）。要加道具 / 改效果就改那个 JSON，然后跑
// `node tools/build-content.mjs`，别手改生成区块。
//
// 这一版把「背包制」换成「手持制」：
//   · 一局只有 **3 个手持栏**，每打赢一个 boss +1（见 Game.heldMax）；
//   · `kind: 'hold'` —— 只要拿在手上就一直生效（持有效果，见 items.json 的 _modKeys）；
//   · `kind: 'use'`  —— **只能在战斗外使用**（战斗里用太强，用户点名禁掉）；
//   · 来源：商人买 / 卖、宝箱、敌人掉落（按属性加权，概率低）。
//
// 图的文件是 assets/items/<id>.png（Generation 9 Pack 的 Graphics/Items，
// 由 tools/import-items.mjs 按 content/items.json 的 art 字段复制）。

// #region GENERATED-ITEMS
/** 道具（手持道具）。id → 定义；art 里的尺寸见 assets/data/items.json */
export const ITEMS = {
  "oran_berry": {
    "id": "oran_berry",
    "name": "橙橙果",
    "kind": "use",
    "art": "ORANBERRY",
    "rarity": "common",
    "price": 30,
    "drop": null,
    "desc": "酸得眯眼的一颗小果子，咬下去伤口就合上了。",
    "use": {
      "healPct": 0.25
    }
  },
  "sitrus_berry": {
    "id": "sitrus_berry",
    "name": "文柚果",
    "kind": "use",
    "art": "SITRUSBERRY",
    "rarity": "uncommon",
    "price": 62,
    "drop": null,
    "desc": "比橙橙果大一圈，苦味在后头，劲儿也在后头。",
    "use": {
      "healPct": 0.5
    }
  },
  "lum_berry": {
    "id": "lum_berry",
    "name": "木子果",
    "kind": "use",
    "art": "LUMBERRY",
    "rarity": "uncommon",
    "price": 58,
    "drop": null,
    "desc": "嚼起来像树皮，咽下去身上就干净了。",
    "use": {
      "cleanse": [
        "poison",
        "toxic",
        "burn",
        "weak",
        "bleed"
      ]
    }
  },
  "pecha_berry": {
    "id": "pecha_berry",
    "name": "桃桃果",
    "kind": "use",
    "art": "PECHABERRY",
    "rarity": "common",
    "price": 32,
    "drop": null,
    "desc": "甜甜的，专治那种从骨头里往外泛的难受。",
    "use": {
      "cleanse": [
        "poison",
        "toxic"
      ]
    }
  },
  "rawst_berry": {
    "id": "rawst_berry",
    "name": "莓莓果",
    "kind": "use",
    "art": "RAWSTBERRY",
    "rarity": "common",
    "price": 32,
    "drop": null,
    "desc": "苦得很，凉得也快 —— 烫伤和血口子都压得住。",
    "use": {
      "cleanse": [
        "burn",
        "bleed"
      ]
    }
  },
  "sacred_ash": {
    "id": "sacred_ash",
    "name": "圣灰",
    "kind": "use",
    "art": "SACREDASH",
    "rarity": "rare",
    "price": 130,
    "drop": null,
    "desc": "一小撮还会发暖的白灰，撒在伤口上就长好了。",
    "use": {
      "healFull": true
    }
  },
  "sweet_apple": {
    "id": "sweet_apple",
    "name": "甜苹果",
    "kind": "use",
    "art": "SWEETAPPLE",
    "rarity": "uncommon",
    "price": 74,
    "drop": null,
    "desc": "甜得发腻，吃完觉得身子沉了一点 —— 是好事。",
    "use": {
      "stat": {
        "maxHp": 15
      }
    }
  },
  "muscle_wing": {
    "id": "muscle_wing",
    "name": "力量之羽",
    "kind": "use",
    "art": "MUSCLEWING",
    "rarity": "common",
    "price": 42,
    "drop": null,
    "desc": "轻飘飘一片，攥久了手上的劲儿会变大。",
    "use": {
      "stat": {
        "atk": 3
      }
    }
  },
  "resist_wing": {
    "id": "resist_wing",
    "name": "抵抗之羽",
    "kind": "use",
    "art": "RESISTWING",
    "rarity": "common",
    "price": 42,
    "drop": null,
    "desc": "贴在身上像多了一层皮，挨打没那么疼了。",
    "use": {
      "stat": {
        "def": 3
      }
    }
  },
  "health_wing": {
    "id": "health_wing",
    "name": "体力之羽",
    "kind": "use",
    "art": "HEALTHWING",
    "rarity": "common",
    "price": 46,
    "drop": null,
    "desc": "凑近听有很轻的搏动声，那是它的，也是你的。",
    "use": {
      "stat": {
        "maxHp": 12
      }
    }
  },
  "normal_gem": {
    "id": "normal_gem",
    "name": "一般宝石",
    "kind": "hold",
    "art": "NORMALGEM",
    "rarity": "uncommon",
    "price": 60,
    "drop": "一般",
    "desc": "没什么脾气的一块石头，什么都肯接一点。",
    "hold": {
      "mods": [
        {
          "key": "attackPct",
          "add": 0.08
        }
      ]
    }
  },
  "lucky_egg": {
    "id": "lucky_egg",
    "name": "幸运蛋",
    "kind": "hold",
    "art": "LUCKYEGG",
    "rarity": "uncommon",
    "price": 72,
    "drop": "一般",
    "desc": "别人看着是蛋，你看着是一路掉下来的钱。",
    "hold": {
      "mods": [
        {
          "key": "goldPct",
          "add": 0.25
        }
      ]
    }
  },
  "flame_orb": {
    "id": "flame_orb",
    "name": "火焰宝珠",
    "kind": "hold",
    "art": "FLAMEORB",
    "rarity": "rare",
    "price": 96,
    "drop": "火",
    "desc": "握在掌心是温的，扔出去的东西会烧起来。",
    "hold": {
      "mods": [
        {
          "key": "burnStacks",
          "add": 1
        },
        {
          "key": "dotPct",
          "add": 0.3
        }
      ]
    }
  },
  "heat_rock": {
    "id": "heat_rock",
    "name": "炽热岩石",
    "kind": "hold",
    "art": "HEATROCK",
    "rarity": "uncommon",
    "price": 66,
    "drop": "火",
    "desc": "一直不肯凉，身上那点热劲儿也散得慢。",
    "hold": {
      "mods": [
        {
          "key": "buffTurns",
          "add": 1
        }
      ]
    }
  },
  "damp_rock": {
    "id": "damp_rock",
    "name": "潮湿岩石",
    "kind": "hold",
    "art": "DAMPROCK",
    "rarity": "rare",
    "price": 98,
    "drop": "水",
    "desc": "永远湿着，揣着它走一天都不渴。",
    "hold": {
      "mods": [
        {
          "key": "healPerTurnPct",
          "add": 0.03
        }
      ]
    }
  },
  "blue_shard": {
    "id": "blue_shard",
    "name": "蓝色碎片",
    "kind": "hold",
    "art": "BLUESHARD",
    "rarity": "uncommon",
    "price": 62,
    "drop": "水",
    "desc": "薄薄一片，边缘磨得很圆 —— 挡过不少东西。",
    "hold": {
      "mods": [
        {
          "key": "shieldPct",
          "add": 0.25
        }
      ]
    }
  },
  "miracle_seed": {
    "id": "miracle_seed",
    "name": "奇迹种子",
    "kind": "hold",
    "art": "MIRACLESEED",
    "rarity": "rare",
    "price": 96,
    "drop": "草",
    "desc": "随手放在兜里，几天后兜里长出新芽。",
    "hold": {
      "mods": [
        {
          "key": "healPct",
          "add": 0.3
        }
      ]
    }
  },
  "big_root": {
    "id": "big_root",
    "name": "大根茎",
    "kind": "hold",
    "art": "BIGROOT",
    "rarity": "uncommon",
    "price": 68,
    "drop": "草",
    "desc": "还带着土，闻着就是「能补回来」的味道。",
    "hold": {
      "mods": [
        {
          "key": "healAfterBattlePct",
          "add": 0.2
        }
      ]
    }
  },
  "electric_seed": {
    "id": "electric_seed",
    "name": "电气种子",
    "kind": "hold",
    "art": "ELECTRICSEED",
    "rarity": "rare",
    "price": 98,
    "drop": "电",
    "desc": "碰上就麻一下，出手也跟着快一拍。",
    "hold": {
      "mods": [
        {
          "key": "firstAttackPct",
          "add": 0.4
        }
      ]
    }
  },
  "thunder_stone": {
    "id": "thunder_stone",
    "name": "雷之石",
    "kind": "hold",
    "art": "THUNDERSTONE",
    "rarity": "rare",
    "price": 112,
    "drop": "电",
    "desc": "里面那道光一直在走，开局就先亮给你看。",
    "hold": {
      "mods": [
        {
          "key": "apFirstTurn",
          "add": 1
        }
      ]
    }
  },
  "icicle_plate": {
    "id": "icicle_plate",
    "name": "冰柱石板",
    "kind": "hold",
    "art": "ICICLEPLATE",
    "rarity": "uncommon",
    "price": 72,
    "drop": "冰",
    "desc": "冷得扎手，挡在身前倒是意外地稳。",
    "hold": {
      "mods": [
        {
          "key": "damageTakenPct",
          "add": -0.08
        }
      ]
    }
  },
  "icy_rock": {
    "id": "icy_rock",
    "name": "寒冷岩石",
    "kind": "hold",
    "art": "ICYROCK",
    "rarity": "uncommon",
    "price": 68,
    "drop": "冰",
    "desc": "伤口沾上它就凉得发木，疼也散得慢。",
    "hold": {
      "mods": [
        {
          "key": "dotPct",
          "add": 0.25
        }
      ]
    }
  },
  "fighting_gem": {
    "id": "fighting_gem",
    "name": "格斗宝石",
    "kind": "hold",
    "art": "FIGHTINGGEM",
    "rarity": "uncommon",
    "price": 62,
    "drop": "格斗",
    "desc": "摆在掌心像颗牙，攥紧了手就发烫。",
    "hold": {
      "mods": [
        {
          "key": "attackPct",
          "add": 0.1
        },
        {
          "key": "damageTakenPct",
          "add": 0.05
        }
      ]
    }
  },
  "expert_belt": {
    "id": "expert_belt",
    "name": "专家腰带",
    "kind": "hold",
    "art": "EXPERTBELT",
    "rarity": "uncommon",
    "price": 76,
    "drop": "格斗",
    "desc": "系得很紧，站定了就不太想退。",
    "hold": {
      "mods": [
        {
          "key": "atk",
          "add": 6
        }
      ]
    }
  },
  "poison_barb": {
    "id": "poison_barb",
    "name": "毒针",
    "kind": "hold",
    "art": "POISONBARB",
    "rarity": "uncommon",
    "price": 66,
    "drop": "毒",
    "desc": "一小截断掉的刺，伤口周围会慢慢发青。",
    "hold": {
      "mods": [
        {
          "key": "poisonStacks",
          "add": 1
        }
      ]
    }
  },
  "toxic_orb": {
    "id": "toxic_orb",
    "name": "剧毒宝珠",
    "kind": "hold",
    "art": "TOXICORB",
    "rarity": "rare",
    "price": 108,
    "drop": "毒",
    "desc": "泡在自己那点毒里，毒越积越深、也不会散。",
    "hold": {
      "mods": [
        {
          "key": "poisonNoDecay"
        },
        {
          "key": "poisonTickPct",
          "add": 0.015
        }
      ]
    }
  },
  "soft_sand": {
    "id": "soft_sand",
    "name": "柔软沙子",
    "kind": "hold",
    "art": "SOFTSAND",
    "rarity": "uncommon",
    "price": 72,
    "drop": "地面",
    "desc": "细得能从指缝里漏光，踩上去却站得很稳。",
    "hold": {
      "mods": [
        {
          "key": "atk",
          "add": 4
        },
        {
          "key": "def",
          "add": 4
        }
      ]
    }
  },
  "earth_plate": {
    "id": "earth_plate",
    "name": "大地石板",
    "kind": "hold",
    "art": "EARTHPLATE",
    "rarity": "rare",
    "price": 96,
    "drop": "地面",
    "desc": "碎角的一块石板，压在对手身上比压在手里重。",
    "hold": {
      "mods": [
        {
          "key": "debuffStacks",
          "add": 1
        }
      ]
    }
  },
  "pretty_feather": {
    "id": "pretty_feather",
    "name": "漂亮羽毛",
    "kind": "hold",
    "art": "PRETTYFEATHER",
    "rarity": "uncommon",
    "price": 66,
    "drop": "飞行",
    "desc": "看着轻，插在羽轴上的风比你想的重。",
    "hold": {
      "mods": [
        {
          "key": "agi",
          "add": 6
        }
      ]
    }
  },
  "sharp_beak": {
    "id": "sharp_beak",
    "name": "锐利鸟嘴",
    "kind": "hold",
    "art": "SHARPBEAK",
    "rarity": "rare",
    "price": 106,
    "drop": "飞行",
    "desc": "轻得几乎没有重量，叼着它出手总快一步。",
    "hold": {
      "mods": [
        {
          "key": "drawPerTurn",
          "add": 1
        }
      ]
    }
  },
  "psychic_seed": {
    "id": "psychic_seed",
    "name": "精神种子",
    "kind": "hold",
    "art": "PSYCHICSEED",
    "rarity": "epic",
    "price": 145,
    "drop": "超能",
    "desc": "握久了会听见自己的念头在排队。",
    "hold": {
      "mods": [
        {
          "key": "apPerTurn",
          "add": 1
        }
      ]
    }
  },
  "moon_stone": {
    "id": "moon_stone",
    "name": "月之石",
    "kind": "hold",
    "art": "MOONSTONE",
    "rarity": "rare",
    "price": 102,
    "drop": "超能",
    "desc": "表面那层光只在夜里显形，照得对手发虚。",
    "hold": {
      "mods": [
        {
          "key": "debuffStacks",
          "add": 1
        }
      ]
    }
  },
  "silver_powder": {
    "id": "silver_powder",
    "name": "银粉",
    "kind": "hold",
    "art": "SILVERPOWDER",
    "rarity": "uncommon",
    "price": 66,
    "drop": "虫",
    "desc": "抖一抖就满天飞，沾上的地方都不容易好。",
    "hold": {
      "mods": [
        {
          "key": "dotPct",
          "add": 0.25
        }
      ]
    }
  },
  "bug_gem": {
    "id": "bug_gem",
    "name": "虫之宝石",
    "kind": "hold",
    "art": "BUGGEM",
    "rarity": "common",
    "price": 46,
    "drop": "虫",
    "desc": "小小的、带点壳光的宝石，边缘有点毛。",
    "hold": {
      "mods": [
        {
          "key": "attackPct",
          "add": 0.07
        }
      ]
    }
  },
  "hard_stone": {
    "id": "hard_stone",
    "name": "坚硬石头",
    "kind": "hold",
    "art": "HARDSTONE",
    "rarity": "uncommon",
    "price": 72,
    "drop": "岩石",
    "desc": "普通得不能再普通的一块，砸在手上你就知道了。",
    "hold": {
      "mods": [
        {
          "key": "def",
          "add": 6
        }
      ]
    }
  },
  "rock_gem": {
    "id": "rock_gem",
    "name": "岩石宝石",
    "kind": "hold",
    "art": "ROCKGEM",
    "rarity": "rare",
    "price": 96,
    "drop": "岩石",
    "desc": "截面上全是细纹，挡下来的力道都顺着纹散了。",
    "hold": {
      "mods": [
        {
          "key": "shieldPct",
          "add": 0.4
        }
      ]
    }
  },
  "spooky_plate": {
    "id": "spooky_plate",
    "name": "妖异石板",
    "kind": "hold",
    "art": "SPOOKYPLATE",
    "rarity": "epic",
    "price": 155,
    "drop": "幽灵",
    "desc": "贴着皮肤是凉的，疼到最狠的时候它替你应了一声。",
    "hold": {
      "mods": [
        {
          "key": "surviveOnce"
        },
        {
          "key": "battleStartCleanse"
        }
      ]
    }
  },
  "ghost_gem": {
    "id": "ghost_gem",
    "name": "幽灵宝石",
    "kind": "hold",
    "art": "GHOSTGEM",
    "rarity": "rare",
    "price": 98,
    "drop": "幽灵",
    "desc": "看着里面空空的，可它一进场就先替你挡了一下。",
    "hold": {
      "mods": [
        {
          "key": "battleStartShieldPct",
          "add": 0.2
        }
      ]
    }
  },
  "dragon_fang": {
    "id": "dragon_fang",
    "name": "龙之牙",
    "kind": "hold",
    "art": "DRAGONFANG",
    "rarity": "rare",
    "price": 106,
    "drop": "龙",
    "desc": "挂在脖子上硌人，咬起来却比谁都狠。",
    "hold": {
      "mods": [
        {
          "key": "attackPct",
          "add": 0.12
        }
      ]
    }
  },
  "dragon_scale": {
    "id": "dragon_scale",
    "name": "龙之鳞",
    "kind": "hold",
    "art": "DRAGONSCALE",
    "rarity": "rare",
    "price": 106,
    "drop": "龙",
    "desc": "一片就够盖住半个胸口，砸上去只留个白点。",
    "hold": {
      "mods": [
        {
          "key": "damageTakenPct",
          "add": -0.12
        }
      ]
    }
  },
  "dread_plate": {
    "id": "dread_plate",
    "name": "恶之石板",
    "kind": "hold",
    "art": "DREADPLATE",
    "rarity": "rare",
    "price": 102,
    "drop": "恶",
    "desc": "翻过来才看清上面的划痕，全是别人留下的。",
    "hold": {
      "mods": [
        {
          "key": "debuffStacks",
          "add": 1
        },
        {
          "key": "dotPct",
          "add": 0.1
        }
      ]
    }
  },
  "dark_gem": {
    "id": "dark_gem",
    "name": "恶之宝石",
    "kind": "hold",
    "art": "DARKGEM",
    "rarity": "uncommon",
    "price": 72,
    "drop": "恶",
    "desc": "吸光的一小块，赢下来的东西会顺手补给你。",
    "hold": {
      "mods": [
        {
          "key": "healOnKillPct",
          "add": 0.08
        }
      ]
    }
  },
  "metal_powder": {
    "id": "metal_powder",
    "name": "金属粉",
    "kind": "hold",
    "art": "METALPOWDER",
    "rarity": "uncommon",
    "price": 72,
    "drop": "钢",
    "desc": "撒一层在身上，硬是硬了点，动起来也响。",
    "hold": {
      "mods": [
        {
          "key": "shieldPct",
          "add": 0.2
        },
        {
          "key": "def",
          "add": 3
        }
      ]
    }
  },
  "steel_gem": {
    "id": "steel_gem",
    "name": "钢铁宝石",
    "kind": "hold",
    "art": "STEELGEM",
    "rarity": "uncommon",
    "price": 72,
    "drop": "钢",
    "desc": "沉甸甸一小块，挡下来的每一下都替你留住一点。",
    "hold": {
      "mods": [
        {
          "key": "damageTakenPct",
          "add": -0.06
        },
        {
          "key": "shieldPct",
          "add": 0.1
        }
      ]
    }
  },
  "fairy_feather": {
    "id": "fairy_feather",
    "name": "妖精羽毛",
    "kind": "hold",
    "art": "FAIRYFEATHER",
    "rarity": "uncommon",
    "price": 66,
    "drop": "妖精",
    "desc": "抖一抖会落下细粉，伤口沾上就痒痒地长好。",
    "hold": {
      "mods": [
        {
          "key": "healPct",
          "add": 0.2
        }
      ]
    }
  },
  "fairy_gem": {
    "id": "fairy_gem",
    "name": "妖精宝石",
    "kind": "hold",
    "art": "FAIRYGEM",
    "rarity": "rare",
    "price": 96,
    "drop": "妖精",
    "desc": "粉得很不正经，可它让你的好状态多赖一会儿。",
    "hold": {
      "mods": [
        {
          "key": "buffTurns",
          "add": 1
        }
      ]
    }
  },
  "moomoo_milk": {
    "id": "moomoo_milk",
    "name": "哞哞牛奶",
    "kind": "hold",
    "art": "MOOMOOMILK",
    "rarity": "rare",
    "price": 112,
    "drop": "一般",
    "desc": "满满一罐，喝一口就暖 —— 恢复类的牌也跟着更补。",
    "hold": {
      "mods": [
        {
          "key": "healPct",
          "add": 0.35
        }
      ]
    }
  },
  "razor_claw": {
    "id": "razor_claw",
    "name": "锐利之爪",
    "kind": "hold",
    "art": "RAZORCLAW",
    "rarity": "rare",
    "price": 118,
    "drop": "恶",
    "desc": "爪尖还挂着旧痕，划开的口子比平时深一倍。",
    "hold": {
      "mods": [
        {
          "key": "bleedStacksMult",
          "mul": 2
        }
      ]
    }
  },
  "toxic_candy": {
    "id": "toxic_candy",
    "name": "毒毒糖",
    "kind": "hold",
    "art": "RAGECANDYBAR",
    "rarity": "rare",
    "price": 104,
    "drop": "毒",
    "desc": "含在嘴里是甜的，咽下去嘴里发苦、对面更苦。",
    "hold": {
      "mods": [
        {
          "key": "poisonNoDecay"
        },
        {
          "key": "poisonTickPct",
          "add": 0.01
        }
      ]
    }
  },
  "shell_bell": {
    "id": "shell_bell",
    "name": "贝壳铃",
    "kind": "hold",
    "art": "SHELLBELL",
    "rarity": "rare",
    "price": 112,
    "drop": "水",
    "desc": "摇一摇有很轻的响声，打在别人身上自己也会好受。",
    "hold": {
      "mods": [
        {
          "key": "lifestealPct",
          "add": 0.1
        }
      ]
    }
  },
  "life_orb": {
    "id": "life_orb",
    "name": "生命宝珠",
    "kind": "hold",
    "art": "LIFEORB",
    "rarity": "epic",
    "price": 142,
    "drop": "龙",
    "desc": "里面那团光一直在跳 —— 它借你力气，也收利息。",
    "hold": {
      "mods": [
        {
          "key": "attackPct",
          "add": 0.25
        },
        {
          "key": "selfDamagePct",
          "add": 0.02
        }
      ]
    }
  },
  "kings_rock": {
    "id": "kings_rock",
    "name": "王者之证",
    "kind": "hold",
    "art": "KINGSROCK",
    "rarity": "rare",
    "price": 102,
    "drop": "岩石",
    "desc": "刻着一只戴着冠的脑袋，压场子的分量比石头重。",
    "hold": {
      "mods": [
        {
          "key": "debuffStacks",
          "add": 1
        }
      ]
    }
  },
  "bright_powder": {
    "id": "bright_powder",
    "name": "光之粉",
    "kind": "hold",
    "art": "BRIGHTPOWDER",
    "rarity": "rare",
    "price": 102,
    "drop": "妖精",
    "desc": "一把亮晶晶的粉，糊在身上连拳头都滑开了。",
    "hold": {
      "mods": [
        {
          "key": "damageTakenPct",
          "add": -0.1
        }
      ]
    }
  },
  "quick_claw": {
    "id": "quick_claw",
    "name": "先制之爪",
    "kind": "hold",
    "art": "QUICKCLAW",
    "rarity": "rare",
    "price": 108,
    "drop": "一般",
    "desc": "捏着它，每回合的第一下总是你先到。",
    "hold": {
      "mods": [
        {
          "key": "firstAttackPct",
          "add": 0.5
        }
      ]
    }
  },
  "grip_claw": {
    "id": "grip_claw",
    "name": "紧绑之爪",
    "kind": "hold",
    "art": "GRIPCLAW",
    "rarity": "rare",
    "price": 108,
    "drop": "虫",
    "desc": "抓住就不松，伤口上的东西也跟着一直往肉里走。",
    "hold": {
      "mods": [
        {
          "key": "dotPct",
          "add": 0.3
        }
      ]
    }
  },
  "white_herb": {
    "id": "white_herb",
    "name": "白色香草",
    "kind": "hold",
    "art": "WHITEHERB",
    "rarity": "uncommon",
    "price": 78,
    "drop": "草",
    "desc": "开打前嚼一片，身上那点晦气就散了。",
    "hold": {
      "mods": [
        {
          "key": "battleStartCleanse"
        }
      ]
    }
  },
  "energy_root": {
    "id": "energy_root",
    "name": "元气之根",
    "kind": "hold",
    "art": "ENERGYROOT",
    "rarity": "uncommon",
    "price": 72,
    "drop": "草",
    "desc": "苦得掉眼泪，可打完一场你就知道值。",
    "hold": {
      "mods": [
        {
          "key": "healAfterBattlePct",
          "add": 0.25
        }
      ]
    }
  },
  "revival_herb": {
    "id": "revival_herb",
    "name": "复活草",
    "kind": "hold",
    "art": "REVIVALHERB",
    "rarity": "epic",
    "price": 152,
    "drop": "草",
    "desc": "叶子一直不枯，它替你留着一口气。",
    "hold": {
      "mods": [
        {
          "key": "surviveOnce"
        }
      ]
    }
  },
  "stardust": {
    "id": "stardust",
    "name": "星星沙子",
    "kind": "hold",
    "art": "STARDUST",
    "rarity": "uncommon",
    "price": 74,
    "drop": "岩石",
    "desc": "一小袋亮沙子，商人看见它说话都客气些。",
    "hold": {
      "mods": [
        {
          "key": "shopDiscountPct",
          "add": 0.2
        }
      ]
    }
  },
  "comet_shard": {
    "id": "comet_shard",
    "name": "彗星碎片",
    "kind": "hold",
    "art": "COMETSHARD",
    "rarity": "epic",
    "price": 148,
    "drop": "超能",
    "desc": "从天上掉下来的东西，靠近它选择会变多。",
    "hold": {
      "mods": [
        {
          "key": "rewardChoices",
          "add": 1
        }
      ]
    }
  },
  "luminous_moss": {
    "id": "luminous_moss",
    "name": "发光苔",
    "kind": "hold",
    "art": "LUMINOUSMOSS",
    "rarity": "epic",
    "price": 148,
    "drop": "草",
    "desc": "在暗处自己亮着，照着照着你就多摸到一张牌。",
    "hold": {
      "mods": [
        {
          "key": "drawPerTurn",
          "add": 1
        }
      ]
    }
  },
  "honey": {
    "id": "honey",
    "name": "蜂蜜",
    "kind": "hold",
    "art": "HONEY",
    "rarity": "uncommon",
    "price": 62,
    "drop": "虫",
    "desc": "甜得能引来东西 —— 路上碰见的好事也变多了。",
    "hold": {
      "mods": [
        {
          "key": "eventHealPct",
          "add": 0.5
        }
      ]
    }
  },
  "rare_bone": {
    "id": "rare_bone",
    "name": "贵重骨头",
    "kind": "hold",
    "art": "RAREBONE",
    "rarity": "uncommon",
    "price": 74,
    "drop": "恶",
    "desc": "干干净净一根，商人都认得这个价钱。",
    "hold": {
      "mods": [
        {
          "key": "goldPct",
          "add": 0.3
        }
      ]
    }
  },
  "float_stone": {
    "id": "float_stone",
    "name": "轻石",
    "kind": "hold",
    "art": "FLOATSTONE",
    "rarity": "uncommon",
    "price": 76,
    "drop": "飞行",
    "desc": "拿着它走路，脚步轻得自己都不习惯。",
    "hold": {
      "mods": [
        {
          "key": "agi",
          "add": 5
        },
        {
          "key": "luck",
          "add": 5
        }
      ]
    }
  },
  "smooth_rock": {
    "id": "smooth_rock",
    "name": "光滑岩石",
    "kind": "hold",
    "art": "SMOOTHROCK",
    "rarity": "uncommon",
    "price": 72,
    "drop": "岩石",
    "desc": "被水磨得发亮，上头的好处也留得久一点。",
    "hold": {
      "mods": [
        {
          "key": "buffTurns",
          "add": 1
        }
      ]
    }
  },
  "charm_atk": {
    "id": "charm_atk",
    "name": "锐爪护符",
    "kind": "hold",
    "art": "POWERBAND",
    "rarity": "uncommon",
    "price": 78,
    "drop": null,
    "desc": "串着一小截爪尖，戴着它就想起怎么出手。",
    "hold": {
      "mods": [
        {
          "key": "atk",
          "add": 4
        }
      ]
    }
  },
  "charm_def": {
    "id": "charm_def",
    "name": "硬壳护符",
    "kind": "hold",
    "art": "MUSCLEBAND",
    "rarity": "uncommon",
    "price": 70,
    "drop": null,
    "desc": "一片甲壳磨的，贴在身上像多长了一层。",
    "hold": {
      "mods": [
        {
          "key": "def",
          "add": 3
        }
      ]
    }
  },
  "charm_agi": {
    "id": "charm_agi",
    "name": "疾风护符",
    "kind": "hold",
    "art": "FOCUSBAND",
    "rarity": "uncommon",
    "price": 82,
    "drop": null,
    "desc": "中间那把穗子一直朝前飘，你的步子也跟着快了。",
    "hold": {
      "mods": [
        {
          "key": "agi",
          "add": 3
        }
      ]
    }
  },
  "charm_luck": {
    "id": "charm_luck",
    "name": "幸运护符",
    "kind": "hold",
    "art": "RELICBAND",
    "rarity": "uncommon",
    "price": 70,
    "drop": null,
    "desc": "上面那颗小石头据说很灵，反正不重。",
    "hold": {
      "mods": [
        {
          "key": "luck",
          "add": 3
        }
      ]
    }
  }
};

export const ITEM_BY_ID = ITEMS;

export const ITEM_ART = {
  "oran_berry": {
    "w": 48,
    "h": 48
  },
  "sitrus_berry": {
    "w": 48,
    "h": 48
  },
  "lum_berry": {
    "w": 48,
    "h": 48
  },
  "pecha_berry": {
    "w": 48,
    "h": 48
  },
  "rawst_berry": {
    "w": 48,
    "h": 48
  },
  "sacred_ash": {
    "w": 48,
    "h": 48
  },
  "sweet_apple": {
    "w": 48,
    "h": 48
  },
  "muscle_wing": {
    "w": 48,
    "h": 48
  },
  "resist_wing": {
    "w": 48,
    "h": 48
  },
  "health_wing": {
    "w": 48,
    "h": 48
  },
  "normal_gem": {
    "w": 48,
    "h": 48
  },
  "lucky_egg": {
    "w": 48,
    "h": 48
  },
  "flame_orb": {
    "w": 48,
    "h": 48
  },
  "heat_rock": {
    "w": 48,
    "h": 48
  },
  "damp_rock": {
    "w": 48,
    "h": 48
  },
  "blue_shard": {
    "w": 48,
    "h": 48
  },
  "miracle_seed": {
    "w": 48,
    "h": 48
  },
  "big_root": {
    "w": 48,
    "h": 48
  },
  "electric_seed": {
    "w": 50,
    "h": 50
  },
  "thunder_stone": {
    "w": 48,
    "h": 48
  },
  "icicle_plate": {
    "w": 48,
    "h": 48
  },
  "icy_rock": {
    "w": 48,
    "h": 48
  },
  "fighting_gem": {
    "w": 48,
    "h": 48
  },
  "expert_belt": {
    "w": 48,
    "h": 48
  },
  "poison_barb": {
    "w": 48,
    "h": 48
  },
  "toxic_orb": {
    "w": 48,
    "h": 48
  },
  "soft_sand": {
    "w": 48,
    "h": 48
  },
  "earth_plate": {
    "w": 48,
    "h": 48
  },
  "pretty_feather": {
    "w": 48,
    "h": 48
  },
  "sharp_beak": {
    "w": 48,
    "h": 48
  },
  "psychic_seed": {
    "w": 50,
    "h": 50
  },
  "moon_stone": {
    "w": 48,
    "h": 48
  },
  "silver_powder": {
    "w": 48,
    "h": 48
  },
  "bug_gem": {
    "w": 48,
    "h": 48
  },
  "hard_stone": {
    "w": 48,
    "h": 48
  },
  "rock_gem": {
    "w": 48,
    "h": 48
  },
  "spooky_plate": {
    "w": 48,
    "h": 48
  },
  "ghost_gem": {
    "w": 48,
    "h": 48
  },
  "dragon_fang": {
    "w": 48,
    "h": 48
  },
  "dragon_scale": {
    "w": 48,
    "h": 48
  },
  "dread_plate": {
    "w": 48,
    "h": 48
  },
  "dark_gem": {
    "w": 48,
    "h": 48
  },
  "metal_powder": {
    "w": 48,
    "h": 48
  },
  "steel_gem": {
    "w": 48,
    "h": 48
  },
  "fairy_feather": {
    "w": 48,
    "h": 48
  },
  "fairy_gem": {
    "w": 48,
    "h": 48
  },
  "moomoo_milk": {
    "w": 48,
    "h": 48
  },
  "razor_claw": {
    "w": 48,
    "h": 48
  },
  "toxic_candy": {
    "w": 48,
    "h": 48
  },
  "shell_bell": {
    "w": 48,
    "h": 48
  },
  "life_orb": {
    "w": 48,
    "h": 48
  },
  "kings_rock": {
    "w": 48,
    "h": 48
  },
  "bright_powder": {
    "w": 48,
    "h": 48
  },
  "quick_claw": {
    "w": 48,
    "h": 48
  },
  "grip_claw": {
    "w": 48,
    "h": 48
  },
  "white_herb": {
    "w": 48,
    "h": 48
  },
  "energy_root": {
    "w": 48,
    "h": 48
  },
  "revival_herb": {
    "w": 48,
    "h": 48
  },
  "stardust": {
    "w": 48,
    "h": 48
  },
  "comet_shard": {
    "w": 48,
    "h": 48
  },
  "luminous_moss": {
    "w": 48,
    "h": 48
  },
  "honey": {
    "w": 48,
    "h": 48
  },
  "rare_bone": {
    "w": 48,
    "h": 48
  },
  "float_stone": {
    "w": 48,
    "h": 48
  },
  "smooth_rock": {
    "w": 48,
    "h": 48
  },
  "charm_atk": {
    "w": 48,
    "h": 48
  },
  "charm_def": {
    "w": 48,
    "h": 48
  },
  "charm_agi": {
    "w": 48,
    "h": 48
  },
  "charm_luck": {
    "w": 48,
    "h": 48
  }
};

/** 开局就在手上的道具（content/items.json 的 starter） */
export const STARTER_ITEMS = {
  "oran_berry": 1
};
// #endregion GENERATED-ITEMS

/** 一件道具是不是「拿着就生效」的那种 */
export function isHeldItem(item) {
  return !!item && item.kind === 'hold';
}

/** 一件道具能不能在战斗外使用（持有型没有「用」这个动作） */
export function isUsableItem(item) {
  return !!item && item.kind === 'use' && !!item.use;
}

/** 道具图的相对路径 */
export function itemArtUrl(id) {
  return `assets/items/${id}.png`;
}
