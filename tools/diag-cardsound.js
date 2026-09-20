// 卡牌音效诊断（?dgcs=1，**真实时间**跑）：
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgcs=1" rt
//
// 起因（用户反馈）：「发牌、出牌都没有音效」。
// 这条诊断回答三件事，每一件都要有数字，不靠耳朵：
//   ① **有没有真的响** —— 真打一场，抽出牌 / 打出牌，把 audio.playedNames() 的增量列出来；
//   ② **响得够不够** —— 把几个音效解码出来量峰值（dBFS），跟战斗音效（PANICPUMPKIN 那套）
//      放一起对照：如果卡牌音效比它们低十几 dB，玩家当然听不见；
//   ③ **预载了没有** —— 它们必须在 BATTLE_SFX 里（不然第一声要等解码，慢半拍）。
(async () => {
  const log = (...a) => console.log('[d2] [cs]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const audioMod = await import('/src/core/audio.js');
    const { audio, BATTLE_SFX } = audioMod;

    log('① 预载表');
    ok(BATTLE_SFX.includes('cardPlace'), '出牌音效（cardPlace）在 BATTLE_SFX 里（遭遇演出时会被预载）');
    ok(BATTLE_SFX.includes('cardSlide'), '抽牌音效（cardSlide）在 BATTLE_SFX 里');

    log('② 音量对照（峰值 dBFS，越接近 0 越响）');
    const peakOf = async (name) => {
      const buf = await audio.load(name);
      if (!buf) return null;
      let peak = 0;
      for (const ch of [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : null]) {
        if (!ch) continue;
        // 每 7 个采样看一个就够（只求量级，不求精确）
        for (let i = 0; i < ch.length; i += 7) peak = Math.max(peak, Math.abs(ch[i]));
      }
      return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    };
    const names = ['cardPlace', 'cardSlide', 'cardSlide2', 'shuffle', 'hit_normal', 'hit_sword', 'magic_bolt'];
    const peaks = {};
    for (const n of names) {
      const p = await peakOf(n);
      peaks[n] = p;
      log(`  ${n.padEnd(12)} ${p == null ? '（解码失败）' : `${p.toFixed(1)} dBFS`}`);
    }
    const battlePeak = Math.max(...['hit_normal', 'hit_sword', 'magic_bolt'].map((n) => peaks[n] ?? -Infinity));
    for (const n of ['cardPlace', 'cardSlide']) {
      if (peaks[n] == null) { ok(false, `${n} 能解码出来`); continue; }
      ok(peaks[n] > battlePeak - 12, `${n} 的原始音量不比战斗音效小太多（差距 <12dB）`,
        `${peaks[n].toFixed(1)} vs ${battlePeak.toFixed(1)} dBFS`);
    }

    log('③ 真打一场：抽牌 / 出牌到底响没响');
    audio.unlock();
    await wait(200);
    game.newRun(20240918);
    game.startBattle('normal', 0, 'direct');
    await wait(1500);
    const bs = ui.battleScreen;
    ok(!!bs, '战斗界面挂上了');
    if (bs) {
      // 开局那一手牌是在 mount 里发下来的，从此之后 played 里应该已经有抽牌音
      const seen = new Set(audio.playedNames());
      ok(seen.has('cardSlide'), '开局发牌时响过抽牌音效（cardSlide）', [...seen].includes('cardSlide') ? '有' : '没有');

      const before = new Set(audio.playedNames());
      const hand = game.battle.hand('player').filter((c) => game.battle.canPlay(c.uid));
      ok(hand.length > 0, '手里有能打出去的牌', `${hand.length} 张`);
      if (hand.length) {
        await bs.playCard(hand[0].uid);
        await wait(700);
        const fresh = audio.playedNames().filter((n) => !before.has(n));
        log(`  出牌之后新响的：${JSON.stringify(fresh)}`);
        ok(fresh.includes('cardPlace'), '出牌响的是「卡牌落桌」音效（cardPlace）', fresh.join('、') || '什么都没响');
      }
      /**
       * 抽牌阶段：**不能靠 playedNames 的增量**判断 —— 那是「响过哪些名字」的集合，
       * 开局发牌时 cardSlide 就已经在里面了，我方回合再响一次集合也不会变
       * （第一版就是这么写的，于是它报了个假失败）。这里直接把 cardDraw / dealCards 包一层计数。
       */
      let drawCalls = 0;
      let dealCalls = 0;
      let dealtMax = 0;
      const origDraw = audio.cardDraw.bind(audio);
      const origDeal = audio.dealCards.bind(audio);
      audio.cardDraw = (...a) => { drawCalls += 1; return origDraw(...a); };
      audio.dealCards = (n) => { dealCalls += 1; dealtMax = Math.max(dealtMax, n ?? 0); return origDeal(n); };
      const turn0 = game.battle.turn;
      await bs.onEndTurn();
      const dl = Date.now() + 12000;
      while (Date.now() < dl && game.battle.turn === turn0) await wait(120);
      await wait(900);
      audio.cardDraw = origDraw;
      audio.dealCards = origDeal;
      log(`  过一回合（第 ${turn0} → ${game.battle.turn} 回合）：dealCards 调了 ${dealCalls} 次`
        + `（其中一次是 ${dealtMax} 张），cardDraw 共响 ${drawCalls} 声`);
      ok(dealCalls >= 1, '我方抽牌时调用了发牌音效（dealCards）', `${dealCalls} 次`);
      ok(drawCalls >= 2, '一次发多张牌会连响几下（1 张一声，封顶 3 声）', `响了 ${drawCalls} 声`);
    }

    /**
     * ④ 卡面角标：增益 / 削弱用**染色的上下箭头**（用户要求，取代温度计）。
     * 光看图标名字不够 —— 角标是按 effects 推出来的（cardRoles），要确认「哪张牌拿到哪个角标」。
     */
    log('④ 卡面角标：红上箭头（增益）/ 蓝下箭头（削弱）');
    {
      const { cardRoles } = await import('/src/ui/cards.js');
      const { CARD_BY_ID } = await import('/src/data/cards.js');
      const { showCardCodex } = await import('/src/ui/codex.js');
      // 用**卡牌图鉴**：它一次铺出全部卡面，两种角标都能找到（起始卡组里没有自强化牌）
      game.phase = 'map';
      ui.forceRerender();
      await wait(300);
      showCardCodex(game);
      await wait(700);
      const modal = [...document.querySelectorAll('.modal-backdrop')].pop();
      const up = [...(modal?.querySelectorAll('.card-act.ico-arrow_up_red') ?? [])];
      const down = [...(modal?.querySelectorAll('.card-act.ico-arrow_down_blue') ?? [])];
      ok(up.length > 0, '卡面上有「红上箭头」角标（强化自己）', `${up.length} 处`);
      ok(down.length > 0, '卡面上有「蓝下箭头」角标（削弱对手）', `${down.length} 处`);
      // 反向验证：角标必须和 effects 推出来的角色一致（别把「给自己加攻」标成削弱）
      let mismatched = 0;
      for (const cardNode of modal?.querySelectorAll('.card') ?? []) {
        const name = cardNode.querySelector('.card-name')?.textContent;
        const card = Object.values(CARD_BY_ID).find((c) => c.name === name);
        if (!card) continue;
        const r = cardRoles(card);
        const hasUp = !!cardNode.querySelector('.card-act.ico-arrow_up_red');
        const hasDown = !!cardNode.querySelector('.card-act.ico-arrow_down_blue');
        if (hasUp !== !!r.buffsSelf || hasDown !== !!r.weakensFoe) mismatched++;
      }
      ok(mismatched === 0, '角标和这张牌的效果对得上（增益=上箭头、削弱=下箭头，逐张核过）',
        `${mismatched} 张对不上`);
      for (const b of modal?.querySelectorAll('.modal-head button') ?? []) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(150);
    }

    /**
     * ⑤ 界面文案的「印出来就是坏的」：
     *   ① 渲染后还剩占位符（`获得 {s} 点护盾` —— 商店截图里就是这么印出来的）；
     *   ② 渲染后还剩 `**`（富文本标记没被转成 <b>）。
     * 查的是**真界面**（商店 + 卡组 + 卡牌图鉴）的文字，不是数据文件 ——
     * 数据侧的遍历在 tools/audit-copy-render.mjs（那种查不到「某个界面忘了调 resolveCardText」）。
     */
    log('⑤ 界面文案里没有残留 {占位符} / **');
    {
      const { changeLanguage } = await import('/src/ui/langswitch.js');
      game.newRun(4242);
      game.phase = 'map';
      ui.current = null;
      ui.forceRerender();
      await wait(300);
      for (const lang of ['ja', 'zh']) {
        changeLanguage(lang);
        ui.current = null;
        ui.forceRerender();
        await wait(400);
        // 商店（用户截图里那一屏）：走游戏自己的 startShop()，别手搓 phase
        game.data.map = { ...(game.data.map ?? {}), biome: 'tide' };
        game.startShop();
        await wait(400);
        const scan = (root, where) => {
          const txt = root?.textContent ?? '';
          const ph = /\{[a-zA-Z_]\w*\}/.exec(txt);
          /**
           * `**` 只看**文字**，不看属性：`data-tip` 里写 `**重点**` 是正常的
           * （tips.js 用 richText 转成 <b>），拿 textContent 查会把它当成「印在界面上的星号」误报。
           * 所以把带 tip 的节点的属性文本从扫描结果里剔掉再查。
           */
          const tips = [...(root?.querySelectorAll('[data-tip]') ?? [])]
            .map((n) => n.getAttribute('data-tip')).filter(Boolean);
          let plain = txt;
          for (const tp of tips) plain = plain.split(tp).join('');
          const star = plain.includes('**');
          ok(!ph && !star, `${where}（${lang}）没有残留占位符 / **`,
            ph ? `还印着 ${ph[0]}` : star ? '还印着 **' : `${txt.length} 字扫过`);
          if (ph) log(`    · 上下文：…${txt.slice(Math.max(0, txt.indexOf(ph[0]) - 40), txt.indexOf(ph[0]) + 40).replace(/\s+/g, ' ')}…`);
          if (star) {
            const at = plain.indexOf('**');
            const nodes = [...(root?.querySelectorAll('*') ?? [])].filter((n) => (n.textContent ?? '').includes('**'));
            const deepest = nodes[nodes.length - 1];
            log(`    · 星号上下文：…${plain.slice(Math.max(0, at - 50), at + 50).replace(/\s+/g, ' ')}…`
              + ` ｜ 最深的节点：${deepest ? `${deepest.tagName}.${deepest.className}` : '(没找到)'}`);
          }
        };
        scan(document.querySelector('.screen') ?? document.body, '商店');
        // 卡牌图鉴也扫一遍（它铺出全部 273 张卡面文案，是「卡面文案渲染」的最大样本）
        game.leaveShop?.();
        const { showCardCodex } = await import('/src/ui/codex.js');
        showCardCodex(game);
        await wait(600);
        scan([...document.querySelectorAll('.modal-backdrop')].pop(), '卡牌图鉴');
        for (const b of document.querySelectorAll('.modal-head button')) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(200);
      }
      changeLanguage('zh');
      game.phase = 'map';
      ui.current = null;
      ui.forceRerender();
      await wait(300);
    }

    /**
     * ⑥ 图鉴详情页的行走图：三张图**同高**、且按素材原始像素比例显示（不许被压扁）。
     * 起因（用户截图）：「行走图被压扁」——canvas 长宽由 createAnim 按帧尺寸设成内联 px，
     * 一旦 CSS 里再给个 max-height / height，它就会被非等比拉伸。这条就是量这个。
     */
    log('⑥ 图鉴里的行走图没有被压扁');
    {
      const { showEnemyCodex } = await import('/src/ui/codex.js');
      const { ENEMIES } = await import('/src/data/enemies.js');
      const { save } = await import('/src/core/save.js');
      save.noteEnemies([ENEMIES[0].id, ENEMIES[5].id], { faced: true });
      game.phase = 'title';
      ui.current = null;
      ui.forceRerender();
      await wait(300);
      const open = async (i) => {
        showEnemyCodex();
        await wait(400);
        const modal = [...document.querySelectorAll('.modal-backdrop')].pop();
        const cards = [...modal.querySelectorAll('.dex-card')].filter((n) => !n.classList.contains('new'));
        cards[i]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(500);
        return [...document.querySelectorAll('.modal-backdrop')].pop();
      };
      const top = await open(0);
      const walk = top?.querySelector('.dex-walk canvas');
      const turn = top?.querySelector('.dex-turnart-img');
      ok(!!walk && !!turn, '详情页有行走图与回合立绘');
      if (walk && turn) {
        const r = walk.getBoundingClientRect();
        const want = walk.frameInfo ? walk.frameInfo.fw / walk.frameInfo.fh : 1;
        const got = r.width / r.height;
        ok(Math.abs(got - want) < 0.02, '行走图按素材比例显示（没有被 CSS 拉伸）',
          `frame ${walk.frameInfo?.fw}x${walk.frameInfo?.fh}（比 ${want.toFixed(3)}）vs 显示 ${r.width.toFixed(0)}x${r.height.toFixed(0)}（比 ${got.toFixed(3)}）`);

        const t = turn.getBoundingClientRect();
        const icon = top.querySelector('.dex-iconbox .poke-icon')?.getBoundingClientRect();
        ok(r.height < t.height, '行走图比立绘**小**（立绘是主体，不是三张一样大）',
          `行走图 ${Math.round(r.height)}px vs 立绘 ${Math.round(t.height)}px`);
        // 行走图压在立绘右下角：水平方向在立绘中线右边、竖直方向在立绘中线下面，且有重叠
        ok(r.left + r.width / 2 > t.left + t.width / 2 && r.top + r.height / 2 > t.top + t.height / 2,
          '行走图压在立绘的**右下角**',
          `行走图中心 (${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)}) vs 立绘中心 (${Math.round(t.left + t.width / 2)},${Math.round(t.top + t.height / 2)})`);
        const overlapX = Math.min(r.right, t.right) - Math.max(r.left, t.left);
        const overlapY = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
        ok(overlapX > 0 && overlapY > 0, '行走图和立绘**部分重叠**（不是并排对齐）',
          `重叠 ${Math.round(overlapX)}×${Math.round(overlapY)}px`);
        if (icon) {
          ok(icon.width < t.width * 0.6, '小图标的尺寸**没有**跟着放大',
            `小图标 ${Math.round(icon.width)}px vs 立绘 ${Math.round(t.width)}px`);
          ok(icon.left + icon.width / 2 < t.left + t.width / 2 && icon.top + icon.height / 2 > t.top + t.height / 2,
            '小图标压在立绘的**左下角**');
          const ox = Math.min(icon.right, t.right) - Math.max(icon.left, t.left);
          ok(ox > 0, '小图标和立绘也重叠', `重叠 ${Math.round(ox)}px`);
        }
        // 图那一块与右列之间要留出间距（不能贴在一起）
        const box = top.querySelector('.dex-art-compose')?.getBoundingClientRect();
        const col = top.querySelector('.dex-detail-info')?.getBoundingClientRect();
        if (box && col) ok(col.left - box.right >= 12, '图那一块和右边文字之间留了间距',
          `${Math.round(col.left - box.right)}px`);
      }
      for (const b of document.querySelectorAll('.modal-head button')) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(200);
    }

    if (fails.length) log(`CS_ERRORS=[${fails.join(' | ')}]`);
    else log('卡牌音效自检：通过 ✓');
    log('CS_DONE');
  } catch (e) {
    log('CS_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('CS_DONE');
  }
})();
