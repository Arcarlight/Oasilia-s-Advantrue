// UI 协调器：监听 game 状态变化，决定渲染哪个界面。

import { toast, el } from './dom.js';
import { BattleScreen } from './battle-view.js';
import { renderHud, hideHud } from './hud.js';
import { showDeck, showItems, showHelp, showSettings } from './overlays.js';
import { showEnemyCodex, showCardCodex } from './codex.js';
import {
  renderTitle, renderMap, renderEvent, renderChest, renderRest,
  renderShop, renderReward, renderGameOver, renderVictory,
} from './screens.js';
import { audio } from '../core/audio.js';
import { bgmKeyFor } from '../core/bgm.js';
import { initLang, currentLang } from '../core/i18n.js';
import { onExpertChange } from '../core/expert.js';
import { refreshI18nTables } from '../core/i18n-tables.js';
import { BALANCE, BIOMES, BIOME_BGM } from '../data/balance.js';
import { enemyDefFor } from '../data/enemies.js';
import { effectiveDef } from '../core/battle.js';
import { setCardTextContext } from './cardtext.js';
import { applyCursorTheme } from './cursor.js';
import { stageCount } from '../data/mapgen.js';
import { playEncounter, wantsEncounter } from './encounter.js';

// 注意：换语言的实现在 src/ui/langswitch.js（那边不 import 本文件，避免和 screens.js 成环）。
// 这里**不要**写「转口导出」（也就是 export 花括号 + from 那种写法）：
// 打包器只认普通 export 与 import，转口导出会剩下半句 from '...'，单文件包直接语法错误
// （踩过一次：verify-bundle 报「游戏没启动」）。
// 另外注释里也别出现那种写法的字面样子 —— 打包器是用正则扫的，注释里的也会被它当成代码。

