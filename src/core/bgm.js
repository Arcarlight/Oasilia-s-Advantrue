// BGM 管理：按场景切歌、无缝循环、切换时交叉淡出淡入。
//
// 曲目来自两个免费素材站（各自按自己的规矩署名，见下面 GENERATED 区块的 BGM_CREDITS）：
//   「音楽の卵」(https://ontama-m.com/)        —— 个人 / 法人均可免费使用、无需报告、可商用
//   「龍的交響楽」(http://d-symphony.com/)     —— 免费（含商用）、无需报告，要求名单里标注站名
// 【选曲表不在这里】—— BGM_FILES / BGM_NAMES / BGM_LOOPS / BGM_CREDITS 都由
// content/bgm.json 生成（见下面的 GENERATED 区块）：加一首曲子就改那个 JSON，然后跑
//   node tools/fetch-bgm.mjs     （下载缺的 ogg，并校验循环点）
//   node tools/build-content.mjs （生成到下面这个区块）
//
// 为什么是 ogg：音楽の卵 每个曲目都提供 mp3 和 ogg 两版，其中 **ogg(L)** 是把音频剪成
// 「切れ目のない自然ループ」（无缝自然循环）的版本，mp3 版则有编码器补的静音帧，
// 循环接缝处能听出来；龍的交響楽 的素材页也是直接给 ogg。所以素材一律用 ogg。
//
// 怎么放才真的无缝：<audio loop> 在多数浏览器上循环时会漏掉一帧（解码器边界），
// 所以这里优先走 WebAudio —— 把整首 ogg 解成 AudioBuffer，用 loop=true 的
// BufferSourceNode 播放，循环点是采样精确的，接缝完全听不出来；音量/淡入淡出也
// 改成 GainNode 上的自动化曲线，不再靠 setTimeout 逐帧改 volume。
// 循环点用文件自带的 LOOPSTART/LOOPLENGTH（两家都带），下载时校验过、写在生成表
// BGM_LOOPS 里：前奏只放一次，之后跳回循环头。
// 没有 WebAudio、或者解码失败（例如 Safari 不支持 Vorbis）时，退回 <audio> 元素
// 那套老路子（仍然挂着 loop）。file:// 下浏览器会拦掉本地音频请求，此时静默降级
// 为无声，不影响游戏本体。

import { save } from './save.js';

const BASE = 'assets/audio/bgm/';

/**
 * 「这一首听过了」记进跨局存档：曲子库（src/ui/music-room.js）靠它把没听过的藏起来。
 * 记在这里而不是各个场景里：每一条播放路径最后都会经过 music.play()，
 * 少写一处的后果是那首曲子永远解锁不了。
 */
function markHeard(key) {
  try { save.noteBgm(key); } catch { /* 存档写不进去也不该影响放歌 */ }
}

// #region GENERATED-BGM
export const BGM_FILES = {
  "title": "title.ogg",
  "map": "map.ogg",
  "map_desert": "map_desert.ogg",
  "map_canyon": "map_canyon.ogg",
  "map_forest": "map_forest.ogg",
  "map_tide": "map_tide.ogg",
  "map_cliff": "map_cliff.ogg",
  "map_night": "map_night.ogg",
  "map_ruins": "map_ruins.ogg",
  "map_fungal": "map_fungal.ogg",
  "map_storm": "map_storm.ogg",
  "map_crystal": "map_crystal.ogg",
  "battle": "battle.ogg",
  "battle_desert": "battle_desert.ogg",
  "battle_canyon": "battle_canyon.ogg",
  "battle_forest": "battle_forest.ogg",
  "battle_tide": "battle_tide.ogg",
  "battle_cliff": "battle_cliff.ogg",
  "battle_night": "battle_night.ogg",
  "battle_ruins": "battle_ruins.ogg",
  "battle_fungal": "battle_fungal.ogg",
  "battle_storm": "battle_storm.ogg",
  "battle_crystal": "battle_crystal.ogg",
  "elite": "elite.ogg",
  "elite_desert": "elite_desert.ogg",
  "elite_canyon": "elite_canyon.ogg",
  "elite_forest": "elite_forest.ogg",
  "elite_tide": "elite_tide.ogg",
  "elite_cliff": "elite_cliff.ogg",
  "elite_night": "elite_night.ogg",
  "elite_ruins": "elite_ruins.ogg",
  "elite_fungal": "elite_fungal.ogg",
  "elite_storm": "elite_storm.ogg",
  "elite_crystal": "elite_crystal.ogg",
  "boss": "boss.ogg",
  "boss_final": "boss_final.ogg",
  "victory": "victory.ogg",
  "defeat": "defeat.ogg",
  "event": "event.ogg",
  "shop": "shop.ogg",
  "rest": "rest.ogg"
};

