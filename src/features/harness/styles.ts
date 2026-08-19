/**
 * The harness's class strings. The wizard promoted the shared vocabulary into
 * `@/features/ui/styles`; these names stay so the harness panels read as they
 * did, and so there is still exactly one definition of each value.
 */

import { button, field, LABEL as UI_LABEL } from '@/features/ui/styles';

export const PANEL = 'bg-card text-ink rounded-frame shadow-dome p-5 flex flex-col gap-4';
export const CARD = 'bg-panel border border-rule rounded-card p-3 flex flex-col gap-2';
export const WELL = 'bg-well rounded-field p-2 flex flex-col gap-1';
export const LABEL = UI_LABEL;
export const BUTTON = button('primary', 'compact');
export const BUTTON_QUIET = button('secondary', 'compact');
export const INPUT = field(false, 'type-measure');
