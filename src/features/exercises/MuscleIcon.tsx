import { cn } from '@/lib/utils';

const PARTS = {
  head: <circle cx={20} cy={6} r={4.2} />,
  shoulderL: <rect height={5.5} rx={2.75} width={6} x={8.5} y={12} />,
  shoulderR: <rect height={5.5} rx={2.75} width={6} x={25.5} y={12} />,
  torso: <rect height={11} rx={3} width={12} x={14} y={12} />,
  abdomen: <rect height={10} rx={3} width={10} x={15} y={23.5} />,
  hip: <rect height={7.5} rx={3} width={13} x={13.5} y={33.5} />,
  upperArmL: <rect height={12} rx={2.5} width={5} x={7} y={18} />,
  upperArmR: <rect height={12} rx={2.5} width={5} x={28} y={18} />,
  forearmL: <rect height={12} rx={2.3} width={4.6} x={6.5} y={30.5} />,
  forearmR: <rect height={12} rx={2.3} width={4.6} x={28.9} y={30.5} />,
  thighL: <rect height={13} rx={2.8} width={5.6} x={14} y={41} />,
  thighR: <rect height={13} rx={2.8} width={5.6} x={20.4} y={41} />,
  shinL: <rect height={9} rx={2.3} width={4.6} x={14.6} y={54.5} />,
  shinR: <rect height={9} rx={2.3} width={4.6} x={20.8} y={54.5} />,
} as const;

type Part = keyof typeof PARTS;

const ORDER = Object.keys(PARTS) as readonly Part[];

const ARMS_UPPER: readonly Part[] = ['upperArmL', 'upperArmR'];
const LEGS_UPPER: readonly Part[] = ['thighL', 'thighR'];

const GROUPS: Record<string, { readonly rear?: true; readonly parts: readonly Part[] }> = {
  chest: { parts: ['torso'] },
  back: { rear: true, parts: ['torso'] },
  shoulders: { parts: ['shoulderL', 'shoulderR'] },
  biceps: { parts: ARMS_UPPER },
  triceps: { rear: true, parts: ARMS_UPPER },
  forearms: { parts: ['forearmL', 'forearmR'] },
  core: { parts: ['abdomen'] },
  glutes: { rear: true, parts: ['hip'] },
  quadriceps: { parts: LEGS_UPPER },
  hamstrings: { rear: true, parts: LEGS_UPPER },
  calves: { rear: true, parts: ['shinL', 'shinR'] },
  'full-body': { parts: ORDER },
};

interface MuscleIconProps {
  /** The group's category string, as `groupExercises` produced it. */
  readonly category: string;
  readonly className?: string;
}
export function MuscleIcon({ category, className }: MuscleIconProps) {
  const group = GROUPS[category];
  const active = new Set(group?.parts ?? []);

  return (
    <svg
      aria-hidden="true"
      className={cn('shrink-0', className)}
      viewBox="0 0 40 64"
    >
      {ORDER.map((part) => (
        <g className={active.has(part) ? 'fill-current' : 'fill-well'} key={part}>
          {PARTS[part]}
        </g>
      ))}
      {group?.rear === true && (
        <line
          stroke="var(--color-card)"
          strokeLinecap="round"
          strokeWidth={1.6}
          x1={20}
          x2={20}
          y1={13.5}
          y2={39}
        />
      )}
    </svg>
  );
}
