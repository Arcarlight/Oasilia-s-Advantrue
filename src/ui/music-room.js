// 曲子库（音乐室）：标题页进去，一屏看完这游戏里所有的 BGM。
//
// ── 规则 ────────────────────────────────────────────────────────────
// 界面一律把 41 首排全（分组、位置固定），但**没在游戏里真的听到过的那首只显示
// 「？？？」**：曲名、出处、时长全藏起来，点了也放不出来。听过的才亮出来，
// 并且可以直接点着试听。
//
// 为什么要有这么个东西：以前设置面板里塞了一个「切换 BGM（试听）」下拉框，
// 那一栏把 41 首曲子的名字（还带上游的日文原名）全摆出来了 ——
// 一进设置就被剧透干净，而玩家真正想要的是「我走过哪些地方、打过哪些架」那点回忆。
//
// 解锁状态存在跨局存档里（meta.heardBgm，见 src/core/save.js），记的是 BGM 的 key；
// 名字一律现查（BGM_NAMES 是「场景 · 上游原名」，会跟着内容表更新）。

import { el, modal, toast } from './dom.js';
import { t } from '../core/i18n.js';
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { music, BGM_FILES, BGM_NAMES, BGM_ROOMS, BGM_ROOM_ORDER, BGM_CREDITS, BGM_SOURCES } from '../core/bgm.js';

/**
 * 分组标题（分组 key 由 content/bgm.json 的 room 决定）。
 *
 * ⚠ 两条都要守住：
 *   ① 必须写成 `k: () => t('中文')` 或 `t('中文')` 这种带字面量的形式 ——
 *      tools/build-i18n.mjs 是靠正则找 `t('字面量')` 的，写成 `k: '中文'` 就永远进不了待翻清单
 *      （曲子库第一版就是这样：分组标题、场景名、章节号全是硬编码中文，界面永远中文）。
 *   ② 要在**渲染时**求值（下面用 getter）：模块只 import 一次，写成常量就把首次加载时的
 *      语言焊死了 —— 切到日语之后标题还是中文。
 */
const ROOM_LABEL = {
  get title() { return t('标题画面'); },
  get map() { return t('地图 · 一章一曲'); },
  get battle() { return t('普通战斗'); },
  get elite() { return t('强敌'); },
  get boss() { return t('首领战'); },
  get misc() { return t('胜利 / 失败 / 事件 / 商店 / 营地'); },
};

/**
 * 章节的中文数字 -> 译文。同样在渲染时求值（切语言之后要是新的）。
 * 曲子库的场景名是「第 N 章 + 地图名」，地图名本身会被 applyContentLang 就地改写，
 * 而「第一」这类章节号是拼出来的，所以单列一张小表让它们也能被扫进待翻清单。
 */
const CHAPTER_NUM = {
  get 1() { return t('第一章'); }, get 2() { return t('第二章'); }, get 3() { return t('第三章'); },
  get 4() { return t('第四章'); }, get 5() { return t('第五章'); }, get 6() { return t('第六章'); },
  get 7() { return t('第七章'); }, get 8() { return t('第八章'); }, get 9() { return t('第九章'); },
  get 10() { return t('第十章'); },
};

/**
 * 曲子库第一列显示的东西（场景）。
 *
 * 来源是 content/bgm.json 每条曲子的 `desc`，而它是**拼出来的**：
 *   `标题 · 旅途开始`（desc 两段）、`第一章 流沙之海`（章节号 + 地图名）、
 *   `流沙之海的战斗`（地图名 + 借来的曲子那种写法）…
 * 拼出来的串在词典里永远没有条目，所以**整串 t() 一定退中文**，
 * 连里面本来有译文的 `流沙之海` 也一起被拖住 —— 日语界面里那一列就一直是中文
 * （用户截图指出的「音乐库这些文本完全没有本地化」）。
 *
 * 所以：把所有可能出现的形式**逐个写成 t('字面量')**（扫描器才收得到），
 * 查表时按「写的顺序」匹配（长的、带章节号的排前面）。
 */
