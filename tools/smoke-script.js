
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
      /**
       * 行走图不许叠：sprites.js 的 destroy() 只停动画、**不摘节点**，所以「换动作」必须是
       * replaceWith 换出去再换回来 —— 一旦写成「藏起来 + 另 append 一张」，
       * 出几次招屏幕上就会叠着两只精灵（用户报过「行走图也出问题了」）。
       */
      const bodyCounts = [...document.querySelectorAll('.fighter-body')].map((n) => n.querySelectorAll('canvas').length);
      log('行走图 canvas 数（敌/我） =', bodyCounts.join('/'), '｜掉落页？' + dropSeen, '｜奖励页？' + !!document.querySelector('.reward-screen'));
      if (bodyCounts.length && bodyCounts.some((n) => n !== 1)) {
        errors.push('行走图叠了（每个 fighter-body 应该只有 1 张 canvas）：' + bodyCounts.join('/'));
      }
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
      const layers = decor ? decor.querySelectorAll('.decor-layer') : [];
      const bg = layers.length ? getComputedStyle(layers[0]).backgroundImage : '';
      log('背景花纹：容器=' + !!decor, '图层数=' + layers.length, '位图=' + (bg.startsWith('url("data:image/png') ? '有' : '没有'), '位图字节≈' + bg.length);
      if (!decor) errors.push('战斗背景没有花纹层（.battle-decor）');
      if (layers.length !== 3) errors.push('背景花纹应该是三层（底色 + 左右各一份高亮），实际 ' + layers.length);
      // 位图必须是**真的画出来了**（空画布会是一张极小的透明 PNG）
      if (!bg.startsWith('url("data:image/png')) errors.push('花纹层没有铺上那张平铺位图');
      else if (bg.length < 2000) errors.push('花纹位图太小了，像是空画布：' + bg.length + ' 字节');
      const enemiesMod = await import('/src/data/enemies.js');
      const slug = window.__oasisUI.battleScreen.battle.enemy.slug;
      const dexText = (enemiesMod.ENEMIES.find((e) => e.slug === slug) || {}).dexText || '';
      if (!dexText) errors.push('这一场敌人的物种没有背景花纹文本：' + slug);
      const glowE = document.querySelector('.decor-glow-enemy');
      const glowP = document.querySelector('.decor-glow-player');
      const opa = (n) => (n ? Number(getComputedStyle(n).opacity) : -1);
      const bs = window.__oasisUI.battleScreen;
      /**
       * 「真的像波浪一样滚」（3.0.7）：三层各是一条 decorRoll 动画，滚一个周期（--roll）
       * 刚好逐像素回到原点，所以看不到接缝。
       *
       * ⚠ 这里**不能**靠「隔一会儿读两次 computed transform」来判断动没动：
       * 这条动画跑在合成层上（will-change + translate3d），主线程的 computed style
       * 一直是起点值 matrix(1,0,0,1,0,0) —— 第一版就是这么误报「没在滚」的。
       * 改成两件主线程能确定的事：
       *   ① 动画挂上了、周期是个像样的正数；
       *   ② 关键帧里那个 calc(-1 * var(--roll)) **真的能算出来**：
       *      拿一个探针元素套同样的表达式，看它算出来的矩阵是不是平移了 -周期。
       * 真在动这件事由 tools/measure-decor-motion.py 拿两张截图逐像素比（见那个脚本）。
       */
      const rolls = [...document.querySelectorAll('.decor-layer')];
      const st = rolls.length ? getComputedStyle(rolls[0]) : null;
      const rollPx = Number((st?.getPropertyValue('--roll') || '0px').replace('px', ''));
      log('花纹滚动：层数=' + rolls.length, '动画=' + (st?.animationName || '-'), '周期=' + rollPx + 'px');
      if (!(rollPx > 100)) errors.push('花纹的滚动周期不像样：' + rollPx + 'px');
      if ((st?.animationName || '') !== 'decorRoll') errors.push('花纹没有挂上滚动动画（decorRoll）');
      if (rolls.length) {
        /**
         * 「平铺无缝」的数学条件：每一行的波长必须能整除**一个周期的宽度**（= 滚动距离）。
         * 不整除的话，滚到接缝处波形对不上，会看到一条一条的竖缝 ——
         * 这是这个做法唯一的硬要求，所以在这里钉住（而不是等图上看出来）。
         */
        const facts = bs?.decor?.decorFacts;
        if (!facts) {
          errors.push('花纹没有留下 decorFacts（验不了平铺无缝）');
        } else {
          const bad = facts.wls.filter((wl) => Math.abs(facts.unit - Math.round(facts.unit / wl) * wl) > 0.6);
          log('  平铺无缝：周期 ' + facts.unit + 'px · 字号 ' + facts.size + 'px · 波长 ' + facts.wls.join('/'));
          if (bad.length) errors.push('有波长不能整除一个周期的宽度（平铺会有缝）：' + bad.join('、'));
          /**
           * 位图的高度必须等于场地现在的真实高度。
           * 不等的话贴上去会被**纵向拉伸** —— 字会被压成一条条横杠，
           * 用户截图报的「既没有波也没有浪，全是一块一块的」正是这个（当时 background-size 写了 100%）。
           */
          const decorH = Math.round(decor.getBoundingClientRect().height);
          log('  位图高=' + facts.h + ' 场地高=' + decorH);
          if (Math.abs(facts.h - decorH) > 2) {
            errors.push('位图高度和场地高度对不上（' + facts.h + ' vs ' + decorH + '）—— 会被纵向拉伸变形');
          }
          /**
           * 位图**不能被排漏一段**（3.1.3）。
           *
           * 这一条守的是「字串没排满一个周期」：排到一半就停了的话，位图右端会空一截，
           * 平铺出去就是每个周期一条竖向空白带 —— 不报错、不提示，只是安静地留白。
           * 3.1.2 就是这个毛病（?decor=probe 量到最长的空白有 50~62 像素宽）。
           * 判据取「最长的一段没有字的竖条」：一个字宽以内算正常
           * （段与段之间补的那个全角空格本身就是这么宽），超过就是排漏了。
           * ⚠ 一开始量的是「左 / 中 / 右三条 78px 宽的竖带里有没有字迹」，
           * 注入 bug 一试就露馅：留了 60px 空白，那一条里仍然有 1100 多个字迹像素，照样放行。
           */
          const fill = facts.fill ?? {};
          for (const side of ['enemy', 'player']) {
            const f = fill[side];
            if (!f) { errors.push('花纹没有留下那一半的字迹体检表（' + side + '）'); continue; }
            log('  字迹（' + side + '）：左 ' + f.left + ' / 中 ' + f.mid + ' / 右 ' + f.right
              + ' 像素 · 最长空白 ' + f.maxEmptyRun + 'px（在第 ' + f.maxEmptyAt + 'px 处）');
            if (!f.left || !f.mid || !f.right) {
              errors.push('花纹位图在 ' + side + ' 这一半整片没字（' + f.left + '/' + f.mid + '/' + f.right + '）');
            }
            if (!(f.maxEmptyRun <= facts.size)) {
              errors.push('花纹位图在 ' + side + ' 这一半排漏了一段（最长空白 ' + f.maxEmptyRun
                + 'px > 一个字宽 ' + facts.size + 'px，位置 ' + f.maxEmptyAt + '）—— 平铺出去是一条条竖向空白带');
            }
          }
        }
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;';
        probe.style.setProperty('--roll', rollPx + 'px');
        probe.style.transform = 'translate3d(calc(-1 * var(--roll, 640px)), 0, 0)';
        document.body.append(probe);
        const m = getComputedStyle(probe).transform;
        probe.remove();
        // 不用正则：这段代码是写在一个模板字符串里的，正则里的反斜杠会被提前吃掉（踩过）
        const parts = String(m).replace('matrix(', '').replace(')', '').split(',').map((s) => Number(s.trim()));
        const tx = parts.length === 6 ? parts[4] : NaN;
        log('  关键帧那个 calc 算出来 =', m, '（横向位移 ' + tx + 'px）');
        if (!(Math.abs(tx + Math.round(rollPx)) < 2)) {
          errors.push('滚动关键帧里的 calc(-1 * var(--roll)) 没有算出平移（实测 ' + m + '）');
        }
      }
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
        const vars = getComputedStyle(bs.decor);
        log('  高亮中心：敌人 ' + vars.getPropertyValue('--glow-enemy-x').trim() + ',' + vars.getPropertyValue('--glow-enemy-y').trim()
          + ' · 玩家 ' + vars.getPropertyValue('--glow-player-x').trim() + ',' + vars.getPropertyValue('--glow-player-y').trim());
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
        if (!(onE > 0.1 && onP < 0.02)) errors.push('敌人行动时亮的应该只有敌人那半片（实测 ' + onE + '/' + onP + '）');
        if (!(pP > 0.1 && pE < 0.02)) errors.push('玩家行动时亮的应该只有玩家那半片（实测 ' + pE + '/' + pP + '）');
        if (!(baseE < 0.02 && baseP < 0.02)) errors.push('停手后两份高亮都该淡回去（实测 ' + baseE + '/' + baseP + '）');
      }
    } catch (e) {
      errors.push('battleDecor: ' + e.message);
    }

    /**
     * 3.7) 3.1 的几处战斗界面改动
     *
     * 这一块的共同点是「肉眼能看出、但出错了也不会崩」，所以每条都钉在冒烟里：
     *   · 手牌左边那张压在上层（费用角标别再被右边的牌盖住）；
     *   · 右侧多出一块弃牌区（打过的牌看得见）；
     *   · 动作按卡牌挑（远程 Shoot / 自身强化 Charge / 近身 Attack），缺动画要回退；
     *   · 净化只点亮**真的被清掉**的那个状态，强化胶囊不许跟着发光；
     *   · 发牌 / 打牌的音效真的放出声（不是被「未解锁 / 解码失败」悄悄丢掉）。
     */
    try {
      window.__oasisAuto({ scene: 'battle', stage: 1 });
      await wait(900);
      const bsv = window.__oasisUI.battleScreen;
      const cardsMod = await import('/src/data/cards.js');
      const CARD_BY_ID = cardsMod.CARD_BY_ID;

      // ① 手牌叠放：最左边那张 z-index 最大
      const handCards = [...document.querySelectorAll('.hand .card')];
      const zs = handCards.map((n) => Number(n.style.zIndex || 0));
      log('手牌叠放 z-index =', zs.join('/'));
      if (handCards.length >= 2 && !(zs[0] > zs[zs.length - 1])) {
        errors.push('手牌的叠放顺序不对（应该左边的牌在最上层）：' + zs.join('/'));
      }

      // ② 弃牌区：容器在、写着张数
      const dz = document.querySelector('.discard-zone');
      log('弃牌区：容器=' + !!dz, '标题=' + (dz ? (dz.textContent || '').slice(0, 20) : '-'));
      if (!dz) errors.push('右侧没有弃牌区（.discard-zone）');
      else if (!dz.querySelector('.discard-head')) errors.push('弃牌区没有标题行（张数写在哪儿？）');

      // ③ 动作挑选 + 回退链（3.1.4 起判定改读卡牌自带的「接触 / 远隔」字段）
      const pick = (n) => bsv.pickFighterAnim('flygon', n);
      const animOf = (id) => bsv.animForCard(CARD_BY_ID[id]);
      const samples = ['tackle', 'bite', 'sand_attack', 'baby_doll_eyes', 'ember', 'flash_cannon'].filter((id) => CARD_BY_ID[id]);
      log('动作挑选：' + samples.map((id) => id + '=' + animOf(id)).join(' '),
        '| 回退：Shoot=' + pick('Shoot') + ' 不存在的动作=' + pick('根本不存在'));
      /**
       * 判据从「按属性猜」换成了**卡牌自己带的 range 字段**（用户：「从现在开始要求所有卡牌分一个，
       * 命名为接触类（近程）和远隔类（远程）来进行判定」，见 content/SPEC.md 与 check-content 的门禁）。
       * 这里挑的几对正好覆盖三种情况：
       *   · 撞击（一般·接触）、咬住（恶·接触，名字是上去咬）：Attack
       *   · 泼沙（地面·判定是接触）、撒娇凝视（妖精·挂弱化）：前者 Attack、后者 Shoot
       *   · 火花（火·远隔）、岩崩（岩石·判定是远隔）：Shoot
       */
      const WANT_ANIM = { tackle: 'Attack', bite: 'Attack', sand_attack: 'Attack', baby_doll_eyes: 'Shoot', ember: 'Shoot', flash_cannon: 'Shoot' };
      for (const [id, want] of Object.entries(WANT_ANIM)) {
        if (!CARD_BY_ID[id]) continue;
        if (animOf(id) !== want) {
          errors.push('动作挑选错了：' + id + '（' + CARD_BY_ID[id].name + '，range=' + CARD_BY_ID[id].range
            + '）应该演 ' + want + '，实际 ' + animOf(id));
        }
      }
      // 每张牌都必须有判定字段（门禁在 check-content 里，这里顺手核一下引擎拿到的数据）
      const noRange = Object.values(CARD_BY_ID).filter((c) => !c.range).map((c) => c.id);
      log('没有接触/远隔判定的卡 =', noRange.length);
      if (noRange.length) errors.push('有卡牌没有 range 判定：' + noRange.slice(0, 6).join('、'));
      if (pick('根本不存在') !== 'Attack') errors.push('没有的动作应该回退到 Attack，实际 ' + pick('根本不存在'));

      /**
       * ③-b 远隔类的牌要**真的打过去**（3.1.4）。
       *
       * 以前不管远近都只是在**自己身上**贴一张图，远程招和近身招看起来一模一样。
       * 现在判定是数据里的（range），演出也照它走：远隔的牌会生成一发「.fx-projectile」
       * 从出手那一侧飞向对手。这一条钉的是「飞行物真的生成了、而且方向对」——
       * 光靠截图钉不住：CSS 动画在 shot.mjs 的虚拟时间下**不推进**（见那个脚本的说明），
       * 想拍到飞行中的那一帧得靠运气。
       */
      const ranged = Object.values(CARD_BY_ID).find((c) => c.range === '远隔' && (c.effects ?? []).some((e) => e.kind === 'damage'));
      const melee = Object.values(CARD_BY_ID).find((c) => c.range === '接触' && (c.effects ?? []).some((e) => e.kind === 'damage'));
      if (ranged && melee) {
        /**
         * ⚠ 飞行物要在**它被摘掉之前**记下来：它自带一个「飞完就 remove」的定时器
         * （见 src/ui/battle-fx.js），而冒烟跑在虚拟时间下 —— 那个定时器会在
         * await attackAnim(...) 返回之前就烧掉，await 完再查 DOM 永远是 0（第一版就是这样）。
         * 所以挂一个 MutationObserver，节点一进战场就抄下它的位移。
         */
        const caught = [];
        const mo = new MutationObserver((muts) => {
          for (const m of muts) {
            for (const n of m.addedNodes) {
              if (n.nodeType === 1 && n.classList?.contains('fx-projectile')) {
                caught.push({
                  dx: Number((n.style.getPropertyValue('--fx-dx') || '0px').replace('px', '')),
                  dy: Number((n.style.getPropertyValue('--fx-dy') || '0px').replace('px', '')),
                });
              }
            }
          }
        });
        mo.observe(bsv.field, { childList: true, subtree: true });
        await bsv.attackAnim('enemy', ranged);
        await bsv.attackAnim('enemy', melee);
        mo.disconnect();
        const shot = caught[0];
        log('远隔招（' + ranged.name + '）的飞行物：生成=' + !!shot,
          shot ? '位移=' + shot.dx.toFixed(0) + ',' + shot.dy.toFixed(0) : '',
          '｜接触招（' + melee.name + '）期间一共生成 ' + caught.length + ' 个');
        if (!caught.length) errors.push('远隔招（' + ranged.name + '）没有生成飞行物');
        // 敌人在右上、主角在左下：这一发应该是往左下方飞的
        else if (!(shot.dx < -20 && shot.dy > 10)) {
          errors.push('飞行物的方向不对：位移 ' + shot.dx.toFixed(0) + ',' + shot.dy.toFixed(0) + '（应该往左下方飞）');
        }
        // 两次出招只有远隔那一次会生成飞行物
        if (caught.length !== 1) errors.push('接触招也生成了飞行物（' + caught.length + ' 个，应该只有远隔那 1 个）');
        for (const n of document.querySelectorAll('.fx-projectile')) n.remove();

        /**
         * ③-c 出招 / 挨打**必须真的放出贴图特效**（3.1.4 的收尾）。
         *
         * 用户报过「怎么什么特效都没了」：那次查下来是两件事 ——
         * ① 远隔类（111 张）只剩一道细光条飞出去，出手那一下几乎看不见；
         * ② style.css 末尾那条全局的「降低动效」规则会把特效动画压成 0.001ms，
         *    而 fxBurst 是**淡到 opacity 0 结束**的 —— 系统开了「减少动画」的玩家
         *    会看到**一个特效都没有**（已经在 CSS 里补了静态兜底）。
         * 所以这里钉住最朴素的一条：出一次招、挨一次打，场上都得出现 .fx-burst。
         * 用 MutationObserver 抓（虚拟时间下它们转瞬就被摘掉了，事后查 DOM 是查不到的）。
         */
        const seen = [];
        const mo2 = new MutationObserver((muts) => {
          for (const m of muts) {
            for (const n of m.addedNodes) {
              if (n.nodeType === 1 && n.classList?.contains('fx-burst')) {
                seen.push((n.style.getPropertyValue('--fx-color') || '?') + ' ' + (n.style.width || '?'));
              }
            }
          }
        });
        mo2.observe(bsv.field, { childList: true, subtree: true });
        await bsv.attackAnim('player', melee);
        const afterAttack = seen.length;
        await bsv.hitAnim({ side: 'player', amount: 7, absorbed: 0, crit: false }, bsv.playerBody, bsv.playerCard);
        mo2.disconnect();
        log('出招期间生成的特效数 =', afterAttack, '｜挨打之后累计 =', seen.length);
        log('  例：' + seen.slice(0, 4).join(' ／ '));
        if (!afterAttack) errors.push('出招那一下一个贴图特效都没有（.fx-burst）');
        if (seen.length <= afterAttack) errors.push('挨打那一下一个命中特效都没有（.fx-burst）');
        for (const n of document.querySelectorAll('.fx-burst')) n.remove();
      }
      const buffCard = Object.values(CARD_BY_ID).find((c) => (c.effects ?? []).some((e) => e.kind === 'shield'));
      for (const [label, card] of [['自身强化', buffCard]]) {
        if (card && animOf(card.id) !== 'Charge') errors.push(label + '（' + card.id + '）应该用 Charge，实际 ' + animOf(card.id));
      }

      // ④ 净化只点亮被清掉的那个：造两个胶囊（一个状态、一个强化）验一下
      const holder = bsv.playerStatuses;
      if (holder) {
        holder.innerHTML = '';
        const chipSt = document.createElement('span');
        chipSt.dataset.st = 'poison';
        const chipBuff = document.createElement('span');
        chipBuff.dataset.buff = 'power';
        holder.append(chipSt, chipBuff);
        const n = bsv.markPurge('player', { statuses: ['poison'] });
        const stLit = chipSt.classList.contains('purge');
        const buffLit = chipBuff.classList.contains('purge');
        log('净化发光：被清掉的状态=' + stLit, '强化胶囊=' + buffLit, '（返回 ' + n + '）');
        if (!stLit) errors.push('净化没有点亮被清掉的那个状态胶囊');
        if (buffLit) errors.push('净化把强化胶囊也点亮了（用户报的错发光）');
        if (n !== 1) errors.push('净化点亮了几个胶囊的返回值不对：' + n);
        holder.innerHTML = '';
        bsv.refreshSide('player');
      }

      // ⑤ 音效：发牌 / 打牌真的出声
      const audioMod = await import('/src/core/audio.js');
      const au = audioMod.audio;
      au.enabled = true;
      au.unlock();
      await au.warm(['cardSlide', 'cardPlace', 'cardSlide2']);
      const before = { ...au.stats, dropped: { ...au.stats.dropped } };
      au.dealCards(3);
      au.cardPlay();
      await wait(600);
      const started = au.stats.started - before.started;
      const dropped = (au.stats.dropped.noBuffer - before.dropped.noBuffer) + (au.stats.dropped.noCtx - before.dropped.noCtx);
      log('音效：这一轮真的播了 ' + started + ' 声 · 被丢掉 ' + dropped + ' 声（发牌 3 + 打牌 2 共 5 声）');
      if (started < 4) errors.push('发牌 / 打牌的音效没有真的播出来（只播了 ' + started + ' 声）');
      if (dropped) errors.push('有音效被静默丢掉：' + dropped + ' 声');

      // ⑥ 真出两张牌，看行走图会不会叠成两张、以及换动作时卡片会不会左右跳
      const playable = bsv.battle.hand('player').filter((c) => bsv.battle.canPlay(c.uid)).slice(0, 2);
      const boxBefore = playable.length ? bsv.enemyBody.getBoundingClientRect() : null;
      for (const c of playable) { await bsv.playCard(c.uid); await wait(420); }
      const counts = [...document.querySelectorAll('.fighter-body')].map((n) => n.querySelectorAll('canvas').length);
      log('出牌后行走图 canvas 数（敌/我） =', counts.join('/') + '（出牌 ' + playable.length + ' 张）');
      if (counts.length && counts.some((n) => n !== 1)) {
        errors.push('行走图叠了（每个 fighter-body 应该只有 1 张 canvas）：' + counts.join('/'));
      }
      /**
       * 换动作不许改布局：不同动作的帧盒子不一样（Idle 32×72 / Attack 64×80），
       * 身体盒子要是跟着变，右边那张血条 / 头像卡就会被挤得左右跳（用户报的）。
       */
      if (boxBefore) {
        const boxAfter = bsv.enemyBody.getBoundingClientRect();
        log('精灵盒子 出牌前 x=' + boxBefore.left.toFixed(1) + ' w=' + boxBefore.width.toFixed(1)
          + ' → 出牌后 x=' + boxAfter.left.toFixed(1) + ' w=' + boxAfter.width.toFixed(1));
        if (Math.abs(boxAfter.width - boxBefore.width) > 1.5) {
          errors.push('换动作时精灵盒子宽度变了（血条 / 头像框会左右跳）：'
            + boxBefore.width.toFixed(1) + ' → ' + boxAfter.width.toFixed(1));
        }
      }
      // 出完牌必须回到 Idle（不能卡在动作的最后一帧）
      const backToIdle = bsv.playerAnimName === 'Idle' && bsv.enemyAnimName === 'Idle';
      log('出完牌的动作 =', bsv.playerAnimName + ' / ' + bsv.enemyAnimName);
      if (!backToIdle) errors.push('动作演完没有回到 Idle（现在停在 ' + bsv.playerAnimName + '）');

      /**
       * ⑦ **换动作时行走图不许被压扁**（3.1.4，用户截图报的「出招、受伤时行走图都会被压扁」）。
       *
       * 判据很硬：一个动作画布的**显示宽高比**必须等于它自己那套帧的宽高比（fw : fh）。
       * 各动作的帧盒子差得很远（冰宝 Idle 32×32 / Attack 64×64，沙漠蜻蜓 Idle 32×72 / Attack 64×80），
       * 所以只要哪个环节拿错一套尺寸、或者被 CSS 单轴夹住，比例立刻就对不上。
       * 这一次的真凶是 CSS 里那句「.fighter-body canvas { max-height: 100% }」：身体盒子被钉成待机那张的高度，
       * 出招画布比它高，于是**高度被夹、宽度照旧** —— 冰宝一出手就成了一张扁饼。
       */
      /**
       * 换动作时角色**不许上下跳**（3.1.4 的后半条）。
       *
       * 帧盒子的空白四边并不对称，画布又都是居中放的 —— 不平移的话，一出手精灵就位移一大截
       * （实测 206 只里 199 只跳得超过 4% 帧高，最狠的 65% ≈ 45 像素）。
       *
       * 判据按**几何**算，不按当前显示的那一帧去数像素：一次性动作是**正在播的**，
       * 量的时候它可能已经演到冲刺帧了，角色本来就该往前冲 —— 那是姿势，不是跳。
       * 所以量的是「这张画布**起手帧**的角色中心落在身体盒子的哪个高度」：
       * 画布顶边 + 内容外接框中心 × 缩放（内容外接框见 core/sprites.js 的 firstFrameBox），
       * 也就是 applyAnimScale 里那句补偿想实现的东西。
       * 待机的基准必须在出任何动作**之前**量好：一次性动作会把待机换出 DOM，
       * 拿一张不在文档里的画布去量 rect 全是 0（第一版就是这么算出「跳了 175 像素」的假警报）。
       */
      const anchorAt = (node2, body2) => {
        const r2 = node2?.getBoundingClientRect?.();
        const fi = node2?.frameInfo;
        const cb2 = node2?.contentBox;
        if (!r2?.height || !fi || !cb2) return null;
        const s2 = r2.height / fi.fh;
        return (r2.top - body2.getBoundingClientRect().top) + (cb2.y + cb2.h / 2) * s2;
      };
      /** 实拍的内容中心（当前这一帧）：只打日志给人看，含姿势差，不能当判据 */
      const shownCenter = (cv, body2) => {
        if (!cv?.isConnected) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let y0 = Infinity; let y1 = -1;
        for (let y = 0; y < cv.height; y += 1) {
          for (let x = 0; x < cv.width; x += 1) {
            if (d[(y * cv.width + x) * 4 + 3] > 8) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
        }
        if (y1 < 0) return null;
        const k = cv.getBoundingClientRect().height / cv.height;
        return (cv.getBoundingClientRect().top - body2.getBoundingClientRect().top) + ((y0 + y1 + 1) / 2) * k;
      };
      const idleRef = {};
      for (const sd of ['enemy', 'player']) {
        idleRef[sd] = anchorAt(sd === 'enemy' ? bsv.enemyIdleAnim : bsv.playerIdleAnim,
          sd === 'enemy' ? bsv.enemyBody : bsv.playerBody);
      }
      log('待机的角色中心（身体盒子坐标）：敌 ' + idleRef.enemy?.toFixed(1) + ' / 我 ' + idleRef.player?.toFixed(1));
      for (const [side, want] of [['enemy', 'Attack'], ['enemy', 'Hurt'], ['player', 'Attack']]) {
        const body = side === 'enemy' ? bsv.enemyBody : bsv.playerBody;
        await bsv.playFighterAnim(side, want, { fps: 12 });
        await wait(160);
        const cv = body?.querySelector('canvas');
        const info = cv?.frameInfo;
        if (!cv || !info) { errors.push('拿不到 ' + side + ' 的 ' + want + ' 画布 / 帧信息'); continue; }
        const r = cv.getBoundingClientRect();
        const wantAspect = info.fw / info.fh;
        const gotAspect = r.width / r.height;
        const at = anchorAt(cv, body);
        const shown = shownCenter(cv, body);
        log('  ' + side + ' ' + want + '：帧 ' + info.fw + '×' + info.fh
          + ' → 显示 ' + r.width.toFixed(1) + '×' + r.height.toFixed(1)
          + '（比 ' + gotAspect.toFixed(3) + ' vs ' + wantAspect.toFixed(3) + '）'
          + '｜起手帧中心 ' + (at == null ? '-' : at.toFixed(1)) + ' vs 待机 ' + (idleRef[side] == null ? '-' : idleRef[side].toFixed(1))
          + '｜实拍 ' + (shown == null ? '-' : shown.toFixed(1))
          + '｜--sprite-dy=' + (cv.style.getPropertyValue('--sprite-dy') || '(未设)'));
        if (Math.abs(gotAspect - wantAspect) > 0.02) {
          errors.push(side + ' 的 ' + want + ' 行走图被压扁了：帧比 ' + wantAspect.toFixed(3)
            + '，显示比 ' + gotAspect.toFixed(3) + '（' + r.width.toFixed(0) + '×' + r.height.toFixed(0) + '）');
        }
        if (at != null && idleRef[side] != null && Math.abs(at - idleRef[side]) > 3) {
          errors.push(side + ' 换 ' + want + ' 的时候角色上下跳了 '
            + Math.abs(at - idleRef[side]).toFixed(1) + 'px（起手帧中心 ' + at.toFixed(1) + ' vs 待机 ' + idleRef[side].toFixed(1) + '）');
        }
      }
      /**
       * ⑦-b 图鉴的行走图**不许被裁掉一截**（3.1.4 的一个回归）。
       *
       * 图鉴那几张图是 trim: true 建的：画布缓冲区按「内容外接框 × 缩放」建，
       * paint() 再把裁过的框铺满画布 —— 所以那个框必须**罩得住这一行动画的每一帧**。
       * 我为了修「换动作上下跳」一度把这里的框换成了「起手帧」的框，于是会动的动作
       * （挥手、前冲、倒下）后面几帧露到画布外面被切掉，用户在图鉴里看到了缺胳膊少腿。
       *
       * 这里的验法和实现无关：自己把精灵图读进来，量出**这一行所有帧的并集**，
       * 再和画布缓冲区尺寸对 —— 对不上就是裁错了。
       */
      try {
        const spritesMod = await import('/src/core/sprites.js');
        const meta = await (await fetch('assets/data/sprites.json')).json();
        /**
         * 挑的这几只不是随手写的：tools/shots/probe-trim-scope.mjs 量过 208 只的 Idle ——
         * **119 只**的「整行并集」比「起手帧的框」大出 2 像素以上（大嘴娃宽 +20、
         * 大嘴雀高 +18、电龙高 +12…）。用起手帧的框去裁，这 119 只就会缺一块。
         * 所以这里拿两只最狠的当哨兵：裁错了它们必然对不上。
         */
        for (const slug of [bsv.game.data.slug, 'mawile', 'fearow']) {
          const info = meta?.[slug]?.anims?.Idle;
          const cv = await spritesMod.createAnim(slug, { anim: 'Idle', trim: true, scale: 2 });
          if (!info || !cv) {
            errors.push('拿不到 ' + slug + ' 的 Idle 元数据 / 裁剪画布');
            continue;
          }
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res; img.onerror = rej;
            img.src = 'assets/pokemon/' + slug + '/Idle.png';
          });
          const w = info.fw * info.cols;
          const h = info.fh * info.rows;
          const probe = document.createElement('canvas');
          probe.width = w; probe.height = h;
          const pc = probe.getContext('2d', { willReadFrequently: true });
          pc.drawImage(img, 0, 0);
          /**
           * ⚠ 必须**换一次朝向**再量：图鉴那张行走图会跟着鼠标转（canvas.setDir），
           * 而出事的就是这条路径（建的时候用的是整行并集，换朝向时一度换成了起手帧的框）。
           * 只量「刚建好」的那张是量不出问题的 —— 第一次写这条断言时就漏了这一步。
           */
          const startRow = cv.dirRow ?? 0;
          cv.setDir(startRow === 0 ? 1 : 0);
          const row = cv.dirRow ?? 0;
          /**
           * ⚠ 并集要在**画格内坐标**里取：一行的 7 格是横向排开的，
           * 直接对整行取外接框会把 7 格连成 434 像素宽（第一版就写错了，
           * 报出来「画布 62×70 vs 并集 434×70」这种假警报）。
           * core/sprites.js 的 contentBox 也是这么做的：把每一格画到 (0,0) 再取并集。
           */
          let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
          for (let c = 0; c < info.cols; c += 1) {
            const d = pc.getImageData(c * info.fw, row * info.fh, info.fw, info.fh).data;
            for (let y = 0; y < info.fh; y += 1) {
              for (let x = 0; x < info.fw; x += 1) {
                if (d[(y * info.fw + x) * 4 + 3] > 8) {
                  if (x < x0) x0 = x; if (x > x1) x1 = x;
                  if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
              }
            }
          }
          const wantW = Math.round((x1 - x0 + 1) * 2);
          const wantH = Math.round((y1 - y0 + 1) * 2);
          log('裁剪行走图（' + slug + '×2）：画布 ' + cv.width + '×' + cv.height
            + '｜这一行所有帧的并集 ' + wantW + '×' + wantH);
          if (Math.abs(cv.width - wantW) > 2 || Math.abs(cv.height - wantH) > 2) {
            errors.push('图鉴行走图裁错了（' + slug + '）：画布 ' + cv.width + '×' + cv.height
              + '，而这一行动画的内容并集是 ' + wantW + '×' + wantH + '（裁小了就会切掉后面几帧）');
          }
          cv.destroy?.();
        }
      } catch (e) {
        errors.push('裁剪行走图检查失败：' + e.message);
      }

      // 量完把这几个一次性动作收掉，别留给后面的检查
      for (const side of ['enemy', 'player']) {
        const body = side === 'enemy' ? bsv.enemyBody : bsv.playerBody;
        const idle = side === 'enemy' ? bsv.enemyIdleAnim : bsv.playerIdleAnim;
        const cur = body?.querySelector('canvas');
        if (cur && idle && cur !== idle) cur.replaceWith(idle);
        if (idle) bsv[side === 'enemy' ? 'enemyAnim' : 'playerAnim'] = idle;
        if (idle) bsv[side === 'enemy' ? 'enemyAnimName' : 'playerAnimName'] = 'Idle';
        if (side === 'enemy') bsv._enemyOneshot = null; else bsv._playerOneshot = null;
      }
    } catch (e) {
      errors.push('battle-3.1: ' + e.message);
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

    /**
     * 6d) 右上角的背包按钮：**战斗中能看、但绝不能嗑药**（用户点名：那会影响平衡）。
     *
     * 这一屏原本只有一个隐藏入口（按 I），于是「身上带着什么」在商店 / 战斗里想不起来
     * 也查不到。现在 HUD 上多了一个背包按钮 —— 它必须满足两件事：
     *   ① 点得开，而且里面有东西（玩家要能看到自己带着什么）；
     *   ② 战斗中「使用」按钮是**禁用的**，并且引擎那一层也拒绝（两道闸都要在，
     *      否则以后谁写个新入口就绕过去了）。
     */
    try {
      window.__oasisAuto({ scene: 'battle', stage: 1 });
      await wait(1400);
      const gB = window.__oasis;
      gB.data.held = [];
      gB.invalidateMods();
      gB.giveItem('oran_berry', 1);
      const heldItem = gB.data.held[gB.data.held.length - 1];
      window.__oasisUI.forceRerender();
      await wait(400);

      const bagBtn = document.getElementById('btn-items');
      log('HUD 背包按钮 =', !!bagBtn, '｜角标 =', document.getElementById('hud-held-count')?.textContent);
      if (!bagBtn) errors.push('HUD 上没有背包按钮（#btn-items）');
      const badge = document.getElementById('hud-held-count');
      if (badge && badge.textContent.trim() !== String(gB.data.held.length)) {
        errors.push('背包角标写的件数和实际不符：' + badge.textContent + ' vs ' + gB.data.held.length);
      }
      if (bagBtn) {
        bagBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(400);
        const modals = [...document.querySelectorAll('.modal-backdrop')];
        const bag = modals.find((m) => m.querySelector('.held-item'));
        log('战斗中打开背包：弹窗 =', !!bag, '｜列出道具 =', bag ? bag.querySelectorAll('.held-item').length : 0);
        if (!bag) errors.push('战斗中点 HUD 的背包按钮没打开手持道具面板');
        const useBtn = bag ? [...bag.querySelectorAll('button')].find((b) => b.textContent.trim() === '使用') : null;
        log('战斗中「使用」按钮：存在 =', !!useBtn, '｜禁用 =', useBtn ? useBtn.disabled : '—',
          '｜悬停说明 =', useBtn ? (useBtn.dataset.tip || '') : '—');
        if (useBtn && !useBtn.disabled) errors.push('战斗中背包里的「使用」按钮还能点（会影响平衡）');
        if (useBtn && !/战斗中不能使用/.test(useBtn.dataset.tip || '')) {
          errors.push('战斗中「使用」按钮没有写明为什么不能点：' + (useBtn.dataset.tip || '（空）'));
        }
        // 引擎那一层也要拦（界面禁用只是第一道闸）
        const before = gB.data.hp;
        const res = gB.useItem(heldItem);
        log('战斗中直接调 useItem：ok =', res ? res.ok : '（null）', '｜', res ? res.text : '');
        if (res && res.ok) errors.push('引擎允许在战斗中使用道具（平衡会被打破）');
        if (gB.data.hp !== before) errors.push('战斗中被拒绝之后血还是变了：' + before + ' → ' + gB.data.hp);
        if (!gB.data.held.includes(heldItem)) errors.push('战斗中被拒绝之后道具却消失了');
        // 关掉面板，别影响后面几步
        for (const b of [...document.querySelectorAll('.modal-head button')]) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(300);
      }
    } catch (e) {
      errors.push('hudBag: ' + e.message);
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

    /**
     * 7.5) 首领称号在图鉴里的写法（3.1）
     *
     * 用户要求：称号不要再做成名字旁边的一枚小胶囊，而是写在名字下面那一行
     * （遭遇演出里本来就是这么打的）。这里点开一个「首领」档位的图鉴详情，
     * 看那一行在不在、以及有没有残留的胶囊写法。
     */
    try {
      g.phase = 'title';
      window.__oasisUI.forceRerender();
      await wait(350);
      const entries2 = [...document.querySelectorAll('.title-codex .title-codex-btn')];
      entries2[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(400);
      const modal2 = [...document.querySelectorAll('.modal-backdrop')].pop();
      const bossCard = modal2 ? [...modal2.querySelectorAll('.dex-card')].find((n) => (n.textContent || '').includes('首领')) : null;
      if (!bossCard) {
        log('首领称号：这一局还没遇见过首领（图鉴里没解锁），跳过');
      } else {
        bossCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(400);
        const detail = [...document.querySelectorAll('.modal-backdrop')].pop();
        const title = detail ? detail.querySelector('.dex-boss-title') : null;
        const chip = detail ? detail.querySelector('.detail-chip.boss-title') : null;
        log('首领称号：名字下面那一行 =', title ? (title.textContent || '').slice(0, 12) : '（没有）', '| 残留胶囊 =', !!chip);
        if (!title) errors.push('图鉴详情里没有「名字下面那一行」的首领称号（.dex-boss-title）');
        if (chip) errors.push('首领称号还在用胶囊写法（.detail-chip.boss-title）');
        for (const b of (detail ? detail.querySelectorAll('.modal-head button') : [])) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(120);
      }
      for (const b of (modal2 ? modal2.querySelectorAll('.modal-head button') : [])) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(120);
    } catch (e) {
      errors.push('bossTitle: ' + e.message);
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
      hudBagBtn: !!document.getElementById('btn-items'),
    };
    log('DOM checks', JSON.stringify(checks));
    if (!checks.hudCodexBtn) errors.push('HUD 上没有图鉴按钮（#btn-codex）');
    if (!checks.hudBagBtn) errors.push('HUD 上没有背包按钮（#btn-items）');

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
