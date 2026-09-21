
(async () => {
  const log = (...a) => console.log('[smoke]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = window.__oasis;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + (e.reason && e.reason.message)));

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
        const before = { phase: g.phase, current: window.__oasisUI.current, rewardScreen: !!document.querySelector('.reward-screen') };
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
      const hasReward = !!document.querySelector('.reward-screen');
      log('真打赢一场（不自己调 finishBattle）→ phase=' + g.phase, '奖励页？' + hasReward, '回合数=' + turn);
      if (g.phase !== 'reward' || !hasReward) {
        errors.push('战斗打赢之后没进奖励页（phase=' + g.phase + '，还在' +
          (document.querySelector('#stage .screen') ? document.querySelector('#stage .screen').className : '空屏') + '）');
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
    log('ERRORS=' + JSON.stringify(errors));
    log('SMOKE_OK');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
  }
})();
