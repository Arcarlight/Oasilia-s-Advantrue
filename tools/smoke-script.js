
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

    /**
     * 3.5) 战斗背景那层波浪花纹文字（3.0.5）
     *
     * 这一条守的是「看上去像装饰、其实是个功能」的那部分：
     *   · 花纹有没有真的铺上去 —— 而且铺的是**这一场敌人那个物种**的图鉴介绍；
     *   · 那一侧行动时**只有它那半片**变亮（不是整屏一起亮，也不是永远不亮）。
     * 后者只能靠 computed style 量：截图走的是虚拟时间，永远截不到「亮着」的那一瞬。
     */
    try {
      window.__oasisAuto({ scene: 'battle', stage: 1 });
      await wait(900);
      const screenEl = document.querySelector('.battle-screen');
      const decor = document.querySelector('.battle-decor');
      const svgs = decor ? decor.querySelectorAll('svg') : [];
      log('背景花纹：容器=' + !!decor, '图层数=' + svgs.length, '文字长度=' + (decor ? decor.textContent.length : 0));
      if (!decor) errors.push('战斗背景没有花纹层（.battle-decor）');
      if (svgs.length !== 3) errors.push('背景花纹应该是三份（底色 + 左右各一份高亮），实际 ' + svgs.length);
      const enemiesMod = await import('/src/data/enemies.js');
      const slug = window.__oasisUI.battleScreen.battle.enemy.slug;
      const dexText = (enemiesMod.ENEMIES.find((e) => e.slug === slug) || {}).dexText || '';
      if (!dexText) errors.push('这一场敌人的物种没有背景花纹文本：' + slug);
      else if (decor && !decor.textContent.includes(dexText)) errors.push('背景花纹里没有这一场敌人的图鉴文本');
      const glowE = document.querySelector('.decor-glow-enemy');
      const glowP = document.querySelector('.decor-glow-player');
      const opa = (n) => (n ? Number(getComputedStyle(n).opacity) : -1);
      const bs = window.__oasisUI.battleScreen;
      if (!screenEl || !glowE || !glowP || !bs) {
        errors.push('背景花纹缺少高亮层');
      } else {
        /**
         * ⚠ 这里必须用 decorPin（而不是直接写 dataset）：战斗自己的事件流
         * 每出一条 turnStart / playCard 都会调 decorAct，而那条路带了
         * 「停手 1.1 秒后自己淡回去」的定时器 —— 虚拟时间下那个定时器会立刻烧掉，
         * 于是刚点亮就被清掉，量到的永远是 0（第一版就是这么红的）。
         * 钉住之后由测试自己控制亮哪一侧。
         */
        bs.decorPin = 'enemy';
        bs.screen.dataset.acting = 'enemy';
        // 把过渡关掉再读：虚拟时间下 CSS 过渡不推进，读到的会永远是起点值 0
        for (const n of [glowE, glowP]) n.style.transition = 'none';
        await wait(200);
        const onE = opa(glowE); const onP = opa(glowP);
        bs.decorPin = 'player';
        bs.screen.dataset.acting = 'player';
        await wait(200);
        const pE = opa(glowE); const pP = opa(glowP);
        bs.decorPin = '';
        bs.screen.dataset.acting = '';
        await wait(200);
        const baseE = opa(glowE); const baseP = opa(glowP);
        for (const n of [glowE, glowP]) n.style.transition = '';
        log('背景花纹变亮（敌/玩家）：敌人行动 ' + onE + '/' + onP
          + ' · 玩家行动 ' + pE + '/' + pP + ' · 停手 ' + baseE + '/' + baseP);
        if (!(onE > 0.9 && onP < 0.05)) errors.push('敌人行动时亮的应该只有敌人那半片（实测 ' + onE + '/' + onP + '）');
        if (!(pP > 0.9 && pE < 0.05)) errors.push('玩家行动时亮的应该只有玩家那半片（实测 ' + pE + '/' + pP + '）');
        if (!(baseE < 0.05 && baseP < 0.05)) errors.push('停手后两份高亮都该淡回去（实测 ' + baseE + '/' + baseP + '）');
      }
    } catch (e) {
      errors.push('battleDecor: ' + e.message);
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

    // 6) **点头图切换主角**（3.0 的主功能）：锁着时不换人、解锁后换得动、换完这一屏真的变了
    try {
      g.phase = 'title';
      window.__oasisUI.forceRerender();
      await wait(500);
      const readH2 = () => ((document.querySelector('.title-h2') || {}).textContent || '');
      /**
       * 先把跨局记录**改成「一次都没通关」**再测第一段：冒烟用的是固定的浏览器 profile，
       * 上一趟跑留下的 localStorage 会让「阿特拉斯已经解锁」—— 那样第一段断言就是假的。
       */
      const metaRaw = JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') || '{}');
      delete metaRaw.clearedHeroes; delete metaRaw.heroCleared; delete metaRaw.hero;
      metaRaw.endlessUnlocked = false;
      localStorage.setItem('oasis_desert_spirit_meta_v1', JSON.stringify(metaRaw));
      g.phase = 'title';
      g.titleHeroId = 'oasilia';
      window.__oasisUI.forceRerender();
      await wait(500);
      const beforeHero = readH2();
      const heroBtn = document.querySelector('.title-hero-btn');
      const hint = document.querySelector('.hero-swap-hint');
      log('头图按钮 =', !!heroBtn, '｜切换提示 =', !!(hint && hint.textContent.trim()), '｜', hint ? hint.textContent.trim() : '');
      if (!heroBtn) errors.push('标题页的头图不是可点的按钮（.title-hero-btn）—— 点它换主角这条功能就没了');
      if (!hint || !hint.textContent.trim()) errors.push('标题页没有「点头图换主角」的提示');
      if (heroBtn) heroBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(300);
      log('锁着时点头图 ->', beforeHero, '→', readH2());
      if (readH2() !== beforeHero) errors.push('阿特拉斯还没解锁，点头图却把人换了');
      const meta = JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') || '{}');
      meta.clearedHeroes = [...new Set([...(meta.clearedHeroes || []), 'oasilia'])];
      meta.heroCleared = Object.assign({}, meta.heroCleared || {}, { oasilia: true });
      meta.endlessUnlocked = true;
      localStorage.setItem('oasis_desert_spirit_meta_v1', JSON.stringify(meta));
      // 通关之后回到标题页会**重新渲染**（真实流程：通关页点「回到标题」）；
      // 这一次画出来的头图旁边就该写着「点头图换主角：阿特拉斯」了
      g.phase = 'title';
      window.__oasisUI.forceRerender();
      await wait(500);
      const hint2 = document.querySelector('.hero-swap-hint');
      log('解锁后的切换提示 =', hint2 ? hint2.textContent.trim() : '(没有)');
      const heroBtn2 = document.querySelector('.title-hero-btn');
      if (heroBtn2) heroBtn2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(700);
      log('通关后点头图 ->', beforeHero, '→', readH2());
      if (readH2() === beforeHero) errors.push('欧亚西莉亚通关之后点头图没有换成阿特拉斯');
      const heroCanvas = document.querySelector('.title-hero canvas');
      log('阿特拉斯的头图 =', !!heroCanvas, heroCanvas ? heroCanvas.width + 'x' + heroCanvas.height : '');
      if (!heroCanvas) errors.push('换成阿特拉斯之后头图没了（动画名 / 素材对不上）');
      g.newRun(undefined, { hero: 'atlas' });
      await wait(400);
      log('阿特拉斯开局：', g.data.slug, '｜卡组', g.data.deck.length, '张｜一行', g.data.map.rows, '行｜首领', g.data.map.nodes.filter((n) => n.type === 'boss').length, '个');
      if (g.data.slug !== 'salamence') errors.push('阿特拉斯那一局的物种不是暴飞龙：' + g.data.slug);
      if (g.data.map.rows < 16) errors.push('阿特拉斯一章没有两倍长：' + g.data.map.rows + ' 行');
      if (g.data.map.nodes.filter((n) => n.type === 'boss').length !== 2) errors.push('阿特拉斯一章不是两个首领');
      g.phase = 'title';
      g.titleHeroId = 'oasilia';
      window.__oasisUI.forceRerender();
      await wait(300);
      if (readH2() !== beforeHero) errors.push('换回欧亚西莉亚失败：' + readH2());
    } catch (e) {
      errors.push('heroSwitch: ' + e.message);
    }

    // 6b) **掉落那一屏：两个按钮的意思必须不一样**（用户报的「两个选项都是拿下、不能说不拿」）
    try {
      window.__oasisAuto({ scene: 'reward', kind: 'boss' });
      await wait(400);
      const gD = window.__oasis;
      const drop = gD.reward && gD.reward.itemDrop;
      if (!drop) {
        log('掉落屏断言跳过：这一局没掉东西');
      } else {
        // 造一个「手持栏满了」的掉落：把栏位塞满，并把这一件标成没放下
        while (gD.data.held.length < gD.heldMax()) gD.giveItem('oran_berry', 1);
        drop.stored = false;
        drop.overflow = true;
        drop.seen = false;
        window.__oasisUI.forceRerender();
        await wait(400);
        const btns = [...document.querySelectorAll('.drop-screen .reward-row .btn')];
        const labels = btns.map((b) => b.textContent.trim());
        log('满栏位时的掉落按钮 =', JSON.stringify(labels));
        if (btns.length !== 2) errors.push('手持栏满时的掉落屏不是两个按钮，而是 ' + btns.length + ' 个：' + labels.join(' / '));
        if (labels.length === 2 && labels[0] === labels[1]) errors.push('掉落屏两个按钮的字一样：「' + labels[0] + '」');
        if (btns[1]) {
          btns[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await wait(400);
          /**
           * 只认**「丢掉一件」那个弹窗**（它的主体里有 .held-slot-row）。
           * 用「页面上有没有 .modal-backdrop」判会误报：前面几步跑过的弹窗可能还挂在 DOM 上。
           */
          const modals = [...document.querySelectorAll('.modal-backdrop')];
          const overflowModal = modals.find((m) => m.querySelector('.held-slot-row'));
          log('点「不要」之后：还在掉落屏？', !!document.querySelector('.drop-screen'),
            '｜弹了丢东西的窗？', !!overflowModal, '｜待处理的溢出 =', JSON.stringify(gD.awaitingOverflow ?? null));
          if (document.querySelector('.drop-screen')) errors.push('点「不要，就这样」之后还停在掉落屏');
          if (overflowModal) errors.push('点「不要，就这样」之后又弹出了「丢掉一件」的窗');
          if (gD.awaitingOverflow) errors.push('拒绝掉落之后还留着待处理的溢出（地图页会再问一遍）');
        }
      }
    } catch (e) {
      errors.push('dropChoice: ' + e.message);
    }

    // 6c) 商店：手持栏满了**不能扣钱**（用户报的「钱消失了」）
    try {
      window.__oasisAuto({ scene: 'shop', stage: 1 });
      await wait(400);
      const gS = window.__oasis;
      while (gS.data.held.length < gS.heldMax()) gS.giveItem('oran_berry', 1);
      window.__oasisUI.forceRerender();
      await wait(500);
      const rows = [...document.querySelectorAll('.shop-item')];
      // 只有**道具**那一行才受手持栏限制（卡牌是进卡组的），道具行的标志是那句作用说明 .shop-eff
      const itemRow = rows.find((r) => r.querySelector('.shop-eff'));
      const buy = itemRow ? [...itemRow.querySelectorAll('.btn')].pop() : null;
      log('满栏位时的商店购买按钮：存在 =', !!buy, '｜禁用 =', buy ? buy.disabled : '—');
      if (buy && !buy.disabled) errors.push('手持栏满了，商店的「购买」按钮还能点（应该禁掉并写明原因）');
      const before = gS.data.gold;
      if (buy) buy.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(300);
      if (gS.data.gold !== before) errors.push('手持栏满了还买得成、钱被扣了：' + before + ' → ' + gS.data.gold);
    } catch (e) {
      errors.push('shopFullBag: ' + e.message);
    }

    // 7) 通关记录 / 图鉴 / 曲子库：标题页那四个入口点得开、有内容
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
