import { hasExerciseArt } from '@/domain/catalog/art';
import type { ExerciseId } from '@/domain/ids';
import { cn } from '@/lib/utils';

export function ExerciseArt({
  className,
  id,
  reserve = false,
}: {
  readonly className?: string;
  readonly id: ExerciseId;
  readonly reserve?: boolean;
}) {
  if (!hasExerciseArt(id)) {
    return reserve ? <span aria-hidden="true" className={cn('block shrink-0', className)} /> : null;
  }
  const url = `url("/exercise-art/${encodeURIComponent(id)}.svg")`;

  return (
    <span
      aria-hidden="true"
      className={cn('block shrink-0 bg-current', className)}
      style={{
        maskImage: url,
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskImage: url,
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}
