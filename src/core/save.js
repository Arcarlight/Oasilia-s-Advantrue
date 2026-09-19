// 存档：localStorage 为主（游戏数据很小），另外支持导出 / 导入 JSON 文件。

const KEY = 'oasis_desert_spirit_save_v1';
const META_KEY = 'oasis_desert_spirit_meta_v1';

/**
 * 跨局记录里最多留几局战绩。
 *
 * localStorage 只有几 MB，而一条战绩带着整副卡组的 id（约 40 个字符串）——
 * 不封顶的话，玩上几百局就会把配额撑满，那时**连存档都写不进去**了
 * （`setItem` 抛异常 → save() 静默失败，玩家丢进度）。30 局够回顾了。
 */
export const HISTORY_MAX = 30;

export const save = {
  writeRun(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), data }));
      return true;
    } catch {
      return false;
    }
  },
  readRun() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.v === 1 ? parsed.data : null;
    } catch {
      return null;
    }
  },
  clearRun() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },

  // ---- 跨局记录 ----
  readMeta() {
    const fallback = {
      bestDistance: 0, bestStage: 0, runs: 0, wins: 0, kills: 0, unlocked: false,
      seenCards: [], seenEnemies: [], slainEnemies: [], history: [],
    };
    try {
      const raw = localStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : fallback;
      /**
       * 老存档里没有这些字段（卡牌图鉴 / 敌人图鉴 / 通关记录都是**后加的**）。
       * 一律在这里补成空数组，别让调用方到处判空 ——
       * 少补一个，「图鉴一打开就白屏」这种事就会在某台老存档的机器上发生。
       */
      if (!Array.isArray(meta.seenCards)) meta.seenCards = [];
      if (!Array.isArray(meta.seenEnemies)) meta.seenEnemies = [];
      if (!Array.isArray(meta.slainEnemies)) meta.slainEnemies = [];
      if (!Array.isArray(meta.history)) meta.history = [];
      return meta;
    } catch {
      return fallback;
    }
  },
  writeMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
  },
  patchMeta(patch) {
    const m = { ...this.readMeta(), ...patch };
    this.writeMeta(m);
    return m;
  },

  /**
   * 记下「拿到过哪些卡」（跨局累加）。
   *
   * 卡牌图鉴靠它把「没见过 / 以前拿过 / 这一局正带着」区分开 ——
   * 以前图鉴把 86 张按同一个亮度全画出来，玩家以为「没拿过的也算已收集」（用户反馈）。
   * 只在真的新增了卡时才写盘，避免每次 save() 都动 localStorage。
   */
  noteCards(ids = []) {
    const meta = this.readMeta();
    const seen = new Set(meta.seenCards ?? []);
    let added = 0;
    for (const id of ids) {
      if (id && !seen.has(id)) { seen.add(id); added += 1; }
    }
    if (!added) return meta;
    const next = { ...meta, seenCards: [...seen] };
    this.writeMeta(next);
    return next;
  },

  /**
   * 记下「遇见过 / 击败过哪些宝可梦」（跨局累加），敌人图鉴靠它分三档：
   *   没见过（压暗 + ???）/ 见过但没打过 / 击败过（✓ + 次数）。
   *
   * 为什么分成两个集合而不是一个「见过」：玩家想知道「这一只我到底打过没有」——
   * 一只怪「遇见了但被它打回家」和「打赢了」是两件事，混在一起图鉴就没有目标感了。
   * `slain` 时顺手也记进 seen（击败必然见过），免得调用方两个都传。
   * 只在真的新增了才写盘。
   */
  noteEnemies(ids = [], { slain = false } = {}) {
    const meta = this.readMeta();
    const seen = new Set(meta.seenEnemies ?? []);
    const beaten = new Set(meta.slainEnemies ?? []);
    let added = 0;
    for (const id of [].concat(ids)) {
      if (!id) continue;
      if (!seen.has(id)) { seen.add(id); added += 1; }
      if (slain && !beaten.has(id)) { beaten.add(id); added += 1; }
    }
    if (!added) return meta;
    const next = { ...meta, seenEnemies: [...seen], slainEnemies: [...beaten] };
    this.writeMeta(next);
    return next;
  },

  /**
   * 记一局战绩（**打完一局才写**：通关和灰溜溜回家都记一条）。
   *
   * 只存 **id 与数字**，绝不存名字：卡组存的是卡牌 id，地图存的是 biome key。
   * 存名字的话，玩家中途切成日语之后，老记录里那一串还是当时的语言
   * （卡名 / 地图名都是原地改写的，记下来就冻结了）。
   * 最新的排在最前面，只留 HISTORY_MAX 条。
   */
  recordRun(entry) {
    const meta = this.readMeta();
    const history = [entry, ...(meta.history ?? [])].slice(0, HISTORY_MAX);
    const next = { ...meta, history };
    this.writeMeta(next);
    return next;
  },

  /** 清空通关记录（图鉴进度不动：那是「收集」，不是「战绩」） */
  clearHistory() {
    const meta = this.readMeta();
    const next = { ...meta, history: [] };
    this.writeMeta(next);
    return next;
  },

  exportFile(data, filename = 'oasis-save.json') {
    const blob = new Blob([JSON.stringify({ v: 1, at: Date.now(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  async importFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const parsed = JSON.parse(await file.text());
          resolve(parsed?.v === 1 ? parsed.data : null);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  },

  // 兼容旧浏览器：把存档写到项目目录下的 saves/ 里（需要 File System Access API）
  async pickSaveFolder() {
    if (!window.showDirectoryPicker) return false;
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      this._dir = dir;
      return true;
    } catch {
      return false;
    }
  },
  async writeToFolder(data) {
    if (!this._dir) return false;
    try {
      const fh = await this._dir.getFileHandle('oasis-save.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify({ v: 1, at: Date.now(), data }, null, 2));
      await w.close();
      return true;
    } catch {
      return false;
    }
  },
};

export { KEY as SAVE_KEY, META_KEY };