const SCENE_LABEL = [
  // 章节：地图（第一章 流沙之海 … 第十章 水晶洞窟）
  { of: '第一章 流沙之海', to: () => t('第一章 流沙之海') },
  { of: '第二章 赤岩峡谷', to: () => t('第二章 赤岩峡谷') },
  { of: '第三章 藤蔓密林', to: () => t('第三章 藤蔓密林') },
  { of: '第四章 潮汐盐海', to: () => t('第四章 潮汐盐海') },
  { of: '第五章 风蚀峭壁', to: () => t('第五章 风蚀峭壁') },
  { of: '第六章 夜砂墓原', to: () => t('第六章 夜砂墓原') },
  { of: '第七章 沉沙遗迹', to: () => t('第七章 沉沙遗迹') },
  { of: '第八章 菌菇湿地', to: () => t('第八章 菌菇湿地') },
  { of: '第九章 雷暴台地', to: () => t('第九章 雷暴台地') },
  { of: '第十章 水晶洞窟', to: () => t('第十章 水晶洞窟') },
  // 各章的「地图」曲与「强敌」曲用的就是地图名本身
  { of: '流沙之海', to: () => t('流沙之海') },
  { of: '赤岩峡谷', to: () => t('赤岩峡谷') },
  { of: '藤蔓密林', to: () => t('藤蔓密林') },
  { of: '潮汐盐海', to: () => t('潮汐盐海') },
  { of: '风蚀峭壁', to: () => t('风蚀峭壁') },
  { of: '夜砂墓原', to: () => t('夜砂墓原') },
  { of: '沉沙遗迹', to: () => t('沉沙遗迹') },
  { of: '菌菇湿地', to: () => t('菌菇湿地') },
  { of: '雷暴台地', to: () => t('雷暴台地') },
  { of: '水晶洞窟', to: () => t('水晶洞窟') },
  // 战斗 / 强敌：`<地图>的战斗`、`<地图>的强敌`
  { of: '流沙之海的战斗', to: () => t('流沙之海的战斗') },
  { of: '赤岩峡谷的战斗', to: () => t('赤岩峡谷的战斗') },
  { of: '藤蔓密林的战斗', to: () => t('藤蔓密林的战斗') },
  { of: '潮汐盐海的战斗', to: () => t('潮汐盐海的战斗') },
  { of: '风蚀峭壁的战斗', to: () => t('风蚀峭壁的战斗') },
  { of: '夜砂墓原的战斗', to: () => t('夜砂墓原的战斗') },
  { of: '沉沙遗迹的战斗', to: () => t('沉沙遗迹的战斗') },
  { of: '菌菇湿地的战斗', to: () => t('菌菇湿地的战斗') },
  { of: '雷暴台地的战斗', to: () => t('雷暴台地的战斗') },
  { of: '水晶洞窟的战斗', to: () => t('水晶洞窟的战斗') },
  { of: '流沙之海的强敌', to: () => t('流沙之海的强敌') },
  { of: '赤岩峡谷的强敌', to: () => t('赤岩峡谷的强敌') },
  { of: '藤蔓密林的强敌', to: () => t('藤蔓密林的强敌') },
  { of: '潮汐盐海的强敌', to: () => t('潮汐盐海的强敌') },
  { of: '风蚀峭壁的强敌', to: () => t('风蚀峭壁的强敌') },
  { of: '夜砂墓原的强敌', to: () => t('夜砂墓原的强敌') },
  { of: '沉沙遗迹的强敌', to: () => t('沉沙遗迹的强敌') },
  { of: '菌菇湿地的强敌', to: () => t('菌菇湿地的强敌') },
  { of: '雷暴台地的强敌', to: () => t('雷暴台地的强敌') },
  { of: '水晶洞窟的强敌', to: () => t('水晶洞窟的强敌') },
  // 非地图场景
  { of: '标题 · 旅途开始', to: () => t('标题 · 旅途开始') },
  { of: '地图兜底曲', to: () => t('地图兜底曲') },
  { of: '战斗兜底曲', to: () => t('战斗兜底曲') },
  { of: '强敌兜底曲', to: () => t('强敌兜底曲') },
  { of: '章节首领', to: () => t('章节首领') },
  { of: '最终首领（终章）', to: () => t('最终首领（终章）') },
  { of: '战斗胜利 / 通关', to: () => t('战斗胜利 / 通关') },
  { of: '失败', to: () => t('失败') },
  { of: '未知事件 / 宝箱', to: () => t('未知事件 / 宝箱') },
  { of: '商店', to: () => t('商店') },
  { of: '营地', to: () => t('营地') },
];

