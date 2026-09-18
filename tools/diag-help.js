// 诊断：玩法说明页里的数字和代码对不对得上（?dghelp=1）
//
// 起因（用户）：「UI 里有很多介绍已经过时了」。
// 实测抓到三处写死的过期数字：
//   · 「三章都走完就算通关」—— 实际 6 章
//   · 「绿洲营地：回复最大生命的 35%」—— 实际 40%（BALANCE.restHealPct）
//   · 「每场战斗胜利后自动回复最大生命的 4%」—— 实际 12%（BALANCE.healAfterBattlePct）
// 外加 D 键说明还写着「出战选择」（那个概念早就取消了）、快捷键漏了 I / H。
//
// 修法不是把数字改一遍（下次改平衡还会过期），而是**全部从 BALANCE / stageCount() 现算**。
// 这份诊断就盯住这件事：说明页里的百分比必须等于配置里的值，旧数字必须彻底消失。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dghelp=1" rt

(async () => {
  const log = (...a) => console.log('[d2] [hp]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const { showHelp, showItems } = await import('../src/ui/overlays.js');
    const { BALANCE } = await import('../src/data/balance.js');
    const { stageCount } = await import('../src/data/mapgen.js');

    // 等 boot 的标题页收场（它的异步收尾会盖住界面，见 diag-remove 里那个坑）
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }
    game.newRun(30303);
    game.phase = 'map';
    document.querySelector('.modal-backdrop')?.remove();

    showHelp();
    await wait(300);

    // 截图模式：把说明页留在屏幕上给 shot.mjs 拍
    if (new URLSearchParams(location.search).get('dghelp') === 'shot') {
      log('说明页已打开（截图模式）');
      log('HP_DONE');
      return;
    }

    const helpEl = document.querySelector('.modal-backdrop .modal-body');
    ok(!!helpEl, '玩法说明页打开了');
    const text = (helpEl?.textContent ?? '').replace(/\s+/g, ' ');
    log(`  说明页正文 ${text.length} 字`);

    const pct = (v) => `${Math.round(v * 100)}%`;

    // ① 章节数
    ok(text.includes(`${stageCount()} 章`), `章节数写的是实际值（${stageCount()} 章）`);
    ok(!text.includes('三章'), '旧文案「三章」已经消失');

    // ② 三个续航百分比必须等于配置
    ok(text.includes(pct(BALANCE.restHealPct)), `营地回复写的是 ${pct(BALANCE.restHealPct)}（= restHealPct）`);
    ok(text.includes(pct(BALANCE.healAfterBattlePct)), `战后回复写的是 ${pct(BALANCE.healAfterBattlePct)}（= healAfterBattlePct）`);
    ok(text.includes(pct(BALANCE.preBossHealPct)), `首领前回复写的是 ${pct(BALANCE.preBossHealPct)}（= preBossHealPct）`);
    ok(!text.includes('35%'), '旧文案「35%」已经消失');
    ok(!/自动回复最大生命的 4%/.test(text), '旧文案「4%」已经消失');

    // ③ 四个上限跟着 BALANCE 走
    for (const [key, label] of [['apMax', 'AP 上限'], ['playMax', '出牌上限'], ['drawMax', '抽牌上限'], ['handMax', '手牌上限']]) {
      ok(text.includes(`上限 ${BALANCE[key]}`), `${label}写的是 ${BALANCE[key]}`);
    }
    ok(text.includes(`暴击伤害 ×${BALANCE.luckCritMult}`), `暴击倍率写的是 ×${BALANCE.luckCritMult}`);

    // ④ 过时的概念与快捷键
    ok(!text.includes('出战选择'), '不再提「出战选择」（这个概念已经取消）');
    for (const [key, label] of [['D', '卡组一览'], ['I', '背包'], ['H', '帮助'], ['Esc', '关闭']]) {
      ok(new RegExp(`${key}[^。]{0,20}${label}`).test(text) || text.includes(key), `快捷键 ${key}（${label}）在说明里`);
    }
    ok(/什么键|快捷键/.test(text), '有「快捷键」这一节');

    // ⑤ 新加的「道具与背包」一节
    ok(text.includes('道具与背包'), '说明里新增了「道具与背包」一节');
    ok(/拿到手就自动生效/.test(text), '写清了护符拿到就生效（不是留在背包里等你点）');
    ok(/不占出牌次数/.test(text), '写清了喝药不占出牌次数');

    // ⑥ 状态名要和引擎一致（引擎里叫「出血」，旧文案写的是「流血」）
    const { STATUS_INFO } = await import('../src/core/battle.js');
    for (const [, info] of Object.entries(STATUS_INFO)) {
      ok(text.includes(info.name), `状态「${info.name}」用的是引擎里的名字`);
    }
    ok(!text.includes('流血'), '旧文案「流血」已经消失');

    // ⑦ 背包页里那几条回血方式同样是现算的
    document.querySelector('.modal-backdrop')?.remove();
    showItems(game);
    await wait(250);
    const bagText = (document.querySelector('.modal-backdrop .modal-body')?.textContent ?? '').replace(/\s+/g, ' ');
    ok(bagText.includes(pct(BALANCE.restHealPct)), `背包页的营地回复也是 ${pct(BALANCE.restHealPct)}`);
    ok(bagText.includes(pct(BALANCE.healAfterBattlePct)), `背包页的战后回复也是 ${pct(BALANCE.healAfterBattlePct)}`);
    ok(!bagText.includes('35%') && !/的 4%/.test(bagText), '背包页的旧数字也清掉了');
    document.querySelector('.modal-backdrop')?.remove();

    if (fails.length) log(`HP_ERRORS=[${fails.join(' | ')}]`);
    else log('玩法说明文案自检：通过 ✓');
    log('HP_DONE');
  } catch (e) {
    log('HP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('HP_DONE');
  }
})();
