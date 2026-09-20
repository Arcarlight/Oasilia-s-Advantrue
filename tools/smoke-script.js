
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

    // 6) 通关记录 / 图鉴：标题页那三个入口点得开、有内容
    //    （不该只活在专门的诊断脚本里 —— 冒烟是每次改完都会跑的那一道）
    try {
      g.phase = 'title';
      window.__oasisUI.forceRerender();
      await wait(400);
      const entries = [...document.querySelectorAll('.title-codex .title-codex-btn')];
      log('标题页收藏入口 =', entries.length);
      if (entries.length !== 3) errors.push('标题页的收藏入口不是 3 个，而是 ' + entries.length);
      for (const [i, name] of ['通关记录', '卡牌图鉴', '敌人图鉴'].entries()) {
        const btn = entries[i];
        if (!btn) { errors.push('标题页少了入口：' + name); continue; }
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(350);
        const modal = [...document.querySelectorAll('.modal-backdrop')].pop();
        const title = modal && modal.querySelector('.modal-head h3') ? modal.querySelector('.modal-head h3').textContent : '';
        const items = modal ? modal.querySelectorAll('.card, .dex-card, .rec-row, .rec-empty, .dex-locked').length : 0;
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
