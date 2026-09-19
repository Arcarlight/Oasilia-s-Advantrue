// 入口：加载素材元数据 → 建游戏 → 建 UI → 进标题。

import { Game } from './core/game.js';
import { loadSpriteMeta } from './core/sprites.js';
import { generateMap } from './data/mapgen.js';
import { music } from './core/bgm.js';
import { UI } from './ui/ui.js';
import { audio } from './core/audio.js';
import { toast } from './ui/dom.js';
import { showDeck } from './ui/overlays.js';
import { initTips } from './ui/tips.js';
import { setEncounterMode } from './ui/encounter.js';
import { EVENTS } from './data/events.js';

async function boot() {
  const splash = document.createElement('div');
  splash.className = 'screen title-screen';
  splash.innerHTML = `
    <div class="title-inner">
      <div class="title-hero"><h1 class="title-h1" style="font-size:38px">正在吹起沙暴…</h1></div>
      <p class="title-quote">加载宝可梦精灵与卡牌数据</p>
    </div>`;
  document.getElementById('stage').append(splash);

  try {
    await loadSpriteMeta();
  } catch (err) {
    console.error('精灵元数据加载失败', err);
    toast('精灵图元数据加载失败，请确认通过 HTTP 服务器打开本页。', 'bad');
  }

  const game = new Game();
  window.__oasis = game; // 方便在控制台调试
  const ui = new UI(game);
  window.__oasisUI = ui;
  // 悬停说明浮层（卡面上的状态词 / 详情页的关键词）在启动时就挂好：
  // 它以前是战斗界面自己建的，于是不进战斗就看不到卡组页里的词条解释。
  initTips();

  /**
   * 未捕获错误的兜底记录。
   *
   * 起因：玩家反馈「随机出现打不出卡」。这种偶发问题如果只发生在别人的机器上，
   * 光靠猜没用 —— 这里把错误原样记下来（控制台 + `window.__oasisLastError`），
   * 下次再有人遇到，让他发一句控制台里的这行就能定位。
   */
  window.addEventListener('error', (e) => {
    window.__oasisLastError = { at: new Date().toISOString(), message: String(e.message ?? e.error ?? ''), stack: String(e.error?.stack ?? '') };
    console.error('[oasis] 未捕获的错误：', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    window.__oasisLastError = { at: new Date().toISOString(), message: String(reason?.message ?? reason ?? ''), stack: String(reason?.stack ?? '') };
    console.error('[oasis] 未处理的 Promise 拒绝：', reason);
  });

  // 调试 / 自动化用的简易接口（也方便我写截图脚本验证界面）
  window.__oasisAuto = (opts = {}) => {
    const { scene = 'title', seed = 20240607, floor = 0, stage = 0 } = opts;
    if (scene === 'title') { game.phase = 'title'; ui.forceRerender(); return 'title'; }
    if (!game.data) game.newRun(seed);
    // ?stage=N 可以直达第 N 章（0-based），方便截图看后面的地图/BGM
    if (stage > 0) {
      game.data.stage = stage;
      game.data.map = generateMap(stage, game.rng);
      game.data.nodeId = null;
    }
    game.data.floor = floor;
    switch (scene) {
      case 'map': game.phase = 'map'; ui.forceRerender(); return 'map';
      case 'battle': game.startBattle('normal', 0); return 'battle';
      case 'elite': game.startBattle('elite', 0); return 'elite';
      case 'boss': game.startBattle('boss', 0); return 'boss';
      case 'event': {
        // `&event=<id>` 指定事件、`&pick=<n>` 顺手点掉第 n 个选项 —— 让「选项结果」那一屏
        // 也能被截图/复看（结果文案是随机事件里最容易漏翻、也最难复现给玩家看的一屏）。
        const wantId = params.get('event');
        const pick = params.get('pick');
        if (wantId) {
          const ev = EVENTS.find((e) => e.id === wantId);
          if (!ev) throw new Error(`没有这个事件：${wantId}`);
          if (!game.data) game.newRun(Number(params.get('seed') ?? 20240607));
          game.event = ev;
          game.eventResult = null;
          game.phase = 'event';
          if (pick != null) game.chooseEventOption(Number(pick));
          ui.forceRerender();
          return 'event';
        }
        game.startEvent();
        return 'event';
      }
      case 'chest': game.startChest(); return 'chest';
      case 'shop': game.startShop(); return 'shop';
      case 'rest': game.startRest(); return 'rest';
      case 'reward': {
        // 直接构造一份奖励数据，避免真的打完一场战斗（也方便截图检查界面）。
        // `&kind=elite|boss` 能看精英 / 首领那一档的奖励长什么样。
        const m = game.mockReward(params.get('kind') ?? 'normal');
        game.reward = m;
        game.phase = 'reward';
        ui.forceRerender();
        return 'reward';
      }
      case 'deck': { showDeck(game); return 'deck'; }
      case 'gameover': game.phase = 'gameover'; ui.forceRerender(); return 'gameover';
      case 'victory': game.phase = 'victory'; ui.forceRerender(); return 'victory';
      default: return 'unknown';
    }
  };

  splash.remove();

  // 支持 ?scene=battle 之类的直接定位，方便截图与手动检查
  const params = new URLSearchParams(location.search);
  /**
   * 遭遇演出（地图 → 战斗的过场）默认只在「玩家从地图走过去撞见的」战斗里出现。
   * ?enc=1 让所有入口都演（遭遇演出自己的诊断脚本用它，因为它是直接 startBattle 的），
   * ?enc=0 完全关掉（其余截图 / 冒烟脚本用，它们都是「进战斗立刻读 DOM」）。
   */
  const encParam = params.get('enc');
  if (encParam === '1' || (params.has('dgenc') && encParam !== '0')) setEncounterMode('always');
  else if (encParam === '0') setEncounterMode('never');
  const scene = params.get('scene');
  if (params.get('smoke') === '1') {
    // 冒烟测试：加载 tools/smoke-script.js 后自动跑一遍主要流程
    import('../tools/smoke-script.js').catch((e) => console.error('冒烟脚本加载失败', e));
  }
  if (params.get('lt') === '1') {
    import('../tools/layout-test-script.js').catch((e) => console.error(e));
  }
  if (params.get('diag') === '1') {
    // 诊断脚本：检查血条 / 头像 / 事件页等具体表现
    import('../tools/diagnose-script.js').catch((e) => console.error('诊断脚本加载失败', e));
  }
  if (params.get('dg2') === '1') {
    import('../tools/diag2-script.js').catch((e) => console.error('diag2 加载失败', e));
  }
  if (params.get('dgview') === '1') {
    // 量出牌展示区的位置、看有没有压住怪兽
    import('../tools/diag2-view.js').catch((e) => console.error('出牌位诊断加载失败', e));
  }
  if (params.get('dgplay') === '1') {
    // 把一张敌方卡面钉在场上，专门给截图用
    import('../tools/dgplay-script.js').catch((e) => console.error('出牌截图脚本加载失败', e));
  }
  if (params.get('dgdeath') === '1') {
    import('../tools/diag-death-script.js').catch((e) => console.error('死亡诊断脚本加载失败', e));
  }
  if (params.get('dgshield') === '1') {
    // 量护盾胶囊挂在哪儿
    import('../tools/diag-shield.js').catch((e) => console.error('护盾诊断加载失败', e));
  }
  if (params.get('dgintent') === '1') {
    // 看意图胶囊算的是什么、会不会随局面变化
    import('../tools/diag-intent.js').catch((e) => console.error('意图诊断加载失败', e));
  }
  if (params.get('dgrest') === '1') {
    // 查营地「只能做一件事」有没有被强制
    import('../tools/diag-rest.js').catch((e) => console.error('营地诊断加载失败', e));
  }
  if (params.get('dgev') === '1') {
    // 把事件池里每个选项都跑一遍，打印文案与状态变化
    import('../tools/diag-events.js').catch((e) => console.error('事件诊断加载失败', e));
  }
  if (params.get('dgbgm') === '1') {
    // 查「按地图切 BGM」有没有生效
    import('../tools/diag-bgm.js').catch((e) => console.error('BGM 诊断加载失败', e));
  }
  if (params.get('dgfx') === '1') {
    // 查战斗简单特效（闪光 / 爆发 / 冲击）有没有真的播出来
    import('../tools/diag-fx.js').catch((e) => console.error('特效诊断加载失败', e));
  }
  if (params.get('dgpreview')) {
    // 内容预览：?dgpreview=<slug> 直接和指定物种打一场（核对新敌人用）
    import('../tools/dgpreview-script.js').catch((e) => console.error('预览脚本加载失败', e));
  }
  if (params.get('dgmerchant')) {
    // 商人诊断：?dgmerchant=1 列出所有商人与货架；?dgmerchant=<id|biome> 直接把商店摆在指定商人前（截图用）
    import('../tools/diag-merchant.js').catch((e) => console.error('商人诊断加载失败', e));
  }
  if (params.get('dganim')) {
    // 动画诊断：抽牌入场 / 销毁碎裂，定格在动画中段方便截图
    import('../tools/diag-anim.js').catch((e) => console.error('动画诊断加载失败', e));
  }
  if (params.get('dgcards')) {
    // 卡面诊断：卡面尺寸 / 文案截断 / 高亮 / 排序 / 详情页 / 手牌溢出
    import('../tools/diag-cards.js').catch((e) => console.error('卡面诊断加载失败', e));
  }
  if (params.get('dgturnart')) {
    // 回合立绘诊断：素材来源 / 落点 / 由大变小 / 不挤动布局 / 跟着演出速度
    import('../tools/diag-turnart.js').catch((e) => console.error('回合立绘诊断加载失败', e));
  }
  if (params.get('dgdeck')) {
    // 牌堆诊断：手牌 DOM 与引擎是否一一对应 + 卡组页的 ×N 角标看不看得见
    import('../tools/diag-deck.js').catch((e) => console.error('牌堆诊断加载失败', e));
  }
  if (params.get('dgremove')) {
    // 商店删卡诊断：整条链路按**真实指针**走一遍（elementFromPoint + 完整指针序列）
    import('../tools/diag-remove.js').catch((e) => console.error('删卡诊断加载失败', e));
  }
  if (params.get('dgitems')) {
    // 背包诊断：每一件道具能不能用、按钮可不可点、×0 的条目有没有被滤掉
    import('../tools/diag-items.js').catch((e) => console.error('背包诊断加载失败', e));
  }
  if (params.get('dgemote')) {
    // 表情诊断：打一回合，把「事件流」和「头像表情变化」按时间对在一起看
    import('../tools/diag-emote.js').catch((e) => console.error('表情诊断加载失败', e));
  }
  if (params.get('dghelp')) {
    // 说明页文案诊断：页里的数字必须等于 BALANCE / stageCount() 的现值
    import('../tools/diag-help.js').catch((e) => console.error('说明页诊断加载失败', e));
  }
  if (params.get('dgstatus')) {
    // 战斗数值诊断：卡面伤害是不是按当前攻击力实时算的、毒 / 剧毒是不是按最大生命百分比结算
    import('../tools/diag-status.js').catch((e) => console.error('战斗数值诊断加载失败', e));
  }
  if (params.get('dgenemy')) {
    // 敌人面板诊断：把指定章节 / 档位的敌人摆到屏幕上，核对攻击力与意图提示
    // （?dgenemy=1 自检；?dgenemy=shot&stage=5&tier=normal 留屏截图）
    import('../tools/diag-enemy-panel.js').catch((e) => console.error('敌人面板诊断加载失败', e));
  }
  if (params.get('dgfloat')) {
    // 浮字诊断：伤害 / AP 数字背后那块「蓝底」到底是谁画的
    import('../tools/diag-float.js').catch((e) => console.error('浮字诊断加载失败', e));
  }
  if (params.get('dgloop')) {
    // 无限连招诊断：0 费「抽 1 张」+ 小卡组会不会把出牌刷成死循环
    import('../tools/diag-loop.js').catch((e) => console.error('连招诊断加载失败', e));
  }
  if (params.get('dgdodge')) {
    // 闪避诊断：对方闪开后会不会「卡住、出不了牌」
    import('../tools/diag-dodge.js').catch((e) => console.error('闪避诊断加载失败', e));
  }
  if (params.has('dgenc')) {
    // 遭遇演出诊断：划入曲线 / 横线有没有跟着立绘 / 预载到底完成没有
    // （?dgenc=1 自检；?dgenc=shot&at=hold 定格在停留那一下方便截图）
    import('../tools/diag-encounter.js').catch((e) => console.error('遭遇演出诊断加载失败', e));
  }
  if (params.get('dgstuck')) {
    // 卡死诊断：主动制造各种「打不出卡」的情形，验证看门狗与提示
    import('../tools/diag-stuck.js').catch((e) => console.error('卡死诊断加载失败', e));
  }
  if (params.has('dgchips')) {
    // 状态胶囊诊断：附加 / 层数变化 / 消除三个方向是不是真有动画
    // （?dgchips=1 自检；?dgchips=shot 把动画定格在中途方便截图）
    import('../tools/diag-chips.js').catch((e) => console.error('状态胶囊诊断加载失败', e));
  }
  if (params.has('dgfont')) {
    // 字体 A/B：把手写体语境的真实句子并排渲染（?dgfont=shot 直接留在屏幕上截图）
    import('../tools/diag-font.js').catch((e) => console.error('字体对照加载失败', e));
  }
  if (params.has('dgi18n')) {
    // 多语言诊断：真点语言按钮，验证「切换 → 内容原地改写 → 重画 → 切回中文逐字恢复」
    import('../tools/diag-i18n.js').catch((e) => console.error('多语言诊断加载失败', e));
  }
  if (params.get('autoplay') === '1') {
    // 自动打两回合，方便截图检查「日志有内容」时的排版
    setTimeout(async () => {
      const bs = ui.battleScreen;
      const b = game.battle;
      if (!bs || !b) return;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 2 && !b.over; i++) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (hand.length) await bs.playCard(hand[0].uid);
        await wait(120);
      }
      if (!b.over) await bs.onEndTurn();
      for (let i = 0; i < 2 && !b.over; i++) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        await bs.playCard(hand[0].uid);
        await wait(100);
      }
    }, 900);
  }
  if (scene) {
    game.phase = 'title';
    ui.render();
    setTimeout(() => {
      game.newRun(Number(params.get('seed') ?? 20240607));
      game.data.floor = Number(params.get('floor') ?? 0);
      const stage = Number(params.get('stage') ?? 0);
      const result = window.__oasisAuto({ scene, seed: Number(params.get('seed') ?? 20240607), floor: Number(params.get('floor') ?? 0), stage });
      ui.current = null;         // 强制重新挂载，否则 UI 会以为还是同一个界面
      if (result !== 'map') ui.forceRerender();
      console.log(`[oasis] scene=${scene} stage=${stage} -> ${result}, phase=${game.phase}, map=${game.data?.map?.biome}, enemy=${game.battle?.enemy?.name ?? '-'}, bgm=${music.nowPlaying()}`);
    }, 150);
  } else {
    game.phase = 'title';
    ui.render();
  }
}

boot();
