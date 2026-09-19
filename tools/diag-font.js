// 字体诊断，两个用途：
//
//   ?dgfont=shot —— 手写体 A/B 对照：把同一句话并排渲染成四栏
//       ① 过期的旧子集（复现「这个字体缺字」的现象）② 旧字体只把子集重裁一遍
//       ③ 换上的写意体 ④ LXGW 兜底对照片，外加一行放大的「呀诶唔哟～♪啦嗯嘛」。
//       ①② 两栏读 tools/shots/_stale-851-subset.woff2 与 _fixed-851-subset.woff2
//       （当时一次性导出来的副本，只在本地有；文件不在时那一栏会退回 serif）：
//         _stale-851-subset.woff2 = 改动前的那份 851 子集（git show HEAD:assets/fonts/…）
//         _fixed-851-subset.woff2 = 重跑 node tools/subset-fonts.mjs 之后的同名文件
//       取二进制一律用 Node（`execFileSync('git', ['show', …])` 拿 Buffer），
//       别用 PowerShell 的 `>` —— 它会把二进制当文本重新编码，得到一个打不开的假字体。
//
//   ?dgfont=ev —— 把**真实事件页**摆到屏幕上（挑文本最长且带 ～ 的那个事件），
//       看换字体之后旁白 / 结果框有没有溢出、有没有换行换得难看。
//
// 为什么会有 shot 这个模式：用户看着屏幕说「851 这个字体严重缺字」，而 fontTools 量出来的
// 结论相反 —— 851 在手写体语境里一个字都不缺，缺字的是**发出去的子集**（子集是内容文本的
// 旧快照：上一轮改了 46 个事件的旁白却没重跑 tools/subset-fonts.mjs，新写的
// 「呀 / 诶 / 唔 / 哟」全落到了兜底黑体上）。截图是给用户看这个区别的最快方式。
//
// 用法：
//   node tools/shot.mjs "http://127.0.0.1:5123/?dgfont=shot" tools/shots/font-ab.png 6000 motion=1 1600,1000
//   node tools/shot.mjs "http://127.0.0.1:5123/?dgfont=ev"   tools/shots/font-ev.png 3000 motion=1 1400,900

