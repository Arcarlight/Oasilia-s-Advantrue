// 诊断：新的战斗数值在**真实界面上**是不是这么回事（?dgstatus=1）
//
// 覆盖这次改动的四个用户可见承诺：
//   ① 卡面上的伤害数字是**按当前攻击力实时算**的（改攻击力 → 卡面数字跟着变）
//   ② 持续伤害按**最大生命的百分比**结算（打血厚的敌人，毒掉的血明显更多）
//   ③ 剧毒层数**不减反增**，而且状态胶囊上认得出来（引擎 + 界面同一套名字）
//   ④ 卡组页的排序按「威力」而不是「伤害」，角标读作「威力 N%」
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgstatus=1" rt
//       node tools/diag2.mjs "http://127.0.0.1:5123/?dgstatus=shot" rt   （留屏截图）

(async () => {
  const log = (...a) => console.log('[d2] [st]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const { BALANCE } = await import('../src/data/balance.js');
    const { CARD_BY_ID } = await import('../src/data/cards.js');
    const { damageAt, resolveCardText, setCardTextContext } = await import('../src/ui/cardtext.js');

    // 等 boot 的标题页收场（它的异步收尾会盖住界面）
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }

    game.newRun(424242);
    game.data.stage = 5;
    Object.assign(game.data, { atk: 57, def: 44, maxHp: 470, hp: 470, agi: 24, luck: 18 });
    game.data.deck = ['tackle', 'bite', 'toxic', 'toxic_spikes', 'venom_burst', 'slash', 'moonlight', 'protect', 'corrode', 'rock_blast'];
    game.data.battleDeck = null;

    // ---------- ① 卡面数字跟着攻击力走 ----------
    log('① 卡面伤害 = 按当前攻击力实时算');
    setCardTextContext({ atk: 30, def: 16 });
    const lowAtk = damageAt(CARD_BY_ID.bite.effects[0].power, { atk: 30, def: 16 });
    setCardTextContext({ atk: 60, def: 16 });
    const highAtk = damageAt(CARD_BY_ID.bite.effects[0].power, { atk: 60, def: 16 });
    ok(lowAtk > 0 && highAtk > lowAtk * 1.8, '攻击力翻倍时伤害大致翻倍（威力是乘法）', `攻击 30 → ${lowAtk} 点；攻击 60 → ${highAtk} 点`);
    const t30 = resolveCardText(CARD_BY_ID.bite, { atk: 30, def: 16 });
    setCardTextContext({ atk: 60, def: 16 });
    const t60 = resolveCardText(CARD_BY_ID.bite, { atk: 60, def: 16 });
    ok(/\d+ 点伤害/.test(t30) && !t30.includes('{d'), '文案里的 {d} 被替换成真实数字', t30);
    ok(t30 !== t60, '同一张卡的文案随攻击力变化', `「${t30}」 vs 「${t60}」`);

    // ---------- ② 持续伤害按最大生命百分比 ----------
    log('② 持续伤害按最大生命的百分比结算');
    const pct = BALANCE.statusPct;
    // 造两个血量差 10 倍的敌人，各挂 3 层中毒，比较掉血
    const mkEnemy = (maxHp) => ({ maxHp, hp: maxHp, atk: 10, def: 8, agi: 10, luck: 0, poison: 0, toxic: 0, burn: 0, weak: 0, bleed: 0, atkMod: 0, defMod: 0, agiMod: 0, luckMod: 0, shield: 0, strength: 0 });
    const { Battle } = await import('../src/core/battle.js');
    const thin = new Battle({ seed: 1, player: { name: 'P', slug: 'flygon', hp: 470, maxHp: 470, atk: 57, def: 44, agi: 24, luck: 18 }, deck: ['tackle'], enemy: { id: 'a', slug: 'sandslash', name: '薄血怪', tier: 'mob', deck: ['tackle'], ...mkEnemy(200) } });
    const thick = new Battle({ seed: 1, player: { name: 'P', slug: 'flygon', hp: 470, maxHp: 470, atk: 57, def: 44, agi: 24, luck: 18 }, deck: ['tackle'], enemy: { id: 'b', slug: 'steelix', name: '厚血怪', tier: 'boss', deck: ['tackle'], ...mkEnemy(2000) } });
    thin.enemy.poison = 3; thick.enemy.poison = 3;
    const a0 = thin.enemy.hp; thin.tickStatuses('enemy');
    const b0 = thick.enemy.hp; thick.tickStatuses('enemy');
    const thinLost = a0 - thin.enemy.hp, thickLost = b0 - thick.enemy.hp;
    ok(thinLost === Math.round((200 * pct.poison + 1) * 3), '薄血怪：伤害 = 最大生命 × 百分比 × 层数', `${thinLost}（旧规则只有 3 点）`);
    ok(thickLost === Math.round((2000 * pct.poison + 1) * 3), '厚血怪：伤害 = 最大生命 × 百分比 × 层数', `${thickLost}`);
    // 血量差 10 倍，毒的伤害差 6 倍多（不是正好 10 倍：每层还有 +1 的固定部分）
    ok(thickLost > thinLost * 5, '血量厚 10 倍 → 毒掉的血也多得多（这正是「后期上毒只扣个位数」的修复）', `${thinLost} vs ${thickLost}`);

    // ---------- ③ 剧毒：层数不减反增 ----------
    log('③ 剧毒层数不衰减');
    thick.enemy.poison = 0;
    thick.enemy.toxic = 2;
    const h0 = thick.enemy.hp;
    thick.tickStatuses('enemy');
    const d1 = h0 - thick.enemy.hp;
    ok(thick.enemy.toxic === 3, '剧毒结算后层数 +1', `2 → ${thick.enemy.toxic}`);
    ok(d1 === Math.round((2000 * pct.toxic + 1) * 2), '剧毒第一跳的伤害也对得上公式', `${d1}`);

    // ---------- ④ 真打一场：状态胶囊与卡面数字 ----------
    log('④ 真实战斗界面');
    game.startBattle('normal', 4);
    const battle = game.battle;
    battle.enemy.maxHp = 4000; battle.enemy.hp = 4000;   // 只顶 hp，别动 maxHp（改 maxHp 会让百分比伤害失真）
    battle.start();
    await wait(900);
    battle.enemy.toxic = 2;
    battle.enemy.burn = 1;
    battle.player.poison = 3;
    battle.active = 'player';
    // 触发一次界面刷新（重新渲染手牌 = 走一遍 {d} 解析）
    window.__oasisUI?.forceRerender?.();
    await wait(500);
    window.__oasisUI?.battleScreen?.refreshSide?.('enemy');
    window.__oasisUI?.battleScreen?.refreshSide?.('player');
    await wait(400);

    const chips = [...document.querySelectorAll('.status-chip')].map((n) => n.textContent.trim());
    ok(chips.some((c) => c.includes('剧毒')), '对手身上出现「剧毒」状态胶囊', chips.join(' / ') || '（一个都没有）');
    ok(chips.some((c) => c.includes('中毒')), '自己身上出现「中毒」状态胶囊', chips.join(' / '));

    const cardTexts = [...document.querySelectorAll('.hand .card-text')].map((n) => n.textContent.trim());
    ok(cardTexts.length > 0, '手牌渲染出来了', `${cardTexts.length} 张`);
    ok(cardTexts.every((t) => !t.includes('{d')), '手牌文案里没有残留的 {d} 占位符', cardTexts.slice(0, 3).join(' ｜ '));

    // 改攻击力 → 手牌数字应该变
    const before = battle.player.atk;
    battle.player.atk = before + 40;
    window.__oasisUI?.battleScreen?.renderHand?.();
    await wait(300);
    const after = [...document.querySelectorAll('.hand .card-text')].map((n) => n.textContent.trim()).join(' ｜ ');
    ok(after !== cardTexts.join(' ｜ '), '攻击力变化后，手牌上的伤害数字跟着更新',
      `攻击 ${before} → ${battle.player.atk}`);

    // ---------- 截图模式 ----------
    if (new URLSearchParams(location.search).get('dgstatus') === 'shot') {
      log('状态 / 卡面数字已就位（截图模式）');
      log('ST_DONE');
      return;
    }

    // ---------- ⑤ 卡组页的「威力」排序 ----------
    log('⑤ 卡组页排序');
    const { showDeck } = await import('../src/ui/overlays.js');
    showDeck(game);
    await wait(350);
    const tabs = [...document.querySelectorAll('.modal-backdrop .sort-tab')].map((n) => n.textContent.trim());
    ok(tabs.includes('威力'), '排序里有「威力」这一档（不再叫「伤害」）', tabs.join(' / '));
    const wtTab = [...document.querySelectorAll('.modal-backdrop .sort-tab')].find((n) => n.textContent.trim() === '威力');
    wtTab?.click();
    await wait(250);
    const badges = [...document.querySelectorAll('.modal-backdrop .card-grid .card-foot span')].map((n) => n.textContent.trim()).filter((t) => t.startsWith('威力 '));
    ok(badges.length > 0, '卡面角标读作「威力 N%」', badges.slice(0, 4).join(' / '));
    const nums = badges.map((b) => Number(b.replace('威力 ', '').replace('%', '')));
    ok(nums.every((v, i) => i === 0 || nums[i - 1] >= v), '「威力」排序确实是降序', nums.slice(0, 8).join(' > '));
    document.querySelector('.modal-backdrop')?.remove();

    const { STATUS_INFO } = await import('../src/core/battle.js');
    ok(!!STATUS_INFO.toxic, '引擎里存在「剧毒」这个状态（不是只有文案）');

    if (fails.length) log(`ST_ERRORS=[${fails.join(' | ')}]`);
    else log('战斗数值自检：通过 ✓');
    log('ST_DONE');
  } catch (e) {
    log('ST_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('ST_DONE');
  }
})();
