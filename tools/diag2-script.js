// 诊断：日志重复、伤害扣血时序、敌人出牌显示、演出节奏。
// 由 tools/diag2.mjs 通过 ?dg2=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const errors = [];
  window.addEventListener('error', (e) => errors.push('window: ' + e.message));

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    // 一副全是「龙之舞」的卡：它同时 +攻击 +敏捷，正好暴露「日志按位置猜」的毛病
    game.data.deck = ['dragon_dance', 'dragon_dance', 'dragon_dance', 'dragon_dance', 'dragon_dance', 'dragon_dance', 'dragon_dance', 'dragon_dance', 'harden', 'bite'];
    game.data.battleDeck = null;
    game.data.maxHp = 400;
    game.data.hp = 400;
    await wait(400);

    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(1800);

    const b = game.battle;
    const bs = ui.battleScreen;
    log('开战 p=' + b.player.hp + ' e=' + b.enemy.hp + '/' + b.enemy.maxHp);
    log('演出倍率 speedMul=' + bs.speedMul);

    // ---------- 1) 出一张「龙之舞」，检查日志有没有重复/丢失 ----------
    log('--- 1) 日志：龙之舞（+攻击 +敏捷）---');
    const t1 = performance.now();
    const entry = b.hand('player').find((c) => c.card.id === 'dragon_dance');
    if (entry) {
      const pr = bs.playCard(entry.uid);
      if (pr && pr.then) await pr;
      const lines = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
      log('  玩家一次出牌的日志行（' + lines.length + ' 行）: ' + JSON.stringify(lines));
      const dup = lines.filter((t, i) => lines.indexOf(t) !== i);
      log('  重复行 = ' + JSON.stringify(dup));
      log('  含「攻击 +3」= ' + lines.some((t) => t.includes('攻击 +3')) + '，含「敏捷 +3」= ' + lines.some((t) => t.includes('敏捷 +3')));
      log('  一次出牌总耗时 = ' + Math.round(performance.now() - t1) + 'ms');
    } else {
      log('  手牌里没有龙之舞，手牌 = ' + b.hand('player').map((c) => c.card.id).join(','));
    }

    // ---------- 2) 伤害扣血时序 ----------
    log('--- 2) 敌方回合扣血时序 ---');
    // 把敌方手牌换成 3 张伤害牌，逼它一回合打三次，才看得出「分次扣」
    const proto = b.decks.enemy.hand.find((c) => c.card.effects.some((e) => e.kind === 'damage')) || b.decks.enemy.hand[0];
    if (proto) {
      b.decks.enemy.hand = [
        { ...proto, uid: 'diag-e1' }, { ...proto, uid: 'diag-e2' }, { ...proto, uid: 'diag-e3' },
      ];
      log('  强制敌方手牌 = 3x ' + proto.card.name);
    }
    b.enemy.atk = 30;
    b.enemy.apMax = 9;
    b.enemy.ap = 9;
    b.enemy.playMax = 9;
    b.enemy.playsLeft = 9;
    b.player.hp = b.player.maxHp = 400;
    b.player.dispHpCheck = true;

    const seq = [];
    const origRefresh = bs.refreshSide.bind(bs);
    const t0 = performance.now();
    bs.refreshSide = function (key) {
      origRefresh(key);
      if (key === 'player') {
        const el2 = document.querySelector('.fighter-player .bar-hp b');
        seq.push({ t: Math.round(performance.now() - t0), dom: el2 ? el2.textContent : '?', engine: b.player.hp });
      }
    };
    // 顺手看敌方出牌展示区有没有真的出现卡面
    let cardSeen = 0, maxCards = 0;
    const probe = setInterval(() => {
      const n = document.querySelectorAll('.enemy-play .played-card').length;
      if (n > 0) cardSeen += 1;
      maxCards = Math.max(maxCards, n);
    }, 40);

    const er = bs.onEndTurn();
    if (er && er.then) await er;
    clearInterval(probe);
    const dur = Math.round(performance.now() - t0);
    log('  敌方回合总时长 = ' + dur + 'ms');
    log('  敌方出牌展示区：出现过卡面的采样次数 = ' + cardSeen + '，同时最多 ' + maxCards + ' 张');
    log('  血量显示序列（时间 / 界面文本 / 引擎真值）:');
    for (const s of seq) log('     @' + s.t + 'ms "' + s.dom + '" (引擎 ' + s.engine + ')');
    const distinct = [...new Set(seq.map((s) => s.dom))];
    log('  界面出现过 ' + distinct.length + ' 种血量文本: ' + JSON.stringify(distinct));
    const hurtLines = b.log.filter((l) => l.text.includes('点伤害')).map((l) => l.text);
    log('  引擎里的伤害日志 ' + hurtLines.length + ' 条: ' + JSON.stringify(hurtLines.slice(-4)));

    // ---------- 3) 战斗日志里有没有重复 ----------
    const all = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
    const counts = {};
    for (const t of all) counts[t] = (counts[t] ?? 0) + 1;
    const repeated = Object.entries(counts).filter(([, n]) => n > 1);
    log('--- 3) 整份日志共 ' + all.length + ' 行，重复文本: ' + JSON.stringify(repeated));
    log('  最后 8 行: ' + JSON.stringify(all.slice(-8)));

    log('ERRORS=' + JSON.stringify(errors));
    log('D2_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('D2_DONE');
  }
})();