(async () => {
  const log = (...a) => console.log('[d2] [font]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const SENTENCES = [
      '「唔……这算有人要的，还是没人要的？」',
      '「好久没见啦～」箱子里全是水，凉得刚刚好。',
      '「诶，你还会说话？」沙子底下传来一声闷响。',
      '「呀，好东西。」压在箱底的那张卡，边角还是新的。',
      '不必太过严肃，可以好玩些。',
      '欧亚西莉亚 使用了「龙之舞」。攻击 +3（当前 19）。',
      'ABCDEFG abcdefg 0123456789 换行：中毒 3 层 → 2 层。',
    ];

    // 另一个用途：把**真实事件页**摆到屏幕上（?dgfont=ev），看换字体之后排版有没有崩。
    // 挑「文本最长、而且带 ～」的那个事件 —— 换字体最容易出问题就是最挤的那一屏。
    if (new URLSearchParams(location.search).get('dgfont') === 'ev') {
      const game = window.__oasis;
      const { EVENTS } = await import('../src/data/events.js');
      const withWave = EVENTS.filter((e) => e.text.includes('～'));
      const pick = (withWave.length ? withWave : EVENTS).slice().sort((a, b) => b.text.length - a.text.length)[0];
      const opts = pick.options.slice().sort((a, b) => (b.label?.length ?? 0) - (a.label?.length ?? 0))[0];
      game.newRun(20260509);
      game.data.hp = Math.round(game.data.maxHp * 0.72);
      game.event = pick;
      // 结果框也摆出来（它同样是手写体，而且带着数值）
      game.eventResult = { index: 0, text: opts?.result ?? '你把它收进了行囊，沙子从指缝里漏下去。' };
      game.phase = 'event';
      game.onChange?.(game);
      await wait(500);
      const sc = document.querySelector('.scene-text');
      const rb = document.querySelector('.result-box');
      const info = (n) => (n ? `${n.textContent.length} 字 / ${Math.round(n.getBoundingClientRect().width)}×${Math.round(n.getBoundingClientRect().height)}px / ${getComputedStyle(n).fontFamily.split(',')[0]}` : '(没找到)');
      log(`事件「${pick.name}」旁白：${info(sc)}`);
      log(`结果框：${info(rb)}`);
      log(`溢出检查：旁白 scrollHeight=${sc?.scrollHeight} clientHeight=${sc?.clientHeight}；结果框 ${rb?.scrollHeight}/${rb?.clientHeight}`);
      log('FONT_AB_DONE');
      return;
    }

    // 四栏对照：
    //   ① 过期的旧子集 —— 复现用户看到的「这个字体严重缺字」（那几个字掉到第 ④ 栏那种黑体上）
    //   ② 重裁之后的旧子集 —— 同一套字体，只是子集跟上了内容
    //   ③ 写意体 SC —— 现在换上的手写体
    //   ④ LXGW 兜底 —— 对照片（掉字时就会掉成它）
    // ①② 用的是 tools/shots/ 里的临时副本（本地才有、不进仓库），缺了就自动跳过那一栏。
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: 'AB Stale'; src: url('tools/shots/_stale-851-subset.woff2') format('woff2'); }
      @font-face { font-family: 'AB Fixed'; src: url('tools/shots/_fixed-851-subset.woff2') format('woff2'); }
      @font-face { font-family: 'AB New Hand'; src: url('assets/fonts/YShiWrittenSC-subset.woff2') format('woff2'); }
      .ab-wrap { position: fixed; inset: 0; z-index: 9999; overflow: auto;
        background: #1a120c; color: #e8cfa2; padding: 14px 18px;
        font-family: var(--font-body); }
      .ab-wrap h2 { font-size: 15px; margin: 0 0 4px; color: #f0a93c; }
      .ab-wrap p.note { font-size: 11px; opacity: .72; margin: 0 0 12px; line-height: 1.6; }
      .ab-row, .ab-head { display: grid; grid-template-columns: 54px 1fr 1fr 1fr 1fr; gap: 9px; align-items: baseline; }
      .ab-row { padding: 5px 0; border-top: 1px solid rgba(232,207,162,.14); }
      .ab-row .who { font-size: 11px; opacity: .55; }
      .ab-row .cell { font-size: 17px; line-height: 1.45; }
      /* 只放那几个「会掉字」的字，放大一号：一眼就能看出哪一栏的字不是同一套 */
      .ab-row.big .cell { font-size: 30px; line-height: 1.3; letter-spacing: 2px; }
      .ab-stale { font-family: 'AB Stale', serif; }
      .ab-fixed { font-family: 'AB Fixed', serif; }
      .ab-new { font-family: 'AB New Hand', 'Oasis Hand Patch', 'LXGW Neo XiHei Plus', serif; }
      .ab-lxgw { font-family: 'LXGW Neo XiHei Plus', serif; }
      .ab-head { font-size: 12px; font-weight: 700; color: #f0a93c; padding-bottom: 4px; }
      .ab-head div { border-bottom: 2px solid rgba(240,169,60,.5); padding-bottom: 3px; }
    `;
    document.head.append(style);

    const host = document.createElement('div');
    host.className = 'ab-wrap';
    const head = document.createElement('div');
    head.className = 'ab-head';
    for (const t of ['', '① 过期的旧子集（你现在看到的现象）', '② 旧手写体 · 子集重裁之后', '③ 写意体 SC（换上的新字体）', '④ LXGW 兜底（对照片）']) {
      head.append(Object.assign(document.createElement('div'), { textContent: t }));
    }
    const title = document.createElement('h2');
    title.textContent = '手写体 A/B：同一句话，四套字体';
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = '请比较「呀 / 诶 / 唔 / 哟 / ～ / ♪」这几个字。第 ① 栏里它们和旁边的字长得不一样'
      + '（笔画直、没有手写感）—— 那就是掉到第 ④ 栏的兜底黑体上了，看起来像「字体缺字」。'
      + '第 ② 栏是同一套旧字体、只把子集重新裁了一遍：字一个不缺。第 ③ 栏是换上的写意体。';
    host.append(title, note, head);
    const mkCell = (cls, text) => Object.assign(document.createElement('div'), { className: `cell ${cls}`, textContent: text });
    // 第一行：只摆那几个「会掉字」的字（放大 + 字距拉开），差异一眼可见
    const bigRow = document.createElement('div');
    bigRow.className = 'ab-row big';
    const BIG = '呀诶唔哟～♪啦嗯嘛';
    bigRow.append(
      Object.assign(document.createElement('div'), { className: 'who', textContent: '掉字的字' }),
      mkCell('ab-stale', BIG), mkCell('ab-fixed', BIG), mkCell('ab-new', BIG), mkCell('ab-lxgw', BIG),
    );
    host.append(bigRow);
    for (const s of SENTENCES) {
      const row = document.createElement('div');
      row.className = 'ab-row';
      row.append(
        Object.assign(document.createElement('div'), { className: 'who', textContent: `${s.length} 字` }),
        mkCell('ab-stale', s), mkCell('ab-fixed', s), mkCell('ab-new', s), mkCell('ab-lxgw', s),
      );
      host.append(row);
    }
    document.body.append(host);

    // 等字体真的加载完再报（否则截到的是兜底字形）
    for (const [fam, txt] of [['AB Stale', '呀诶唔哟～♪'], ['AB Fixed', '呀诶唔哟～♪'], ['AB New Hand', '呀诶唔哟～♪']]) {
      await document.fonts.load(`17px "${fam}"`, txt);
    }
    await wait(600);
    log('字体状态：' + [...document.fonts].map((f) => `${f.family}:${f.status}`).join(' ｜ '));
    log('FONT_AB_DONE');
  } catch (e) {
    log('FONT_AB_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('FONT_AB_DONE');
  }
})();
