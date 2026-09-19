// 多语言诊断（?dgi18n=1）：**真的点一下语言按钮**，验证整条链路。
//
// 为什么必须真点：`?lang=` 只是启动时选一次语言，绕过了「切换」这条路径 ——
// 而切换要同时做三件事（改状态 → 原地改写内容字段 → 重画界面），
// 最容易出问题的是第三件之外还有一件：**切回中文时要逐字恢复**。
// 内容字段是原地改写的（applyContentLang），中文原文存在 _zh 副本里 ——
// 那份副本的恢复逻辑要是错了，切回中文就会串味（显示上一次的译文）。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgi18n=1" rt
(async () => {
  const log = (...a) => console.log('[d2] [i18n]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const titleText = () => {
    const h1 = document.querySelector('.title-screen .title-h1');
    const btns = [...document.querySelectorAll('.title-screen .btn')].map((b) => b.textContent.trim());
    return `${h1?.textContent ?? '(没有标题)'}｜${btns.slice(0, 2).join(' / ')}`;
  };
  const clickLang = (name) => {
    const btn = [...document.querySelectorAll('.lang-btn')].find((b) => b.textContent.trim() === name);
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  };

  try {
    const game = window.__oasis;
    const { currentLang, hasTranslation, dictOf } = await import('../src/core/i18n.js');
    const { CARDS } = await import('../src/data/cards.js');
    const { STATUS_INFO } = await import('../src/core/battle.js');

    // 等标题页落定
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }

    log('① 默认（中文）');
    ok(currentLang() === 'zh', '默认语言是中文', currentLang());
    ok(!!document.querySelector('.lang-switch'), '标题页上有语言切换按钮');
    const zhTitle = titleText();
    const tackleZh = CARDS.find((c) => c.id === 'tackle')?.name;
    ok(tackleZh === '撞击', '中文下卡名是原文', String(tackleZh));
    ok(STATUS_INFO.poison.name === '中毒', '中文下状态名是原文', STATUS_INFO.poison.name);

    log('② 点「日本語」');
    ok(clickLang('日本語'), '找到并点了「日本語」按钮');
    await wait(400);
    const jaTitle = titleText();
    ok(currentLang() === 'ja', '语言状态变成 ja', currentLang());
    ok(document.documentElement.lang === 'ja', '<html lang> 跟着变（字体 / 断行 / 朗读都看它）', document.documentElement.lang);
    ok(jaTitle !== zhTitle, '标题页当场重画成日语', jaTitle);
    ok(CARDS.find((c) => c.id === 'tackle')?.name === 'たいあたり', '卡名**当场**变成译文（内容字段是原地改写的）', CARDS.find((c) => c.id === 'tackle')?.name);
    ok(STATUS_INFO.poison.name === 'どく', '状态名也当场变了（状态胶囊跟着走）', STATUS_INFO.poison.name);
    ok(JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') ?? '{}').lang === 'ja',
      '选择写进了跨局记录（下次进来还是日语）', localStorage.getItem('oasis_desert_spirit_meta_v1'));

    log('③ 开一场战斗，日志应该是日语');
    game.newRun(4242);
    game.startBattle('normal', 0, 'direct');
    await wait(1500);
    const lines = [...document.querySelectorAll('.battle-log p')].map((p) => p.textContent);
    ok(lines.some((t) => t.includes('が現れた！')), '战斗日志模板走了译文', lines.slice(0, 2).join(' ｜ ') || '（没有日志）');
    ok(!lines.some((t) => t.includes('遭遇 ')), '没有残留的中文模板', lines.filter((t) => t.includes('遭遇')).join(' ｜ ') || '（干净）');

    log('④ 切回中文，必须**逐字**回到原文（原地改写的恢复路径）');
    // 战斗界面里没有语言按钮（那是标题页 / 设置里的），直接用执行入口切
    const { changeLanguage } = await import('../src/ui/langswitch.js');
    changeLanguage('zh');
    await wait(400);
    ok(currentLang() === 'zh', '语言回到中文', currentLang());
    ok(CARDS.find((c) => c.id === 'tackle')?.name === '撞击', '卡名逐字回到中文', CARDS.find((c) => c.id === 'tackle')?.name);
    ok(STATUS_INFO.poison.name === '中毒', '状态名逐字回到中文', STATUS_INFO.poison.name);
    ok(STATUS_INFO.poison.desc.startsWith('回合开始流失'), '状态说明也回到原文（不是上一次的译文）', STATUS_INFO.poison.desc.slice(0, 14));
    // 真的再打一张牌，看新产生的日志行是不是中文模板（老行是日语时留下的，不该拿来判）
    {
      const bs = window.__oasisUI?.battleScreen;
      const b = game.battle;
      const before = document.querySelectorAll('.battle-log p').length;
      const entry = b.hand('player').find((c) => b.canPlay(c.uid));
      if (bs && entry) await bs.playCard(entry.uid);
      await wait(600);
      const fresh = [...document.querySelectorAll('.battle-log p')].slice(before).map((p) => p.textContent);
      ok(fresh.some((t) => t.includes('使用了「')), '切回中文之后**新产生**的日志是中文模板', fresh.join(' ｜ ') || '（没有新行）');
      ok(!fresh.some((t) => t.includes('を使った')), '新行里没有残留日语模板', fresh.filter((t) => t.includes('を使った')).join(' ｜ ') || '（干净）');
    }

    log('⑤ 来回切两轮不串味');
    changeLanguage('en'); await wait(200);
    const enName = CARDS.find((c) => c.id === 'tackle')?.name;
    changeLanguage('zh'); await wait(200);
    changeLanguage('ja'); await wait(200);
    const jaName = CARDS.find((c) => c.id === 'tackle')?.name;
    changeLanguage('zh'); await wait(200);
    ok(enName === 'Tackle' && jaName === 'たいあたり', '中→en→中→ja→中 之后各自都对', `en=${enName} ja=${jaName} zh=${CARDS.find((c) => c.id === 'tackle')?.name}`);

    log('⑥ 覆盖率（按运行时那份短语表算）');
    const ja = dictOf('ja');
    const en = dictOf('en');
    log(`  ja 表 ${Object.keys(ja).length} 条 · en 表 ${Object.keys(en).length} 条`);
    ok(hasTranslation('开始新的冒险', 'ja') && hasTranslation('开始新的冒险', 'en'),
      '界面文案两边都翻到了', `开始新的冒险 → ${dictOf('ja')['开始新的冒险']} / ${dictOf('en')['开始新的冒险']}`);
    ok(!hasTranslation('不存在的句子', 'ja'), '查不到就返回原文（不会显示键名）', '不存在的句子');

    if (fails.length) log(`I18N_ERRORS=[${fails.join(' | ')}]`);
    else log('多语言自检：通过 ✓');
    log('I18N_DONE');
  } catch (e) {
    log('I18N_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('I18N_DONE');
  }
})();
