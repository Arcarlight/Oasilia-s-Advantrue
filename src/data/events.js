// 地图事件。
//
// 【数据本体不在这里】—— 每个事件都在 content/events/*.json 里，用声明式的 DSL 描述
// 「发生什么」，由 src/core/eventfx.js 解释执行（见下面 GENERATED 区块）。
// 加事件 = 往对应的 JSON 里加一段，然后跑 `node tools/build-content.mjs`。
//
// 事件的 DSL 速查表写在 src/core/eventfx.js 顶部。

import { eventOption } from '../core/eventfx.js';

// #region GENERATED-EVENTS
export const EVENTS = [
  {
    "id": "cliff_wind_gap",
    "name": "风的口子",
    "biome": "cliff",
    "text": "岩壁上有一道被风啃穿的缝，风从里面出来的时候是热的，还带着一股铁味。\n「唔……这风是从哪儿吹来的呀？」",
    "options": [
      eventOption({
        "label": "钻过去（50% 获得 1 张卡 / 50% -20 HP）",
        "tone": "neutral",
        "text": "你把翅膀折到背上，侧着身子往里挤。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "缝后面是一个被风掏空的腔，里面堆着所有被吹进来的东西，包括一张卡。\n「哇，风还会收集东西。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRandom": 0.45
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "风突然换了方向，从背后把你拍在岩壁上，拍了好几下。\n「呜！风也会翻脸呀……」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -20
                  }
                ]
              }
            ]
          }
        ],
        "hint": "钻过去试试。"
      }),
      eventOption({
        "label": "张开翅膀迎着风（攻击 +4，-10 HP）",
        "tone": "good",
        "text": "你在风口上撑了十几秒，被吹得站不住，但你知道该怎么用力了。\n「哦哦哦 —— 懂了懂了！这样用力才对。」\nHP -{hp}，攻击 +4。",
        "effects": [
          {
            "hp": -10
          },
          {
            "stat": {
              "atk": 4
            }
          }
        ],
        "hint": "张开翅膀迎着风！"
      }),
      eventOption({
        "label": "绕开它",
        "tone": "neutral",
        "text": "你从缝口走开。风在里面继续吹它自己的，吹了不知道多少年，也不差你一个听众。\n「下次再来听。」",
        "effects": [],
        "hint": "绕开它。"
      }),
    ]
  },
  {
    "id": "cliff_ledge_nest",
    "name": "岩架上的窝",
    "biome": "cliff",
    "text": "一个用枯枝和骨头搭的窝卡在岩架边上，里面有三颗蛋，蛋壳上有被风刻出来的花纹。\n「诶 —— 好漂亮的花纹。」",
    "options": [
      eventOption({
        "label": "拿走一颗蛋（获得活力药 ×1，-18 HP）",
        "tone": "neutral",
        "text": "母鸟回来了。你叼着蛋往下跳，落地的时候蛋碎了，蛋液在瓶里凝成了一颗药。\n「对不起呀母鸟！……不过这个药真能用。」\nHP -{hp}，获得{item} ×1。",
        "effects": [
          {
            "item": "elixir"
          },
          {
            "hp": -18
          }
        ],
        "hint": "拿走一颗（窝的主人好像不在？）"
      }),
      eventOption({
        "label": "在原地等它回来（幸运 +3，回复 20 HP）",
        "tone": "good",
        "text": "秃鹫回来看了你一眼，没管你。你们在同一个岩架上晒了一个下午的太阳。\n「晒太阳最舒服啦。」\nHP +{heal}，幸运 +3。",
        "effects": [
          {
            "stat": {
              "luck": 3
            }
          },
          {
            "hp": 20
          }
        ],
        "hint": "在原地等它回来。"
      }),
      eventOption({
        "label": "把窝往里推半米（最大生命 +14）",
        "tone": "good",
        "text": "你小心地把窝推进岩壁的凹处，风正好绕开。做完之后，你觉得自己站得也稳了一点。\n「这样就吹不到啦。」\n最大生命 +14。",
        "effects": [
          {
            "stat": {
              "maxHp": 14
            }
          }
        ],
        "hint": "把窝往里推半米。"
      }),
    ]
  },
  {
    "id": "cliff_glide_line",
    "name": "滑翔线",
    "biome": "cliff",
    "text": "从这处岩架到下一条山脊之间全是空的。风在中间拉出一道看不见的线，线很直。\n「诶，这条线是给谁留的？」",
    "options": [
      eventOption({
        "label": "顺着那条线滑过去（-12 HP，敏捷 +5）",
        "tone": "good",
        "text": "你贴着风线飞过去，落地时磕了一下膝盖。但这条线你记住了，以后不用再找。\n「膝盖疼……但是飞得超爽♪」\nHP -{hp}，敏捷 +5。",
        "effects": [
          {
            "hp": -12
          },
          {
            "stat": {
              "agi": 5
            }
          }
        ],
        "hint": "顺着那条线滑过去！"
      }),
      eventOption({
        "label": "先扔一块石头试试风（幸运 +2）",
        "tone": "good",
        "text": "石头掉下去的时候没有声音。你等了三秒才听见它到地。你决定今天不飞。\n「唔……今天风心情不好呀。」\n幸运 +2。",
        "effects": [
          {
            "stat": {
              "luck": 2
            }
          }
        ],
        "hint": "先扔块石头试试风。"
      }),
      eventOption({
        "label": "绕到山脊上去（回复 30 HP）",
        "tone": "good",
        "text": "你绕了很远，累得不轻，但在山脊上找到一处背风的凹槽，睡了一觉。\n「绕路也有绕路的好嘛。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 30
          }
        ],
        "hint": "老老实实绕上去。"
      }),
    ]
  },
  {
    "id": "cliff_scree_slope",
    "name": "碎石坡",
    "biome": "cliff",
    "text": "一整面碎石坡，脚一放上去石头就开始往下走。坡底堆着从上面掉下来的一切。\n「诶，下面好像有东西在反光。」",
    "options": [
      eventOption({
        "label": "顺着坡滑下去（-15 HP，获得 1 张卡）",
        "tone": "neutral",
        "text": "你滑到底，被石头埋到腰。扒出来的时候手里攥着一张卡 —— 不知道是谁的。\n「呸呸呸……不过这趟不亏。」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "hp": -15
          },
          {
            "cardRandom": 0.4
          }
        ],
        "hint": "滑下去！（有点快）"
      }),
      eventOption({
        "label": "在坡底翻一翻（获得金币）",
        "tone": "good",
        "text": "坡底什么都有：旧行囊、断掉的爪子、还有一个没散开的钱袋。\n「哟，这个还能用。」\n金币 +{gold}。",
        "effects": [
          {
            "goldRange": [
              30,
              75
            ]
          }
        ],
        "hint": "在坡底翻一翻。"
      }),
      eventOption({
        "label": "踩稳了横着走（防御 +3）",
        "tone": "good",
        "text": "你把重心放到最低，一步一步横过去。石头在你脚边滚，一块都没被你带下去。\n「看，稳吧。」\n防御 +3。",
        "effects": [
          {
            "stat": {
              "def": 3
            }
          }
        ],
        "hint": "踩稳了横着走。"
      }),
    ]
  },
  {
    "id": "cliff_vulture_debt",
    "name": "秃鹫娜的账",
    "biome": "cliff",
    "text": "一只秃鹫娜站在岩尖上等你走近。它开口就说：「你上次欠我的。」你不记得有这回事。\n「诶？我有欠过吗……？」",
    "options": [
      eventOption({
        "label": "付钱（-45 金币，获得 1 张稀有卡）",
        "tone": "good",
        "text": "你开始掏钱。",
        "effects": [
          {
            "if": {
              "goldAtLeast": 45
            },
            "then": {
              "tone": "good",
              "text": "它叼走钱，从翅膀底下抖出一张卡给你：「清了，下次记得。」\n「唔……下次我一定记着呀。」\n金币 -45，获得「{card}」。",
              "effects": [
                {
                  "gold": -45
                },
                {
                  "cardRarity": {
                    "rarities": [
                      "rare"
                    ]
                  }
                }
              ]
            },
            "else": {
              "tone": "neutral",
              "text": "你掏了半天也凑不出四十五。它盯着你看了很久，然后说：「那就先记着。」\n「诶 —— 还要记账的吗？！」\n（它记得比你还清楚。）",
              "effects": []
            }
          }
        ],
        "hint": "算了，给它吧。"
      }),
      eventOption({
        "label": "跟它讨价还价（-12 HP，幸运 +2）",
        "tone": "neutral",
        "text": "它啄了你一下当利息，然后同意把账抹平。你觉得这买卖还行。\n「疼！……不过算啦，扯平了。」\nHP -{hp}，幸运 +2。",
        "effects": [
          {
            "hp": -12
          },
          {
            "stat": {
              "luck": 2
            }
          }
        ],
        "hint": "跟它讲讲价。"
      }),
      eventOption({
        "label": "说你不认识它",
        "tone": "neutral",
        "text": "「哦，」它说，「那大概是别的沙漠蜻蜓。」它转过头去看风了。\n「嗯嗯，肯定不是我。」你飞快地走了。",
        "effects": [],
        "hint": "装不认识。"
      }),
    ]
  },
  {
    "id": "cliff_carved_wall",
    "name": "刻满沟的岩壁",
    "biome": "cliff",
    "text": "一整面岩壁被风刻成一条条平行的沟，深的地方能塞进你半个人。沟底有东西在反光。\n「诶 —— 是谁刻的呀？好整齐。」",
    "options": [
      eventOption({
        "label": "沿着沟爬到顶（-18 HP，最大生命 +18）",
        "tone": "good",
        "text": "你顺着最宽的那条沟往上爬，指爪磨得发烫。爬到顶的时候，你觉得自己比上来之前大了一圈。\n「到啦 —— ！……手好疼。」\nHP -{hp}，最大生命 +18。",
        "effects": [
          {
            "hp": -18
          },
          {
            "stat": {
              "maxHp": 18
            }
          }
        ],
        "hint": "沿着沟爬到顶！"
      }),
      eventOption({
        "label": "掏沟底反光的东西（获得 1 张卡）",
        "tone": "good",
        "text": "是一块被风磨了几百年的卡形石头，翻过来居然真的能当卡用。\n「石头也是卡呀。」\n获得「{card}」。",
        "effects": [
          {
            "cardRarity": {
              "rarities": [
                "rare",
                "epic"
              ],
              "boost": 0.3
            }
          }
        ],
        "hint": "掏掏沟底那个反光的。"
      }),
      eventOption({
        "label": "用翅膀打沟壁（攻击 +3，-8 HP）",
        "tone": "neutral",
        "text": "你打了几十下，岩壁没什么变化，你的翅膀倒是学会怎么更用力了。\n「哼，我记住你啦！」\nHP -{hp}，攻击 +3。",
        "effects": [
          {
            "hp": -8
          },
          {
            "stat": {
              "atk": 3
            }
          }
        ],
        "hint": "用翅膀打打看。"
      }),
    ]
  },
  {
    "id": "cliff_updraft",
    "name": "上升气流",
    "biome": "cliff",
    "text": "岩壁拐角处有一股一直在往上抬的气流。你把爪子伸进去，它就把你抬起来一寸。\n「诶 —— 这个好玩！」",
    "options": [
      eventOption({
        "label": "乘上去升到顶（敏捷 +4，-14 HP）",
        "tone": "good",
        "text": "你被抬到岩壁顶上，冷得发抖。但下来的时候你几乎不用扇翅膀。\n「上面好冷！但是省力。」\nHP -{hp}，敏捷 +4。",
        "effects": [
          {
            "hp": -14
          },
          {
            "stat": {
              "agi": 4
            }
          }
        ],
        "hint": "乘上去升到顶。"
      }),
      eventOption({
        "label": "把气流当被子睡一会儿（回复 40 HP）",
        "tone": "good",
        "text": "气流是暖的，像有人在下面一直托着你。你睡了半小时，梦里一直在飞，一次都没落下来。\n「唔……真舒服呀。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 40
          }
        ],
        "hint": "把它当被子睡一会儿。"
      }),
      eventOption({
        "label": "从顶上看看后面的路（获得 1 张卡）",
        "tone": "good",
        "text": "你从顶上看见了后面该走的整条路。看完之后，那条路线在你手里变成了一张卡。\n「记下来记下来。」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.35
          }
        ],
        "hint": "从顶上看看后面的路。"
      }),
    ]
  },
  {
    "id": "cliff_rockfall",
    "name": "落石",
    "biome": "cliff",
    "text": "头顶传来一连串闷响。你抬头，半面坡正在往下走，走得不快，但你跑不过它。\n「诶诶诶 ——！」",
    "options": [
      eventOption({
        "label": "往岩缝里挤（-10 HP，防御 +4）",
        "tone": "good",
        "text": "石头从你旁边过去了，最大的那块擦掉了你一层壳。你挤在缝里，觉得自己像个楔子。\n「呼……差点就变成扁的了。」\nHP -{hp}，防御 +4。",
        "effects": [
          {
            "hp": -10
          },
          {
            "stat": {
              "def": 4
            }
          }
        ],
        "hint": "往岩缝里挤！"
      }),
      eventOption({
        "label": "飞出去接住那块石头（-20 HP，攻击 +6）",
        "tone": "neutral",
        "text": "你用身体顶住了一块，它没砸到路。你的肩膀到现在还在响。\n「看！我接住啦……疼疼疼。」\nHP -{hp}，攻击 +6。",
        "effects": [
          {
            "hp": -20
          },
          {
            "stat": {
              "atk": 6
            }
          }
        ],
        "hint": "飞出去接住它！"
      }),
      eventOption({
        "label": "躲在岩架下面等它过（回复 30 HP）",
        "tone": "good",
        "text": "你在岩架下面蹲了二十分钟，把落石的声音从头听到尾。像一场很吵的雨。\n「唔……听久了还挺好听的呀。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 30
          }
        ],
        "hint": "躲到岩架下面等它过。"
      }),
    ]
  },
  {
    "id": "common_lost_pack",
    "name": "遗落的行囊",
    "text": "一个行囊挂在路边的石头上，带子系得很整齐。主人应该没走远 —— 但周围一个脚印都没有。\n「唔……这算有人要的，还是没人要的？」",
    "options": [
      eventOption({
        "label": "打开看看（获得道具与金币）",
        "tone": "good",
        "text": "里面有半袋钱和一瓶还没开封的药。你按原样把钱袋口系了回去，然后又解开。\n「我先借用一下。下次见到你再还。」\n金币 +{gold}，获得{item} ×1。",
        "effects": [
          {
            "goldRange": [
              20,
              55
            ]
          },
          {
            "item": "potion_small"
          }
        ],
        "hint": "打开看看嘛。"
      }),
      eventOption({
        "label": "在原地等主人回来（回复 35 HP，幸运 +2）",
        "tone": "good",
        "text": "你等了半天，没人来。你靠着行囊睡了一觉，醒来的时候觉得心里轻了一点。\n「睡在别人的包上，好像有点不好意思呀。」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "hp": 35
          },
          {
            "stat": {
              "luck": 2
            }
          }
        ],
        "hint": "说不定主人只是去打水了。"
      }),
      eventOption({
        "label": "原样挂回去，走人",
        "tone": "neutral",
        "text": "你把带子重新系紧，往石头里面推了推，这样下雨也不会湿。然后你走了。\n「帮你挂高一点。」",
        "effects": [],
        "hint": "算了，不是我的东西。"
      }),
    ]
  },
  {
    "id": "common_roadside_shrine",
    "name": "路边的小祠",
    "text": "一个用石头垒起来的小祠，里面放着一枚硬币、一颗牙和一张画着什么的纸。纸已经看不清了。\n「诶……这是谁放在这儿的？」",
    "options": [
      eventOption({
        "label": "放一枚硬币进去（-20 金币，幸运 +4）",
        "tone": "good",
        "text": "你把手伸进口袋摸了摸。",
        "effects": [
          {
            "if": {
              "goldAtLeast": 20
            },
            "then": {
              "tone": "good",
              "text": "硬币滑到底下，发出很轻的一声，像有人在里面接住了它。\n「请保佑我一路平安。」\n金币 -20，幸运 +4。",
              "effects": [
                {
                  "gold": -20
                },
                {
                  "stat": {
                    "luck": 4
                  }
                }
              ]
            },
            "else": {
              "tone": "neutral",
              "text": "你摸遍全身也凑不出二十金币。小祠里静了一会儿，好像本来就没指望你。\n「唔……下次一定补上呀。」",
              "effects": []
            }
          }
        ],
        "hint": "身上正好有一枚。"
      }),
      eventOption({
        "label": "借走那颗牙（获得锐爪护符 ×1）",
        "tone": "good",
        "text": "牙很旧，但磨一磨还能用。你拿的时候说了声「借」，虽然没人听。\n「用完会还的。大概。」\n获得{item} ×1。",
        "effects": [
          {
            "item": "charm_atk"
          }
        ],
        "hint": "说一声「借」就好啦。"
      }),
      eventOption({
        "label": "拜一下就走",
        "tone": "neutral",
        "text": "你没带钱，也没伸手。你低头站了一会儿就走了。风把你身后的那张纸吹得响了一下。\n「打扰啦。」",
        "effects": [],
        "hint": "唔，还是别乱动别人的东西。"
      }),
    ]
  },
  {
    "id": "common_warm_spring",
    "name": "温热的水洼",
    "text": "一洼水在石头中间冒着热气。水边有别人留下的脚印，一路走进水里，然后就断了。\n「诶……脚印呢？」",
    "options": [
      eventOption({
        "label": "泡进去（回复 50 HP）",
        "tone": "good",
        "text": "水很烫，烫得正好。你泡到指爪发皱才肯出来，出来的时候腿有点软。\n「唔 —— 舒服♪」\nHP +{heal}。",
        "effects": [
          {
            "hp": 50
          }
        ],
        "hint": "泡到起皱为止。"
      }),
      eventOption({
        "label": "潜下去看看（50% 获得卡 / 50% -16 HP）",
        "tone": "neutral",
        "text": "你吸了口气，往下潜。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "水底有个被石头压住的铁盒，里面有一张居然还干着的卡。\n「居然没湿。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRandom": 0.4
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "水底比你想的深，也比你想的冷。你摸到一只手，不是你的。你拼了命往上蹬。\n「哇啊啊 —— 对不起打扰了！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -16
                  }
                ]
              }
            ]
          }
        ],
        "hint": "潜下去看看？"
      }),
      eventOption({
        "label": "灌两瓶带走（获得好伤药 ×2）",
        "tone": "good",
        "text": "热水在瓶里先变温，再变凉。但味道和刚舀起来的时候一样。\n「路上喝。」\n获得{item} ×2。",
        "effects": [
          {
            "item": {
              "id": "potion_small",
              "n": 2
            }
          }
        ],
        "hint": "灌两瓶带走。"
      }),
    ]
  },
  {
    "id": "common_old_battlefield",
    "name": "打过一场的地方",
    "text": "地上有翅膀划出来的沟，有碎掉的卡，还有几片指甲盖大的甲壳。打得很凶，赢的那个也没回来。\n「唔……这里打过很凶的一场。」",
    "options": [
      eventOption({
        "label": "翻找还能用的东西（获得 1 张卡，-10 HP）",
        "tone": "neutral",
        "text": "你在碎卡里找到一张完整的，也顺手把手掌划开了。\n「疼！……不过值啦。」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "hp": -10
          },
          {
            "cardRandom": 0.3
          }
        ],
        "hint": "翻翻还有没有能用的。"
      }),
      eventOption({
        "label": "把碎卡埋起来（幸运 +3）",
        "tone": "good",
        "text": "你花了一刻钟把碎片堆成一堆，盖上土和石头。走的时候，你觉得自己欠这里的东西少了一点。\n「安息。」\n幸运 +3。",
        "effects": [
          {
            "stat": {
              "luck": 3
            }
          }
        ],
        "hint": "把碎片埋起来吧。"
      }),
      eventOption({
        "label": "顺着沟研究它怎么打的（攻击 +2，敏捷 +2）",
        "tone": "good",
        "text": "沟的方向说明它冲得比你狠。你照着那个角度比了几次，记住了。\n「原来要这样用力……学会啦。」\n攻击 +2，敏捷 +2。",
        "effects": [
          {
            "stat": {
              "atk": 2,
              "agi": 2
            }
          }
        ],
        "hint": "研究一下它是怎么打的。"
      }),
    ]
  },
  {
    "id": "common_fallen_star",
    "name": "还热着的星屑",
    "text": "一颗星屑插在地里，还在冒烟。周围的石头被烫出了裂纹，裂纹的方向全朝着它。\n「哇……是从天上掉下来的！」",
    "options": [
      eventOption({
        "label": "用爪子把它挖出来（-14 HP，获得 1 张史诗卡）",
        "tone": "good",
        "text": "它比看上去烫得多。你把它挖出来的时候，它已经变成了一张卡的样子，还在冒气。\n「烫烫烫！……但是好漂亮。」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "hp": -14
          },
          {
            "cardRarity": {
              "rarities": [
                "epic"
              ],
              "boost": 0.4
            }
          }
        ],
        "hint": "挖出来看看！"
      }),
      eventOption({
        "label": "等它凉下来（回复 25 HP，幸运 +2）",
        "tone": "good",
        "text": "你坐在旁边，看它从白变红再变黑。天黑下来的时候，头顶那些星星很好看。\n「唔……你们是一起的吗？」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "hp": 25
          },
          {
            "stat": {
              "luck": 2
            }
          }
        ],
        "hint": "等它凉下来。"
      }),
      eventOption({
        "label": "绕开它",
        "tone": "neutral",
        "text": "你不碰它。第二天你再路过那块地的时候，它已经塌成一个坑了。\n「唔……还好没碰呀。」",
        "effects": [],
        "hint": "……还是绕开吧。"
      }),
    ]
  },
  {
    "id": "common_stray_egg",
    "name": "没人管的蛋",
    "text": "一枚蛋放在路中间一块平石头上，像是有人特意放的。蛋壳是热的，石头是凉的。\n「诶？谁把你放在这儿的？」",
    "options": [
      eventOption({
        "label": "揣在怀里带走（最大生命 +12，幸运 +2）",
        "tone": "good",
        "text": "你把它揣了一整段路，一直暖着。它没孵，但你走路的时候腰上多了一点分量，心里也是。\n「乖乖的，我带你出去。」\n最大生命 +12，幸运 +2。",
        "effects": [
          {
            "stat": {
              "maxHp": 12,
              "luck": 2
            }
          }
        ],
        "hint": "揣着走。"
      }),
      eventOption({
        "label": "在旁边守着它（回复 30 HP）",
        "tone": "good",
        "text": "你守着它睡了一夜。天亮的时候蛋还是热的，连石头也热了。\n「早安呀。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 30
          }
        ],
        "hint": "守着它。"
      }),
      eventOption({
        "label": "敲开看一眼（50% 获得卡 / 50% -18 HP）",
        "hint": "……敲开看一眼？",
        "tone": "neutral",
        "text": "你用爪尖敲了敲，壳比想的脆。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "里面没有小东西，只有一卷用壳膜包着的招式，还有一张卡。\n「诶……是招式，不是小宝宝。那就收下咯。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRandom": 0.5
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "里面是一窝被激怒的蜂。你跑得比这辈子任何时候都快。\n「对不起对不起对不起呀 ——！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -18
                  }
                ]
              }
            ]
          }
        ]
      }),
    ]
  },
  {
    "id": "forest_vine_wall",
    "name": "藤蔓墙",
    "biome": "forest",
    "text": "一堵藤蔓从地面长到看不见顶的地方，把路整个吃掉了。你敲了敲，里面传出很轻的、像有人在换气的声音。\n「唔……里面是活的。」",
    "options": [
      eventOption({
        "label": "硬扯开一条缝（-14 HP，攻击 +4）",
        "hint": "硬扯开一条缝！",
        "tone": "neutral",
        "text": "你抓着藤蔓往外撕，倒刺刮得你满手是伤。墙后面确实是路 —— 还有一大堆被你惊起来的飞虫。\n「疼疼疼！……不过路通啦。」\nHP -{hp}，攻击 +4。",
        "effects": [
          {
            "hp": -14
          },
          {
            "stat": {
              "atk": 4
            }
          }
        ]
      }),
      eventOption({
        "label": "顺着藤蔓爬到顶上（最大生命 +16）",
        "hint": "顺着藤蔓爬到顶上。",
        "tone": "good",
        "text": "你一直爬到能看见整片林子的高度，发现路其实是一圈一圈绕的。你在上面把那圈看完了。\n「原来是这样绕的呀。记下来咯。」\n最大生命 +16。",
        "effects": [
          {
            "stat": {
              "maxHp": 16
            }
          }
        ]
      }),
      eventOption({
        "label": "绕过去",
        "hint": "绕过去吧。",
        "tone": "neutral",
        "text": "你从墙的侧面绕，多走了半天。藤蔓在你身后慢慢合拢，声音像有人咽了口口水。\n「唔……总觉得它在看我。」",
        "effects": []
      }),
    ]
  },
  {
    "id": "forest_glowcap",
    "name": "发光的蘑菇圈",
    "biome": "forest",
    "text": "一圈蘑菇在腐叶里发光，光是一跳一跳的，节奏很像心跳。圈中间的地面比别处软。\n「诶……这个光是在跟我打招呼吗？」",
    "options": [
      eventOption({
        "label": "站到圈中间（50% 幸运 +4 / 50% -18 HP）",
        "hint": "站到圈中间去。",
        "tone": "neutral",
        "text": "你走进圈里，光把你围起来了。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "光整个冲你亮了一下，有东西从你身上穿过去，不疼，还带走了点累。\n「哇……谢谢呀。」\n幸运 +4。",
                "effects": [
                  {
                    "stat": {
                      "luck": 4
                    }
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "光突然全灭了。你脚下的地面塌下去，一堆菌丝缠住你的腿往里拉。你自己爬出来的。\n「呜哇 —— 放开我！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -18
                  }
                ]
              }
            ]
          }
        ]
      }),
      eventOption({
        "label": "摘几朵吃（回复 30 HP）",
        "tone": "good",
        "text": "味道像湿木头。但胃里暖起来了，一路暖到翅膀根。\n「唔，不好吃……但是很暖。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 30
          }
        ],
        "hint": "摘几朵尝尝。"
      }),
      eventOption({
        "label": "串起来挂在脖子上（获得幸运护符 ×1）",
        "tone": "good",
        "text": "它们被你串成一圈挂在脖子上，走了很久都不灭。\n「好看吧？我自己做的。」\n获得{item} ×1。",
        "effects": [
          {
            "item": "charm_luck"
          }
        ],
        "hint": "串起来挂脖子上。"
      }),
    ]
  },
  {
    "id": "forest_canopy_gap",
    "name": "树冠的破洞",
    "biome": "forest",
    "text": "头顶的叶子裂开一个洞，一小块天空直直砸下来，落在落叶上。你已经很久没见过这么亮的东西了。\n「呀，是太阳！好久不见啦。」",
    "options": [
      eventOption({
        "label": "趴在光里晒一会儿（回复 40 HP）",
        "tone": "good",
        "text": "你摊开翅膀，把每一块甲片都翻到光下面，像在翻一堆湿掉的东西。\n「唔 —— 好暖和。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 40
          }
        ],
        "hint": "趴在光里晒一会儿。"
      }),
      eventOption({
        "label": "从洞口冲出去看一眼（幸运 +3，-16 HP）",
        "hint": "冲出去看一眼外面！",
        "tone": "neutral",
        "text": "你笔直往上飞，撞开枝条扎出去，看见了外面那片熟悉的黄。然后被树枝抽了回来。\n「诶！外面还是沙……疼。」\nHP -{hp}，幸运 +3。",
        "effects": [
          {
            "hp": -16
          },
          {
            "stat": {
              "luck": 3
            }
          }
        ]
      }),
      eventOption({
        "label": "在光斑上整理卡组（获得 1 张卡）",
        "tone": "good",
        "text": "光正好够看清卡面。你重新排了一遍顺序，顺手记住了一张新的。\n「这样清楚多啦。」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.3
          }
        ],
        "hint": "趁着亮整理卡组。"
      }),
    ]
  },
  {
    "id": "forest_leaf_litter",
    "name": "腐叶层",
    "biome": "forest",
    "text": "脚下的落叶堆到膝盖，每一步都往下陷一点，还带着温度 —— 像踩在什么活的东西上面。\n「唔……这个温度不太对劲呀。」",
    "options": [
      eventOption({
        "label": "往里挖（55% 获得道具 / 45% -20 HP）",
        "tone": "neutral",
        "text": "你开始刨，叶子下面的土是热的。",
        "effects": [
          {
            "branch": [
              {
                "weight": 55,
                "tone": "good",
                "text": "底下是一堆蛋壳，壳里塞着别人藏起来的药，居然还没坏。\n「谁藏的？我先借走咯。」\n获得{item} ×1。",
                "effects": [
                  {
                    "item": "potion_big"
                  }
                ]
              },
              {
                "weight": 45,
                "tone": "bad",
                "text": "你挖到一只正在睡觉的大甲。它没醒，但它夹了你一下，又睡了。\n「疼！……对不起呀，你继续睡。」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -20
                  }
                ]
              }
            ]
          }
        ],
        "hint": "往里挖挖看。"
      }),
      eventOption({
        "label": "踩实了快走过去（敏捷 +3）",
        "tone": "good",
        "text": "你每一步都先试探再落下，走到对面的时候，脚步轻得自己都吃惊。\n「看，一点声音都没有。」\n敏捷 +3。",
        "effects": [
          {
            "stat": {
              "agi": 3
            }
          }
        ],
        "hint": "踩实了快走过去。"
      }),
      eventOption({
        "label": "在叶子里打个滚（幸运 +1）",
        "hint": "打个滚。",
        "tone": "good",
        "text": "你滚了两圈，起来的时候身上挂满碎叶和一只不认识的虫。它跟着你走了很久。\n「诶？你要跟我一起走吗？」\n幸运 +1。",
        "effects": [
          {
            "stat": {
              "luck": 1
            }
          }
        ]
      }),
    ]
  },
  {
    "id": "forest_bug_chorus",
    "name": "虫鸣",
    "biome": "forest",
    "text": "整片林子的虫同时开始叫。声音大到听不见自己在想什么。叫到一半，它们全停了。\n「诶，怎么突然安静了？」",
    "options": [
      eventOption({
        "label": "跟着叫一声（幸运 +2，回复 20 HP）",
        "tone": "good",
        "text": "你发出一个自己都陌生的声音。虫群接住了它，然后又一起叫起来，把你盖在里面。\n「诶 —— 我也可以唱得这么响呀。」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "stat": {
              "luck": 2
            }
          },
          {
            "hp": 20
          }
        ],
        "hint": "跟着叫一声！"
      }),
      eventOption({
        "label": "趁它们停的时候听（获得 1 张卡）",
        "tone": "good",
        "text": "安静的那几秒里，你听见很远的地方有人在念一个名字。念完之后你手里多了一张卡。\n「唔……是我的名字吗？」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.4
          }
        ],
        "hint": "趁安静的时候听。"
      }),
      eventOption({
        "label": "捂住耳朵赶路（防御 +2）",
        "tone": "good",
        "text": "你把耳朵折到甲壳底下，一路走到林子深处。什么也没听见，什么也没被咬。\n「唔……什么都听不到，有点无聊。」\n防御 +2。",
        "effects": [
          {
            "stat": {
              "def": 2
            }
          }
        ],
        "hint": "捂住耳朵赶路。"
      }),
    ]
  },
  {
    "id": "forest_hollow_trunk",
    "name": "空心的巨树",
    "biome": "forest",
    "text": "一棵倒了很久的树，树干空成一条走廊。里面黑得很整齐，风穿过去的时候会响。\n「呜……里面好黑呀。」",
    "options": [
      eventOption({
        "label": "钻进去走到头（60% 获得卡 / 40% -22 HP）",
        "tone": "neutral",
        "text": "你低头钻进树干，里面比外面凉很多。",
        "effects": [
          {
            "branch": [
              {
                "weight": 60,
                "tone": "good",
                "text": "走廊尽头堆着别人的旧东西，其中一张卡还完好无损。\n「这个我收下啦。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRarity": {
                      "rarities": [
                        "rare",
                        "epic"
                      ],
                      "boost": 0.4
                    }
                  }
                ]
              },
              {
                "weight": 40,
                "tone": "bad",
                "text": "你走到一半，树干深处的东西醒了，从后面把你往外推。你是被倒着吐出来的。\n「呜哇 —— 我自己会走！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -22
                  }
                ]
              }
            ]
          }
        ],
        "hint": "钻进去走到头！"
      }),
      eventOption({
        "label": "刨开树皮（防御 +4）",
        "tone": "good",
        "text": "刨开的木屑里混着硬得像石头的老树脂，你顺手抹在甲壳上，干得很快。\n「这个好用。」\n防御 +4。",
        "effects": [
          {
            "stat": {
              "def": 4
            }
          }
        ],
        "hint": "刨开树皮看看。"
      }),
      eventOption({
        "label": "在树洞里过一夜（回复 45 HP）",
        "tone": "good",
        "text": "你把洞口堵了一半，睡了一整夜，梦见水，还有别的会飞的东西。\n「唔……梦到好大的水呀。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 45
          }
        ],
        "hint": "在树洞里过一夜。"
      }),
    ]
  },
  {
    "id": "forest_sap_trap",
    "name": "树胶",
    "biome": "forest",
    "text": "一大摊琥珀色的树胶从枝上垂下来，里面封着翅膀、壳，还有一只你认不出的手。\n「诶……这些是以前的人吗？」",
    "options": [
      eventOption({
        "label": "把手伸进去捞（50% 获得卡 / 50% -20 HP）",
        "tone": "neutral",
        "text": "你选了个看起来最浅的地方下手。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "你捞出一块被封住的石板，上面是一整套完整的动作。你把它读完了。\n「学会啦 谢谢你。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRarity": {
                      "rarities": [
                        "rare",
                        "epic"
                      ]
                    }
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "树胶比你想的黏得多。你抽手的时候，把自己的一层甲皮留在了里面。\n「呜！我的皮 ——！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -20
                  }
                ]
              }
            ]
          }
        ],
        "hint": "伸手进去捞捞看。"
      }),
      eventOption({
        "label": "敲一块凝固的带走（获得硬壳护符 ×1）",
        "tone": "good",
        "text": "凝了很久的树胶硬得能当盾牌使，敲下来的时候还带着一只虫的轮廓。\n「好硬！这个当护符不错。」\n获得{item} ×1。",
        "effects": [
          {
            "item": "charm_def"
          }
        ],
        "hint": "敲一块凝固的带走。"
      }),
      eventOption({
        "label": "从底下侧身绕过去",
        "tone": "neutral",
        "text": "有只虫子在胶里看着你，眼神像在求你。你没停。你走得很快，一直到听不见那声音。\n「对不起呀……我帮不了你。」",
        "effects": [],
        "hint": "……绕过去吧。"
      }),
    ]
  },
  {
    "id": "forest_seed_pod",
    "name": "会弹的种子",
    "biome": "forest",
    "text": "一颗比你头还大的种子躺在地上，壳上已经裂开一条缝。缝里在往外冒热气。\n「诶，它在冒烟。是不是要炸了？」",
    "options": [
      eventOption({
        "label": "掰开它（攻击 +5，-12 HP）",
        "tone": "neutral",
        "text": "种子炸了，弹片和种子雨一起砸在你脸上。但里面那块硬得像爪子的东西，很合手。\n「呜哇 —— ！……不过这个好顺手。」\nHP -{hp}，攻击 +5。",
        "effects": [
          {
            "hp": -12
          },
          {
            "stat": {
              "atk": 5
            }
          }
        ],
        "hint": "掰开它！"
      }),
      eventOption({
        "label": "掏空当背包（获得好伤药 ×2）",
        "tone": "good",
        "text": "你把种子里原来的果肉晒干了，居然能当药。壳背上还能挡雨。\n「哟，一物两用。我厉害吧。」\n获得{item} ×2。",
        "effects": [
          {
            "item": {
              "id": "potion_small",
              "n": 2
            }
          }
        ],
        "hint": "掏空当背包。"
      }),
      eventOption({
        "label": "踢一脚就走",
        "tone": "neutral",
        "text": "你踢了它一下，它在原地晃了晃，没炸。你走出很远才听见它炸。\n「诶 —— 我刚才踢的是这个吗？」",
        "effects": [],
        "hint": "踢一脚就走。"
      }),
    ]
  },
  {
    "id": "lost_trainer",
    "name": "迷路的旅行者",
    "text": "沙丘阴影里坐着一个人，正把水壶倒过来抖最后两滴。他抬头看你：「你也是来送死的？」\n「我是来玩的。」你抖了抖翅膀上的沙。",
    "options": [
      eventOption({
        "label": "分给他半壶水（-15 HP）",
        "hint": "看他渴成这样，实在不忍心。",
        "tone": "good",
        "text": "你把水递过去。他一口气喝光，然后塞给你一袋金币：「前面第三座沙丘，绕左边。」\n「谢了。你也早点找到水。」\nHP -{hp}，金币 +{gold}。",
        "effects": [
          {
            "hp": -15
          },
          {
            "gold": 45
          }
        ]
      }),
      eventOption({
        "label": "问他沙漠里的传闻（抽 1 张卡）",
        "hint": "话匣子一开就收不住。",
        "tone": "good",
        "text": "「沙子底下埋着会走的东西。」他说完就睡了。你在他行囊里翻到一张卡，就当情报费吧。\n获得卡牌「{card}」。",
        "effects": [
          {
            "cardRandom": 0
          }
        ]
      }),
      eventOption({
        "label": "继续赶路",
        "hint": "不关你的事。",
        "tone": "neutral",
        "text": "你从旁边绕过去。他在背后喊了句什么，被风吃掉了。\n「下次记得带水呀。」你回头喊了一声。",
        "effects": []
      }),
    ]
  },
  {
    "id": "sand_pit",
    "name": "流沙坑",
    "text": "脚下的沙忽然开始往下走。你展开翅膀 —— 沙子抓住了你的尾尖。",
    "options": [
      eventOption({
        "label": "用力振翅冲出去（-10 HP）",
        "hint": "硬来。",
        "tone": "neutral",
        "text": "你把自己从沙里拔出来，翅膀酸得要命。但坑底躺着一张卡。\n「……不亏。」\nHP -{hp}，获得「电光一闪」。",
        "effects": [
          {
            "hp": -10
          },
          {
            "card": "quick_attack"
          }
        ]
      }),
      eventOption({
        "label": "顺着沙流滑下去（敏捷 +2）",
        "hint": "那就顺着它走。",
        "tone": "good",
        "text": "你放松下来，沙流把你送到坑底的一个洞穴。出口在很远的另一边。\n「比飞还快。」\n敏捷 +2。",
        "effects": [
          {
            "stat": {
              "agi": 2
            }
          }
        ]
      }),
    ]
  },
  {
    "id": "cactus",
    "name": "沙铃仙人掌",
    "text": "一株沙铃仙人掌转过来对着你，晃了晃手里的沙铃：「要刺吗？刚长的。」",
    "options": [
      eventOption({
        "label": "要（获得 1 张稀有卡，-12 HP）",
        "hint": "扎手也认了。",
        "tone": "good",
        "text": "你摘了一根。它看起来很满意，顺手又摇了一下沙铃。\n「谢啦～」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "cardRarity": {
              "rarities": [
                "rare",
                "epic"
              ]
            }
          },
          {
            "hp": -12
          }
        ]
      }),
      eventOption({
        "label": "不要（防御 +3）",
        "hint": "礼貌地摇摇翅膀。",
        "tone": "good",
        "text": "「聪明。」它说完就继续晒太阳了。你摸了摸自己的甲壳，好像硬了一点。\n防御 +3。",
        "effects": [
          {
            "stat": {
              "def": 3
            }
          }
        ]
      }),
    ]
  },
  {
    "id": "old_cache",
    "name": "半埋的补给箱",
    "text": "一个锈掉的箱子露出一角，锁早就烂了。\n「这个能开吧？」",
    "options": [
      eventOption({
        "label": "打开（获得道具与金币）",
        "tone": "good",
        "text": "里面是几瓶还算完好的药和一个钱袋。\n「今天运气不错。」\n金币 +{gold}，获得{item} ×1。",
        "effects": [
          {
            "goldRange": [
              25,
              60
            ]
          },
          {
            "item": "potion_small"
          }
        ],
        "hint": "开！"
      }),
      eventOption({
        "label": "箱子底下有东西在动（查看）",
        "tone": "neutral",
        "text": "你把手伸进去。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "你把箱子掀开，一只沙鼠窜了出去。它窝里堆着一瓶高级伤药。\n「打扰了，这个我拿走。」\n获得{item} ×1。",
                "effects": [
                  {
                    "item": "potion_big"
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "neutral",
                "text": "是一只被惊动的穿山鼠。它先咬了你一口，然后叼着金币跑了 —— 不过钱袋掉了一半下来。\n「疼。不过钱还在，算你输。」\nHP -{hp}，金币 +{gold}。",
                "effects": [
                  {
                    "hp": -18
                  },
                  {
                    "gold": 80
                  }
                ]
              }
            ]
          }
        ],
        "hint": "诶，里面有东西在动。"
      }),
      eventOption({
        "label": "不碰（幸运 +1）",
        "tone": "good",
        "text": "沙漠里半埋的箱子十有八九是陷阱。你绕着走，感觉自己做对了。\n「忍住不看也是本事。」\n幸运 +1。",
        "effects": [
          {
            "stat": {
              "luck": 1
            }
          }
        ],
        "hint": "沙漠里的箱子十个有九个是坑。"
      }),
    ]
  },
  {
    "id": "singing_sand",
    "name": "会唱歌的沙丘",
    "text": "风吹过沙丘顶，沙子发出很像歌声的嗡鸣。\n「唔……这个调子我会呀。」",
    "options": [
      eventOption({
        "label": "回应它（幸运 +2，回复 20 HP）",
        "tone": "good",
        "text": "你振动翅膀，和沙丘合了个音。整片沙原安静了一瞬，然后风都变得温柔了。\n「好听吧？我练过的♪」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "stat": {
              "luck": 2
            }
          },
          {
            "hp": 20
          }
        ],
        "hint": "跟着唱！"
      }),
      eventOption({
        "label": "不理它（获得 1 张卡）",
        "tone": "neutral",
        "text": "你捂住耳朵往前走。声音在身后变成一句听不懂的话。\n「唔，好像有点对不起它。」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.3
          }
        ],
        "hint": "捂住耳朵快走。"
      }),
    ]
  },
  {
    "id": "mirror_pool",
    "name": "绿洲镜池",
    "text": "一汪静水映出你的样子 —— 但它比你大得多，而且眼睛是红的。\n「诶？我没这么大。」",
    "options": [
      eventOption({
        "label": "盯着它（攻击 +4）",
        "tone": "good",
        "text": "水里的那个东西先移开了视线。\n「哼，先眨眼的是你。」\n攻击 +4。",
        "effects": [
          {
            "stat": {
              "atk": 4
            }
          }
        ],
        "hint": "盯回去，谁先移开谁输。"
      }),
      eventOption({
        "label": "喝一口（回复 45 HP）",
        "tone": "good",
        "text": "水很甜，甜得不太对劲。但身体确实舒服了。\n「唔……应该没毒吧。应该。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 45
          }
        ],
        "hint": "渴了，先喝一口。"
      }),
      eventOption({
        "label": "打碎水面（获得 1 张史诗卡，-20 HP）",
        "tone": "neutral",
        "text": "水花四溅，碎片里浮出一张卡。你的倒影不见了。\n「诶……对不起呀。不过这张卡真好看。」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "cardRarity": {
              "rarities": [
                "epic",
                "rare"
              ],
              "boost": 0.5
            }
          },
          {
            "hp": -20
          }
        ],
        "hint": "打碎它！（……有点心虚）"
      }),
    ]
  },
  {
    "id": "caravan_toll",
    "name": "商队收税员",
    "text": "一只戴着帽子的沙河马拦住你：「过路费。三十金币，或者一件东西。」\n「诶 —— 这么贵的吗？！」",
    "options": [
      eventOption({
        "label": "付钱（-35 金币，获得 1 张卡）",
        "tone": "good",
        "text": "你开始掏钱。",
        "effects": [
          {
            "if": {
              "goldAtLeast": 35
            },
            "then": {
              "tone": "good",
              "text": "他收了钱，还顺手从货里挑了一张卡给你：「下次别走这条路。」\n「这条也一般。」你嘟囔着走了。\n金币 -35，获得「{card}」。",
              "effects": [
                {
                  "gold": -35
                },
                {
                  "cardRandom": 0.35
                }
              ]
            },
            "else": {
              "tone": "neutral",
              "text": "你掏了半天，只有几枚硬币。他叹了口气，挥挥手让你过了。\n「诶？这就放我走啦。谢了。」",
              "effects": []
            }
          }
        ],
        "hint": "给吧给吧。"
      }),
      eventOption({
        "label": "拒绝（-12 HP，攻击 +2）",
        "tone": "neutral",
        "text": "他推了你一把。你站稳了，而且很生气。\n「下手这么重，过分了！」\nHP -{hp}，攻击 +2。",
        "effects": [
          {
            "hp": -12
          },
          {
            "stat": {
              "atk": 2
            }
          }
        ],
        "hint": "不给！"
      }),
      eventOption({
        "label": "飞过去",
        "hint": "……我是会飞的。",
        "tone": "good",
        "text": "你张开翅膀从他头顶飞过。他在下面喊：「这不公平！」\n「飞得起来就是公平呀。」\n（什么都没发生，但心情不错。）",
        "effects": []
      }),
    ]
  },
  {
    "id": "first_oasis",
    "name": "第一处绿洲",
    "biome": "desert",
    "text": "棕榈树围着一小片水。几只青绵鸟在上面打转，看到你就散开了。\n「是水！好久没见啦～」",
    "options": [
      eventOption({
        "label": "泡一会儿（回复 35 HP）",
        "tone": "good",
        "text": "水是温的。你趴了半小时，尾巴尖在水面上打了个圈。\n「唔 —— 舒服♪」\nHP +{heal}。",
        "effects": [
          {
            "hp": 35
          }
        ],
        "hint": "泡到起皱为止。"
      }),
      eventOption({
        "label": "在树荫下整理卡组（最大生命 +14）",
        "tone": "good",
        "text": "你把卡一张张摊在沙上重新排了顺序，顺便睡了一觉。\n「这样顺眼多啦。」\n最大生命 +14。",
        "effects": [
          {
            "stat": {
              "maxHp": 14
            }
          }
        ],
        "hint": "顺便把卡理一理。"
      }),
      eventOption({
        "label": "带走一颗果子（获得好伤药 ×2）",
        "tone": "good",
        "text": "树下的果子还能吃。\n「带走带走，路上当零食。」\n获得{item} ×2。",
        "effects": [
          {
            "item": {
              "id": "potion_small",
              "n": 2
            }
          }
        ],
        "hint": "树下的果子看着能吃。"
      }),
    ]
  },
  {
    "id": "bone_field",
    "name": "化石滩",
    "biome": "desert",
    "text": "一整片白色的骨头从沙里伸出来，像某种很久以前的路标。\n「好大呀。以前住在这儿的吗？」",
    "options": [
      eventOption({
        "label": "挖一挖（50% 获得卡牌 / 50% -15 HP）",
        "tone": "neutral",
        "text": "你开始挖。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "骨头下面压着一块石板，石板上刻着招式。你把它记住了。\n「学会啦。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRandom": 0.4
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "沙子塌了，你被埋到脖子才爬出来。\n「呸呸呸……下次先看看稳不稳。」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -15
                  }
                ]
              }
            ]
          }
        ],
        "hint": "挖挖看。"
      }),
      eventOption({
        "label": "绕过去（敏捷 +2）",
        "tone": "good",
        "text": "你从骨堆边缘绕过去，脚步很轻。\n「借过一下。」\n敏捷 +2。",
        "effects": [
          {
            "stat": {
              "agi": 2
            }
          }
        ],
        "hint": "绕过去，别打扰它们。"
      }),
    ]
  },
  {
    "id": "storm_ride",
    "name": "沙暴来了",
    "biome": "desert",
    "text": "远处的地平线立起来一整面墙，正在往这边推。\n「唔……这个看起来有点好玩。」",
    "options": [
      eventOption({
        "label": "迎面飞进去（幸运 +3，-18 HP）",
        "tone": "good",
        "text": "你在沙暴中心待了三分钟。你听到了那个像歌声的振翅声 —— 是你自己的。\n「这才叫飞呀♪」\nHP -{hp}，幸运 +3。",
        "effects": [
          {
            "hp": -18
          },
          {
            "stat": {
              "luck": 3
            }
          }
        ],
        "hint": "迎面飞进去！"
      }),
      eventOption({
        "label": "挖个坑躲起来（防御 +3）",
        "tone": "good",
        "text": "你把自己埋起来，只留眼睛。沙子打在甲壳上，它挡住了。\n「有点痒。但是很安全。」\n防御 +3。",
        "effects": [
          {
            "stat": {
              "def": 3
            }
          }
        ],
        "hint": "挖个坑把自己埋起来。"
      }),
      eventOption({
        "label": "飞高躲过去（最大生命 +10）",
        "tone": "good",
        "text": "你在沙暴顶上飞了很久，看到了整片沙海的形状。\n「原来沙漠长这样。记下来记下来。」\n最大生命 +10。",
        "effects": [
          {
            "stat": {
              "maxHp": 10
            }
          }
        ],
        "hint": "飞高一点躲过去。"
      }),
    ]
  },
  {
    "id": "echo_wall",
    "name": "回音壁",
    "biome": "canyon",
    "text": "峡谷在这里收成一个很窄的缝。你喊了一声，回音回来的时候变成了两个声音。\n「诶？谁在学我说话？」",
    "options": [
      eventOption({
        "label": "再喊一声（获得 1 张卡）",
        "tone": "good",
        "text": "第二个声音回答了你一句你没说过的话。那句话变成了一张卡。\n「诶……这也算我的？那我收下了。」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.4
          }
        ],
        "hint": "再喊一声！"
      }),
      eventOption({
        "label": "安静地听（幸运 +2，回复 25 HP）",
        "tone": "good",
        "text": "你听了很久，风声里全是沙。\n「唔……听懂了，又好像没听懂。」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "stat": {
              "luck": 2
            }
          },
          {
            "hp": 25
          }
        ],
        "hint": "安静地听一会儿。"
      }),
    ]
  },
  {
    "id": "lava_vent",
    "name": "地热裂口",
    "biome": "canyon",
    "text": "岩缝里透出橙色的光，热得能烤干鳞片。一只熔岩蜗牛慢吞吞地爬过去。\n「诶，你不烫的吗？！」",
    "options": [
      eventOption({
        "label": "把卡牌凑近火（随机 1 张史诗卡）",
        "tone": "good",
        "text": "你把一张卡在火边烘了一下，它上面的图案变了。\n「变成好看的了。」\n获得「{card}」。",
        "effects": [
          {
            "cardRarity": {
              "rarities": [
                "epic"
              ]
            }
          }
        ],
        "hint": "把卡凑近火烘一烘。"
      }),
      eventOption({
        "label": "跳进去淬炼（-22 HP，防御 +5）",
        "tone": "good",
        "text": "很疼。但冷却之后，甲壳上多了一层像釉的东西。\n「呜……好疼呀。不过变硬了。」\nHP -{hp}，防御 +5。",
        "effects": [
          {
            "hp": -22
          },
          {
            "stat": {
              "def": 5
            }
          }
        ],
        "hint": "跳进去淬炼（很疼的样子）。"
      }),
      eventOption({
        "label": "取火烤点吃的（回复 30 HP）",
        "tone": "good",
        "text": "烤过的仙人掌果实意外地好吃。\n「这个真的可以！你们也试试。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 30
          }
        ],
        "hint": "烤点吃的！"
      }),
    ]
  },
  {
    "id": "rival_meet",
    "name": "另一位沙漠精灵",
    "biome": "canyon",
    "text": "半空中悬着另一只沙漠蜻蜓。她比你小一点，但眼睛很亮。「你也是……欧亚西莉亚？听说过这个名字。」\n「诶？我这么有名。」",
    "options": [
      eventOption({
        "label": "聊一会儿（获得 1 张稀有卡）",
        "tone": "good",
        "text": "你们交换了各自会的招式。临走她塞给你一张：「前面有个东西在等你。」\n「你也小心。」\n获得「{card}」。",
        "effects": [
          {
            "cardRarity": {
              "rarities": [
                "rare"
              ]
            }
          }
        ],
        "hint": "聊一会儿嘛。"
      }),
      eventOption({
        "label": "比一场（攻击 +5，-20 HP）",
        "tone": "good",
        "text": "你们在峡谷里追了十几分钟。你赢了，也累坏了。\n「哈……哈……赢了。但是好累呀。」\nHP -{hp}，攻击 +5。",
        "effects": [
          {
            "hp": -20
          },
          {
            "stat": {
              "atk": 5
            }
          }
        ],
        "hint": "比一场！"
      }),
      eventOption({
        "label": "不理会",
        "tone": "neutral",
        "text": "你从她身边掠过。她在你身后喊了句「小心点」，然后飞走了。\n「唔……下次再聊吧。」",
        "effects": [],
        "hint": "唔……赶时间呢。"
      }),
    ]
  },
  {
    "id": "star_dust",
    "name": "星尘沉积地",
    "biome": "night",
    "text": "沙面上浮着一层细碎的光。踩上去会有轻微的响声，像踩在玻璃上。\n「哇 —— 亮晶晶的！」",
    "options": [
      eventOption({
        "label": "滚一圈（幸运 +4）",
        "tone": "good",
        "text": "你全身沾满了星尘，在夜里看起来像一大团萤火。\n「好看吧？谁都不许笑哟。」\n幸运 +4。",
        "effects": [
          {
            "stat": {
              "luck": 4
            }
          }
        ],
        "hint": "滚一圈。"
      }),
      eventOption({
        "label": "收集起来（获得厉害伤药 ×2）",
        "tone": "good",
        "text": "星尘压成药丸，苦，但很有用。\n「唔……好苦。不过为了有用，忍了。」\n获得{item} ×2。",
        "effects": [
          {
            "item": {
              "id": "potion_big",
              "n": 2
            }
          }
        ],
        "hint": "收起来带走。"
      }),
      eventOption({
        "label": "把它埋回去（最大生命 +22）",
        "tone": "good",
        "text": "你觉得它不该被踩。盖上沙的时候，有什么东西从地底轻轻顶了你一下，像在道谢。\n「不客气。」\n最大生命 +22。",
        "effects": [
          {
            "stat": {
              "maxHp": 22
            }
          }
        ],
        "hint": "唔……还是埋回去吧。"
      }),
    ]
  },
  {
    "id": "grave_marker",
    "name": "无名的墓碑",
    "biome": "night",
    "text": "一块歪掉的石头，上面刻着半句话：「走到这里就够了。」\n「唔……那我偏要再走一段呀。」",
    "options": [
      eventOption({
        "label": "继续往前走（攻击 +6）",
        "tone": "good",
        "text": "你把石头扶正，然后越过了它。\n「谢谢你提醒。不过我还想看看前面。」\n攻击 +6。",
        "effects": [
          {
            "stat": {
              "atk": 6
            }
          }
        ],
        "hint": "扶正它，然后往前走。"
      }),
      eventOption({
        "label": "坐下来休息（回复 50 HP）",
        "tone": "good",
        "text": "你靠着石头坐了一会儿，什么都没想。\n「唔……就这样待着也不错。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 50
          }
        ],
        "hint": "靠着它坐一会儿。"
      }),
      eventOption({
        "label": "把石头搬开（50% 史诗卡 / 50% -25 HP）",
        "tone": "neutral",
        "text": "你把石头推开了。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "石头下面是个地窖。里面整整齐齐摆着别人留下的东西，还有一张卡。\n「诶……那我拿一张就好。」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRarity": {
                      "rarities": [
                        "epic"
                      ],
                      "boost": 0.6
                    }
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "石头底下全是沙，还有一只被吵醒的尖牙陆鲨。\n「哇！对不起呀 —— 不是故意吵你的！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -25
                  }
                ]
              }
            ]
          }
        ],
        "hint": "把它搬开看看下面。"
      }),
    ]
  },
  {
    "id": "order_voice",
    "name": "地下的低语",
    "biome": "night",
    "text": "整个沙原同时震了一下。有个很慢的声音在你脑子里说话：「回去。」\n「唔……不要。」",
    "options": [
      eventOption({
        "label": "「不。」（攻击 +4 / 防御 +4）",
        "tone": "good",
        "text": "声音沉默了。你感到整片大地都在看着你。\n「我说了不回去。」\n攻击 +4，防御 +4。",
        "effects": [
          {
            "stat": {
              "atk": 4,
              "def": 4
            }
          }
        ],
        "hint": "「不。」"
      }),
      eventOption({
        "label": "「凭什么？」（获得 1 张史诗卡，-30 HP）",
        "tone": "neutral",
        "text": "大地翻了一下。你被打进了沙里，但手里多了一张卡。\n「疼死了！……不过卡我收下了。」\nHP -{hp}，获得「{card}」。",
        "effects": [
          {
            "hp": -30
          },
          {
            "cardRarity": {
              "rarities": [
                "epic"
              ],
              "boost": 0.8
            }
          }
        ],
        "hint": "「凭什么？」"
      }),
      eventOption({
        "label": "暂时退开（回复 40 HP，幸运 +2）",
        "tone": "good",
        "text": "你退到远处缩起来，把呼吸放慢。声音也慢慢远了。\n「唔……先歇会儿。等下再跟它讲道理。」\nHP +{heal}，幸运 +2。",
        "effects": [
          {
            "hp": 40
          },
          {
            "stat": {
              "luck": 2
            }
          }
        ],
        "hint": "（先退开一点……）"
      }),
    ]
  },
  {
    "id": "tide_low_shells",
    "name": "退潮的贝壳滩",
    "biome": "tide",
    "text": "水退到看不见的地方，整片滩上全是贝壳，白得刺眼。踩上去会碎，碎的声音在远处回一遍。\n「哇 —— 亮得睁不开眼！」",
    "options": [
      eventOption({
        "label": "捡最完整的那只（获得 1 张卡）",
        "tone": "good",
        "text": "贝壳里侧刻着一串很细的痕，像谁记下来的招式。你看懂了。\n「哟，这是谁写的呀？我收下咯。」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.35
          }
        ],
        "hint": "捡最完整的那只。"
      }),
      eventOption({
        "label": "躺在贝壳上晒太阳（回复 35 HP，幸运 +1）",
        "tone": "good",
        "text": "太阳把盐烤进甲缝里，很舒服，也很咸。你翻身的时候听见自己身上在响。\n「唔 —— 好舒服♪」\nHP +{heal}，幸运 +1。",
        "effects": [
          {
            "hp": 35
          },
          {
            "stat": {
              "luck": 1
            }
          }
        ],
        "hint": "躺着晒太阳。"
      }),
      eventOption({
        "label": "光脚走完一整片（-10 HP，敏捷 +3）",
        "tone": "neutral",
        "text": "每一步都割得挺深。走到最后，你已经能在碎壳上走得不发出一点声音。\n「……疼。但是走过来啦。」\nHP -{hp}，敏捷 +3。",
        "effects": [
          {
            "hp": -10
          },
          {
            "stat": {
              "agi": 3
            }
          }
        ],
        "hint": "光脚走完一整片（会割脚）。"
      }),
    ]
  },
  {
    "id": "tide_breathing_flat",
    "name": "会呼吸的滩",
    "biome": "tide",
    "text": "你脚下的整片盐壳在慢慢地起伏，一下、一下。你站着不动，它就跟着你的呼吸走。\n「诶……它在学我呀？」",
    "options": [
      eventOption({
        "label": "躺下去跟着它呼吸（回复 45 HP）",
        "tone": "good",
        "text": "你和地面终于对上了频率。身上的疼被一下一下挤了出去，像挤水。\n「唔……好舒服～」\nHP +{heal}。",
        "effects": [
          {
            "hp": 45
          }
        ],
        "hint": "躺下去跟着它呼吸。"
      }),
      eventOption({
        "label": "在它抬起来的时候跳（50% 幸运 +4 / 50% -16 HP）",
        "hint": "在它抬起来的时候跳！",
        "tone": "neutral",
        "text": "你盯着脚下的起伏数拍子。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "你算准了。落地的瞬间整片滩往上抬了一下，把你稳稳托在半空。\n「看见没，我算得很准。」\n幸运 +4。",
                "effects": [
                  {
                    "stat": {
                      "luck": 4
                    }
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "你算错了。盐壳在下面合上，夹住了你的尾巴，夹了很久才松开。\n「呜 —— 我的尾巴呀！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -16
                  }
                ]
              }
            ]
          }
        ]
      }),
      eventOption({
        "label": "用爪子敲出节奏（获得 1 张卡）",
        "tone": "good",
        "text": "你敲了三下。退得很远的水回了同一个节奏，那个节奏后来变成了一张卡。\n「它听得懂！」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.3
          }
        ],
        "hint": "用爪子敲出节奏。"
      }),
    ]
  },
  {
    "id": "tide_salt_crust",
    "name": "盐壳底下的水",
    "biome": "tide",
    "text": "一层盐壳盖住了整条路，底下有水在走。你能听见它走 —— 它走得比你有耐心。\n「唔……它要去哪儿？」",
    "options": [
      eventOption({
        "label": "踩出一条路来（-9 HP，最大生命 +12）",
        "tone": "good",
        "text": "盐壳每一块都锋利，你踩了不知道多少块，也磨出了一路硬壳。\n「脚好疼……不过走出来啦。」\nHP -{hp}，最大生命 +12。",
        "effects": [
          {
            "hp": -9
          },
          {
            "stat": {
              "maxHp": 12
            }
          }
        ],
        "hint": "踩出一条路来！"
      }),
      eventOption({
        "label": "敲一块带在身上（获得锐爪护符 ×1）",
        "tone": "good",
        "text": "盐块在爪子上磨了几天，越来越顺手，磨的时候会掉白粉。\n「越用越合手。」\n获得{item} ×1。",
        "effects": [
          {
            "item": "charm_atk"
          }
        ],
        "hint": "敲一块带在身上。"
      }),
      eventOption({
        "label": "绕到盐壳薄的地方",
        "tone": "neutral",
        "text": "你多走了一个小时，从最薄的地方过去。底下那片水一直跟着你，走到哪跟到哪。\n「唔……你要跟到什么时候呀？」",
        "effects": [],
        "hint": "绕到盐壳薄的地方。"
      }),
    ]
  },
  {
    "id": "tide_flood_warning",
    "name": "涨潮",
    "biome": "tide",
    "text": "远处传来一种很低的声音，像有人把一大盆水端了起来。盐壳下面的水开始往上冒。\n「诶 —— 这个声音不妙！」",
    "options": [
      eventOption({
        "label": "往高处跑（-12 HP，敏捷 +4）",
        "tone": "good",
        "text": "你在水到膝盖之前爬上了盐丘，肺疼得厉害，但你跑得比上次快。\n「哈……哈……跑掉啦！」\nHP -{hp}，敏捷 +4。",
        "effects": [
          {
            "hp": -12
          },
          {
            "stat": {
              "agi": 4
            }
          }
        ],
        "hint": "往高处跑！"
      }),
      eventOption({
        "label": "原地不动，看它涨到哪（50% 获得卡 / 50% -25 HP）",
        "hint": "原地不动，看它涨到哪。",
        "tone": "neutral",
        "text": "你站在原地，水开始碰你的脚。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "水漫到你胸口就停了。水面上漂来一张还没泡烂的卡，你伸手接住了。\n「还送东西呀。谢啦！」\n获得「{card}」。",
                "effects": [
                  {
                    "cardRarity": {
                      "rarities": [
                        "rare",
                        "epic"
                      ],
                      "boost": 0.5
                    }
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "水没停。你被冲出去很远，最后撞在一堆贝壳上才站住。\n「呜哇 —— ！好疼……」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -25
                  }
                ]
              }
            ]
          }
        ]
      }),
      eventOption({
        "label": "飞起来躲过去（回复 20 HP）",
        "tone": "good",
        "text": "你贴着水面飞了十几分钟，翅膀上一滴都没沾。下面那层水一直在找你。\n「飞得起来就是赢呀。」\nHP +{heal}。",
        "effects": [
          {
            "hp": 20
          }
        ],
        "hint": "飞起来躲过去。"
      }),
    ]
  },
  {
    "id": "tide_brine_pool",
    "name": "咸水洼",
    "biome": "tide",
    "text": "一个和别处不一样的水洼，水面上浮着一层白。周围什么都不长 —— 连盐壳都不长。\n「诶，这里怎么什么都没有？」",
    "options": [
      eventOption({
        "label": "喝一口（60% 回复 55 HP / 40% -18 HP）",
        "hint": "……喝一口试试？",
        "tone": "neutral",
        "text": "你低头喝了一口，喉咙立刻开始抗议。",
        "effects": [
          {
            "branch": [
              {
                "weight": 60,
                "tone": "good",
                "text": "很难喝。但它把你身体里攒的那些沙子泡开了，你吐出来一堆。\n「呸呸呸……不过好像轻快了。」\nHP +{heal}。",
                "effects": [
                  {
                    "hp": 55
                  }
                ]
              },
              {
                "weight": 40,
                "tone": "bad",
                "text": "你咽下去半口就咳了出来，喉咙像被人用火烤过一遍。\n「呜 —— 好咸呀！再也不喝了！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -18
                  }
                ]
              }
            ]
          }
        ]
      }),
      eventOption({
        "label": "把手泡进去（防御 +4）",
        "tone": "good",
        "text": "泡完之后，手上的老茧硬得像又长了一层壳。你敲了敲，声音不错。\n「变硬了。」\n防御 +4。",
        "effects": [
          {
            "stat": {
              "def": 4
            }
          }
        ],
        "hint": "把手泡进去。"
      }),
      eventOption({
        "label": "装一瓶带走（获得活力药 ×1）",
        "tone": "good",
        "text": "装的时候瓶子外壁结了一层白霜，你舔了一下，舌头麻了半天。\n「唔！麻了麻了 —— 这个真的能喝吗？」\n获得{item} ×1。",
        "effects": [
          {
            "item": "elixir"
          }
        ],
        "hint": "装一瓶带走。"
      }),
    ]
  },
  {
    "id": "tide_stranded_thing",
    "name": "搁浅的东西",
    "biome": "tide",
    "text": "一只比你还大的巨翅飞鱼搁在盐壳上，嘴一动一动。它看着你，没有求救的意思。\n「唔……你还好吗？」",
    "options": [
      eventOption({
        "label": "把它推回水里（-14 HP，幸运 +3）",
        "tone": "good",
        "text": "你从后面顶它，推到水边的时候自己被浪拍了个跟头。它下水前回头看了你一眼。\n「路上小心。」\nHP -{hp}，幸运 +3。",
        "effects": [
          {
            "hp": -14
          },
          {
            "stat": {
              "luck": 3
            }
          }
        ],
        "hint": "把它推回水里！"
      }),
      eventOption({
        "label": "坐在旁边等它自己了结（获得厉害伤药 ×1）",
        "tone": "neutral",
        "text": "你等了两个小时。它最后把嘴里含着的一块东西吐给了你，然后不动了。\n「唔……谢谢你呀。走好。」\n获得{item} ×1。",
        "effects": [
          {
            "item": "potion_big"
          }
        ],
        "hint": "坐在旁边等着。"
      }),
      eventOption({
        "label": "不管，继续走",
        "tone": "neutral",
        "text": "你从它旁边走过去。它在盐上又动了几下，声音很像有人在敲门。你没回头。\n「对不起……我搬不动你。」",
        "effects": [],
        "hint": "……继续走吧。"
      }),
    ]
  },
  {
    "id": "tide_fog_bank",
    "name": "咸雾",
    "biome": "tide",
    "text": "一层雾从水面上推过来，吸进去嘴里全是咸味。雾里能见度只有三步，三步以外全是白的。\n「唔，什么都看不见呀。」",
    "options": [
      eventOption({
        "label": "闭着眼睛走（幸运 +3）",
        "tone": "good",
        "text": "你把眼睛闭上，靠盐壳底下的水声带路。雾散的时候你一步都没走错。\n「看，闭着眼也行。」\n幸运 +3。",
        "effects": [
          {
            "stat": {
              "luck": 3
            }
          }
        ],
        "hint": "闭着眼睛走。"
      }),
      eventOption({
        "label": "喊一声，听回音（获得 1 张卡）",
        "tone": "good",
        "text": "雾里有人回了你一句，回的不是你说的话。你顺着那句话走过去，地上躺着一张卡。\n「诶……你是谁？」\n获得「{card}」。",
        "effects": [
          {
            "cardRandom": 0.4
          }
        ],
        "hint": "喊一声，听回音。"
      }),
      eventOption({
        "label": "张开翅膀扇散它（-8 HP，敏捷 +2）",
        "tone": "neutral",
        "text": "你扇了很久，雾只让开了一小圈，翅膀酸得像要掉下来。\n「呜……扇不动呀。」\nHP -{hp}，敏捷 +2。",
        "effects": [
          {
            "hp": -8
          },
          {
            "stat": {
              "agi": 2
            }
          }
        ],
        "hint": "张开翅膀扇散它！"
      }),
    ]
  },
  {
    "id": "tide_wreck",
    "name": "盐壳里的残骸",
    "biome": "tide",
    "text": "退潮之后，半条船插在盐壳里，木头已经被盐撑开了，缝里还在往下滴水。\n「哇……船！好久以前的吧。」",
    "options": [
      eventOption({
        "label": "潜进船舱（50% 金币+道具 / 50% -22 HP）",
        "tone": "neutral",
        "text": "舱门半开着，里面全是水，看不见底。",
        "effects": [
          {
            "branch": [
              {
                "weight": 50,
                "tone": "good",
                "text": "舱里保存得比外面好。你捞出来一个钱袋和几瓶还没开封的药。\n「还是新的。谢谢船长。」\n金币 +{gold}，获得{item} ×1。",
                "effects": [
                  {
                    "goldRange": [
                      30,
                      70
                    ]
                  },
                  {
                    "item": "potion_small"
                  }
                ]
              },
              {
                "weight": 50,
                "tone": "bad",
                "text": "舱顶塌下来一块，你被压在底下，靠自己一寸一寸扒出来的。\n「呜 —— 好重！」\nHP -{hp}。",
                "effects": [
                  {
                    "hp": -22
                  }
                ]
              }
            ]
          }
        ],
        "hint": "潜进船舱看看！"
      }),
      eventOption({
        "label": "拆一块船板带走（防御 +3）",
        "tone": "good",
        "text": "木板被盐腌得又硬又轻，绑在前臂上正好。你试着挡了一下风。\n「能当盾牌。」\n防御 +3。",
        "effects": [
          {
            "stat": {
              "def": 3
            }
          }
        ],
        "hint": "拆一块船板带走。"
      }),
      eventOption({
        "label": "坐在船头等潮水回来（回复 40 HP）",
        "tone": "good",
        "text": "潮水回来的时候，半条船慢慢立起来又落下去，像在点头。你在上面坐了很久。\n「唔……你以前去过哪儿呀？」\nHP +{heal}。",
        "effects": [
          {
            "hp": 40
          }
        ],
        "hint": "坐在船头等潮水回来。"
      }),
    ]
  }
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
// #endregion GENERATED-EVENTS

/** 按章节取事件池：本章专属 + 通用，通用的事件任何地图都可能遇到 */
export function eventsFor(biomeKey) {
  const generic = EVENTS.filter((e) => !e.biome);
  const themed = EVENTS.filter((e) => e.biome === biomeKey);
  return [...themed, ...generic];
}
