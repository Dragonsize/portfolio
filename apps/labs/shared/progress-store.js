const STORAGE_KEY = 'security-labs-progress-v1';

export class ProgressStore {
  constructor(validIds) {
    this.validIds = new Set(validIds);
    this.solved = new Set();
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved?.version !== 1 || !Array.isArray(saved.solvedLabIds)) return;
      saved.solvedLabIds.filter((id) => this.validIds.has(id)).forEach((id) => this.solved.add(id));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, solvedLabIds: [...this.solved], updatedAt: new Date().toISOString() }));
  }

  markSolved(id) {
    if (!this.validIds.has(id)) return false;
    this.solved.add(id);
    this.save();
    return true;
  }

  has(id) { return this.solved.has(id); }
  count() { return this.solved.size; }

  reset() {
    this.solved.clear();
    localStorage.removeItem(STORAGE_KEY);
  }
}
