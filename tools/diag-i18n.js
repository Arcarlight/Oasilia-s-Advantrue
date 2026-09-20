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
    /**
     * 标签页标题（用户点出来的：「网页标题到现在都没改」）。
     * 它是**玩家看得见的一行字**，所以和界面文案一个标准：不许写死在 HTML 里不动 ——
     * 切了日语 / 英语，标签页也得跟着换（`applyDocumentTitle`，见 src/ui/langswitch.js）。
     */
    const zhTab = document.title;
    ok(zhTab.includes('欧亚西莉亚'), '中文下标签页标题是新版（不再是早期占位那版）', zhTab);

    log('② 点「日本語」');
    ok(clickLang('日本語'), '找到并点了「日本語」按钮');
    await wait(400);
    const jaTitle = titleText();
    ok(currentLang() === 'ja', '语言状态变成 ja', currentLang());
    ok(document.documentElement.lang === 'ja', '<html lang> 跟着变（字体 / 断行 / 朗读都看它）', document.documentElement.lang);
    ok(jaTitle !== zhTitle, '标题页当场重画成日语', jaTitle);
    ok(document.title !== zhTab && document.title.includes('オアシリア'),
      '标签页标题跟着切成日语', `${zhTab} → ${document.title}`);
    // 判据只用**简体专有字**：日语标题里「大冒険」这种汉字是正经日文，用「有没有汉字」查会误报
    // （diag-music 里踩过同一个坑）
    ok(!/[题图标乐击败敌鉴张奖级复录说写点类]/.test(document.title),
      '日语标题里没有残留的简体中文', document.title);
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
    ok(document.title === zhTab, '标签页标题逐字回到中文那一份', document.title);
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

    /**
     * ⑦ 内容表逐个过一遍：**不许有「本该翻却还留着中文」的字段**。
     *
     * 这一条是补课：事件正文曾经整个漏掉（applyContentLang 里 skip 了 event 表），
     * 而当时的自检只看了卡名和状态名 —— 于是「事件标题和正文一直是中文」这件事
     * 在体检全绿的情况下活了下来，直到截图才被发现。
     *
     * 判据不用 _zh（表要是压根没被 apply 过，_zh 也不存在，判据会空过），
     * 而是**直接看界面上的值**：只要某个可见字段的值**正好是日语表里的一个键**，
     * 就说明它还是中文原文 —— 这就是玩家看到中文的那个瞬间。
     */
    log('⑦ 内容表逐字段：还有没有「本该翻却留着中文」的');
    {
      const { I18N_TABLES } = await import('../src/core/i18n-tables.js');
      const { CONTENT_FIELDS, entriesOf } = await import('../src/core/i18n.js');
      changeLanguage('ja');
      await wait(300);
      let totalFields = 0; let lazy = 0;
      for (const [kind, list] of Object.entries(I18N_TABLES)) {
        const fields = CONTENT_FIELDS[kind];
        if (!fields) continue;
        let n = 0; let bad = 0; let sample = '';
        for (const obj of entriesOf(list, fields)) {
          if (!obj || typeof obj !== 'object') continue;
          for (const f of fields) {
            const v = obj[f];
            const vals = Array.isArray(v) ? v : [v];
            for (const one of vals) {
              if (typeof one !== 'string') continue;
              n += 1;
              // 译文和原文**一模一样**的不算问题：「野生」在日语里本来就是「野生」，
              // 「敏捷」「威力」这类中日同形词也一样 —— 那种「没变」是正确的。
              if (ja[one] !== undefined && ja[one] !== one) { bad += 1; if (!sample) sample = `${kind}.${f} 还是「${one.slice(0, 14)}」`; }
            }
          }
        }
        totalFields += n; lazy += bad;
        ok(bad === 0, `${kind} 表 ${n - bad}/${n} 个可见字段已跟着语言走`, bad ? sample : '');
      }
      ok(totalFields > 800, '确实扫到了足够多的字段（判据不是空跑）', `${totalFields} 个字段，其中没翻的 ${lazy} 个`);
    }

    /**
     * ⑧ 事件选项的**结果文案**（含随机分支）—— 它们藏在 eventOption() 的 run() 闭包里，
     * 运行时对象上根本没有 `text` 字段。这件事坑过两次：applyEventOptions 改不到它（切到日语，
     * 选项结果那一大段还是中文，用户截图报的就是这个），build-i18n 也扫不到它
     * （那 160 多条从来没进过待翻清单）。这条断言就是盯着这一类「看不见的文案」。
     */
    log('⑧ 事件选项的结果文案（藏在 run() 闭包里的那些）');
    {
      const { optionTextNodes } = await import('../src/core/i18n.js');
      const { EVENTS } = await import('../src/data/events.js');
      changeLanguage('ja');
      await wait(200);
      let total = 0; let lazy = 0; let sample = '';
      for (const ev of EVENTS) {
        for (const o of ev.options ?? []) {
          for (const nd of optionTextNodes(o)) {
            if (typeof nd.text !== 'string') continue;
            total += 1;
            if (ja[nd.text] !== undefined && ja[nd.text] !== nd.text) { lazy += 1; if (!sample) sample = nd.text.slice(0, 18); }
          }
        }
      }
      ok(total > 150, '确实扫到了结果文案（判据不是空跑）', `${total} 条`);
      ok(lazy === 0, `结果文案 ${total - lazy}/${total} 条已跟着语言走`, lazy ? `还是中文：${sample}` : '（含随机分支各自的文案）');
      changeLanguage('zh');
      await wait(150);
    }

    if (fails.length) log(`I18N_ERRORS=[${fails.join(' | ')}]`);
    else log('多语言自检：通过 ✓');
    log('I18N_DONE');
  } catch (e) {
    log('I18N_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('I18N_DONE');
  }
})();
