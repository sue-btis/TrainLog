import { cn } from '@/lib/utils';


/** The board. `dvh` rather than `vh` so a phone's URL bar cannot clip it. */
export const SCREEN = 'relative min-h-dvh bg-board text-ink';

export const COLUMN = 'relative mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6 pb-12';


export const CARD = 'bg-card text-ink rounded-card shadow-lift p-5 flex flex-col gap-4';

export const PANEL_CARD = 'bg-card text-ink rounded-card shadow-dome p-4 flex flex-col gap-3';

export const WELL = 'bg-card text-ink rounded-card p-4 flex flex-col gap-3';

export const ROW_LIST = 'flex flex-col divide-y divide-rule';
export const ROW = 'flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0';

export const RULED = 'flex flex-col gap-3 border-t border-rule pt-4';


export const LABEL = 'type-label text-ink-3';


export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned ' +
  'focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)]';

export const PRESS =
  'transition-[box-shadow,transform,scale,translate,background-color] duration-[110ms] ease-snap active:scale-[.975]';

export const BUTTON_BASE =
  `inline-flex items-center justify-center gap-2 min-h-12 rounded-chip type-title ${PRESS} ${FOCUS_RING} disabled:pointer-events-none`;

/** Disabled goes flat rather than fading out: no shadow means nothing to press. */
const BUTTON_DISABLED = 'disabled:bg-well disabled:text-ink-3 disabled:shadow-none';

export const BUTTON_VARIANT = {
  primary: `bg-actual-ink text-on-fill shadow-lift hover:bg-actual-deep ${BUTTON_DISABLED}`,
  secondary: `bg-card text-ink shadow-dome hover:shadow-dome-lift hover:-translate-y-0.5 ${BUTTON_DISABLED}`,
  ghost: 'bg-transparent text-planned-ink hover:bg-planned-wash disabled:text-ink-3',
  danger: `bg-missed-ink text-on-fill shadow-lift hover:bg-missed-deep ${BUTTON_DISABLED}`,
  nav: `bg-planned-wash text-planned-ink ring-1 ring-planned shadow-dome hover:bg-card hover:shadow-dome-lift hover:-translate-y-0.5 ${BUTTON_DISABLED}`,
  quiet: `bg-well text-ink ring-1 ring-ink-3 shadow-dome hover:bg-card ${BUTTON_DISABLED}`,
} as const;

export const BUTTON_SIZE = {
  control: 'px-[22px] py-3.5',
  compact: 'px-4 py-2 type-body-sm',
  /** Square, for an icon that carries an `aria-label` instead of a word. */
  icon: 'w-12 px-0',
  block: 'w-full px-6',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;
export type ButtonSize = keyof typeof BUTTON_SIZE;

const TAB_BASE =
  `inline-flex shrink-0 items-center gap-2 min-h-12 rounded-control px-4 type-body-sm ${PRESS} ${FOCUS_RING}`;

const TAB_REST = 'bg-card text-ink-2 shadow-dome hover:shadow-dome-lift';
const TAB_ACTIVE = 'bg-planned-ink text-on-fill shadow-none';

export const TAB_TRIGGER = cn(
  TAB_BASE,
  TAB_REST,
  'data-[state=active]:bg-planned-ink data-[state=active]:text-on-fill data-[state=active]:shadow-none',
);

export function tab(active: boolean, extra?: string): string {
  return cn(TAB_BASE, active ? TAB_ACTIVE : TAB_REST, extra);
}

export const MENU_ITEM = cn(
  'flex min-h-12 w-full cursor-default items-center gap-3 rounded-control px-3 text-left type-body-sm',
  'select-none outline-none focus:bg-well data-[highlighted]:bg-well',
  'data-[disabled]:pointer-events-none data-[disabled]:text-ink-3',
  FOCUS_RING,
);


export const FIELD_BASE = `w-full min-h-12 rounded-field bg-well text-ink ring-1 ring-edge px-3 ${FOCUS_RING}`;

/** Invalid adds a ring in Errata Red — the hue that owns a validation error. */
export function field(invalid: boolean, extra?: string): string {
  return cn(FIELD_BASE, invalid && 'ring-1 ring-missed', extra);
}


const CHIP_TONE = {
  neutral: 'bg-panel text-ink-2 shadow-edge',
  planned: 'bg-planned-ink text-on-fill',
  actual: 'bg-actual-ink text-on-fill',
  missed: 'bg-missed-ink text-on-fill',
  progress: 'bg-progress-ink text-on-fill',
} as const;

export type ChipTone = keyof typeof CHIP_TONE;

export function chip(tone: ChipTone = 'neutral', extra?: string): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-chip type-label px-3 py-1.5',
    CHIP_TONE[tone],
    extra,
  );
}

