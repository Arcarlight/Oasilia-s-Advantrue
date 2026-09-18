// 诊断：战斗里头像表情到底怎么变的（?dgemote=1）
//
// 起因（用户）：「为什么角色受伤的时候会用激动的表情啊（那个黄底的）」。
// 黄底的只有 Happy / Joyous 两张（见 tools/probe-portrait-colors.mjs 量出来的底色），
// 而 emotionForEvent('damage') 分明给的是 'pain' —— 所以要**看着它变**。
//
// 做法：一边真实打一回合，一边每 25ms 采样两边头像 <img> 的 src，
// 把「事件流」和「表情变化」按时间对在一起打印，最后断言：
//   · 受伤时玩家头像必须是 Pain；
//   · 玩家挨打的那一回合里，玩家头像**不许**出现 Happy / Joyous / Inspired。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgemote=1" rt

(async () => {
  const log = (...a) => console.log('[d2] [em]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const base = (src) => (src ? String(src).split('/').pop().split('?')[0] : '(无)');

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;

    game.newRun(60606);
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);

    const bs = ui.battleScreen;
    // 等开场过场收场
    const dl = Date.now() + 30000;
    while (!document.querySelector('.turn-sweep') && Date.now() < dl) await wait(50);
    while (document.querySelector('.turn-sweep') && Date.now() < dl) await wait(50);
    while (ui.battleScreen?.busy && Date.now() < dl) await wait(100);
    await wait(300);
    if (!bs) throw new Error('没有战斗界面');

    const SKIN = { player: 'flygon', enemy: bs.battle.enemy.slug };
    const readFace = (side) => base((side === 'player' ? bs.playerFace : bs.enemyFace)?.querySelector('img')?.src);
    log(`  物种：我方 ${SKIN.player} / 敌方 ${SKIN.enemy}`);
    log(`  起手表情：我方 ${readFace('player')} / 敌方 ${readFace('enemy')}`);

    // 记录事件（playEvent 是演出入口，事件按顺序在这里过）
    const timeline = [];
    const orig = bs.playEvent.bind(bs);
    bs.playEvent = async (ev) => {
      timeline.push({ t: Date.now(), kind: 'event', type: ev.type, side: ev.side, amount: ev.amount });
      return orig(ev);
    };
    // 采样两边头像
    let sampling = true;
    const last = { player: null, enemy: null };
    const sampler = (async () => {
      while (sampling) {
        for (const side of ['player', 'enemy']) {
          const f = readFace(side);
          if (f !== last[side]) {
            timeline.push({ t: Date.now(), kind: 'face', side, file: f });
            last[side] = f;
          }
        }
        await wait(25);
      }
    })();

    // 打一回合：把能打的都打掉，然后结束回合让对手出手
    for (let g = 0; g < 12; g++) {
      const hand = bs.battle.hand('player').filter((c) => bs.battle.canPlay(c.uid));
      if (!hand.length) break;
      await bs.playCard(hand[0].uid);
    }
    await bs.onEndTurn();
    const waitDl = Date.now() + 30000;
    while (bs.busy && Date.now() < waitDl) await wait(100);
    await wait(400);

    // 再多打几回合：一回合里撞不到「高兴脸」不代表不会出现
    for (let turn = 0; turn < 8 && !bs.battle.over; turn++) {
      for (let g = 0; g < 12; g++) {
        const hand = bs.battle.hand('player').filter((c) => bs.battle.canPlay(c.uid));
        if (!hand.length) break;
        await bs.playCard(hand[0].uid);
      }
      if (bs.battle.over) break;
      await bs.onEndTurn();
      const d2 = Date.now() + 30000;
      while (bs.busy && Date.now() < d2) await wait(100);
      await wait(200);
    }
    sampling = false;
    await sampler;

    const T0 = timeline[0]?.t ?? Date.now();
    log('  —— 时间线（事件 / 表情变化）——');
    for (const e of timeline) {
      const ms = String(e.t - T0).padStart(5);
      if (e.kind === 'event') log(`   ${ms}ms  事件 ${e.type}${e.side ? ' · ' + e.side : ''}${e.amount != null ? ' ' + e.amount : ''}`);
      else log(`   ${ms}ms  表情 ${e.side} → ${e.file}`);
    }

    // 断言：我方受到伤害之后，我方头像必须是 Pain
    const playerDamageIdx = timeline.findIndex((e) => e.kind === 'event' && e.type === 'damage' && e.side === 'player');
    ok(playerDamageIdx >= 0, '这一回合我方确实挨了打（有 damage·player 事件）');
    if (playerDamageIdx >= 0) {
      const after = timeline.slice(playerDamageIdx + 1).find((e) => e.kind === 'face' && e.side === 'player');
      ok(after?.file === 'Pain.png', '挨打之后我方头像是 Pain.png',
        `实际是 ${after?.file ?? '(没有变化)'}`);
    }

    // 断言：我方挨打的那一回合，我方头像不许出现「高兴 / 激励」那几张
    const cheer = ['Happy.png', 'Joyous.png', 'Inspired.png', 'SlightlyHappy.png'];
    const playerCheer = timeline.filter((e) => e.kind === 'face' && e.side === 'player' && cheer.includes(e.file));
    ok(playerCheer.length === 0, '我方头像全程没有出现「高兴 / 激励」类表情',
      playerCheer.map((e) => e.file).join('、') || '（没有）');

    // 每张「笑脸」都要能对上一条合理的事件 —— 对不上就是 bug，对上了就如实说明
    log('  —— 所有「高兴 / 激励」脸出现时的上下文 ——');
    let unexplained = 0;
    for (const c of timeline.filter((e) => e.kind === 'face' && cheer.includes(e.file))) {
      const idx = timeline.indexOf(c);
      const prev = timeline.slice(Math.max(0, idx - 4), idx).filter((e) => e.kind === 'event');
      const last = prev[prev.length - 1];
      const why = last?.type === 'heal' ? '自己回血（合理）'
        : last?.type === 'buff' ? '自己上强化（合理）'
          : last?.type === 'battleEnd' ? '战斗结束（合理）'
            : `紧跟在 ${last?.type ?? '(没有事件)'} 之后 ← 说不通`;
      if (why.includes('说不通')) unexplained += 1;
      log(`   ${c.side} → ${c.file}：${why}（前一条事件 ${last?.type ?? '-'}${last?.side ? '·' + last.side : ''}）`);
    }
    ok(unexplained === 0, '每一张笑脸都紧跟在「回血 / 强化 / 战斗结束」之后，没有凭空高兴', `${unexplained} 张说不通`);

    // 敌方出现笑脸也要能对上事件（它自己回血 / 自己强化 / 战斗结束）。
    // 注意：不能写成「整条时间线里存在一条 heal·enemy」—— 那是「只要有一次回血，
    // 后面所有笑脸都算合理」，等于没检查。上下文必须逐次对（下面那段统一做）。
    const enemyCheer = timeline.filter((e) => e.kind === 'face' && e.side === 'enemy' && cheer.includes(e.file));
    if (enemyCheer.length) log(`  （敌方出现过 ${enemyCheer.length} 次笑脸，逐次上下文见下）`);

    // ---- ② 削弱（负向 buff）不能给「兴奋脸」 ----
    //
    // 刺耳声 = {kind:'buff', stat:'def', amount:-5, target:'enemy'} ——
    // 引擎给「削弱」发的也是 `buff` 事件，只是数值是负的。
    // 以前 emotionForEvent 只看 type，于是「你的防御被削掉 5 点」的时候，
    // 你自己的头像会变成一张**淡黄底的兴奋脸**（用户反馈的正是这个）。
    {
      const { emotionForEvent } = await import('../src/core/portraits.js');
      const cases = [
        ['正向 buff（变硬 +防御）', { type: 'buff', side: 'player', stat: 'def', amount: 3 }, 'inspired'],
        ['负向 buff（刺耳声 -防御）', { type: 'buff', side: 'player', stat: 'def', amount: -5, requested: -5 }, 'worried'],
        ['被下限夹住的负向 buff', { type: 'buff', side: 'player', stat: 'def', amount: 0, requested: -2 }, 'worried'],
        ['受伤', { type: 'damage', side: 'player', amount: 12 }, 'pain'],
      ];
      for (const [label, ev, want] of cases) {
        const got = emotionForEvent(ev.type, ev.side, ev);
        ok(got === want, `${label} → ${want}`, `实际 ${got}`);
      }
      // 真的在界面上走一遍：让玩家身上挂一个削弱事件，看头像
      const before = readFace('player');
      await orig({ type: 'buff', side: 'player', stat: 'def', amount: -5, requested: -5, value: 7, log: '欧亚西莉亚 的防御 -5（当前 7）。' });
      await wait(300);
      const after = readFace('player');
      log(`  削弱事件之后：我方头像 ${before} → ${after}`);
      ok(!['Happy.png', 'Joyous.png', 'Inspired.png'].includes(after), '被削弱的瞬间不会换成黄底的兴奋脸',
        `实际是 ${after}`);
    }

    if (fails.length) log(`EM_ERRORS=[${fails.join(' | ')}]`);
    else log('战斗表情自检：通过 ✓');
    log('EM_DONE');
  } catch (e) {
    log('EM_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('EM_DONE');
  }
})();
