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

    if (fails.length) log(`CS_ERRORS=[${fails.join(' | ')}]`);
    else log('卡牌音效自检：通过 ✓');
    log('CS_DONE');
  } catch (e) {
    log('CS_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('CS_DONE');
  }
})();
