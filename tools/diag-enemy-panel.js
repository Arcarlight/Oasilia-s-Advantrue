// 诊断：把某一档敌人摆到屏幕上，核对面板上的攻击力与意图提示（?dgenemy=1）
//
// 起因（玩家反馈）：截图里「较强」的怪显示 攻 122、刺甲贝 攻 127，
// 意图提示写着「下回合最多 623 伤害，会被打倒」—— 比首领还猛。
// 这份诊断直接把指定章节 / 档位的敌人拉出来，把面板数字与引擎值对一遍。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgenemy=1" rt
//       node tools/shot.mjs "http://127.0.0.1:5123/?dgenemy=shot&stage=5&tier=normal" out.png 12000
//       参数：stage=0~5（第几章，按 0 计）、tier=mob|normal|elite|boss、slug=<物种>

(async () => {
  const log = (...a) => console.log('[d2] [en]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const params = new URLSearchParams(location.search);
    const stage = Math.max(0, Math.min(5, Number(params.get('stage') ?? 5)));
    const tier = params.get('tier') ?? 'normal';
    const wantSlug = params.get('slug');
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { BALANCE, STAGE_BIOME } = await import('../src/data/balance.js');
    const { ENEMIES } = await import('../src/data/enemies.js');

    // 等 boot 的标题页收场
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }
    game.newRun(9182736);
    const G = [
      { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
      { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
      { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
      { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
      { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
      { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
    ][stage];
    // 注意：别把 GROWTH 里的 deck（张数）直接 Object.assign 进 data ——
    // data.deck 是**卡牌 id 数组**，覆盖成数字会让 Battle.buildDeck 直接崩（这里踩过一次）
    Object.assign(game.data, {
      atk: G.atk, def: G.def, maxHp: G.maxHp, hp: G.maxHp, agi: G.agi, luck: G.luck, stage,
    });
    game.data.map.biome = STAGE_BIOME[stage];
    const { STARTER_DECK, rollCard } = await import('../src/data/cards.js');
    const deck = STARTER_DECK.slice(0, G.deck);
    let guard = 0;
    while (deck.length < G.deck && guard++ < 200) deck.push(rollCard(0.12, []).id);
    game.data.deck = deck;
    game.data.battleDeck = null;

    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    // 这一档的敌人是随机抽的，抽到想要的那只为止
    let battle = null;
    for (let i = 0; i < 400; i++) {
      game.startBattle(kind, 4);
      battle = game.battle;
      if (battle.enemy.tier === tier && (!wantSlug || battle.enemy.slug === wantSlug)) break;
      battle = null;
    }
    ok(!!battle, `抽到了 ${tier} 档的敌人`, battle ? `${battle.enemy.name}（${battle.enemy.slug}）` : `400 次都没抽到 slug=${wantSlug}`);
    if (!battle) { log('EN_DONE'); return; }

    // 交给界面挂上去
    game.phase = 'battle';
    game.changed();
    const dl = Date.now() + 30000;
    while (!document.querySelector('.turn-sweep') && Date.now() < dl) await wait(50);
    while (document.querySelector('.turn-sweep') && Date.now() < dl) await wait(50);
    while (ui.battleScreen?.busy && Date.now() < dl) await wait(100);
    await wait(500);

    const bs = ui.battleScreen;
    // 敌人的信息卡（.fighter-enemy 里那张，包含名字 / 血条 / 攻防速）
    const panel = document.querySelector('.fighter-enemy .fighter-card, .fighter-enemy');
    const text = (panel?.textContent ?? '').replace(/\s+/g, ' ');
    const shownAtk = bs?.battle?.enemy?.atk ?? -1;
    const intent = [...document.querySelectorAll('.intent, .threat, [class*="intent"]')].map((n) => n.textContent.trim()).join(' ');
    const threat = bs?.battle?.predictEnemyThreat?.()?.damage ?? 0;
    const pMax = bs?.battle?.player?.maxHp ?? 1;

    log(`第 ${stage + 1} 章 ${tier}：${battle.enemy.name}`);
    log(`  面板文字：${text.slice(-90)}`);
    log(`  引擎：攻 ${shownAtk} / 血 ${battle.enemy.maxHp}；意图上界 ${threat}（占玩家最大生命 ${(threat / pMax * 100).toFixed(0)}%）`);
    if (intent) log(`  意图提示：「${intent}」`);

    ok(text.includes(String(shownAtk)), '面板上显示的攻击力和引擎一致', `面板里有「${shownAtk}」`);
    ok(text.includes(String(battle.enemy.maxHp)), '面板上显示的血量和引擎一致', `${battle.enemy.maxHp}`);

    // 顺序硬约束：同一章里 杂兵 < 较强 < 精英 < 首领
    const order = ['mob', 'normal', 'elite', 'boss'];
    const row = order.map((t) => BALANCE.enemyAtk[t][stage]);
    ok(row.every((v, i) => i === 0 || row[i - 1] < v), `第 ${stage + 1} 章攻击力逐档递增`, `${order.map((t, i) => `${t} ${row[i]}`).join(' < ')}`);
    // 首领的攻击力不该比玩家高出一个量级
    ok(BALANCE.enemyAtk.boss[stage] <= BALANCE.cap.atk * 1.6,
      `首领攻击力（${BALANCE.enemyAtk.boss[stage]}）与玩家攻击力上限（${BALANCE.cap.atk}）在同一档次`);

    if (params.get('dgenemy') === 'shot') { log('敌人面板已就位（截图模式）'); log('EN_DONE'); return; }

    if (fails.length) log(`EN_ERRORS=[${fails.join(' | ')}]`);
    else log('敌人面板自检：通过 ✓');
    log('EN_DONE');
  } catch (e) {
    log('EN_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('EN_DONE');
  }
})();