export const BGM_NAMES = {
  "title": "标题 · 旅途开始 · 旅のはじめ",
  "map": "地图兜底曲 · 風吹く草原",
  "map_desert": "第一章 流沙之海 · 烈日と黄塵のヴェール",
  "map_canyon": "第二章 赤岩峡谷 · 谷を越えて",
  "map_forest": "第三章 藤蔓密林 · 薄暗い森",
  "map_tide": "第四章 潮汐盐海 · 太陽と潮風の街",
  "map_cliff": "第五章 风蚀峭壁 · 頂上目指して",
  "map_night": "第六章 夜砂墓原 · 闇の洞窟",
  "map_ruins": "第七章 沉沙遗迹 · 永遠なる輝きのもとに",
  "map_fungal": "第八章 菌菇湿地 · 木霊の踊り",
  "map_storm": "第九章 雷暴台地 · 霊峰は荘厳に",
  "map_crystal": "第十章 水晶洞窟 · 朽ち果てた紋章",
  "battle": "战斗兜底曲 · 攻防一体",
  "battle_desert": "流沙之海的战斗 · Sand Labyrinth",
  "battle_canyon": "赤岩峡谷的战斗 · 取っ組み合い",
  "battle_forest": "藤蔓密林的战斗 · さぐり合い",
  "battle_tide": "潮汐盐海的战斗 · ヒット＆アウェイ",
  "battle_cliff": "风蚀峭壁的战斗 · 風車",
  "battle_night": "夜砂墓原的战斗 · 闇を打ち払う",
  "battle_ruins": "沉沙遗迹的战斗 · 龍飛鳳舞",
  "battle_fungal": "菌菇湿地的战斗 · Crimson Ridge",
  "battle_storm": "雷暴台地的战斗 · 蒼天疾駆",
  "battle_crystal": "水晶洞窟的战斗 · 深淵を行く",
  "elite": "强敌兜底曲 · クロス陣形",
  "elite_desert": "流沙之海的强敌 · 立ち向かう者達",
  "elite_canyon": "赤岩峡谷的强敌 · 灼熱の奥へ",
  "elite_forest": "藤蔓密林的强敌 · 魔物の気配",
  "elite_tide": "潮汐盐海的强敌 · 飛竜の背に乗って",
  "elite_cliff": "风蚀峭壁的强敌 · 風を追いかけて",
  "elite_night": "夜砂墓原的强敌 · 執行人",
  "elite_ruins": "沉沙遗迹的强敌 · 白虎豪勇",
  "elite_fungal": "菌菇湿地的强敌 · 鉄と炎の律動",
  "elite_storm": "雷暴台地的强敌 · 轟く鉄の巨神",
  "elite_crystal": "水晶洞窟的强敌 · Freezing Edge",
  "boss": "章节首领 · 襲来",
  "boss_final": "最终首领（终章） · 巨竜血闘",
  "victory": "战斗胜利 / 通关 · 勝利のうた",
  "defeat": "失败 · ぜんめつ",
  "event": "未知事件 / 宝箱 · 傘貸し",
  "shop": "商店 · おかしな行商人",
  "rest": "营地 · 泉のほとりで"
};

