// 诊断：战斗简单特效有没有真的出现（白光闪光 / 强化爆发 / 命中冲击），以及有没有留下垃圾节点。
// 由 tools/diag2.mjs 通过 ?dgfx=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const count = (sel) => document.querySelectorAll(sel).length;
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    game.newRun(90210);
    // 一副「变硬 + 龙之舞 + 撞击」的牌：既有强化也有攻击。
    // 注意要连 battleDeck 一起指定 —— 不指定的话 defaultBattleDeck() 会优先挑伤害牌，
    // 强化牌根本进不了这场战斗（第一次诊断就是这么被骗的）。
    game.data.deck = ['harden', 'harden', 'dragon_dance', 'harden', 'tackle', 'tackle', 'tackle', 'tackle', 'double_kick', 'bite'];
    game.data.battleDeck = ['harden', 'harden', 'dragon_dance', 'harden', 'tackle', 'tackle', 'tackle', 'tackle', 'double_kick', 'bite'];
    await wait(400);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(1800);

    const b = game.battle;
    const bs = ui.battleScreen;
    log('开战 p=' + b.player.hp + ' e=' + b.enemy.hp);

    // 插桩：记录每一帧出现过哪些特效节点，同时数一数函数被调用了几次
    const seen = { flash: 0, burst: 0, floatBuff: 0, floatDebuff: 0, impact: 0, swing: 0 };
    const calls = { flash: 0, burst: 0, floatAt: 0 };
    const origFlash = bs.flash.bind(bs);
    bs.flash = function (body) { calls.flash++; log('  [flash] 被调用，body=' + (body ? body.className : 'null')); return origFlash(body); };
    const origBurst = bs.burstFx.bind(bs);
    bs.burstFx = function (body, fx, opts) { calls.burst++; return origBurst(body, fx, opts); };
    const timer = setInterval(() => {
      if (count('.fighter-flash')) seen.flash++;
      if (count('.fx-burst')) seen.burst++;
      if (count('.float-buff')) seen.floatBuff++;
      if (count('.float-debuff')) seen.floatDebuff++;
      if (count('.fx-impact, .fx-impact-crit')) seen.impact++;
      if (count('.fx-swing-right, .fx-swing-left')) seen.swing++;
    }, 40);

    // 1) 打一张「变硬」（强化 + 护盾）
    const play = async (cardId) => {
      const entry = b.hand('player').find((c) => c.card.id === cardId);
      if (!entry) { log('  手牌里没有 ' + cardId + '（手牌：' + b.hand('player').map((c) => c.card.id).join(',') + '）'); return null; }
      const canPlay = b.canPlay(entry.uid);
      const before = b.log.length;
      const r = bs.playCard(entry.uid);
      if (r && r.then) await r;
      const added = b.log.slice(before).map((l) => l.text);
      log('  出「' + cardId + '」：可出=' + canPlay + ' 演出后新日志=' + JSON.stringify(added));
      return true;
    };

    await play('harden');
    await wait(200);
    log('出「变硬」后：闪光采样=' + seen.flash + ' 爆发采样=' + seen.burst + ' 飘字=' + seen.floatBuff + ' 调用=' + JSON.stringify(calls));

    // 2) 打一张「龙之舞」（纯强化，应该闪白光）
    await play('dragon_dance');
    await wait(200);
    log('出「龙之舞」后：闪光采样=' + seen.flash + ' 爆发采样=' + seen.burst + ' 飘字=' + seen.floatBuff + ' 调用=' + JSON.stringify(calls));

    // 3) 打一张攻击牌（应该有弧光）
    await play('tackle');
    log('出攻击牌后：挥击采样=' + seen.swing);

    // 4) 敌方回合：应该有命中冲击 + 敌方强化闪光
    const t = bs.onEndTurn();
    if (t && t.then) await t;
    await wait(300);
    log('敌方回合后：冲击采样=' + seen.impact + ' 闪光采样=' + seen.flash + ' 削弱飘字=' + seen.floatDebuff);

    clearInterval(timer);
    log('  ' + JSON.stringify(seen));
    // 5) 特效节点有没有清干净
    await wait(1600);
    log('残留节点：.fx-burst=' + count('.fx-burst') + ' .fighter-flash=' + count('.fighter-flash') +
        ' .float-buff=' + count('.float-buff') + '（浮动文字会自己消失，短暂残留正常）');
    const missing = [...document.querySelectorAll('.fx-burst')].filter((n) => {
      const bg = getComputedStyle(n).backgroundImage;
      return !bg || bg === 'none';
    }).length;
    log('  背景图加载失败的特效节点 = ' + missing + '（应为 0）');

    // 6) 截图模式：把「白光闪烁 + 爆发特效」定格住（用静态样式，不走带定时清理的那两个函数），
    //    这样截图窗口足够宽，能真的看清效果长什么样。
    if (new URLSearchParams(location.search).get('hold') === '1') {
      const bg = (fx) => `url(assets/img/fx/${fx}.png)`;
      const node = (fx, size, extra = {}) => {
        const n = document.createElement('div');
        n.className = 'fx-burst';
        n.style.cssText = `width:${size}px;height:${size}px;margin-left:${-size / 2}px;margin-top:${-size / 2}px;` +
          `background-image:${bg(fx)};animation:none;opacity:1;scale:1.05;` +
          `--fx-size:${size}px;--fx-rot:0deg;transform:rotate(0deg);`;
        Object.assign(n.style, extra);
        return n;
      };
      // 我方：白光 + 金色星星（强化）
      bs.playerBody.style.filter = 'brightness(0) invert(1) drop-shadow(0 0 16px rgba(255,255,255,.95))';
      bs.playerBody.append(node('star_1', 150), node('twirl_1', 130));
      // 敌方：命中冲击
      bs.enemyBody.append(node('dirt_1', 120, { mixBlendMode: 'screen' }));
      log('FX_HELD 已定格：我方白光+星星，敌方冲击');
    }
    log('FX_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('FX_DONE');
  }
})();
