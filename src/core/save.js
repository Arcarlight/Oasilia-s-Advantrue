// 存档：localStorage 为主（游戏数据很小），另外支持导出 / 导入 JSON 文件。

const KEY = 'oasis_desert_spirit_save_v1';
const META_KEY = 'oasis_desert_spirit_meta_v1';

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
    const fallback = { bestDistance: 0, bestStage: 0, runs: 0, wins: 0, kills: 0, unlocked: false, seenCards: [] };
    try {
      const raw = localStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : fallback;
      // 老存档里没有 seenCards（图鉴是后加的），补一个空数组，别让调用方到处判空
      if (!Array.isArray(meta.seenCards)) meta.seenCards = [];
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