/** key -> { start, length, rate }（采样数 / 采样率），null = 没有可用的循环点，整首循环 */
export const BGM_LOOPS = {
  "title": {
    "start": 196488,
    "length": 4920833,
    "rate": 44100
  },
  "map": {
    "start": 84398,
    "length": 2566384,
    "rate": 44100
  },
  "map_desert": {
    "start": 84398,
    "length": 2566384,
    "rate": 44100
  },
  "map_canyon": {
    "start": 160659,
    "length": 2725901,
    "rate": 44100
  },
  "map_forest": {
    "start": 66308,
    "length": 3440837,
    "rate": 44100
  },
  "map_tide": {
    "start": 140414,
    "length": 2850121,
    "rate": 44100
  },
  "map_cliff": {
    "start": 109984,
    "length": 4615384,
    "rate": 44100
  },
  "map_night": {
    "start": 166813,
    "length": 3435737,
    "rate": 44100
  },
  "map_ruins": {
    "start": 481504,
    "length": 5029420,
    "rate": 44100
  },
  "map_fungal": {
    "start": 403760,
    "length": 3693369,
    "rate": 44100
  },
  "map_storm": {
    "start": 479017,
    "length": 4927039,
    "rate": 44100
  },
  "map_crystal": {
    "start": 0,
    "length": 3138450,
    "rate": 44100
  },
  "battle": {
    "start": 167685,
    "length": 3875853,
    "rate": 44100
  },
  "battle_desert": {
    "start": 167685,
    "length": 3875853,
    "rate": 44100
  },
  "battle_canyon": {
    "start": 138195,
    "length": 2694237,
    "rate": 44100
  },
  "battle_forest": {
    "start": 141037,
    "length": 2681924,
    "rate": 44100
  },
  "battle_tide": {
    "start": 298595,
    "length": 2385020,
    "rate": 44100
  },
  "battle_cliff": {
    "start": 159331,
    "length": 2506451,
    "rate": 44100
  },
  "battle_night": {
    "start": 195451,
    "length": 2540590,
    "rate": 44100
  },
  "battle_ruins": null,
  "battle_fungal": {
    "start": 169756,
    "length": 2101924,
    "rate": 44100
  },
  "battle_storm": null,
  "battle_crystal": {
    "start": 0,
    "length": 4381072,
    "rate": 44100
  },
  "elite": {
    "start": 157800,
    "length": 3922538,
    "rate": 44100
  },
  "elite_desert": {
    "start": 103162,
    "length": 3969380,
    "rate": 44100
  },
  "elite_canyon": {
    "start": 70273,
    "length": 4535816,
    "rate": 44100
  },
  "elite_forest": {
    "start": 132282,
    "length": 2721477,
    "rate": 44100
  },
  "elite_tide": {
    "start": 293702,
    "length": 2645903,
    "rate": 44100
  },
  "elite_cliff": {
    "start": 2645946,
    "length": 2490397,
    "rate": 44100
  },
  "elite_night": {
    "start": 2651,
    "length": 2415353,
    "rate": 44100
  },
  "elite_ruins": {
    "start": 380637,
    "length": 4390180,
    "rate": 44100
  },
  "elite_fungal": {
    "start": 608698,
    "length": 3074248,
    "rate": 44100
  },
  "elite_storm": {
    "start": 196338,
    "length": 5291356,
    "rate": 44100
  },
  "elite_crystal": {
    "start": 367452,
    "length": 4483540,
    "rate": 44100
  },
  "boss": {
    "start": 157945,
    "length": 3048936,
    "rate": 44100
  },
  "boss_final": {
    "start": 256811,
    "length": 2309508,
    "rate": 44100
  },
  "victory": {
    "start": 873715,
    "length": 643426,
    "rate": 44100
  },
  "defeat": {
    "start": 198996,
    "length": 1061367,
    "rate": 44100
  },
  "event": {
    "start": 134251,
    "length": 2117017,
    "rate": 44100
  },
  "shop": {
    "start": 1400910,
    "length": 1556880,
    "rate": 44100
  },
  "rest": {
    "start": 247381,
    "length": 3478560,
    "rate": 44100
  }
};

/** key -> 音乐室里的分组（content/bgm.json 的 room） */
export const BGM_ROOMS = {
  "title": "title",
  "map": "map",
  "map_desert": "map",
  "map_canyon": "map",
  "map_forest": "map",
  "map_tide": "map",
  "map_cliff": "map",
  "map_night": "map",
  "map_ruins": "map",
  "map_fungal": "map",
  "map_storm": "map",
  "map_crystal": "map",
  "battle": "battle",
  "battle_desert": "battle",
  "battle_canyon": "battle",
  "battle_forest": "battle",
  "battle_tide": "battle",
  "battle_cliff": "battle",
  "battle_night": "battle",
  "battle_ruins": "battle",
  "battle_fungal": "battle",
  "battle_storm": "battle",
  "battle_crystal": "battle",
  "elite": "elite",
  "elite_desert": "elite",
  "elite_canyon": "elite",
  "elite_forest": "elite",
  "elite_tide": "elite",
  "elite_cliff": "elite",
  "elite_night": "elite",
  "elite_ruins": "elite",
  "elite_fungal": "elite",
  "elite_storm": "elite",
  "elite_crystal": "elite",
  "boss": "boss",
  "boss_final": "boss",
  "victory": "misc",
  "defeat": "misc",
  "event": "misc",
  "shop": "misc",
  "rest": "misc"
};