/**
 * 场景名 -> 译文：先按上面的表查（长的优先），查不到再退到「章节号 + 地图名」拆开翻。
 */
function translateScene(scene) {
  for (const { of, to } of SCENE_LABEL) if (of === scene) return to();
  const at = scene.indexOf(' ');
  if (at < 0) return t(scene);
  const head = scene.slice(0, at);
  const rest = scene.slice(at + 1);
  const num = /^第([一二三四五六七八九十]+)章$/.exec(head);
  if (!num) return `${t(head)} ${t(rest)}`;
  const zhNum = num[1];
  const n = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }[zhNum];
  return `${CHAPTER_NUM[n] ?? t(head)} ${t(rest)}`;
}

/** 地图名（这些是 biomes.json 的 name，词典里有；写在这里是为了让扫描器收得到） */
const BIOME_LABEL = {
  desert: t('流沙之海'), canyon: t('赤岩峡谷'), forest: t('藤蔓密林'),
  tide: t('潮汐盐海'), cliff: t('风蚀峭壁'), night: t('夜砂墓原'),
  ruins: t('沉沙遗迹'), fungal: t('菌菇湿地'), storm: t('雷暴台地'), crystal: t('水晶洞窟'),
};
void BIOME_LABEL;

/** 这一屏里的全部曲目（按分组顺序） */
export function musicRoomTracks() {
  const keys = Object.keys(BGM_FILES);
  const out = [];
  for (const room of BGM_ROOM_ORDER) {
    const inRoom = keys.filter((k) => (BGM_ROOMS[k] ?? 'misc') === room);
    if (inRoom.length) out.push({ room, keys: inRoom });
  }
  // 万一有 key 的 room 不在 roomOrder 里，也排到最后，别让它从界面上消失
  const known = new Set(BGM_ROOM_ORDER);
  const orphans = keys.filter((k) => !known.has(BGM_ROOMS[k] ?? 'misc'));
  if (orphans.length) out.push({ room: null, keys: orphans });
  return out;
}

/** 听过几首 / 一共几首（标题页按钮上的小字用它） */
export function musicRoomProgress() {
  const total = Object.keys(BGM_FILES).length;
  const heard = new Set(save.readMeta().heardBgm ?? []);
  return { heard: Object.keys(BGM_FILES).filter((k) => heard.has(k)).length, total };
}

/**
 * 「场景 · 上游原名」拆成两段显示：场景名是给玩家看的，原名是出处。
 *
 * 场景那一半要**逐段翻**：BGM_NAMES 是 `desc · name` 拼出来的
 * （`标题 · 旅途开始 · 旅のはじめ`），整串在词典里没有条目，
 * 直接 t(整串) 会整串退回中文 —— 连本来有译文的 `标题 · 旅途开始` 也一起被拖住
 * （用户截图指出的就是这个：日语界面里「标题画面」下面还跟着一行中文）。
 * 所以先试着翻「场景」那一整段（`标题 · 旅途开始` 这种确实有译文），
 * 不行再退到 translateScene()（管「第一章 流沙之海」这种拼出来的章节名）。
 */
function splitName(key) {
  const full = BGM_NAMES[key] ?? key;
  const at = full.lastIndexOf(' · ');
  const scene = at < 0 ? full : full.slice(0, at);
  const title = at < 0 ? '' : full.slice(at + 3);
  return { scene: translateScene(scene), title };
}

