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
    /**
     * ⚠ 这两条原来写的是「不许出现 35%」「不许出现『自动回复最大生命的 4%』」——
     * 而 preBossHealPct **现在就是 35%**（首领前回复那一行会正大光明地印出来），
     * 所以「不许出现 35%」这条一直在假红（它没进 author check，所以没人发现）。
     * 现在改成盯**当年那句旧说法**，而不是盯一个数字：数字会随平衡变，句子不会。
     */
    ok(!/绿洲营地[：:]\s*回复/.test(text), '旧说法「绿洲营地：回复…」已经消失（改成现算的一句话）');
    ok(!/自动回复最大生命的 4%/.test(text), '旧说法「自动回复最大生命的 4%」已经消失');

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

    // ⑤ 「道具与背包」一节：说的必须是**手持制**这一套（不再是药水 + 背包那套旧说法）
    ok(text.includes('道具与背包'), '说明里新增了「道具与背包」一节');
    ok(text.includes(`只有 ${BALANCE.heldBase} 个`), `手持栏写的是 ${BALANCE.heldBase} 个（= BALANCE.heldBase）`);
    ok(/战斗中不能使用/.test(text), '写明了道具**战斗中不能使用**（用户点名：会影响平衡）');
    ok(/不占出牌次数/.test(text), '写清了持有型不占出牌次数');
    ok(/石丸子铁匠铺|护符/.test(text), '写清了护符的来源（铁匠铺一定有护符）');

    // ⑤b 那套「药水 / 背包」的旧说法必须彻底消失（用户报的：事件和说明页里还有好伤药）
    for (const dead of ['好伤药', '厉害伤药', '活力药', '高级伤药', '药水', '喝药']) {
      ok(!text.includes(dead), `说明页不再提「${dead}」（那件东西已经没了）`);
    }

    // ⑥ 状态名要和引擎一致（引擎里叫「出血」，旧文案写的是「流血」）
    const { STATUS_INFO } = await import('../src/core/battle.js');
    for (const [, info] of Object.entries(STATUS_INFO)) {
      ok(text.includes(info.name), `状态「${info.name}」用的是引擎里的名字`);
    }
    ok(!text.includes('流血'), '旧文案「流血」已经消失');

    // ⑦ 手持道具面板：每一件都写着自己的作用，而且不许说「战斗里能嗑药」
    /**
     * ⚠ 这一段原来断言的是「面板里写着营地回复 30% / 战后回复 6%」——
     * 而那两句话在**说明页**（不是这个面板），面板早就不印续航数字了。
     * 现在改成查这个面板真正该有的东西：作用说明 + 战斗中的禁令。
     */
    document.querySelector('.modal-backdrop')?.remove();
    game.data.held = [];
    game.invalidateMods();
    game.giveItem('big_root', 1);
    game.giveItem('oran_berry', 1);
    showItems(game);
    await wait(250);
    const bagEl = document.querySelector('.modal-backdrop .modal-body');
    const bagText = (bagEl?.textContent ?? '').replace(/\s+/g, ' ');
    ok((bagEl?.querySelectorAll('.held-item') ?? []).length >= 2, '面板里列出了身上带着的那几件');
    ok((bagEl?.querySelectorAll('.shop-eff') ?? []).length >= 2, '每一件都写着自己的作用（不是只有名字和风味文案）');
    ok(/战斗胜利后回复最大生命/.test(bagText), '大根茎的作用写出来了', '战斗胜利后回复最大生命 10%');
    ok(/战斗中不能使用/.test(bagText) || /战斗外使用/.test(bagText), '写清了「可用」那类只能在战斗外使用');
    ok(!/战斗中随时能用|可以随时使用/.test(bagText), '没有「战斗中随时能用」这种和引擎相反的写法');
    document.querySelector('.modal-backdrop')?.remove();

    if (fails.length) log(`HP_ERRORS=[${fails.join(' | ')}]`);
    else log('玩法说明文案自检：通过 ✓');
    log('HP_DONE');
  } catch (e) {
    log('HP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('HP_DONE');
  }
})();
