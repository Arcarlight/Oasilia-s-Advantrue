// UI 协调器：监听 game 状态变化，决定渲染哪个界面。

import { clear, toast, el } from './dom.js';
import { BattleScreen } from './battle-view.js';
import { renderHud, hideHud } from './hud.js';
import { showDeck, showItems, showHelp, showSettings } from './overlays.js';
import {
  renderTitle, renderMap, renderEvent, renderChest, renderRest,
  renderShop, renderReward, renderGameOver, renderVictory,
} from './screens.js';
import { audio } from '../core/audio.js';
import { bgmKeyFor } from '../core/bgm.js';
import { BIOMES } from '../data/balance.js';
import { applyCursorTheme } from './cursor.js';
import { stageCount } from '../data/mapgen.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.current = null;   // 当前界面 key，避免重复渲染
    this.battleScreen = null;
    this.stage = document.getElementById('stage');
    game.onChange = () => this.render();
    this.bindGlobal();
  }

  bindGlobal() {
    // 首次交互解锁音频
    const unlock = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      audio.ui('open');
      showSettings();
    });
    document.getElementById('btn-deck')?.addEventListener('click', () => {
      audio.ui('open');
      // 卡组一览是只读的（出战卡组 = 全部所持卡牌），所以战斗中也能看 —— 查牌挺有用的
      if (this.game.data) showDeck(this.game);
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      // Esc 交给 modal() 自己处理：它知道「该关最上面那一层」。
      // 这里以前也抢着 remove() 第一个 .modal-backdrop，于是
      // 卡组页 + 卡牌详情叠着开时，一次 Esc 会把两层一起关掉，
      // 而且绕过 modal 的 close()（onClose 不执行）。
      const modalOpen = document.querySelector('.modal-backdrop');
      if (modalOpen) return;

      if (this.game.phase === 'battle' && this.battleScreen) {
        const bs = this.battleScreen;
        if (e.key === ' ') { e.preventDefault(); bs.onEndTurn(); return; }
        const n = Number(e.key);
        if (n >= 1 && n <= 9) {
          const hand = this.game.battle.hand('player');
          const entry = hand[n - 1];
          if (entry) bs.playCard(entry.uid);
        }
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        if (this.game.data && this.game.phase !== 'title') showDeck(this.game);
      }
      if (e.key === 'i' || e.key === 'I') {
        if (this.game.data && this.game.phase !== 'title') showItems(this.game);
      }
      if (e.key === 'h' || e.key === 'H' || e.key === '?') showHelp();
    });
  }

  /** 根据 game.phase 渲染 */
  render() {
    const g = this.game;
    const phase = g.phase;

    // 场景 BGM：地图与战斗都按**当前地图**换曲（每章不同），找不到专属曲就退回通用曲
    const biome = g.data?.map?.biome ?? 'desert';
    // 鼠标指针也跟着当前地图的主题色描边（纯白指针在浅色沙漠/亮色盐海上不好找）
    applyCursorTheme((BIOMES[biome] ?? BIOMES.desert)?.accent ?? '#f0b95c');
    // 整页 UI 主题色也按地图走：style.css 里 body[data-biome=...] 覆盖了 accent 三个变量，
    // 按钮 / 标题 / 血条 / 地图节点 / 焦点描边一起换色（盐海是蓝、密林是绿…）
    if (document.body && document.body.dataset.biome !== biome) document.body.dataset.biome = biome;
    const lastStage = stageCount() - 1;
    switch (phase) {
      case 'title': audio.playBgm('title'); break;
      case 'map': audio.playBgm(bgmKeyFor('map', biome)); break;
      case 'battle': {
        const kind = g.battleKind ?? 'normal';
        if (kind === 'boss') audio.playBgm(g.data?.stage >= lastStage ? 'boss_final' : 'boss');
        else if (kind === 'elite') audio.playBgm('elite');
        else audio.playBgm(bgmKeyFor('battle', biome));
        break;
      }
      case 'event': audio.playBgm('event'); break;
      case 'chest': audio.playBgm('event'); break;
      case 'shop': audio.playBgm('shop'); break;
      case 'rest': audio.playBgm('rest'); break;
      case 'reward': audio.playBgm('victory'); break;
      case 'gameover': audio.playBgm('defeat'); break;
      case 'victory': audio.playBgm('victory'); break;
      default: break;
    }

    switch (phase) {
      case 'title': {
        if (this.current === 'title') return;
        this.teardownBattle();
        hideHud();
        this.current = 'title';
        renderTitle(g);
        break;
      }
      case 'map': {
        this.teardownBattle();
        renderHud(g);
        if (this.current === 'map' && !g.mapDirty) {
          // 地图结构没变，只需要刷新 HUD
          renderHud(g);
          return;
        }
        this.current = 'map';
        g.mapDirty = false;
        renderMap(g);
        renderHud(g);
        break;
      }
      case 'battle': {
        if (this.current === 'battle' && this.battleScreen && this.battleScreen.battle === g.battle) return;
        this.teardownBattle();
        clear(this.stage);
        renderHud(g);
        this.current = 'battle';
        const bs = new BattleScreen(g, this.stage);
        this.battleScreen = bs;
        bs.mount().catch((err) => {
          console.error('战斗界面挂载失败:', err?.message, '\n', err?.stack);
          toast('战斗界面出错，已返回地图。', 'bad');
          g.phase = 'map';
          this.current = null;
          this.render();
        });
        break;
      }
      case 'event':
        this.teardownBattle();
        renderHud(g);
        this.current = 'event';
        renderEvent(g);
        break;
      case 'chest':
        this.teardownBattle();
        renderHud(g);
        this.current = 'chest';
        renderChest(g);
        break;
      case 'rest':
        this.teardownBattle();
        renderHud(g);
        this.current = 'rest';
        renderRest(g);
        break;
      case 'shop':
        this.teardownBattle();
        renderHud(g);
        this.current = 'shop';
        renderShop(g);
        break;
      case 'reward':
        this.teardownBattle();
        renderHud(g);
        this.current = 'reward';
        renderReward(g);
        break;
      case 'gameover':
        this.teardownBattle();
        hideHud();
        this.current = 'gameover';
        renderGameOver(g);
        break;
      case 'victory':
        this.teardownBattle();
        hideHud();
        this.current = 'victory';
        renderVictory(g);
        break;
      default:
        break;
    }
  }

  teardownBattle() {
    if (this.battleScreen) {
      this.battleScreen.destroy();
      this.battleScreen = null;
    }
  }

  /** 强制重新渲染当前界面（例如 HUD 数值变化） */
  forceRerender() {
    this.current = null;
    this.render();
  }
}
