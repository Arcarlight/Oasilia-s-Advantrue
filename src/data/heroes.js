// 主角数据（3.0 起有两位）：欧亚西莉亚（沙漠蜻蜓）与阿特拉斯（暴飞龙）。
//
// 【数据本体不在这里】—— HEROES / HERO_STARTERS 由 content/heroes.json 生成（见下面的
// GENERATED 区块），要改主角就改那个 JSON，然后跑 `node tools/build-content.mjs`。
//
// 这一版为什么要有这个文件：以前「主角」散在三个地方 —— 名字 / 物种 / 初始属性写在
// src/data/balance.js 的 BALANCE.player，开局卡组写在 content/cards.json 的 starterDeck，
// 标题页那两句台词写死在界面代码里。加第二个主角时这三处就成了三份要同步的真相。
// 现在它们收在这里：一个主角 = 一条记录，界面 / 引擎 / 生成脚本都读同一份。

// #region GENERATED-HEROES
export const HERO_ORDER = [
  "oasilia",
  "atlas"
];

/** 主角记录（content/heroes.json 生成）。字段含义见那个 JSON 的 _comment。 */
export const HEROES = [
  {
    "id": "oasilia",
    "name": "欧亚西莉亚",
    "species": "flygon",
    "speciesName": "沙漠蜻蜓",
    "dex": "0330",
    "types": [
      "地面",
      "龙"
    ],
    "ability": "飘浮",
    "gender": "♀",
    "atk": 16,
    "def": 12,
    "maxHp": 260,
    "agi": 10,
    "luck": 5,
    "unlock": null,
    "endlessUnlock": "clear-self",
    "rowBadge": "沙漠精灵",
    "titleAnim": "FlapAround",
    "titleScale": 4.2,
    "quote": "「凡是听见沙子唱歌的人，最后都留在了沙里。」\n——你是{name}，一只雌性沙漠蜻蜓。沙海深处有个声音在叫你，你决定去看看。",
    "clearHint": "「这一路，你就送到这儿啦。不过别急着收翅膀——你后头还跟着一条龙，早就等不及要自己走一遭了。」",
    "ending": {
      "title": "你走到了沙的尽头",
      "text": "夜砂墓原的尽头不是墙，是一片什么都没有的平地。\n绿色细胞拼成的脸慢慢散开，落回沙里。\n「……好吧。你走得够远了，沙漠的孩子。」\n\n{name} 展开翅膀，第一次觉得风是干净的。"
    },
    "map": {
      "rowsMul": 1,
      "bosses": 1,
      "enemy": {
        "hp": 1,
        "atk": 1
      }
    },
    "titleName": "沙漠精灵"
  },
  {
    "id": "atlas",
    "name": "阿特拉斯",
    "species": "salamence",
    "speciesName": "暴飞龙",
    "dex": "0373",
    "types": [
      "龙",
      "飞行"
    ],
    "ability": "威吓",
    "gender": "♂",
    "atk": 17,
    "def": 14,
    "maxHp": 275,
    "agi": 9,
    "luck": 4,
    "unlock": "clear:oasilia",
    "endlessUnlock": "clear-self",
    "rowBadge": "沙漠精灵",
    "titleAnim": "Float",
    "titleScale": 5,
    "quote": "「风把脚印都抹了。没关系，我本就不靠脚印找人。」\n——你是{name}，一只雄性暴飞龙。她一声不吭出了门，你觉得这事实在靠不住，就跟了出来。",
    "clearHint": "沙的尽头，她早就站在那儿，像是等了很久。她见你走近，只抬了抬下巴：「……你总算追上来了？」",
    "ending": {
      "title": "沙的尽头是家",
      "text": "沙的尽头，她正坐在一块被风磨圆的大石头上，像是早算准了你会追来。\n「你来得可够晚的。」她冲你眨眨眼，「路上不好走？」\n「你一声不吭就走。」{name} 回了一句，「我总不能装没看见。」\n\n她笑了一声，你们一起展开翅膀，从沙海的尽头起飞。\n风把来时的脚印全抹平了，可回家的方向，你们都记得。\n等落在自家门口，天边刚刚透亮。"
    },
    "map": {
      "rowsMul": 2,
      "bosses": 2,
      "enemy": {
        "hp": 1.08,
        "atk": 1.06,
        "perStage": 0.015
      }
    },
    "titleName": "探寻的新月"
  }
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

/** 每位主角的开局卡组（id 数组，可以有重复） */
export const HERO_STARTERS = {
  "oasilia": [
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
  ],
  "atlas": [
    "atlas_charge",
    "atlas_charge",
    "atlas_charge",
    "atlas_bite",
    "atlas_bite",
    "atlas_scales",
    "atlas_scales",
    "atlas_wingbeat",
    "sand_attack",
    "quick_attack"
  ]
};
// #endregion GENERATED-HEROES

/** 兜底主角（老存档 / 诊断脚本里没有 d.hero 时用它） */
export const DEFAULT_HERO_ID = HERO_ORDER[0];

/**
 * 一位主角的记录。传进来的 id 不认识就退回默认主角 —— 老存档里的 run 数据没有 `hero` 字段，
 * 读档时不能因此报错（那时候就这一个主角）。
 */
export function heroById(id) {
  return HERO_BY_ID[id] ?? HERO_BY_ID[DEFAULT_HERO_ID] ?? HEROES[0] ?? null;
}

/** 这一局（或这份 run 数据）用的是哪位主角 */
export function heroOf(data) {
  return heroById(data?.hero);
}

/** 这位主角的开局卡组 */
export function starterDeckFor(id) {
  return HERO_STARTERS[id] ?? HERO_STARTERS[DEFAULT_HERO_ID] ?? [];
}

/** 这位主角的地图形状（行数倍率 / 一关几个首领 / 敌人额外倍率），缺配置就是正片形状 */
export function heroMapShape(id) {
  const h = heroById(id);
  return {
    rowsMul: h?.map?.rowsMul ?? 1,
    bosses: Math.max(1, Math.round(h?.map?.bosses ?? 1)),
    enemy: { hp: h?.map?.enemy?.hp ?? 1, atk: h?.map?.enemy?.atk ?? 1, perStage: h?.map?.enemy?.perStage ?? 0 },
  };
}

/**
 * 这位主角在**第 stage 章**的敌人额外倍率。
 *
 * `perStage` 是「每一章再抬一点」——用户要的「难度曲线也会变高一些」里的**曲线**两个字：
 * 只用一个固定倍率的话，难度是**整体平移**（前期更难、后期一样）；
 * 加上每章递增之后，前期只是略紧、越往后越紧，这才是「曲线更高」。
 */
export function heroEnemyMul(id, stage = 0) {
  const e = heroMapShape(id).enemy;
  const k = 1 + (e.perStage ?? 0) * Math.max(0, stage);
  return { hp: (e.hp ?? 1) * k, atk: (e.atk ?? 1) * k };
}

// ---------------------------------------------------------------------------
// 解锁（纯函数：跨局记录由调用方传进来，这里不碰 localStorage）
// ---------------------------------------------------------------------------

/** 谁已经通关过（meta.clearedHeroes → Set） */
export function clearedHeroSet(meta) {
  return new Set(meta?.clearedHeroes ?? []);
}

/**
 * 这位主角能不能选。
 *
 * 规则（用户定的）：欧亚西莉亚一开始就能用；**阿特拉斯要用欧亚西莉亚通关一次**
 * （`unlock: 'clear:oasilia'`）。老存档（3.0 之前通的关）由 save.readMeta 补上
 * `clearedHeroes` —— 不然老玩家会莫名其妙发现新主角锁着。
 */
export function isHeroUnlocked(hero, meta) {
  const h = typeof hero === 'string' ? heroById(hero) : hero;
  if (!h) return false;
  if (!h.unlock) return true;
  const m = /^clear:(.+)$/.exec(String(h.unlock));
  if (!m) return true;
  return clearedHeroSet(meta).has(m[1]) || !!meta?.heroCleared?.[m[1]];
}

/**
 * 这位主角能不能打**无尽模式**。
 *
 * 用户的要求分两句：欧亚西莉亚通关解锁无尽（老规则）；
 * 「阿特拉斯通关后，可以选择阿特拉斯进行普通难度的挑战和无尽模式的挑战」——
 * 也就是无尽模式里用哪一位主角，得**用那一位主角通过一次关**。
 */
export function isHeroEndlessUnlocked(hero, meta) {
  const h = typeof hero === 'string' ? heroById(hero) : hero;
  if (!h) return false;
  if (!isHeroUnlocked(h, meta)) return false;
  if (h.endlessUnlock === 'clear-self') {
    // `endlessUnlocked` 是 2.x 的老标记（那时只有欧亚西莉亚一位主角），老存档只认它就够
    return !!meta?.heroCleared?.[h.id] || (h.id === HERO_ORDER[0] && !!meta?.endlessUnlocked);
  }
  return !!meta?.heroCleared?.[h.id];
}
