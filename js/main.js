// Entry point: module import order = original single-file evaluation order.
import './core/dom.js';
import './app/loop.js';
import './ui/studioPanel.js';
import './ui/exports.js';
import { later } from './app/build.js';

later();