/** A solid band in the hue of what it is announcing, with white text. */
export function alert(tone: 'missed' | 'planned' = 'missed', extra?: string): string {
  return cn(
    'flex items-start gap-3 rounded-control px-4 py-3 text-on-fill',
    tone === 'missed' ? 'bg-missed-ink' : 'bg-planned-ink',
    extra,
  );
}

export const ICON_STROKE = 1.75;


const DOME_STATE = {
  planned: 'bg-card text-planned-ink shadow-dome ring-2 ring-planned-wash',
  live: 'bg-live text-on-live shadow-dome-lift animate-breathe',
  logged: 'bg-actual-ink text-on-fill shadow-none',
  suggested: 'bg-progress text-on-fill shadow-dome-lift',
  missed: 'bg-missed-ink text-on-fill shadow-none',
  locked: 'bg-well text-ink-3 shadow-none',
  /**
   * Not a Set — the offer of one. It is the only dome drawn as an outline
   * rather than a body, because there is nothing there yet: a solid circle
   * would claim a set exists. Dashed says "this could be one".
   */
  add: 'bg-transparent text-ink-3 border-2 border-dashed border-edge hover:border-planned hover:text-planned-ink shadow-none',
} as const;

const DOME_SIZE = {
  compact: 'size-[60px] type-body-sm',
  default: 'size-[76px] type-title',
  live: 'size-[96px] type-readout',
} as const;

export type DomeState = keyof typeof DOME_STATE;
export type DomeSize = keyof typeof DOME_SIZE;

export function dome(state: DomeState, size: DomeSize = 'default', extra?: string): string {
  return cn(
    'inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-cell leading-none',
    PRESS,
    FOCUS_RING,
    'disabled:pointer-events-none',
    DOME_STATE[state],
    DOME_SIZE[size],
    extra,
  );
}

export const STEPPER = cn(
  'inline-flex size-12 shrink-0 items-center justify-center rounded-cell',
  'bg-planned-wash text-planned-ink ring-1 ring-planned shadow-dome',
  'hover:bg-card hover:shadow-dome-lift',
  'disabled:bg-well disabled:text-ink-3 disabled:shadow-none disabled:ring-rule disabled:pointer-events-none',
  PRESS,
  FOCUS_RING,
);

export const READOUT = cn(
  // The three gym-mode readouts had no boundary at all — `bg-well` on `bg-card`
  // is 1.13:1, so the field a lifter aims a thumb at mid-set was findable only
  // by the label above it.
  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-field bg-well ring-1 ring-edge px-2 py-3',
  'focus-within:ring-1 focus-within:ring-planned focus-within:shadow-[0_0_0_3px_var(--color-planned-wash)]',
);

export const READOUT_INPUT =
  'w-full min-w-0 bg-transparent text-center type-readout text-ink outline-none';

export const TIMER_SHELL =
  'fixed inset-x-0 bottom-0 z-20 overflow-hidden bg-live-ink text-on-fill shadow-lift';

export const TIMER_TRACK = 'absolute inset-x-0 top-0 h-1.5 bg-scrim';
export const TIMER_RAIL =
  'h-full origin-left bg-live-rail transition-transform duration-1000 ease-linear';