export class UI {
  constructor(game) {
    this.game = game;
    this.current = null;   // 当前界面 key，避免重复渲染
    this.battleScreen = null;
    this.stage = document.getElementById('stage');
    /**
     * 语言要在**第一次渲染之前**定下来：
     *   ① initLang() 读跨局记录里的选择（没存过就按浏览器语言猜）；
     *   ② refreshI18nTables() 把卡名 / 事件正文 / 状态名这些**数据里的**可见字段
     *      原地刷成该语言 —— 界面是照着这些字段渲染的，慢一步就会先闪一屏中文。
     */
    initLang();
    refreshI18nTables();
    document.documentElement.lang = currentLang();
    game.onChange = () => this.render();
    /**
     * 专家模式开关一变就重画：卡面那一行数字是在 cardEl 里按开关现拼的，
     * 不重画的话，关掉设置面板后屏幕上的牌还是旧样子（和切语言同一个道理）。
     */
    onExpertChange(() => this.forceRerender());
    /**
     * 曲子库关掉时要把 BGM 还给当前场景（不然在音乐室试听完了，回到地图还在放那首）。
     * 钩子挂在这里而不是让音乐室 import ui.js —— 那会绕成 ui -> screens -> music-room -> ui 的环。
     */
    audio.onSceneBgm = () => this.forceRerender();
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
    document.getElementById('btn-codex')?.addEventListener('click', () => {
      audio.ui('open');
      // 敌人图鉴：战斗中尤其有用（「这家伙会什么招」在开打前就该看得见）
      if (this.game.data) showEnemyCodex();
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
          return;
        }
        /**
         * 注意这里**不能**无条件 return。
         *
         * 以前战斗分支最后是一句裸 `return;`，于是战斗中 D / I / H 全都不响应 ——
         * 而说明页明明写着「按 I 打开背包……**战斗中也随时能用**」（用户会被这句话骗），
         * 新加的 E（敌人图鉴）更是最该在战斗中能按。现在只吞掉它自己处理的那两类键
         * （空格、1~9），其余的继续往下走。
         */
      }
      if (e.key === 'd' || e.key === 'D') {
        if (this.game.data && this.game.phase !== 'title') showDeck(this.game);
      }
      if (e.key === 'i' || e.key === 'I') {
        if (this.game.data && this.game.phase !== 'title') showItems(this.game);
      }
      // E = 敌人图鉴（Enemy）。战斗中按一下就能查「对面会什么」，不用离开战斗
      if (e.key === 'e' || e.key === 'E') {
        if (this.game.data && this.game.phase !== 'title') showEnemyCodex();
      }
      // C = 卡牌图鉴（全部卡牌的收集进度；卡组一览里那份是同一套数据）
      if (e.key === 'c' || e.key === 'C') {
        if (this.game.data && this.game.phase !== 'title') showCardCodex(this.game);
      }
      if (e.key === 'h' || e.key === 'H' || e.key === '?') showHelp();
    });
  }

  /** 根据 game.phase 渲染 */
  render() {
    const g = this.game;
    const phase = g.phase;

    /**
     * 卡面上的伤害数字是**实时算**的（威力 × 你的攻击力），所以在每次渲染之前
     * 先把「拿什么攻击力、对什么防御去估」这件事更新一遍。
     * 战斗中用当前敌人的真实防御，战斗外用本章普通怪的防御 ——
     * 以前卡面印死数字，玩家一进第二章看到的就是过期信息。
     */
    setCardTextContext({
      atk: g.data?.atk ?? BALANCE.player.atk,
      def: phase === 'battle' && g.battle
        ? effectiveDef(g.battle.enemy)
        : enemyDefFor('normal', g.data?.stage ?? 0),
    });

    // 场景 BGM：地图与战斗都按**当前地图**换曲（每章不同），找不到专属曲就退回通用曲
    const biome = g.data?.map?.biome ?? 'desert';
    // 新地图不额外抓音频：content/biomes.json 里写 `bgm: "canyon"`，借一张已有曲子的氛围
    const tune = BIOME_BGM[biome] ?? biome;
    // 鼠标指针也跟着当前地图的主题色描边（纯白指针在浅色沙漠/亮色盐海上不好找）
    applyCursorTheme((BIOMES[biome] ?? BIOMES.desert)?.accent ?? '#f0b95c');
    // 整页 UI 主题色也按地图走：style.css 里 body[data-biome=...] 覆盖了 accent 三个变量，
    // 按钮 / 标题 / 血条 / 地图节点 / 焦点描边一起换色（盐海是蓝、密林是绿…）
    if (document.body && document.body.dataset.biome !== biome) document.body.dataset.biome = biome;
    const lastStage = stageCount() - 1;
    switch (phase) {
      case 'title': audio.playBgm('title'); break;
      case 'map': audio.playBgm(bgmKeyFor('map', tune)); break;
      case 'battle': {
        const kind = g.battleKind ?? 'normal';
        if (kind === 'boss') audio.playBgm(g.data?.stage >= lastStage ? 'boss_final' : 'boss');
        // 强敌也按地图换曲（用户反馈：「每个地图强敌都是一个 bgm 太重复了」）。
        // 找不到专属曲就退回通用的 elite —— bgmKeyFor 的第二参数就是干这个的。
        else if (kind === 'elite') audio.playBgm(bgmKeyFor('elite', tune, 'elite'));
        else audio.playBgm(bgmKeyFor('battle', tune));
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
        /**
         * 「已经在地图上了就只刷 HUD」这个优化必须**同时确认地图屏真的在屏幕上**。
         *
         * 以前这里只信 `this.current === 'map'`，而 `mapDirty` 从来没被置位过 ——
         * 于是只要 `this.current` 因为任何原因（例如某个界面自己往 #stage 里画了一屏，
         * 没走这里的记账）和实际屏幕对不上，地图就再也不重画了：
         * 玩家看到的是上一屏（实测就是奖励页）永远关不掉，而状态其实早就推进了。
         * 现在按 DOM 实际内容判断 —— 对不上就重画，界面不会留孤儿屏。
         */
        if (this.current === 'map' && !g.mapDirty && this.stage.querySelector('.map-screen')) {
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
        renderHud(g);
        this.current = 'battle';
        const bs = new BattleScreen(g, this.stage);
        this.battleScreen = bs;
        this.enterBattle(bs);
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
        /**
         * 奖励已经领走（`game.reward` 为空）却还在这一屏：**不要画一屏点不动的奖励页**。
         *
         * 这是上面那个「卡在奖励页」bug 的最后一道保险：奖励页画出来时会把
         * `takeRewardCard` 挂上去，而那个函数一进门就是 `if (!this.reward) return;` ——
         * 奖励对象没了，那一屏上的任何按钮都会变成哑巴。此时直接按地图重画，
         * 玩家的这一局还能继续往下走（状态早就推进过去了）。
         */
        if (!g.reward) {
          this.current = 'map';
          renderMap(g);
          renderHud(g);
          break;
        }
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

  /**
   * 进入战斗：先放遭遇演出（如果这一场该放），再挂载战斗界面。
   *
   * 为什么挂载要等到「幕布完全盖住屏幕」那一下（encounter 的 onCovered）：
   * BattleScreen.mount() 第一件事就是 clear(stage) 把地图清掉 ——
   * 那一刻地图正好被幕布挡着，玩家看不到这次清屏，交接是干净的。
   * 而且此时战斗界面的行走图已经在遭遇演出里预热过，挂载几乎是瞬时的。
   */
  async enterBattle(bs) {
    const g = this.game;
    const start = () => {
      bs.mount().catch((err) => {
        console.error('战斗界面挂载失败:', err?.message, '\n', err?.stack);
        toast(t('战斗界面出错，已返回地图。'), 'bad');
        g.phase = 'map';
        this.current = null;
        this.render();
      });
    };
    if (!wantsEncounter(g.battleEntry)) { start(); return; }
    try {
      await playEncounter({
        game: g,
        battle: bs.battle,
        onCovered: start,
        // 演出期间玩家切屏了（例如战斗已经结算回地图）就别再往下演、也别挂战斗界面
        shouldAbort: () => this.battleScreen !== bs || g.phase !== 'battle',
      });
    } catch (err) {
      console.error('遭遇演出失败：', err);
      if (this.battleScreen === bs) start();
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