/** key -> 素材来源 id（content/bgm.json 的 source） */
export const BGM_SOURCES = {
  "title": "ontama",
  "map": "ontama",
  "map_desert": "dsymphony",
  "map_canyon": "ontama",
  "map_forest": "ontama",
  "map_tide": "ontama",
  "map_cliff": "ontama",
  "map_night": "ontama",
  "map_ruins": "dsymphony",
  "map_fungal": "dsymphony",
  "map_storm": "dsymphony",
  "map_crystal": "dsymphony",
  "battle": "ontama",
  "battle_desert": "dsymphony",
  "battle_canyon": "ontama",
  "battle_forest": "ontama",
  "battle_tide": "ontama",
  "battle_cliff": "ontama",
  "battle_night": "ontama",
  "battle_ruins": "dsymphony",
  "battle_fungal": "dsymphony",
  "battle_storm": "dsymphony",
  "battle_crystal": "dsymphony",
  "elite": "ontama",
  "elite_desert": "ontama",
  "elite_canyon": "ontama",
  "elite_forest": "ontama",
  "elite_tide": "ontama",
  "elite_cliff": "ontama",
  "elite_night": "ontama",
  "elite_ruins": "dsymphony",
  "elite_fungal": "dsymphony",
  "elite_storm": "dsymphony",
  "elite_crystal": "dsymphony",
  "boss": "ontama",
  "boss_final": "dsymphony",
  "victory": "ontama",
  "defeat": "ontama",
  "event": "ontama",
  "shop": "ontama",
  "rest": "ontama"
};

/** 音乐室分组顺序 */
export const BGM_ROOM_ORDER = [
  "title",
  "map",
  "battle",
  "elite",
  "boss",
  "misc"
];

/** 素材来源与授权（署名要求就写在这里，音乐室与设置页直接读它） */
export const BGM_CREDITS = {
  "ontama": {
    "name": "音楽の卵",
    "site": "ontama-m.com",
    "url": "https://ontama-m.com/ongaku.html",
    "license": "个人 / 法人均可免费使用、无需报告、无需署名、可商用（署名非必须，游戏里仍然标注了出处）"
  },
  "dsymphony": {
    "name": "龍的交響楽",
    "site": "d-symphony.com",
    "url": "http://d-symphony.com/",
    "license": "免费使用（非营利 / 营利均可）、无需报告与许可，唯一要求是在制作人员名单等处标注「龍的交響楽」或链接 http://d-symphony.com/"
  }
};

/** 授权说明的原文（会被 i18n 词表原地改写，别当常量缓存） */
export const BGM_LICENSES = {
  "ontama": "个人 / 法人均可免费使用、无需报告、无需署名、可商用（署名非必须，游戏里仍然标注了出处）",
  "dsymphony": "免费使用（非营利 / 营利均可）、无需报告与许可，唯一要求是在制作人员名单等处标注「龍的交響楽」或链接 http://d-symphony.com/"
};
// #endregion GENERATED-BGM

/**
 * 主题曲查找：先找「地图专属」，再退回通用曲。
 * 找不到的键会一直退到 fallback 链的最后一环，保证永远有曲子可放。
 */
export function bgmKeyFor(prefix, key, fallback = prefix) {
  const primary = `${prefix}_${key}`;
  if (BGM_FILES[primary]) return primary;
  if (BGM_FILES[fallback]) return fallback;
  return Object.keys(BGM_FILES)[0];
}

/** `battle_forest` -> `battle`：某一首放不出来时退回它的通用曲 */
export function baseKeyOf(key) {
  const i = key.indexOf('_');
  return i < 0 ? null : key.slice(0, i);
}

const FADE_MS = 900;
const FADE_S = FADE_MS / 1000;
/** 解好的 AudioBuffer 最多留几首（一首 3 分钟立体声大约 60MB，不能全留着） */
const MAX_DECODED = 3;
/** 还没解码的压缩数据最多留几首（一首大约 2~4MB） */
const MAX_BYTES = 6;

/** 淡入用的音量曲线：平方根（听起来比线性自然），淡出用线性 */
function fadeInCurve(target, n = 64) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = target * Math.sqrt(i / (n - 1));
  return c;
}

/**
 * 从 ogg 的 Vorbis 注释块里读循环点（**兜底**路径，正常走生成表 BGM_LOOPS）。
 *
 * 两个来源的 ogg 都带 `LOOPSTART=` / `LOOPLENGTH=` 注释（RPG Maker 那套约定，单位是
 * **采样数**）：文件其实是「前奏 + 循环段」，例如 battle.ogg 是 3.8 秒前奏 + 87.9 秒
 * 循环（合起来正好等于文件总长）。直接 loop 整个 buffer 会把前奏每圈重放一遍 ——
 * 听感上就是「循环点不对」。
 *
 * 正常路径不用这个函数：下载时（tools/fetch-bgm.mjs）就把注释读出来、拿解码长度
 * 验一遍，写进 BGM_LOOPS。**验不过的那条在表里是 null**，这里就不能再去信文件里的
 * 注释（上游换过文件但没换注释，battle_storm.ogg 就声称自己有 941 秒音乐）。
 * 只有表里根本没有这个 key 时（例如有人手工塞了一个 ogg 进来）才现读一遍。
 */
