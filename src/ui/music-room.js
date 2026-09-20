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

/** 分组标题（分组 key 由 content/bgm.json 的 room 决定） */
const ROOM_LABEL = {
  title: '标题画面',
  map: '地图 · 一章一曲',
  battle: '普通战斗',
  elite: '强敌',
  boss: '首领战',
  misc: '胜利 / 失败 / 事件 / 商店 / 营地',
};

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

/** 「场景 · 上游原名」拆成两段显示：场景名是给玩家看的，原名是出处 */
function splitName(key) {
  const full = BGM_NAMES[key] ?? key;
  const at = full.lastIndexOf(' · ');
  return at < 0 ? { scene: full, title: '' } : { scene: full.slice(0, at), title: full.slice(at + 3) };
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
      section.append(el('h4', { class: 'mr-group-title', text: t(ROOM_LABEL[group.room] ?? t('其他')) }));
      const list = el('div', { class: 'mr-list' });
      for (const key of group.keys) list.append(row(key, heard.has(key)));
      section.append(list);
      body.append(section);
    }

    const credits = el('div', { class: 'mr-credits' });
    credits.append(el('h4', { text: t('曲子出处') }));
    const ul = el('ul', {});
    for (const [id, c] of Object.entries(BGM_CREDITS)) {
      const n = Object.values(BGM_SOURCES).filter((s) => s === id).length;
      ul.append(el('li', {}, [
        el('span', { html: `<b>${c.name}</b>（${c.site}，${t('{n} 首', { n })}）` }),
        el('br'),
        el('span', { class: 'mr-license', text: c.license }),
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

    line.append(el('span', { class: 'mr-scene', text: t(scene) }));
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
