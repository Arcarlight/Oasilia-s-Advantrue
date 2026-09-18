// 「子弹拳 + 电光一闪 + 小卡组」复现诊断（?dgloop=1）
//
// 用户反馈：这两张 0 费「抽 1 张」的牌放在一副小卡组里会「无限循环」。
// 这里量三件事：
//   ① 引擎侧有没有真的死循环（每次出牌耗时、每回合出牌数）
//   ② 界面上一次出牌要多久（真卡住的话这里会飙到几秒甚至永不返回）
//   ③ 按住数字键连打时会不会自动刷出一串牌
(async () => {
  const log = (...a) => console.log('[d2] [loop]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARD_BY_ID } = await import('/src/data/cards.js');

    game.newRun(777);
    game.data.deck = ['bullet_punch', 'quick_attack'];
    game.data.battleDeck = game.data.deck.slice();
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(900);
    const bs = ui.battleScreen;
    if (!bs) { log('没有 battleScreen'); log('LOOP_DONE'); return; }
    const b = bs.battle;
    log(`卡组 2 张（子弹拳 + 电光一闪）｜playMax=${b.player.playMax}｜drawN=${b.player.drawN}｜敌方 HP ${b.enemy.maxHp}`);

    // ---------- ① 一回合能打多少张 ----------
    let plays = 0;
    let slowest = 0;
    const order = [];
    for (;;) {
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!hand.length) break;
      if (plays >= 40) { log('⚠️ 打到 40 张还没停'); break; }
      const t0 = performance.now();
      await bs.playCard(hand[0].uid);
      const dt = performance.now() - t0;
      slowest = Math.max(slowest, dt);
      order.push(hand[0].card.name);
      plays += 1;
    }
    const used = b.enemy.maxHp - Math.max(0, b.enemy.hp);
    check('出牌数被「每回合出牌上限」拦住（没有无限循环）', plays <= b.player.playMax,
      `实测 ${plays} 张（上限 ${b.player.playMax}），单张最慢 ${slowest.toFixed(0)}ms`);
    // 小卡组轮换是允许的（花钱删卡才做得出来），但绝不允许越过出牌上限
    check('小卡组可以轮换，但一回合不超过出牌上限', plays <= b.player.playMax,
      `实测 ${plays} 张：${order.join(' → ')}`);
    log(`一回合打掉敌方 ${Math.round(used)} HP（${(used / b.enemy.maxHp * 100).toFixed(0)}%）`);

    // ---------- ② 界面有没有卡住 ----------
    // 阈值放到 3 秒：一次出牌要演完「摊牌 + 出招 + 命中 + 飘字」好几个 PACE 段，
    // 真实耗时本来就有一秒多；真死循环的话这里会是几十秒起步。
    check('每次出牌都在 3 秒内返回（界面没被卡死）', slowest < 3000, `最慢一次 ${slowest.toFixed(0)}ms`);

    // ---------- ③ 按住数字键连打 ----------
    if (!b.over) {
      // 先把这一回合的剩余出牌数补满，再连发 12 次「1」
      b.player.playsLeft = b.player.playMax;
      const before = b.player.playsLeft;
      for (let i = 0; i < 12; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      }
      await wait(2000);
      const spent = before - (b.player.playsLeft ?? 0);
      check('连按 12 次「1」不会刷出一串牌（busy 期间忽略输入 / 手里没牌就打不出去）',
        spent <= 2, `实际出牌 ${spent} 张（卡组只有 2 张、当回合都打过），剩余出牌数 ${b.player.playsLeft}/${b.player.playMax}`);
    }

    log(`CARD_BY_ID 可用：${!!CARD_BY_ID.bullet_punch}`);
    log(fails.length ? `ERRORS=[${fails.join(' / ')}]` : 'ERRORS=[]');
    log('LOOP_DONE');
  } catch (err) {
    log('崩了：', err?.message ?? err, String(err?.stack ?? '').split('\n')[1] ?? '');
    log('LOOP_DONE');
  }
})();