function readLoopMeta(ab) {
  try {
    // 注释块在文件开头（这些文件的标记都在 150~250 字节处），扫前 64KB 足够
    const u8 = new Uint8Array(ab, 0, Math.min(ab.byteLength, 65536));
    const s = new TextDecoder('latin1').decode(u8);
    // 两条注释不一定相邻、也不一定按顺序（battle_storm.ogg 把 LOOPLENGTH 写在前面），
    // 所以各自单独匹配
    const st = /LOOPSTART=(\d+)/.exec(s);
    const ln = /LOOPLENGTH=(\d+)/.exec(s);
    if (!st || !ln) return null;
    const start = Number(st[1]);
    const length = Number(ln[1]);
    if (!(length > 0)) return null;
    return { start, length };
  } catch {
    return null;
  }
}

/** 这首曲子的循环参数：优先用生成表（已校验），表里没有才现读注释 */
function loopSpanFor(key, ab) {
  if (key in BGM_LOOPS) {
    const t = BGM_LOOPS[key];
    return t && t.start != null && t.length > 0 ? { start: t.start, length: t.length, rate: t.rate } : null;
  }
  return readLoopMeta(ab);
}

export const music = {
  enabled: true,
  volume: 0.32,
  debug: false,
  current: null,

  // ---- WebAudio 通道（首选）----
  /** 由 audio.js 在 init() 里接上，BGM 直接进 master（音乐音量自己管） */
  _ctx: null,
  _bus: null,
  /** key -> Promise<ArrayBuffer|null>：压缩数据（预取用，解码后就让位给 AudioBuffer） */
  _bytes: new Map(),
  _bytesOrder: [],
  /** key -> Promise<AudioBuffer|null>：解好的音频 */
  _bufs: new Map(),
  _bufOrder: [],
  /** key -> { src, gain }：正在响的 BufferSource */
  _live: new Map(),
  /** key -> { start, length }：从 ogg 注释里读到的循环点（单位：采样数） */
  _loopMeta: new Map(),
  /** 每切换一次 +1，用来丢掉「切走了才解码完」的迟到结果 */
  _seq: 0,

  // ---- <audio> 兜底通道 ----
  _els: new Map(),
  /** 加载失败的曲目（按键记录，不再重试）。某个键失败不该把整条 BGM 通道拖死。 */
  _failedKeys: new Set(),
  /** 连兜底曲都放不出来（file:// 下必然如此）时置位，避免反复报错 */
  _silent: false,
  /** 被 setEnabled(false) 掐掉时记着是哪首，重新打开能接着放 */
  _mutedKey: null,

  /** audio.js 建好 AudioContext 后调用：之后 BGM 就走 AudioBuffer 无缝循环 */
  attach(ctx, bus) {
    if (!ctx || this._ctx === ctx) return false;
    this._ctx = ctx;
    this._bus = bus || ctx.destination;
    if (this.debug) console.log('[music] 接入 WebAudio，BGM 改用 AudioBuffer 无缝循环');
    // attach 之前就用 <audio> 放上了的话（例如 unlock 晚了），把当前这首挪过来
    const key = this.current;
    const el = key ? this._els.get(key) : null;
    if (key && el && !el.paused && !el.ended) {
      this._buf(key).then((buf) => {
        if (!buf || this.current !== key) return;
        this._start(key, buf, { restart: false });
        this._fadeOutEl(el);
      });
    }
    return true;
  },

  // ------------------------------------------------------------------
  // 加载
  // ------------------------------------------------------------------

  /** 取压缩数据（预取 / 解码都从这里走） */
  _bytesOf(key) {
    if (this._bytes.has(key)) return this._bytes.get(key);
    const file = BGM_FILES[key];
    const p = (!file || typeof fetch !== 'function')
      ? Promise.resolve(null)
      : fetch(BASE + file)
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        })
        .then((ab) => {
          // 循环点要趁解码前取（万一要现读注释，decodeAudioData 会把 buffer 摘走）
          const meta = loopSpanFor(key, ab);
          if (meta) this._loopMeta.set(key, meta);
          else if (this.debug) console.log('[music] 这首没有可用的循环点，整首循环：', key);
          return ab;
        })
        .catch((e) => {
          if (this.debug) console.warn('[music] 取不到', key, '(' + file + ')：' + e.message);
          return null;
        });
    this._bytes.set(key, p);
    this._bytesOrder.push(key);
    while (this._bytesOrder.length > MAX_BYTES) {
      const old = this._bytesOrder.shift();
      if (old !== key) this._bytes.delete(old);
    }
    return p;
  },

  /** 解码成 AudioBuffer（同一首只解一次） */
  _buf(key) {
    if (this._bufs.has(key)) return this._bufs.get(key);
    if (!this._ctx) return Promise.resolve(null);
    const ctx = this._ctx;
    const p = this._bytesOf(key).then((ab) => {
      if (!ab || !ab.byteLength) return null;
      return new Promise((resolve) => {
        let settled = false;
        const ok = (buf) => { if (!settled) { settled = true; resolve(buf || null); } };
        const bad = () => {
          if (settled) return;
          settled = true;
          if (this.debug) console.warn('[music] 解码失败，退回 <audio> 元素播放：', key);
          resolve(null);
        };
        try {
          const ret = ctx.decodeAudioData(ab, ok, bad);
          if (ret && typeof ret.then === 'function') ret.then(ok, bad);
        } catch (e) { bad(); }
      });
    }).then((buf) => {
      // 解码会把 ArrayBuffer 摘走，压缩数据就没用了，顺手让位（省内存）
      this._bytes.delete(key);
      return buf;
    });
    this._bufs.set(key, p);
    this._bufOrder.push(key);
    while (this._bufOrder.length > MAX_DECODED) {
      const old = this._bufOrder.shift();
      if (old !== key && old !== this.current) this._bufs.delete(old);
    }
    return p;
  },

  // ------------------------------------------------------------------
  // 播放
  // ------------------------------------------------------------------

  /**
   * 预加载若干场景（不播放）。
   * @param {string|string[]} keys
   * @param {{decode?:boolean}} opts
   *   decode=false（默认）只预取压缩数据 —— 解码一首要几十 MB，留到真要放的时候再解。
   *   decode=true 连 AudioBuffer 一起解好：遭遇演出（src/ui/encounter.js）的停留阶段
   *   就是这么用的 —— 拿那段时间换「幕布一掀开，战斗曲已经在响」，
   *   否则 music.play() 还得先 fetch 整首 ogg 再解码，开头会有半秒安静。
   *   解码结果进的是和 play() 同一张缓存、同一个淘汰策略（MAX_DECODED），
   *   所以这里提前解码不会多占内存。
   * @returns {Promise<Array>} 这一批准备好的时候兑现（放不出来的也算准备好）
   */
  preload(keys = [], opts = {}) {
    const jobs = [];
    for (const key of [].concat(keys)) {
      if (!key || !BGM_FILES[key]) continue;
      if (this._ctx) {
        const p = this._bytesOf(key);
        jobs.push(opts.decode ? this._buf(key) : p);
      } else {
        const el = this._element(key);
        if (el) { try { el.preload = 'auto'; el.load(); } catch { /* ignore */ } }
      }
    }
    return Promise.all(jobs.map((p) => Promise.resolve(p).catch(() => null)));
  },

  /**
   * 切到某个场景的曲子。
   * @param {string} key BGM_FILES 的键
   * @param {{restart?:boolean}} opts
   */
  play(key, opts = {}) {
    if (!this.enabled) return false;
    if (this._failedKeys.has(key)) {
      // 这首放不出来：退到通用曲（map_forest -> map），再不行就放弃
      const base = baseKeyOf(key);
      if (!base || base === key || this._failedKeys.has(base)) return false;
      key = base;
    }
    if (this.current === key && !opts.restart) return true;

    const prevKey = this.current;
    this.current = key;
    this._mutedKey = null;
    this._seq++;
    const seq = this._seq;
    // 真的开始放了才算「听过」（曲子被换掉 / 放不出来都不算），音乐室据此解锁
    markHeard(key);
    if (this.debug) console.log('[music] 切歌 ->', key, '(' + BGM_FILES[key] + ')');

    if (this._ctx) {
      // WebAudio：解码好再交叉淡入（解码期间旧曲子继续响着，不会出现空档）
      this._buf(key).then((buf) => {
        if (this.current !== key || this._seq !== seq) return;
        if (buf) {
          this._start(key, buf, opts);
          this._fadeOutOthers(key, prevKey);
        } else {
          this._playElement(key, opts, prevKey);
        }
      });
      return true;
    }
    return this._playElement(key, opts, prevKey);
  },

  /** WebAudio：起一个 loop=true 的 BufferSource，音量用 GainNode 曲线推上去 */
  _start(key, buf, opts) {
    const ctx = this._ctx;
    const old = this._live.get(key);
    if (old) this._stopLive(key, 0.08);           // restart：同曲重放，把旧的掐掉
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;                              // ← 循环点是采样精确的
    // 循环段来自 BGM_LOOPS（下载时从 ogg 注释里读出来、并用解码长度校验过）：
    // 前奏只放一次，到循环尾跳回循环头。表里是 null 就是「整首循环」。
    const meta = this._loopMeta.get(key);
    let loopText = '整首循环';
    if (meta && meta.length > 0) {
      // 采样率陷阱：注释里的采样数是按 **44100** 写的（title.ogg 196488+4920833 = 5117321
      // 采样 ÷ 44100 = 116.06s，正好等于文件实际时长），而 decodeAudioData 会把音频
      // **重采样到 AudioContext 的采样率**（Windows 上常是 48000）。
      // 拿 buf.sampleRate 去换算的话，循环点会整体提前 8.8% —— 结尾被砍掉近 10 秒再跳回去，
      // 听起来就是「循环点还是不对」（这个坑踩过一次）。
      // 表里带了下载时用的那个采样率，但仍然不写死：哪个能让「循环段末尾 = 文件末尾」
      // 对上就用哪个。
      const total = meta.start + meta.length;
      const nominal = meta.rate || 44100;
      const byDefault = Math.abs(total / nominal - buf.duration);
      const byBuffer = Math.abs(total / buf.sampleRate - buf.duration);
      const rate = byDefault <= byBuffer ? nominal : buf.sampleRate;
      const ls = meta.start / rate;
      const le = total / rate;
      if (le > ls && le <= buf.duration + 0.6) {
        src.loopStart = ls;
        src.loopEnd = Math.min(le, buf.duration);
        loopText = `循环段 ${ls.toFixed(2)}~${src.loopEnd.toFixed(2)}s（前奏 ${ls.toFixed(2)}s 只放一次，按 ${rate}Hz 换算）`;
      }
    }
    const gain = ctx.createGain();
    const target = this.enabled ? this.volume : 0;
    gain.gain.setValueAtTime(0, now);
    src.connect(gain);
    gain.connect(this._bus);
    try { src.start(now); } catch (e) { if (this.debug) console.warn('[music] start 失败', key, e.message); }
    try { gain.gain.setValueCurveAtTime(fadeInCurve(target), now, FADE_S); }
    catch { gain.gain.setValueAtTime(target, now); }
    this._live.set(key, { src, gain, fading: false });
    if (this.debug) {
      console.log('[music] 播放(webaudio)', key, '时长 ' + buf.duration.toFixed(1) + 's，loop=true，' + loopText);
    }
  },

  _fadeOutOthers(keepKey, prevKey) {
    for (const k of [...this._live.keys()]) if (k !== keepKey) this._stopLive(k, FADE_S);
    for (const [k, el] of [...this._els]) if (k !== keepKey && !el.paused) this._fadeOutEl(el);
    if (prevKey && prevKey !== keepKey && this.debug) console.log('[music] 交叉淡出 ->', prevKey);
  },

  /** 淡出并停掉一个 BufferSource（dur 秒后真正 stop） */
  _stopLive(key, dur = FADE_S) {
    const live = this._live.get(key);
    if (!live) return;
    this._live.delete(key);
    const ctx = this._ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const g = live.gain.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); }
      if (dur > 0) g.linearRampToValueAtTime(0, now + dur);
      else g.setValueAtTime(0, now);
    } catch { /* ignore */ }
    const stopAt = now + Math.max(dur, 0) + 0.02;
    try { live.src.stop(stopAt); } catch { /* 已经停了 */ }
    live.src.onended = () => {
      try { live.src.disconnect(); live.gain.disconnect(); } catch { /* ignore */ }
    };
  },

  /** 兜底：<audio> 元素（老路子，仍然挂着 loop） */
  _playElement(key, opts = {}, prevKey = null) {
    const el = this._element(key);
    if (!el) return false;
    if (prevKey && prevKey !== key) {
      const prevEl = this._els.get(prevKey);
      if (prevEl) this._fadeOutEl(prevEl);
    }
    try {
      if (opts.restart || el.paused || el.ended) el.currentTime = 0;
    } catch { /* 还没拿到元数据，忽略 */ }
    if (opts.restart) el.volume = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* 自动播放被拦，等用户交互后再试 */ });
    this._animate(el, Math.max(this.volume, 0.0001), true);
    return true;
  },

  /** 创建（或复用）某个场景的 audio 元素（只在兜底通道里用） */
  _element(key) {
    if (this._els.has(key)) return this._els.get(key);
    const file = BGM_FILES[key];
    if (!file) return null;
    const el = new Audio();
    el.src = BASE + file;
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.addEventListener('error', () => {
      // 只把「这一首」标记为不可用，并试试退回通用曲（例如 battle_forest 没下到
      // 就退到 battle）。全都放不出来才静默降级（file:// 下就是这样）。
      this._failedKeys.add(key);
      if (this.debug) console.warn('[music] 加载失败:', key, '(' + file + ')');
      const base = baseKeyOf(key);
      if (this.current === key) {
        if (base && base !== key && !this._failedKeys.has(base)) {
          this.play(base, { restart: true });
        } else {
          this.current = null;
          this._silent = true;
          if (this.debug) console.warn('[music] 没有可用的 BGM 了，静默降级为无声');
        }
      }
    });
    this._els.set(key, el);
    return el;
  },

  _fadeOutEl(el) {
    this._animate(el, 0, false, () => {
      try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
    });
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    // 兜底通道
    const el = this.current ? this._els.get(this.current) : null;
    if (el) {
      clearInterval(el._fadeTimer);
      el._fadeTimer = null;
      el.volume = this.volume;
    }
    // WebAudio 通道
    if (this._ctx) {
      const live = this.current ? this._live.get(this.current) : null;
      if (live) {
        const g = live.gain.gain;
        const now = this._ctx.currentTime;
        try {
          g.cancelScheduledValues(now);
          g.setValueAtTime(this.volume, now);
        } catch { /* ignore */ }
      }
    }
  },

  /**
   * 音量过渡（只给 <audio> 兜底通道用；WebAudio 那边是 GainNode 自动化）。
   * 用 setTimeout 而不是 requestAnimationFrame：rAF 在页面不可见 / 无头环境里会被节流
   * 甚至完全不回调，用定时器更可靠（这里也不需要跟屏幕刷新同步）。
   * 过渡结束后一定会把音量精确落到目标值，避免出现「循环播放但音量 0」的静音 bug。
   */
  _animate(el, target, rising, done) {
    const from = Number.isFinite(el.volume) ? el.volume : 0;
    const safeTarget = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));
    const t0 = performance.now();
    clearInterval(el._fadeTimer);
    el._fadeTimer = setInterval(() => {
      const k = Math.min(1, Math.max(0, (performance.now() - t0) / FADE_MS));
      // 淡入用平方根（听起来更自然），淡出用平方
      const eased = rising ? Math.sqrt(k) : k * k;
      const v = from + (safeTarget - from) * eased;
      el.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : safeTarget;
      if (k >= 1) {
        clearInterval(el._fadeTimer);
        el._fadeTimer = null;
        el.volume = safeTarget;
        if (done) done();
      }
    }, 40);
    // 兜底：即使定时器被完全阻塞，也保证 1.2 秒后音量到位
    setTimeout(() => {
      if (el._fadeTimer === null || !el.paused) {
        el.volume = safeTarget;
      }
    }, FADE_MS + 300);
  },

  stop(fade = true) {
    if (!this.current) return;
    const key = this.current;
    if (fade) {
      this._stopLive(key, FADE_S);
      const el = this._els.get(key);
      if (el) this._fadeOutEl(el);
    } else {
      this._stopLive(key, 0);
      const el = this._els.get(key);
      if (el) { try { el.pause(); el.volume = 0; } catch { /* ignore */ } }
    }
    this.current = null;
  },

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this._mutedKey = this.current;
      this.stop(false);
    } else if (this._mutedKey) {
      const key = this._mutedKey;
      this._mutedKey = null;
      this.play(key, { restart: false });
    }
  },

  nowPlaying() {
    return this.current;
  },

  /** 调试信息 */
  status() {
    const key = this.current;
    const el = key ? this._els.get(key) : null;
    const live = key ? this._live.get(key) : null;
    return {
      key,
      file: key ? BGM_FILES[key] : null,
      backend: this._ctx ? 'webaudio' : 'element',
      ctxState: this._ctx ? this._ctx.state : 'none',
      loop: this._ctx ? !!live : (el ? el.loop : null),
      sources: this._live.size,
      // <audio> 兜底通道的实际音量（WebAudio 走 GainNode，这里给 null）
      volume: this._ctx ? null : (el ? Number(el.volume.toFixed(3)) : null),
      gain: live ? Number(live.gain.gain.value.toFixed(3)) : null,
      paused: this._ctx ? !live : (el ? el.paused : null),
      decoded: [...this._bufs.keys()],
      failed: this._silent,
      failedKeys: [...this._failedKeys],
      loaded: [...this._els.keys()],
    };
  },
};