export function showMusicRoom() {
  const body = el('div', { class: 'mr' });
  let playing = music.nowPlaying();

  const paint = () => {
    body.replaceChildren();
    const heard = new Set(save.readMeta().heardBgm ?? []);
    const { heard: got, total } = musicRoomProgress();

    body.append(el('p', {
      class: 'mr-lead',
      text: t('走过的地方、打过的架，曲子都在这里。一共 {total} 首，已经听到 {got} 首 —— 没听到的曲名还盖着（显示成 ？？？）。', { got, total }),
    }));

    for (const group of musicRoomTracks()) {
      const section = el('div', { class: 'mr-group' });
      section.append(el('h4', { class: 'mr-group-title', text: ROOM_LABEL[group.room] ?? t('其他') }));
      const list = el('div', { class: 'mr-list' });
      for (const key of group.keys) list.append(row(key, heard.has(key)));
      section.append(list);
      body.append(section);
    }

    const credits = el('div', { class: 'mr-credits' });
    credits.append(el('h4', { text: t('曲子出处') }));
    const ul = el('ul', {});
    /**
     * 两处**非** content/bgm.json 名字的文案也要能翻：
     *   · 授权说明是 content/bgm.json 里的长句，整串当键过一遍 t()（词典里两条都有）；
     *   · 「免费素材」这个分类词在这里现拼 —— 写死就永远是中文，所以也过 t()。
     */
    ul.append(el('li', {}, [
      el('span', { html: `<b>${t('免费素材')}</b>` }),
      el('br'),
      el('span', { class: 'mr-license', text: t('授权说明见下面两个站点链接。') }),
    ]));
    for (const [id, c] of Object.entries(BGM_CREDITS)) {
      const n = Object.values(BGM_SOURCES).filter((s) => s === id).length;
      ul.append(el('li', {}, [
        el('span', { html: `<b>${c.name}</b>（${c.site}，${t('{n} 首', { n })}）` }),
        el('br'),
        el('span', { class: 'mr-license', text: t(c.license) }),
        el('br'),
        el('a', { href: c.url, target: '_blank', rel: 'noreferrer', text: c.url }),
      ]));
    }
    credits.append(ul);
    credits.append(el('p', {
      class: 'mr-note',
      text: t('音频文件按原样使用，未做改编；循环点用的是文件自带的循环标记。'),
    }));
    body.append(credits);
  };

  /**
   * 一行曲子：听过就是「播放」按钮，没听过就是锁着的 ？？？。
   *
   * 锁定行仍然显示**场景**（「第一章 流沙之海」这种），只把**曲名与出处**藏成 ？？？：
   * 场景名是玩家自己走过的地方，本来就知道；藏起来的是「那里放的是哪一首」——
   * 全藏的话一屏全是 ？？？，看不出还有什么可收。
   */
  function row(key, unlocked) {
    const { scene, title } = splitName(key);
    const isPlaying = playing === key;
    const line = el('div', { class: `mr-row${unlocked ? '' : ' locked'}${isPlaying ? ' playing' : ''}` });

    line.append(el('span', { class: 'mr-scene', text: scene }));
    line.append(el('span', { class: 'mr-title', text: unlocked ? title : '？？？' }));

    const right = el('div', { class: 'mr-actions' });
    if (unlocked) {
      right.append(el('button', {
        class: 'btn btn-sm',
        onClick: () => {
          audio.ui('click');
          if (playing === key) {
            // 再点一次 = 从循环头重放
            audio.playBgm(key, { restart: true });
          } else {
            audio.playBgm(key);
          }
          playing = key;
          paint();
        },
      }, [isPlaying ? t('重放') : t('试听')]));
    } else {
      right.append(el('span', { class: 'mr-lock', text: t('还没听到') }));
    }
    line.append(right);
    return line;
  }

  paint();

  const { heard: got, total } = musicRoomProgress();
  return modal({
    title: t('曲子库'),
    wide: true,
    body,
    onClose: () => {
      // 关掉音乐室之后要回到「当前场景该放的那首」，否则回到地图还在放试听的曲子。
      // 走 audio 上的钩子而不是直接 import ui.js：ui.js 已经 import 了 screens.js，
      // 反向 import 会绕成一个环（ESM 能活，但谁先初始化就成了运气问题）。
      audio.resumeSceneBgm();
      if (got === 0) toast(t('游戏里遇到过的曲子会自动收录进来。'), 'good');
    },
  });
}
