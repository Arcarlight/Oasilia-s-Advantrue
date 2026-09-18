// 「对方闪开之后我出不了牌」诊断（?dgdodge=1）
//
// 玩家反馈：闪避出现的时候很容易「卡住」，对方一闪开自己就没法出牌了。
// 这里把「闪避」变成必然事件（把敌我双方的幸运拉满 → dodgeChance 45% 上限），
// 然后逐张出牌，每次出牌后量一遍界面与引擎的状态：
//   · playCard 用了多久（真卡死会飙到几秒以上）
//   · busy 有没有放掉（busy=true 时手牌全部禁用 → 看起来就是「出不了牌」）
//   · 引擎侧还能不能出牌（canPlay 的数量、出牌次数、AP）
//   · 手牌里有多少张被画成 disabled、active 是谁
(async () => {
  const log = (...a) => console.log('[d2] [dodge]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const q = (s, root = document) => root.querySelector(s);
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;

    game.newRun(31337);
    // 一副全是攻击牌的卡组：保证每一张都会触发一次闪避判定
    game.data.deck = ['bite', 'bite', 'bite', 'tackle', 'tackle', 'tackle', 'double_kick', 'double_kick', 'rock_throw', 'rock_throw'];
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(900);
    const bs = ui.battleScreen;
    if (!bs) { log('没有 battleScreen'); log('DODGE_DONE'); return; }
    const b = bs.battle;
    // 双方幸运拉满：dodgeChance 会顶到上限，几回合内必定出现闪避
    b.player.luck = 9999;
    b.enemy.luck = 9999;
    // 敌人做成一堵墙：保证闪避事件足够多（不然两下就打死了，测不到）
    b.enemy.maxHp = 99999;
    b.enemy.hp = 99999;
    log(`双方幸运拉满，敌人血量拉到 99999，开打：${b.enemy.name}`);

    // 逐条事件盯着：出现闪避就立刻记录当时的界面状态
    const origPlayEvent = bs.playEvent.bind(bs);
    let dodgeEvents = 0;
    bs.playEvent = async (ev) => {
      const res = await origPlayEvent(ev);
      if (ev.type === 'dodge') {
        dodgeEvents += 1;
        const st = state();
        log(`  闪避 #${dodgeEvents}（${ev.side === 'player' ? '玩家' : '敌人'}闪开）｜busy=${st.busy} active=${st.active} 手牌 ${st.hand} 可出 ${st.playable} 禁用 ${st.disabled} 出牌次数剩 ${st.playsLeft} AP ${st.ap}`);
      }
      return res;
    };

    const state = () => {
      const hand = b.hand('player');
      const playable = hand.filter((c) => b.canPlay(c.uid)).length;
      const disabled = qa('.hand .card.disabled').length;
      return {
        busy: bs.busy,
        active: b.active,
        playsLeft: b.player.playsLeft,
        ap: b.player.ap,
        hand: hand.length,
        playable,
        disabled,
        over: b.over,
      };
    };

    let dodges = 0;
    let worst = 0;
    let stuckAfter = 0;
    let lastPlayerDodge = -1;
    const rounds = 6;
    for (let round = 0; round < rounds && !b.over; round++) {
      // 玩家回合：一张一张打，每次打完立刻量状态
      for (let i = 0; i < 12 && !b.over; i++) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        const before = b.enemy.dodgeCount ?? 0;
        void before;
        const t0 = performance.now();
        await bs.playCard(hand[0].uid);
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        // 统计这一张有没有被闪开
        const dodgedNow = b.takeEvents ? false : false;
        void dodgedNow;
        const st = state();
        if (st.busy || (st.playable === 0 && st.hand > 0 && !st.over && st.active === 'player' && st.playsLeft > 0)) {
          stuckAfter += 1;
          log(`⚠️ 卡住迹象：出牌耗时 ${dt.toFixed(0)}ms｜busy=${st.busy}｜手牌 ${st.hand} 张可出 ${st.playable} 张被禁用 ${st.disabled} 张｜出牌次数剩 ${st.playsLeft}｜AP ${st.ap}｜active=${st.active}`);
        }
      }
      if (!b.over) {
        await bs.onEndTurn();
        await wait(200);
      }
    }

    const st = state();
    check('每张牌都能正常打完（没有卡死）', worst < 3000, `最慢一次 ${worst.toFixed(0)}ms`);
    check('一轮打完界面不忙、还能继续出牌', !st.busy, `busy=${st.busy}，active=${st.active}，手牌 ${st.hand} 张`);
    check('手牌没有被整批禁用（busy 放掉后必须恢复可点）', st.disabled === 0 || st.playable > 0,
      `手牌 ${st.hand} 张 / 可出 ${st.playable} 张 / 被禁用 ${st.disabled} 张`);
    log(`出现过「卡住迹象」的次数：${stuckAfter}（${rounds} 回合）`);
    log(`战斗状态：第 ${b.turn} 回合，active=${b.active}，敌方 HP ${Math.round(b.enemy.hp)}/${b.enemy.maxHp}，玩家 HP ${Math.round(b.player.hp)}/${b.player.maxHp}`);
    log(fails.length ? `ERRORS=[${fails.join(' / ')}]` : 'ERRORS=[]');
    log('DODGE_DONE');
  } catch (err) {
    log('崩了：', err?.message ?? err, String(err?.stack ?? '').split('\n')[1] ?? '');
    log('DODGE_DONE');
  }
})();
