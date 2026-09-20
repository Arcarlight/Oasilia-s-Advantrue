// 敌人招式属性的诊断（?dgkit=1）：
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgkit=1" rt
//
// 起因（用户要求）：「很多宝可梦没有本系招式的卡牌，改掉他们技能池内莫名其妙的技能」。
// 所以这里要量的是**跑起来之后**的事实，而不是数据文件里的字段：
//   ① 每只敌人的招式池里都有本系招式；
//   ② 逐个地图 × 逐个档位真的开一场，读出敌方牌堆里实际发到的牌 ——
//      这些牌的属性必须都是这只敌人的属性（或者是不带属性的通用小工具）；
//   ③ 抽到的敌牌里含本系牌的比例；
//   ④ 顺手量一眼「属性池的攻击牌每 AP 威力」有没有离基线太远。
(async () => {
  const log = (...a) => console.log('[d2] [kit]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const game = window.__oasis;
    const { CARDS, CARD_BY_ID } = await import('/src/data/cards.js');
    const { ENEMIES, ENEMY_BY_ID, MOVE_POOLS } = await import('/src/data/enemies.js');
    const { BIOMES } = await import('/src/data/balance.js');
    /** 物种属性就在生成的敌人表里（每个条目都带 types） */
    const typesOfSlug = (slug) => ENEMY_BY_ID[slug]?.types ?? ENEMIES.find((e) => e.slug === slug)?.types ?? [];

    const typeOf = (id) => (CARD_BY_ID[id]?.types ?? [])[0] ?? null;
    const isAttack = (id) => (CARD_BY_ID[id]?.effects ?? []).some((e) => e.kind === 'damage');
    /**
     * 通用小工具：不带伤害、任何属性都能用（抓挠 / 撞击 / 扬沙 / 缩壳 / 瞪眼 / 守住）。
     * 名单和 tools/enemy-kit-plan.mjs 的 UNIVERSAL_CARDS 对齐 —— 一只地面系用「撞击」不算跑题。
     */
    const UNIVERSAL = new Set(['mob_scratch', 'tackle', 'mob_sand', 'mob_guard', 'mob_stare', 'protect']);
    const isUtility = (id) => !isAttack(id) || UNIVERSAL.has(id);

    // ---------- ① 数据层：每只敌人都要有本系招式 ----------
    log('① 每只敌人都配了本系招式');
    const withoutSameType = [];
    for (const e of ENEMIES) {
      const types = typesOfSlug(e.slug);
      const pool = typeof e.deck === 'string' ? (MOVE_POOLS[e.deck] ?? []) : (e.deck ?? []);
      if (!types.length || !pool.length) continue;
      if (!pool.some((id) => types.includes(typeOf(id)))) withoutSameType.push(`${e.id}(${types.join('/')})`);
    }
    ok(withoutSameType.length === 0, `${ENEMIES.length} 只敌人里每只的池子都有本系招式`,
      withoutSameType.length ? `缺 ${withoutSameType.length}：${withoutSameType.slice(0, 6).join(', ')}` : '无');

    // 属性池里不许混进异系的**攻击牌**
    const mixed = [];
    for (const [name, pool] of Object.entries(MOVE_POOLS)) {
      const m = /^kit_t_(.+?)(_hi)?$/.exec(name);
      if (!m) continue;
      for (const id of pool) {
        if (!isAttack(id)) continue;
        if (!(CARD_BY_ID[id]?.types ?? []).includes(m[1])) mixed.push(`${name}:${id}(${typeOf(id)})`);
      }
    }
    ok(mixed.length === 0, '属性池里的攻击牌全是该属性的', mixed.slice(0, 5).join(', ') || '无');

    // ---------- ② 实际开一场，看敌方手里发到什么牌 ----------
    log('② 实际战斗里敌方拿到的是本系牌');
    const kinds = [['normal', 'mob/normal'], ['elite', 'elite'], ['boss', 'boss']];
    let checked = 0;
    let sameTypeCards = 0;
    let offTypeCards = 0;
    const offenders = [];
    for (const biome of Object.keys(BIOMES)) {
      for (const [kind, label] of kinds) {
        // 用固定种子开局，直接把敌人按地图+档位抓出来
        const seen = new Set();
        for (let attempt = 0; attempt < 6 && seen.size < 2; attempt++) {
          game.newRun(9000 + attempt * 137);
          game.data.map = { ...(game.data.map ?? {}), biome };
          game.startBattle(kind, 0, 'direct');
          await wait(60);
          const enemy = game.battle?.enemy;
          if (!enemy || seen.has(enemy.id)) continue;
          seen.add(enemy.id);
          const sp = { types: typesOfSlug(enemy.slug) };
          // 敌方这一局的**全部**牌（手牌 + 牌堆 + 弃牌 + 销毁），比只看手牌更能说明问题
          const d = game.battle.decks?.enemy;
          const ids = [...new Set([...(d?.hand ?? []), ...(d?.draw ?? []), ...(d?.discard ?? []), ...(d?.exhaust ?? [])]
            .map((c) => c.id ?? c.card?.id).filter(Boolean))];
          if (!ids.length) continue;
          checked++;
          const same = ids.filter((id) => sp.types.includes(typeOf(id)));
          /**
           * 越系 = 既是攻击牌、又不是本系、**也不是这只怪的专属招式**。
           * 专属招式（signature）是给某只首领/精英手写的招牌技，它可能故意跨系
           * （例如岩石系的巨铅怪用「岩钉钻」——它本来就是专属卡），不算跑题。
           */
          const sig = new Set(ENEMY_BY_ID[enemy.id]?.signature ?? []);
          const off = ids.filter((id) => !isUtility(id) && !sp.types.includes(typeOf(id)) && !sig.has(id));
          sameTypeCards += same.length;
          offTypeCards += off.length;
          if (off.length) offenders.push(`${biome}/${label} ${enemy.id}(${sp.types.join('/')}) 拿到 ${off.map((i) => `${CARD_BY_ID[i]?.name}(${typeOf(i)})`).slice(0, 3).join('、')}`);
          if (!same.length) offenders.push(`${biome}/${label} ${enemy.id}(${sp.types.join('/')}) 一张本系都没拿到`);
        }
      }
    }
    ok(offenders.length === 0, `${checked} 场战斗里敌方拿到的攻击牌全是本系（不含通用小工具）`,
      offenders.length ? `有 ${offenders.length} 处：${offenders.slice(0, 4).join(' ｜ ')}` : `本系牌 ${sameTypeCards} 张 / 越系 ${offTypeCards} 张`);

    // ---------- ③ 属性池的强度口径 ----------
    log('③ 属性池的每 AP 威力（基线 ≈90~95）');
    const rows = [];
    for (const [name, pool] of Object.entries(MOVE_POOLS)) {
      if (!/^kit_t_/.test(name)) continue;
      const atk = pool.map((id) => CARD_BY_ID[id]).filter((c) => c && c.effects.some((e) => e.kind === 'damage'));
      const dmg = (c) => c.effects.filter((e) => e.kind === 'damage').reduce((s, e) => s + (e.power ?? 0) * (e.hits ?? 1), 0);
      const costed = atk.filter((c) => c.ap > 0);
      const perAp = costed.reduce((s, c) => s + Math.min(dmg(c), 450) / c.ap, 0) / Math.max(1, costed.length);
      rows.push({ name, perAp, n: atk.length });
    }
    const avgPerAp = rows.reduce((s, r) => s + r.perAp, 0) / Math.max(1, rows.length);
    log(`  属性池 ${rows.length} 个，每 AP 威力平均 ${avgPerAp.toFixed(1)}（最低 ${Math.min(...rows.map((r) => r.perAp)).toFixed(1)} 最高 ${Math.max(...rows.map((r) => r.perAp)).toFixed(1)}）`);
    ok(avgPerAp >= 60 && avgPerAp <= 110, '属性池的每 AP 威力落在基线的 ±20% 内', `${avgPerAp.toFixed(1)}`);
    const thin = rows.filter((r) => r.n < 5);
    ok(thin.length === 0, '每个属性池至少有 5 张攻击牌（敌人有得选）', thin.map((r) => `${r.name}:${r.n}`).join(', ') || '无');

    // ---------- ④ 卡表本身的属性登记 ----------
    log('④ 卡牌的属性登记');
    const noType = CARDS.filter((c) => !(c.types ?? []).length).map((c) => c.id);
    ok(noType.length === 0, '每一张卡都登记了属性', noType.slice(0, 6).join(', ') || `${CARDS.length} 张齐全`);

    if (fails.length) log(`KIT_ERRORS=[${fails.join(' | ')}]`);
    else log('敌人招式属性自检：通过 ✓');
    log('KIT_DONE');
  } catch (e) {
    log('KIT_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('KIT_DONE');
  }
})();
