import { Store } from '../core/store.js';
import { DEFAULTS } from './schema.js';
import { programFor } from './types.js';

// The single design store of the Algiers designer (persisted between sessions).
export const design = new Store(DEFAULTS, 'alger-design-v1');
if (!design.state.program || !design.state.program.length) design.set({ program: programFor(design.state.type, design.state.floors) }, { history: false, silent: true });
