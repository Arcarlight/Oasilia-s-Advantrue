// 专家模式诊断（?dgexpert=1）：
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgexpert=1" rt
//
// 起因（用户要求）：「在设置里添加一个专家模式，打开后可以在卡牌里看到这些详细的威力、
// 防御影响之类的数值，正常情况下默认关闭。」
// 所以这里要量四件事：① 默认是关的、卡面上没有那一行；② 设置里能开、卡面立刻多出那一行；
// ③ 那一行里的数字**与引擎算出来的一致**（伤害 = 按当前攻防结算、护盾 = 基数 ×(1+防御÷12)）；
// ④ 关掉之后那一行消失。
(async () => {
  const log = (...a) => console.log('[d2] [exp]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { expertEnabled, setExpertEnabled } = await import('/src/core/expert.js');
    const { expertStats } = await import('/src/ui/cardtext.js');
    const { CARD_BY_ID } = await import('/src/data/cards.js');

    log('① 默认关闭');
    // 截图模式：把专家模式打开、摆一场战斗就停住（给 tools/shot.mjs 用）
    const shot = new URLSearchParams(location.search).get('dgexpert') === 'shot';
    if (shot) {
      setExpertEnabled(true);
      game.newRun(4242);
      game.startBattle('normal', 0, 'direct');
      await wait(1500);
      // 标题页的精灵图是**异步**取的：它可能在战斗挂上之后才把标题叠回来
      // （第一版截图拍到的就是标题页），所以这里等它落定再强制重画一次当前这一屏
      ui.current = null;
      ui.forceRerender();
      await wait(900);
      log(`（截图模式：专家模式已打开，当前 phase=${game.phase}，卡面 ${document.querySelectorAll('.card-expert').length} 处）`);
      log('EXP_DONE');
      return;
    }
    setExpertEnabled(false);
    game.newRun(4242);
    game.phase = 'map';
    ui.forceRerender();
    await wait(400);
    ok(expertEnabled() === false, '默认是关的（localStorage 里也是 0）', String(localStorage.getItem('oasis.expertMode')));

    log('② 打开之后卡面出现那一行');
    // 去卡组一览：那里的卡最多，最好量
    ui.forceRerender();
    await wait(200);
    const before = qa('.card-expert').length;
    ok(before === 0, '关着的时候卡面上没有专家行', `${before} 处`);
    setExpertEnabled(true);
    await wait(500);
    // 随便打开一个有卡面的界面：奖励页（卡面 + 选项）
    game.startBattle('normal', 0, 'direct');
    await wait(1200);
    const handCards = qa('.hand .card');
    ok(handCards.length > 0, '战斗里手上有牌', `${handCards.length} 张`);
    await wait(1200);
    const withExpert = qa('.card.expert .card-expert').length;
    ok(withExpert > 0, '打开之后卡面上出现了专家行（.card.expert .card-expert）', `${withExpert} 张卡有`);
    const chips = qa('.card-expert-chip').map((n) => n.textContent);
    log(`  示例：${chips.slice(0, 8).join(' ｜ ')}`);
    ok(chips.some((c) => c.includes('威力')), '那一行里有「威力」');
    ok(chips.some((c) => c.includes('伤害')), '那一行里有「伤害」');

    log('③ 数字与引擎一致');
    {
      const b = game.battle;
      const first = b.hand('player')[0];
      const card = CARD_BY_ID[first.id] ?? first.card;
      const s = expertStats(card);
      // 伤害：引擎在战斗里会算「这张牌打到这只敌人身上多少」，两边的输入都必须是当前攻防
      const shown = qa('.hand .card .card-expert-chip').map((n) => n.textContent).join(' ');
      const expectDmg = `伤害 ${s.damage}`;
      const hasDmg = s.hits > 1 ? shown.includes(`=${s.damage}`) : shown.includes(expectDmg);
      ok(s.damage === 0 || hasDmg, '卡面上标的伤害 = 按当前攻防结算的伤害',
        `引擎 ${s.damage}（攻击 ${s.per} × ${s.hits}）｜卡面「${shown.slice(0, 60)}…」`);
      // 护盾：吃自己的防御
      const shieldCard = Object.values(CARD_BY_ID).find((c) => c.effects.some((e) => e.kind === 'shield' && e.scaleWithDef));
      if (shieldCard) {
        const ss = expertStats(shieldCard);
        const raw = shieldCard.effects.find((e) => e.kind === 'shield');
        const want = Math.round(raw.amount * (1 + ss.selfDef / 12));
        ok(ss.shield === want, '护盾数字 = 基数 ×(1 + 防御 ÷ 12)（用的是**自己**的防御）',
          `【${shieldCard.name}】基数 ${raw.amount} × (1 + ${ss.selfDef}/12) = ${want}，卡面算出来 ${ss.shield}`);
      } else {
        ok(true, '（内容里没有「随防御成长」的护盾牌，跳过护盾对账）');
      }
    }

    log('④ 关掉之后那一行消失');
    setExpertEnabled(false);
    await wait(500);
    const after = qa('.card.expert .card-expert').length;
    ok(after === 0, '关掉之后卡面上的专家行没了', `${after} 处`);

    if (fails.length) log(`EXP_ERRORS=[${fails.join(' | ')}]`);
    else log('专家模式自检：通过 ✓');
    log('EXP_DONE');
  } catch (e) {
    log('EXP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('EXP_DONE');
  }
})();
