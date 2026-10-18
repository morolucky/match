// Entry point. Import order mirrors the original single-file evaluation order
// (scene → render loop → panels), then the first build is scheduled.
import './core/dom.js';
import './app/loop.js';
import './ui/studioPanel.js';
import './ui/exports.js';
import { initShell } from './ui/shell.js';
import { initAlgiersPanel } from './ui/algiersPanel.js';
import { later } from './app/build.js';

initShell();
const ui = initAlgiersPanel();
later();
ui.regenPBR(1500);
