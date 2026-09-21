
(async () => {
  const log = (...a) => console.log('[smoke]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = window.__oasis;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + (e.reason && e.reason.message)));
  /** 场景名（断言里用得到：界面到底停在哪一屏） */
  const screen = () => { const s = document.querySelector('#stage .screen'); return s ? s.className : '空'; };
  /**
   * 掉落道具是**单独一屏**（.drop-screen，点「收下，去结算」才走结算页）。
   * 打赢有概率掉落，所以每条奖励断言前面都要先把它点掉，否则量到的是掉落页。
   */
  const clearDrop = async () => {
    const b = [...document.querySelectorAll('.drop-screen .btn')].pop();
    if (!b) return false;
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(400);
    return true;
  };

  try {
    // 1) 标题 -> 新游戏
    g.newRun(12345);
    await wait(300);
    log('phase after newRun =', g.phase);

    // 2) 地图：走到第一个节点
    const node = g.availableNodes()[0];
    log('available nodes =', g.availableNodes().length, 'first =', node.type);
    g.goToNode(node.id);
    await wait(400);
    log('phase after node =', g.phase);

    // 3) 如果是战斗，把能打的牌全打完
    if (g.phase === 'battle') {
      let guard = 0;
      while (!g.battle.over && guard++ < 40) {
        if (g.battle.active === 'player') {
          const hand = g.battle.hand('player').filter((c) => g.battle.canPlay(c.uid));
          if (!hand.length) { g.battle.endTurn(); }
          else { g.battle.playCard(hand[0].uid); }
        } else {
          g.battle.endTurn();
        }
        g.battle.takeEvents();
        await wait(20);
      }
      log('battle done, winner =', g.battle.winner, 'turns =', g.battle.turn);
      g.finishBattle();
      await wait(300);
      log('phase after battle =', g.phase);
      if (g.phase === 'reward') { g.takeRewardCard(g.reward.cardChoices && g.reward.cardChoices[0] ? g.reward.cardChoices[0].id : null); await wait(300); }
      log('phase after reward =', g.phase);
    }

    /**
     * 3.5) **首领奖励页必须点得掉**。
     *
     * 用户报的 bug：「打完 boss 会卡在这个页面，点卡会收入卡包但是不会关闭界面，
     * 点击下方不拿卡也没用」。原因是奖励页由战斗界面自己 import 出来直接画在 #stage 上，
     * 绕过了 UI 的换屏记账（ui.current）—— 一旦记账和实际屏幕对不上，
     * 点卡时状态其实推进了（卡进卡组），但重画在地图那一支被「已经在地图上」的早退挡掉，
     * 于是屏幕上永远挂着那张已经作废的奖励页，再点什么都不动。
     *
     * 所以这里把两件事都钉住：① 正常点卡必须换屏；② 故意把记账弄乱之后**也必须能自己恢复**。
     */
    try {
      const bossReward = async (label, { lie }) => {
        window.__oasisAuto({ scene: 'boss', stage: 2 });
        await wait(500);
        g.battle.enemy.hp = 0;
        g.battle.winner = 'player';
        g.battle.over = true;
        g.finishBattle();
        await wait(350);
        // 打赢有概率掉道具，掉落是**单独一屏**，先点掉它才看得到结算页
        const dropped = await clearDrop();
        const before = { phase: g.phase, current: window.__oasisUI.current, dropScreen: dropped, rewardScreen: !!document.querySelector('.reward-screen') };
        // 把「界面认为自己在哪一屏」故意写错 —— 复现那个 bug 的触发条件
        if (lie) window.__oasisUI.current = 'map';
        const deckBefore = g.data.deck.length;
        const card = document.querySelector('.reward-cards .card');
        if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(350);
        const stuck = !!document.querySelector('.reward-screen');
        log('首领奖励 ·', label, '| 点击前', JSON.stringify(before), '→ phase=' + g.phase,
          'deck', deckBefore, '->', g.data.deck.length, '奖励页还在？' + stuck);
        if (stuck) errors.push('首领奖励页没关掉（' + label + '）');
        if (g.phase === 'reward') errors.push('首领奖励之后 phase 还是 reward（' + label + '）');
        if (g.data.deck.length !== deckBefore + 1) errors.push('首领奖励点卡之后卡组没有 +1（' + label + '）');
      };
      await bossReward('正常点法', { lie: false });
      await bossReward('界面记账被弄乱时', { lie: true });

      // 奖励已经领走却还停在奖励屏：不能再画一屏「点不动的奖励页」，要退回地图
      g.phase = 'reward';
      g.reward = null;
      window.__oasisUI.forceRerender();
      await wait(300);
      const dead = !!document.querySelector('.reward-screen');
      log('reward 为空时的兜底 → phase=' + g.phase, '还在奖励页？' + dead,
        '屏幕 =', document.querySelector('#stage .screen') ? document.querySelector('#stage .screen').className : '空');
      if (dead) errors.push('reward 为空时又画了一屏点不动的奖励页');
    } catch (e) {
      errors.push('bossReward: ' + e.message);
    }

    /**
     * 3.6) **真的打赢一场**：从出牌打到结算，全程不让脚本帮忙（不许自己调 finishBattle）。
     *
     * 为什么补这一条：3.5 里那几条断言是脚本自己调 finishBattle() 把奖励页造出来的 ——
     * 于是「战斗界面打完到底有没有推进状态」这件事**没有任何人守**。实测漏过一次：
     * 整理 settle() 时把 finishBattle() 连同画屏一起删掉，后果是**每场战斗打完都停在战场上**
     * （敌人已经 0 血、「战斗结束」飘着，永远不进奖励页），而冒烟测试全绿、一键体检全绿。
     */
    try {
      window.__oasisAuto({ scene: 'battle', stage: 1 });
      await wait(600);
      let turn = 0;
      while (g.phase === 'battle' && turn++ < 15) {
        const b2 = window.__oasisUI.battleScreen;
        if (!b2) break;
        let busy = 0;
        while (b2.busy && busy++ < 200) await wait(80);
        if (g.phase !== 'battle') break;
        // 把敌人血压到 1：一两张牌就能结束，不用真打完一整场
        g.battle.enemy.hp = Math.min(g.battle.enemy.hp, 1);
        const playable = b2.battle.hand('player').filter((c) => b2.battle.canPlay(c.uid));
        if (playable.length) await b2.playCard(playable[0].uid);
        else await b2.onEndTurn();
        await wait(400);
      }
      let reach = 0;
      while (g.phase === 'battle' && reach++ < 120) await wait(100);
      /**
       * 掉落是单独一屏：打赢如果掉了东西，先看到的是「捡到道具」。
       * 这一条也要顺带把它点掉（顺便就断言了它点得掉、点完能到结算页）。
       */
      const dropSeen = await clearDrop();
      const hasReward = !!document.querySelector('.reward-screen');
      log('真打赢一场（不自己调 finishBattle）→ phase=' + g.phase, '掉落页？' + dropSeen, '奖励页？' + hasReward, '回合数=' + turn);
      if (g.phase !== 'reward' || !hasReward) {
        errors.push('战斗打赢之后没进奖励页（phase=' + g.phase + '，还在' + screen() + '）');
      } else {
        const deckBefore = g.data.deck.length;
        const card = document.querySelector('.reward-cards .card');
        if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(450);
        const stuck = !!document.querySelector('.reward-screen');
        log('  点卡之后 phase=' + g.phase, 'deck', deckBefore, '->', g.data.deck.length, '奖励页还在？' + stuck);
        if (stuck) errors.push('战斗胜利的奖励页没关掉');
      }
    } catch (e) {
      errors.push('battleWin: ' + e.message);
    }

    /**
     * 3.7) **掉落道具要单独一屏**（用户要的：「掉落物品的提示过小，可以单独为其做一个窗口」）。
     *
     * 用「奖励」那个调试场景的假奖励：它必定带一件掉落，所以这一条是确定性的，
     * 不依赖「这次到底掉没掉」。要钉的是这一屏**内容齐不齐、点得掉不掉**。
     */
    try {
      window.__oasisAuto({ scene: 'reward' });
      await wait(600);
      const haveDrop = !!document.querySelector('.drop-screen');
      const effCount = document.querySelectorAll('.drop-eff-line').length;
      log('捡到道具那一屏：', haveDrop ? '在' : '不在',
        '｜大图', !!document.querySelector('.drop-art-img'),
        '｜效果条', effCount,
        '｜收下按钮', !!document.querySelector('.drop-screen .btn-primary'));
      if (!haveDrop) errors.push('掉落没有单独一屏（.drop-screen 不存在）');
      else {
        if (!document.querySelector('.drop-art-img')) errors.push('掉落屏上没有道具大图');
        if (!effCount) errors.push('掉落屏上没有写清这件东西的作用');
        const btn = document.querySelector('.drop-screen .btn-primary');
        if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(450);
        if (document.querySelector('.drop-screen')) errors.push('掉落屏点「收下」之后没有换屏');
        if (!document.querySelector('.reward-screen')) errors.push('掉落屏之后没有进结算页');
        log('  收下之后 → phase=' + g.phase, '屏幕=' + screen());
      }
    } catch (e) {
      errors.push('dropScreen: ' + e.message);
    }

    /**
     * 3.8) **战斗结束后没人结算 → 看门狗必须自己收尾**。
     *
     * 用户第二次报「boss 战又卡住了」：现场是 0 血的敌人 + 意图胶囊写着「战斗结束」，
     * 手牌和「结束回合」全都点不动（引擎会说「战斗已经结束了」）—— 也就是
     * 「出牌尾巴上那一句 settle()」没有跑到（哪一步抛了异常、或者被中途打断）。
     * 这一条故意把战斗置成已结束、**谁都不去结算**，看界面能不能自己走出去。
     */
    try {
      window.__oasisAuto({ scene: 'battle', stage: 1 });
      await wait(800);
      g.battle.enemy.hp = 0;
      g.battle.winner = 'player';
      g.battle.over = true;
      // 故意不调 finishBattle / settle：模拟结算没跑到
      await wait(2600);
      const recovered = window.__oasisSettleRecover ?? 0;
      log('故意不结算 → phase=' + g.phase, '屏幕=' + screen(), '看门狗补结算次数=' + recovered);
      if (g.phase === 'battle') errors.push('战斗已经结束却还停在战场上（看门狗没有补结算）');
      if (!recovered) errors.push('看门狗没有记录到「补结算」这一步');
    } catch (e) {
      errors.push('settleRecover: ' + e.message);
    }

    // 4) BGM 检查：解锁音频后依次切场景，看曲子有没有跟着换
    try {
      const audioMod = await import('/src/core/audio.js');
      const musicMod = await import('/src/core/bgm.js');
      const audio = audioMod.audio;
      const music = musicMod.music;
      music.debug = true;
      audio.unlock();
      await wait(500);
      log('audio ctx =', audio.ctx ? audio.ctx.state : 'no-ctx');
      music.setVolume(0);
      log('BGM_FILES keys =', Object.keys(musicMod.BGM_FILES).length);
      log('music.status =', JSON.stringify(music.status()), '（冒烟测试跑在虚拟时间下，此时 ogg 往往还没解码完，loop/sources 会显示 0；要量真实播放请看 tools/verify-music.mjs）');

      window.__oasisAuto({ scene: 'battle' });
      await wait(2500);
      log('BGM @battle =', music.nowPlaying());
      window.__oasisAuto({ scene: 'shop' });
      await wait(2500);
      log('BGM @shop =', music.nowPlaying());
      window.__oasisAuto({ scene: 'map' });
      await wait(2500);
      log('BGM @map =', music.nowPlaying());
      log('music.failed =', music._failed);
    } catch (e) {
      errors.push('bgm: ' + e.message);
    }

    // 5) 依次渲染所有界面，看有没有抛错
    for (const scene of ['event', 'chest', 'shop', 'rest', 'reward', 'deck', 'gameover', 'victory', 'map']) {
      try {
        const r = window.__oasisAuto({ scene });
        await wait(200);
        log('scene', scene, '->', r, 'ok, stage children =', document.getElementById('stage').children.length);
      } catch (e) {
        errors.push(scene + ': ' + e.message);
      }
    }

    // 5.5) 商店：专家模式下卖场里的卡要有数字，道具要写清作用（用户报过这两样都看不到）
    try {
      const { setExpertEnabled } = await import('/src/core/expert.js');
      setExpertEnabled(true);
      window.__oasisAuto({ scene: 'shop', stage: 1 });
      await wait(600);
      const rows = [...document.querySelectorAll('.shop-item')];
      const cardRows = rows.filter((r) => r.querySelector('.shop-ap')).length;
      const chips = [...document.querySelectorAll('.shop-item .card-expert-chip')].map((n) => n.textContent);
      const effs = [...document.querySelectorAll('.shop-item .shop-eff-line')].map((n) => n.textContent);
      const kinds = [...document.querySelectorAll('.shop-item .held-kind')].map((n) => n.textContent);
      log('商店 · 专家模式：卡牌行', cardRows, '｜卡上数字胶囊', chips.length, '｜道具作用胶囊', effs.length);
      log('  例：数字', chips.slice(0, 4).join(' / ') || '（无）', '｜作用', effs.slice(0, 3).join(' / ') || '（无）');
      if (!cardRows) errors.push('商店货架上没有卡牌行（这一条断言就没有意义了）');
      if (cardRows && !chips.length) errors.push('商店货架上的卡看不到专家模式的数据');
      if (!effs.length) errors.push('商店货架上的道具看不到作用说明');
      if (!kinds.length) errors.push('商店货架上的道具没有标「持有 / 可用」');
      setExpertEnabled(false);
    } catch (e) {
      errors.push('shopExpert: ' + e.message);
    }

    // 6) 通关记录 / 图鉴 / 曲子库：标题页那四个入口点得开、有内容
    //    （不该只活在专门的诊断脚本里 —— 冒烟是每次改完都会跑的那一道）
    try {
      g.phase = 'title';
      window.__oasisUI.forceRerender();
      await wait(400);
      const entries = [...document.querySelectorAll('.title-codex .title-codex-btn')];
      log('标题页收藏入口 =', entries.length);
      if (entries.length !== 5) errors.push('标题页的收藏入口不是 5 个，而是 ' + entries.length);
      for (const [i, name] of ['通关记录', '卡牌图鉴', '敌人图鉴', '道具图鉴', '曲子库'].entries()) {
        const btn = entries[i];
        if (!btn) { errors.push('标题页少了入口：' + name); continue; }
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(350);
        const modal = [...document.querySelectorAll('.modal-backdrop')].pop();
        const title = modal && modal.querySelector('.modal-head h3') ? modal.querySelector('.modal-head h3').textContent : '';
        const items = modal ? modal.querySelectorAll('.card, .dex-card, .rec-row, .rec-empty, .dex-locked, .mr-row').length : 0;
        log('入口', name, '->', title, '内容块 =', items);
        if (!modal || !items) errors.push(name + ' 打开是空的');
        for (const b of (modal ? modal.querySelectorAll('.modal-head button') : [])) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(120);
      }
    } catch (e) {
      errors.push('codex: ' + e.message);
    }

    // 7) 更新日志：标题页那个按钮点得开、有版本条目
    try {
      const btn = [...document.querySelectorAll('.title-menu .btn')].find((b) => b.textContent.includes('更新日志'));
      log('标题页更新日志按钮 =', !!btn);
      if (!btn) errors.push('标题页没有「更新日志」按钮');
      else {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(300);
        const modal = [...document.querySelectorAll('.modal-backdrop')].pop();
        const entries = modal ? modal.querySelectorAll('.cl-entry').length : 0;
        const items = modal ? modal.querySelectorAll('.cl-items li').length : 0;
        log('更新日志 ->', entries, '个版本，', items, '条');
        if (!entries || !items) errors.push('更新日志打开是空的');
        for (const b of (modal ? modal.querySelectorAll('.modal-head button') : [])) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(120);
      }
    } catch (e) {
      errors.push('changelog: ' + e.message);
    }

    // 8) 检查关键 DOM
    const checks = {
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      hasScreen: !!document.querySelector('.screen'),
      cardCount: document.querySelectorAll('.card').length,
      hudCodexBtn: !!document.getElementById('btn-codex'),
    };
    log('DOM checks', JSON.stringify(checks));
    if (!checks.hudCodexBtn) errors.push('HUD 上没有图鉴按钮（#btn-codex）');

    /**
     * 9) **页面这一趟不许留下任何被吞掉的错误**。
     *
     * UI 现在有几处兜底（换屏失败退回地图、结算失败硬推 phase）—— 兜底能把玩家救回来，
     * 但也**会把错误藏起来**：那些地方如果不在这里断言，门禁就再也看不到它们了。
     * 所以整趟跑完必须一句都没记下。
     */
    log('兜底记录：换屏错误 =', JSON.stringify(window.__oasisRenderError ?? null),
      '｜未捕获 =', JSON.stringify(window.__oasisLastError ?? null),
      '｜看门狗补结算 =', window.__oasisSettleRecover ?? 0);
    if (window.__oasisRenderError) errors.push('换屏过程中出过错（已兜底）：' + window.__oasisRenderError.message);
    if (window.__oasisLastError) errors.push('页面里出现过未捕获的错误：' + window.__oasisLastError.message);

    log('ERRORS=' + JSON.stringify(errors));
    log('SMOKE_OK');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
  }
})();
