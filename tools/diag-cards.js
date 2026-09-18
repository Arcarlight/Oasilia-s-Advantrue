// 卡面 / 卡组页诊断（?dgcards=1）
//
// 用户需求：卡太小、长文案放不下、要能看详情、要能排序、数字和状态要标出来。
// 这里逐条量出来，别靠「看起来没问题」：
//   ① 三档卡面尺寸下，86 张卡的描述有没有被截断（scrollHeight > clientHeight 就是截了）
//   ② 数字 / 状态 / 关键词有没有真的被标出来（数 .kw 节点）
//   ③ 五种排序是不是真的按那个规则排（读排序后的伤害值核对）
//   ④ 卡牌详情页有没有打开、效果明细 / 关键词齐不齐
//   ⑤ 关键词悬停有没有出浮层
//   ⑥ 战斗手牌放大后会不会横向溢出
//   ⑦ Esc 叠层（详情页开着时按 Esc 不能把底下的卡组页一起关掉）
//
// 参数：
//   ?dgcards=1          跑全部检查
//   ?dgcards=deck        打开卡组页就停（截图用）
//   ?dgcards=detail      打开某张带状态的牌的详情页（截图用）
//   ?dgcards=hand        进战斗、手牌摊开（截图用）
(async () => {
  const log = (...a) => console.log('[d2] [cards]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mode = new URLSearchParams(location.search).get('dgcards') || '1';
  const fails = [];
  const check = (name, ok, extra = '') => {
    log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };
  const clipped = (node) => (node ? node.scrollHeight - node.clientHeight > 1 : false);
  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  /** 颜色亮度（0=黑 1=白）：用来判断高亮色是「深墨」还是「亮色」 */
  const lum = (rgb) => {
    const [r, g, b] = (rgb.match(/\d+/g) ?? [0, 0, 0]).map(Number).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  /** 高亮检查：数字必须落在 .kw / .card-num 里面 —— 散在正文里的数字算漏标 */
  const looseDigits = (root) => {
    const bad = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (/[0-9]/.test(c.nodeValue)) bad.push(c.nodeValue.trim().slice(0, 12)); }
        else if (c.nodeType === 1 && !c.classList.contains('kw')) walk(c);
      }
    };
    walk(root);
    return bad;
  };

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARDS } = await import('/src/data/cards.js');
    const { cardEl } = await import('/src/ui/cards.js');
    const { showDeck } = await import('/src/ui/overlays.js');
    const { cardDamageTotal } = await import('/src/ui/cardtext.js');

    game.newRun(20240607);
    game.phase = 'map';
    ui.current = null;
    ui.forceRerender();
    await wait(320);

    // ---------- ① 三档尺寸下的截断检查 ----------
    // 离屏摆一列卡片来量：真实的卡组页一次只显示十来张，量不全 86 张
    function measureAll(opts, label) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:240px;display:flex;flex-direction:column;';
      document.body.append(host);
      const rows = [];
      for (const card of CARDS) {
        const node = cardEl(card, opts);
        host.append(node);
        const t = q('.card-text', node);
        const nm = q('.card-name', node);
        rows.push({
          id: card.id, name: card.name, box: `${node.offsetWidth}×${node.offsetHeight}`,
          cut: clipped(t), textH: t.scrollHeight, boxH: t.clientHeight,
          kw: qa('.kw', node).length, nums: qa('.card-num', node).length, tips: qa('[data-tip]').length,
          loose: looseDigits(t),
          // 卡名被 text-overflow: ellipsis 吃掉了吗（名字变大了，得盯住别再被截）
          nameCut: nm.scrollWidth - nm.clientWidth > 1,
          nameFs: parseFloat(getComputedStyle(nm).fontSize),
          textFs: parseFloat(getComputedStyle(t).fontSize),
          nameFw: Number(getComputedStyle(nm).fontWeight),
        });
        node.remove();
      }
      // 检具自检：故意把描述撑到 200 个字，clipped() 必须报 true，
      // 否则「没有截断」这个结论只说明检具坏了。
      const probe = cardEl(CARDS[0], opts);
      host.append(probe);
      const pt = q('.card-text', probe);
      pt.textContent = '截断检具自检'.repeat(40);
      const probeWorks = clipped(pt);
      const probeNums = `可视 ${pt.clientHeight} / 内容 ${pt.scrollHeight}`;
      probe.remove();
      host.remove();
      check(`${label}：截断检具自检`, probeWorks, probeNums);
      return rows;
    }
    for (const [label, opts] of [
      ['sm（卡组列表）', { size: 'sm' }],
      ['md（战斗手牌）', {}],
      ['lg（详情 / 奖励）', { size: 'lg' }],
      // 卡组页的卡左边还要让开「已入选」勾选圈，名字能用的宽度最窄 —— 单独量一遍
      ['sm + 勾选圈（卡组页实况）', { size: 'sm', check: true, checked: true }],
    ]) {
      const rows = measureAll(opts, label);
      const cut = rows.filter((r) => r.cut);
      check(`${label}：86 张卡的描述全部放得下`, cut.length === 0,
        cut.length ? `${cut.length} 张被截：${cut.map((c) => `${c.name}(${c.boxH}<${c.textH})`).join('、')}` : `卡面 ${rows[0].box}`);
      const noHl = rows.filter((r) => r.loose.length);
      check(`${label}：数字都落在高亮片段里`, noHl.length === 0,
        noHl.length ? noHl.map((r) => `${r.name}「${r.loose.join('')}」`).join('、') : `${rows.reduce((s, r) => s + r.nums, 0)} 个数字标记`);
      // 卡名：必须比描述明显大一档、更粗，而且不许被省略号截掉（用户要求「名字大一点、加粗、不要和介绍一个字号」）
      const nameCut = rows.filter((r) => r.nameCut);
      const r0 = rows[0];
      check(`${label}：卡名比描述大且更粗`, r0.nameFs - r0.textFs >= 3 && r0.nameFw >= 800,
        `卡名 ${r0.nameFs}px / ${r0.nameFw}，描述 ${r0.textFs}px（差 ${(r0.nameFs - r0.textFs).toFixed(1)}px）`);
      check(`${label}：86 张卡的卡名都没被省略号截掉`, nameCut.length === 0,
        nameCut.length ? nameCut.map((r) => r.name).join('、') : `最长的名字 ${Math.max(...rows.map((r) => [...r.name].length))} 个字都放得下`);
    }
    // 配色分档：卡面是米黄纸底，高亮必须用**深墨**（亮度低）；
    // 详情页是深色底，同一套语义必须换成亮色 —— 搞反了就是「字看不见」。
    {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.append(box);
      const sample = cardEl(CARDS.find((c) => /层虚弱/.test(c.text)), { size: 'sm' });
      box.append(sample);
      const num = lum(getComputedStyle(q('.card-num', sample)).color);
      const stat = lum(getComputedStyle(q('.kw-status', sample)).color);
      const bodyInk = lum(getComputedStyle(q('.card-text', sample)).color);
      box.remove();
      check('卡面上的高亮是深墨（浅底上看得清）', num < 0.35 && stat < 0.35 && num !== bodyInk,
        `数字亮度 ${num.toFixed(2)} / 状态亮度 ${stat.toFixed(2)} / 正文 ${bodyInk.toFixed(2)}`);
    }
    const statusCards = measureAll({ size: 'sm' }, 'sm（状态词复查）');
    const withStatus = CARDS.filter((c) => /中毒|灼伤|虚弱|流血/.test(c.text));
    const badTip = withStatus.filter((c) => {
      const row = statusCards.find((r) => r.id === c.id);
      return !row || row.tips === 0;
    });
    check('状态词带悬停说明', badTip.length === 0, `共 ${withStatus.length} 张带状态词${badTip.length ? '，缺：' + badTip.map((c) => c.name).join('、') : ''}`);

    // ---------- 打开卡组页 ----------
    const deckModal = showDeck(game, { picking: true });
    await wait(120);
    const grid = q('.modal-body .card-grid');
    const budget = q('.deck-count');
    log(`卡组页已打开：网格里 ${qa('.card', grid).length} 张，${budget.textContent}`);

    // ---------- ③ 排序 ----------
    // 注意：卡组里同一张牌可能有多份，所以「非递增」而不是「严格递减」
    const clickSort = async (label) => {
      const tab = qa('.sort-tab').find((t) => t.textContent === label);
      if (!tab) throw new Error(`没有「${label}」这个排序按钮`);
      tab.click();
      await wait(60);
      return tab;
    };
    await clickSort('伤害');
    const dmgOrder = qa('.card', grid).map((n) => {
      const badge = qa('.card-foot span', n).find((s) => s.textContent.startsWith('伤害 '));
      return { name: q('.card-name', n).textContent, dmg: badge ? Number(badge.textContent.replace('伤害 ', '')) : 0 };
    });
    const sortedOk = dmgOrder.every((v, i, a) => i === 0 || a[i - 1].dmg >= v.dmg);
    check('按伤害排序 = 伤害降序', sortedOk, dmgOrder.slice(0, 8).map((d) => `${d.name}${d.dmg}`).join(' > '));
    check('排序后伤害值来自 cardtext 的计算', dmgOrder.every((d, i) => {
      const card = CARDS.find((c) => c.name === d.name);
      return !card || cardDamageTotal(card) === d.dmg;
    }));

    await clickSort('特殊效果');
    // 卡组里只有十来张牌，跨不到所有分组 —— 展开图鉴（86 种）再数分组标题才准
    const codex = q('.modal-body details');
    if (codex) {
      codex.open = true;
      codex.dispatchEvent(new Event('toggle'));
      await wait(80);
    }
    const codexGrid = qa('.modal-body .card-grid').pop();
    const groups = qa('.grid-group', codexGrid).map((n) => n.textContent);
    check('特殊效果排序会分组，且 7 个分组都在', groups.length >= 7, groups.join(' / '));

    // ---------- 图鉴的「拿过 / 没拿过」 ----------
    // 用户反馈：图鉴里连没拿过的卡也全是亮的，看着像都已经收集了。
    {
      const { save } = await import('/src/core/save.js');
      const cards = qa('.card', codexGrid);
      const unowned = cards.filter((n) => n.classList.contains('card-unowned'));
      const deckNames = new Set(game.data.deck.map((id) => CARDS.find((c) => c.id === id)?.name));
      const ownedLit = cards.filter((n) => !n.classList.contains('card-unowned') && deckNames.has(q('.card-name', n).textContent));
      check('图鉴里「没拿过」的卡被压暗并标出「未获得」',
        unowned.length > 0 && unowned.every((n) => /未获得/.test(n.textContent)),
        `${cards.length} 张里 ${unowned.length} 张未获得，第一张＝「${q('.card-name', unowned[0] ?? cards[0])?.textContent}」`);
      check('图鉴里这一局正带着的卡一张都没被压暗', ownedLit.length === deckNames.size,
        `卡组 ${deckNames.size} 种，其中亮的 ${ownedLit.length} 种`);
      const summary = q('.modal-body details summary')?.textContent ?? '';
      check('图鉴标题写着「已收集 X / N 种」', /已收集 \d+ \/ \d+ 种/.test(summary), summary);

      // 「以前拿过但这一局没带」的卡：应该是亮的 + 标「曾拿过」
      const seenId = CARDS.find((c) => !game.data.deck.includes(c.id))?.id;
      save.patchMeta({ seenCards: [...new Set([...(save.readMeta().seenCards ?? []), seenId])] });
      codex.open = false;
      codex.open = true;
      codex.dispatchEvent(new Event('toggle'));
      await wait(100);
      const seenNode = qa('.card', codexGrid).find((n) => q('.card-name', n).textContent === CARDS.find((c) => c.id === seenId).name);
      check('以前拿过的卡是亮的，并标着「曾拿过」',
        !!seenNode && !seenNode.classList.contains('card-unowned') && /曾拿过/.test(seenNode.textContent),
        `「${CARDS.find((c) => c.id === seenId).name}」→ ${seenNode?.classList.contains('card-unowned') ? '被压暗了' : '亮的'}｜${qa('.card-foot span', seenNode ?? cards[0]).map((s) => s.textContent).join(',')}`);

      // 拿到新卡时要写进跨局记录（图鉴靠它认「以前拿过」）
      const before = (save.readMeta().seenCards ?? []).length;
      game.save();
      const after = (save.readMeta().seenCards ?? []).length;
      check('本局卡组会被记进跨局图鉴记录', after >= new Set(game.data.deck).size,
        `记录 ${before} → ${after} 种（卡组 ${new Set(game.data.deck).size} 种）`);
    }
    const effOrder = qa('.card', grid).map((n) => q('.card-name', n).textContent);
    log(`特殊效果排序前 10：${effOrder.slice(0, 10).join('、')}`);
    if (codex) { codex.open = false; }

    await clickSort('费用');
    const apOrder = qa('.card', grid).map((n) => Number(q('.card-ap', n).textContent));
    check('按费用排序 = 费用升序', apOrder.every((v, i, a) => i === 0 || a[i - 1] <= v), apOrder.join(','));

    await clickSort('稀有度');
    const rarOrder = qa('.card', grid).map((n) => {
      const cls = [...n.classList].find((c) => c.startsWith('card-') && !['card-sm', 'card-common'].includes(c) && ['card-common', 'card-uncommon', 'card-rare', 'card-epic'].includes(c));
      return cls ?? 'card-common';
    });
    const RANK = { 'card-common': 0, 'card-uncommon': 1, 'card-rare': 2, 'card-epic': 3 };
    check('按稀有度排序 = 稀有度降序', rarOrder.every((v, i, a) => i === 0 || RANK[a[i - 1]] >= RANK[v]), rarOrder.join(','));
    await clickSort('默认');

    // ---------- ⑤ 悬停说明（在卡面上） ----------
    const kwSpan = q('.card-text .kw-status[data-tip], .card-text .kw[data-tip]', grid);
    if (kwSpan) {
      kwSpan.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await wait(60);
      const layer = q('.tip-layer');
      check('卡面关键词悬停会弹说明', layer?.classList.contains('show') && layer.textContent.length > 6,
        `「${kwSpan.textContent}」→ ${(layer?.textContent ?? '').replace(/\n/g, ' / ').slice(0, 60)}…`);
      kwSpan.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    } else {
      check('卡面关键词悬停会弹说明', false, '网格里没找到带 data-tip 的关键词');
    }

    // ---------- ④ 详情页 ----------
    // 挑一张带状态词的牌，保证效果明细和关键词两栏都有东西
    const targetName = CARDS.find((c) => /层中毒|层灼伤|层虚弱/.test(c.text)).name;
    const targetNode = qa('.card', grid).find((n) => q('.card-name', n).textContent === targetName) ?? q('.card', grid);
    const beforeCount = Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
    targetNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(120);
    const detail = q('.card-detail');
    check('点卡牌会打开详情页', !!detail, detail ? `标题＝${q('.modal-head h3')?.textContent}` : '没找到 .card-detail');
    if (detail) {
      const big = q('.card-static', detail);
      const desc = q('.detail-desc', detail);
      const rows = qa('.detail-row', detail);
      const kws = qa('.detail-kw span', detail);
      check('详情页有大卡面', !!big, big ? `${big.offsetWidth}×${big.offsetHeight}` : '没有');
      check('详情页有完整说明', !!desc && desc.textContent.length > 4, `「${desc?.textContent ?? ''}」`);
      check('详情页有剩余文案没被截断', !clipped(desc), desc ? `内容 ${desc.scrollHeight} / 可视 ${desc.clientHeight}` : '');
      check('详情页有效果明细', rows.length > 0, rows.map((r) => `${q('.dr-label', r).textContent}=${q('.dr-value', r).textContent}`).join(' | '));
      check('详情页有可悬停的关键词', kws.length > 0, kws.map((k) => k.textContent).join('、'));
      {
        const descKw = q('.detail-desc .kw', detail) ?? kws[0];
        const l1 = lum(getComputedStyle(descKw).color);
        const l2 = kws[0] ? lum(getComputedStyle(kws[0]).color) : l1;
        const chipInk = lum(getComputedStyle(q('.detail-desc', detail)).color);
        check('详情页（深底）上的高亮是亮色', l1 > 0.35 && l2 > 0.35,
          `说明里的关键词亮度 ${l1.toFixed(2)} / 词条 ${l2.toFixed(2)} / 正文 ${chipInk.toFixed(2)}`);
      }
      if (kws[0]) {
        kws[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await wait(60);
        check('详情页关键词悬停有说明', q('.tip-layer')?.classList.contains('show'), (q('.tip-layer')?.textContent ?? '').slice(0, 50));
        kws[0].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      }

      // 详情页的两个按钮（加入 / 拿掉），以及「加不了的时候必须把原因写在按钮上」
      {
        const addB = () => qa('.detail-actions .btn')[0];
        const remB = () => qa('.detail-actions .btn')[1];
        const count = () => Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
        const label = () => `「${addB()?.textContent ?? '-'}」disabled=${addB()?.disabled}`;
        // 这个目标牌在卡组里只有 1 张、而且已经带上了：
        // 用户报的就是这个场景 ——「卡组里只能有一张」这件事没写出来，
        // 点「加入」像没反应。现在必须变成禁用的「只能拥有 1 张」。
        check('卡组里只有 1 张且已带上时，加入按钮 = 禁用的「只能拥有 1 张」',
          addB()?.disabled === true && /只能拥有 1 张/.test(addB()?.textContent ?? ''), label());
        // 禁用的按钮收不到鼠标事件，所以说明必须挂在外层 span 上 —— 量一下真的会弹
        {
          const wrap = q('.detail-actions .btn-wrap');
          wrap?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await wait(60);
          const layer = q('.tip-layer');
          check('把禁用按钮的说明挂在外层壳上（悬停能看到原因）',
            !!wrap?.dataset.tip && layer?.classList.contains('show') && /只有 1 张/.test(layer?.textContent ?? ''),
            `「${wrap?.dataset.tip ?? '-'}」→ 浮层「${(layer?.textContent ?? '').replace(/\n/g, ' / ')}」`);
          wrap?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        }
        const c0 = count();
        addB()?.click();
        await wait(60);
        check('点这个禁用的按钮不会再改变张数（但按钮上写着原因）', count() === c0, `${c0} → ${count()}，${label()}`);
        remB()?.click();
        await wait(80);
        check('拿掉一张后按钮恢复可点、并写明还剩几张',
          addB()?.disabled === false && /加入出战卡组/.test(addB()?.textContent ?? '') && remB()?.classList.contains('hidden'),
          `${label()}；拿掉按钮 hidden=${remB()?.classList.contains('hidden')}`);
        addB()?.click();
        await wait(80);
        check('再点加入能加回去（于是又变成「只能拥有 1 张」）',
          /只能拥有 1 张/.test(addB()?.textContent ?? '') && addB()?.disabled === true, `${label()}｜${q('.detail-deckstate')?.textContent}`);
      }

      if (mode === 'detail') {
        // 截图用：换一张效果最多的牌（盐腌：2 种状态 + 降防 + 销毁），
        // 这样「效果明细」一栏能看出它到底能列多少东西
        const rich = CARDS.find((c) => c.id === 'salt_cure') ?? CARDS[0];
        const { showCardDetail } = await import('/src/ui/overlays.js');
        showCardDetail(rich, { picking: true, state: () => ({ picked: 1, owned: 2 }), onToggle: () => {} });
        await wait(150);
        log(`（截图模式：停在「${rich.name}」的详情页）`);
        log('CARD_DONE');
        return;
      }

      // ---------- ⑦ Esc 只关最上面一层 ----------
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
      check('Esc 关掉详情页', !q('.card-detail'));
      check('Esc 之后底下的卡组页还在', !!q('.sort-bar'), q('.modal-head h3')?.textContent ?? '(没了)');

      // ---------- 勾选 / 保存 ----------
      const checkBox = q('.card-grid .card-check');
      if (checkBox) {
        checkBox.click();
        await wait(60);
        const after = Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
        check('左上角圆圈能加减出战场次', after !== beforeCount, `${beforeCount} → ${after}`);
        // paint() 重建了整个网格，要重新取一次（旧节点已经脱离文档）
        q('.card-grid .card-check')?.click();
        await wait(40);
        const back = Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
        check('再点一下能加回来', back === beforeCount, `${after} → ${back}`);
      }

      // ★ 真实鼠标路径：element.click() 会绕过命中测试，
      //   所以「脚本里点得动、用户点不动」这种问题必须用 elementFromPoint + 完整指针序列才量得出来。
      {
        const cb = q('.card-grid .card-check');
        const r = cb.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        log(`勾选圈中心 (${cx},${cy}) 命中：<${hit?.tagName}> class="${hit?.className}"（应为 card-check 或它里面的 .ico-check）`);
        const before = Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1 };
        hit?.dispatchEvent(new PointerEvent('pointerdown', opts));
        hit?.dispatchEvent(new MouseEvent('mousedown', opts));
        hit?.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
        hit?.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
        hit?.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
        await wait(80);
        const now = Number((budget.textContent.match(/出战卡组 (\d+) 张/) ?? [])[1] ?? -1);
        check('真实鼠标点击勾选圈能加减出战卡组', now !== before, `${before} → ${now}；命中元素 class="${hit?.className}"`);
        check('真实鼠标点击不会误开详情页', !q('.card-detail'), q('.card-detail') ? '详情页被误开了' : 'OK');
      }

      // ★★ 点哪一份就切换哪一份。
      //   这条是用户报的 bug：「点一下：从出战卡组里拿掉」的圆圈点下去没反应 ——
      //   因为当时按 id 数份数，「取消」永远扣第一份，玩家点第 4 张那份被取消的却是第 1 张。
      //   只断言「张数变了」是抓不到它的（张数确实变了），必须断言**变化的是被点的那一张**。
      {
        const picked = () => qa('.card-grid .card').map((n) => n.classList.contains('in-deck'));
        const before = picked();
        // 找一份「已选」的和一份「没选」的，两份都要点一次
        const onIdx = before.indexOf(true);
        const offIdx = before.indexOf(false);
        const boxes = () => qa('.card-grid .card-check');
        if (onIdx >= 0) {
          boxes()[onIdx].click();
          await wait(60);
          const after = picked();
          const othersSame = before.every((v, i) => i === onIdx || v === after[i]);
          check('点已选的那一份 → 取消的就是这一份', before[onIdx] && !after[onIdx] && othersSame,
            `${q('.card-grid .card', q('.card-grid')) ? '' : ''}第 ${onIdx + 1} 张：${before[onIdx]} → ${after[onIdx]}；其余没变=${othersSame}`);
        }
        if (offIdx >= 0) {
          const cur = picked();
          const target = cur.indexOf(false);
          boxes()[target].click();
          await wait(60);
          const after = picked();
          const othersSame = cur.every((v, i) => i === target || v === after[i]);
          check('点没选的那一份 → 选上的就是这一份', !cur[target] && after[target] && othersSame,
            `第 ${target + 1} 张：${cur[target]} → ${after[target]}；其余没变=${othersSame}`);
        }
        // 复原成一开始的样子，后面的保存测试才有牌可存
        const nowPicked = picked();
        for (let i = 0; i < nowPicked.length; i++) {
          if (nowPicked[i] !== before[i]) { qa('.card-grid .card-check')[i]?.click(); await wait(30); }
        }
        log(`复原后已选 ${picked().filter(Boolean).length} 张（原始 ${before.filter(Boolean).length} 张）`);
      }
      // 键盘：焦点在勾选圈上按回车，不该顺手把详情页也开出来
      // （勾选圈是 <button>，keydown 会冒泡到卡面上的「回车 = 看详情」处理）
      {
        const cb = q('.card-grid .card-check');
        cb?.focus();
        cb?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await wait(60);
        check('勾选圈上按回车不会误开详情页', !q('.card-detail'), q('.card-detail') ? '详情页被误开了' : 'OK');
      }
      const saveBtn = qa('.modal-foot .btn').find((b) => b.textContent.includes('保存'));
      if (saveBtn) {
        // 存进去的卡必须正好是界面上打了勾的那些（按出现序号记账之后特别容易搞错）
        const shownNames = qa('.card-grid .card').filter((n) => n.classList.contains('in-deck'))
          .map((n) => q('.card-name', n).textContent).sort();
        saveBtn.click();
        await wait(120);
        const saved = (game.data.battleDeck ?? []).map((id) => CARDS.find((c) => c.id === id)?.name ?? id).sort();
        check('保存按钮真的会关掉弹窗（以前 m 未定义会抛错）', !q('.sort-bar'),
          `battleDeck = ${(game.data.battleDeck ?? []).length} 张`);
        check('保存下来的卡与界面上打勾的完全一致', JSON.stringify(saved) === JSON.stringify(shownNames),
          `界面 ${shownNames.length} 张 / 存档 ${saved.length} 张${JSON.stringify(saved) === JSON.stringify(shownNames) ? '' : `：${shownNames.join('、')} ≠ ${saved.join('、')}`}`);
      }
    }

    // ---------- 出战卡组满了：加不进去的时候要给反馈，不能「点了没反应」 ----------
    if (mode === '1' || mode === 'hand' || mode === 'full') {
      const keepDeck = game.data.deck.slice();
      const { BALANCE } = await import('/src/data/balance.js');
      // 先把卡组撑到比上限多：这样才能真的把 14 张塞满
      while (game.data.deck.length < BALANCE.maxBattleDeck + 6) game.data.deck.push('tackle');
      showDeck(game, { picking: true });
      await wait(150);
      qa('.deck-toolbar .btn').find((b) => b.textContent.includes('尽量多带'))?.click();
      await wait(100);
      const countEl = q('.deck-count');
      const locked = qa('.card-grid .card-check.locked').length;
      check('出战卡组满时，还没选的圆圈会画成「锁住」并带说明', locked > 0,
        `${countEl?.textContent}｜锁住 ${locked} 个，说明＝「${qa('.card-grid .card-check.locked')[0]?.dataset.tip ?? '-'}」`);
      const c1 = Number((countEl?.textContent.match(/(\d+) 张/) ?? [])[1] ?? -1);
      q('.card-grid .card-check.locked')?.click();
      await wait(80);
      const c2 = Number((countEl?.textContent.match(/(\d+) 张/) ?? [])[1] ?? -1);
      const toastEl = document.getElementById('toast');
      check('点锁住的圆圈不会偷偷加进去，并且弹出原因',
        c1 === c2 && !toastEl?.classList.contains('hidden') && /满了/.test(toastEl?.textContent ?? ''),
        `${c1} → ${c2} 张；提示＝「${toastEl?.textContent ?? ''}」`);
      // 详情页：加入按钮必须写着「出战卡组已满」
      const freeNode = qa('.card-grid .card').find((n) => !n.classList.contains('in-deck'));
      freeNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await wait(120);
      const addB = qa('.detail-actions .btn')[0];
      check('满员时详情页的加入按钮 = 禁用的「出战卡组已满（N 张）」',
        addB?.disabled === true && /出战卡组已满/.test(addB?.textContent ?? ''),
        `「${addB?.textContent}」disabled=${addB?.disabled}`);
      qa('.modal-backdrop').forEach((n) => n.remove());   // 关掉详情页和卡组页
      await wait(80);
      game.data.deck = keepDeck;                          // 把卡组还原，别影响后面的战斗检查
      game.data.battleDeck = null;
    }

    if (mode === 'codex') {
      // 截图用：展开图鉴并滚到它，看「拿过 / 没拿过」的区分
      showDeck(game, { picking: true });
      await wait(180);
      const codexEl = q('.modal-body details');
      if (codexEl) {
        codexEl.open = true;
        codexEl.dispatchEvent(new Event('toggle'));
        await wait(160);
        codexEl.scrollIntoView({ block: 'start' });
        await wait(120);
      }
      const un = qa('.card-grid .card-unowned').length;
      log(`（截图模式：图鉴，${qa('.card-grid .card').length} 张里 ${un} 张未获得｜${q('.modal-body details summary')?.textContent}）`);
      log('CARD_DONE');
      return;
    }

    if (mode === 'limited' || mode === 'full') {
      // 截图用：① limited = 卡组里只有 1 张的牌 → 加入按钮写着「只能拥有 1 张」
      //          ② full = 出战场次塞满 → 没选的圆圈锁住
      if (mode === 'full') {
        const { BALANCE } = await import('/src/data/balance.js');
        while (game.data.deck.length < BALANCE.maxBattleDeck + 6) game.data.deck.push('tackle');
      }
      showDeck(game, { picking: true });
      await wait(180);
      if (mode === 'full') {
        qa('.deck-toolbar .btn').find((b) => b.textContent.includes('尽量多带'))?.click();
        await wait(150);
        log(`（截图模式：${q('.deck-count')?.textContent}，锁住 ${qa('.card-grid .card-check.locked').length} 个圆圈）`);
      } else {
        // 挑一张「卡组里只有 1 张」的牌：这才是「只能拥有 1 张」那个场景
        const dd = game.data.deck;
        const onceName = CARDS.find((c) => dd.filter((x) => x === c.id).length === 1)?.name;
        const node = qa('.card-grid .card').find((n) => q('.card-name', n).textContent === onceName) ?? q('.card-grid .card');
        node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await wait(180);
        const addB = qa('.detail-actions .btn')[0];
        log(`（截图模式：${q('.modal-head h3')?.textContent} → 加入按钮 =「${addB?.textContent}」disabled=${addB?.disabled}，${q('.detail-deckstate')?.textContent}）`);
      }
      log('CARD_DONE');
      return;
    }

    if (mode === 'tip') {
      // 截图用：把鼠标停在卡面的状态词上，让悬停说明留在屏幕上
      showDeck(game, { picking: true });
      await wait(150);
      const span = qa('.card-text .kw-status[data-tip]')[0] ?? qa('.card-text .kw[data-tip]')[0];
      span?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await wait(120);
      const layer = q('.tip-layer');
      // 截图专用：把过渡掐掉、透明度钉死。
      // 虚拟时间下截图是在「加类的那一帧」拍的，0.12s 的淡入还没画上去，
      // 拍出来就是「明明触发了却看不到浮层」。
      if (layer) { layer.style.transition = 'none'; layer.style.opacity = '1'; layer.style.transform = 'none'; }
      const lr = layer?.getBoundingClientRect();
      log(`（截图模式：悬停「${span?.textContent}」→ ${(layer?.textContent ?? '').replace(/\n/g, ' / ')}）`);
      log(`浮层：class=${layer?.className} opacity=${layer ? getComputedStyle(layer).opacity : '-'} rect=${lr ? `${Math.round(lr.left)},${Math.round(lr.top)} ${Math.round(lr.width)}×${Math.round(lr.height)}` : '-'} 视口=${innerWidth}×${innerHeight}`);
      log('CARD_DONE');
      return;
    }

    if (mode === 'deck') {
      // 上面那串检查已经把弹出关了，重新开一份干净的卡组页用来截图
      showDeck(game, { picking: true });
      await wait(150);
      qa('.sort-tab').find((t) => t.textContent === '特殊效果')?.click();
      await wait(80);
      log('（截图模式：停在卡组页）');
      log('CARD_DONE');
      return;
    }

    // ---------- ⑥ 战斗手牌 ----------
    if (q('.modal-backdrop')) deckModal.close();
    game.startBattle('normal', 0);
    ui.current = null;
    ui.forceRerender();
    await wait(1200);
    const bs = ui.battleScreen;
    const handEl = q('.hand');
    const hand = qa('.card', handEl);
    const over = handEl ? handEl.getBoundingClientRect() : null;
    check('战斗手牌比原来大', hand.length > 0 && hand[0].offsetWidth >= 180, hand.length ? `${hand.length} 张，卡面 ${hand[0].offsetWidth}×${hand[0].offsetHeight}` : '手牌是空的');
    if (hand.length) {
      const cut = hand.map((n) => ({ n: q('.card-name', n).textContent, cut: clipped(q('.card-text', n)), h: q('.card-text', n).scrollHeight, box: q('.card-text', n).clientHeight }));
      check('手牌里的描述没有截断', cut.every((c) => !c.cut), cut.map((c) => `${c.n}${c.cut ? `(截:${c.box}<${c.h})` : ''}`).join('、'));
      check('手牌横向不溢出屏幕', over.right <= innerWidth + 1 && over.left >= -1,
        `手牌区间 ${Math.round(over.left)}~${Math.round(over.right)} / 视口 ${innerWidth}，重叠 ${getComputedStyle(handEl).getPropertyValue('--hand-overlap').trim()}`);
      check('手牌里的数字 / 状态也标出来了', qa('.kw', handEl).length > 0, `${qa('.kw', handEl).length} 个标记`);
    }
    // 出牌展示区的卡面尺寸是 JS 按可用空间算的，比例必须跟卡面一致（不然摊开的牌会被拉变形）
    const zone = q('.play-zone');
    if (zone) {
      const cs = getComputedStyle(zone);
      const zw = parseFloat(cs.getPropertyValue('--card-w'));
      const zh = parseFloat(cs.getPropertyValue('--card-h'));
      check('出牌展示区的宽高比跟卡面一致', zw > 0 && zh > 0 && Math.abs(zw / zh - 186 / 190) < 0.08,
        `${zw}×${zh}（比例 ${(zw / zh).toFixed(3)}，卡面 0.979）`);
    }
    log('CARD_DONE');
    if (fails.length) log(`ERRORS=[${fails.join(' / ')}]`);
  } catch (err) {
    log('崩了：', err?.message ?? err);
    log(String(err?.stack ?? '').split('\n').slice(0, 4).join(' | '));
    log('CARD_DONE');
  }
})();
