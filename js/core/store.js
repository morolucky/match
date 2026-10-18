// Tiny observable store with undo/redo history and localStorage persistence.
const clone = (o) => JSON.parse(JSON.stringify(o));

export class Store {
  constructor(initial, key) {
    this.key = key; this.past = []; this.future = []; this.subs = new Set();
    let saved = null; try { saved = key && JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { saved = null; }
    this.s = Object.assign(clone(initial), saved || {});
  }
  get state() { return this.s; }
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(patch) { for (const f of this.subs) f(patch, this.s); }
  persist() { try { this.key && localStorage.setItem(this.key, JSON.stringify(this.s)); } catch (e) { /* private mode / quota */ } }
  set(patch, { history = true, silent = false } = {}) {
    if (history) { this.past.push(clone(this.s)); if (this.past.length > 80) this.past.shift(); this.future = []; }
    Object.assign(this.s, clone(patch)); this.persist(); if (!silent) this.emit(patch);
  }
  replace(state, history = true) { const all = clone(state); this.set(all, { history }); }
  undo() { if (!this.past.length) return false; this.future.push(clone(this.s)); this.s = this.past.pop(); this.persist(); this.emit({ ...this.s }); return true; }
  redo() { if (!this.future.length) return false; this.past.push(clone(this.s)); this.s = this.future.pop(); this.persist(); this.emit({ ...this.s }); return true; }
}
