import { S } from '../core/state.js';
import { later } from '../app/build.js';

// Panel shell: tabs (the designer and classic tabs also switch the building engine) + theme.
export function initShell() {
  const tabs = [...document.querySelectorAll('.tabs button')], secs = [...document.querySelectorAll('section.tab')];
  const show = (id) => {
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.tab === id)); secs.forEach((s) => s.classList.toggle('on', s.dataset.tab === id));
    const mode = id === 'alg' ? 'alg' : id === 'studio' ? 'studio' : S.mode;
    if (mode !== S.mode) { S.mode = mode; later(); }
    document.body.dataset.mode = S.mode;
  };
  tabs.forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  document.body.dataset.mode = S.mode;
  const root = document.documentElement, saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
  document.getElementById('theme').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme);
  };
}
