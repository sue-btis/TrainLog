/**
 * The figure of a movement being performed (§11.12).
 *
 * Distinct from `MuscleIcon`, which answers "what part of you does this train"
 * with one schematic body. This answers "what does it look like" with the
 * movement's own drawing, and the two appear together on the catalog screen:
 * the group's icon in the heading, the exercise's figure on the row.
 *
 * Drawn as a **mask**, not as an `<img>`. The source files are white
 * silhouettes on transparent — one filled path with `fill-rule="evenodd"` — so
 * an `<img>` would render white on white in the light theme and would need a
 * second copy of every file to work in both. Masked, only the alpha channel is
 * read and the colour comes from `bg-current`, which means the figure inherits
 * whatever the surrounding text is: one file, both themes, and it dims with the
 * row it sits in.
 *
 * `-webkit-mask-image` rides along because Safari only dropped the prefix in
 * 15.4, and this app is installed on phones.
 *
 * Decorative, always: every place it appears, the exercise's name is already
 * beside it, so a screen reader announcing it twice would be noise.
 */

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
  /**
   * Hold the space when this movement has no drawing.
   *
   * Set it in a **list**, clear it under a **heading**, and the reason is the
   * left edge. Nineteen of the catalog's rows have no figure, scattered among
   * the ones that do: in the quadriceps group five names out of forty started
   * 56px left of the rest, and a column of names that wanders is harder to
   * scan than one with a few blanks in it. A heading has no column to keep —
   * one title, nothing above or below to line up with — so there the gap is
   * pure waste and the name moves flush left instead.
   */
  readonly reserve?: boolean;
}) {
  // Never a placeholder mark, only presence or absence: the nineteen without a
  // drawing are real exercises, and a broken-image glyph beside "Snatch" reads
  // as a bug in the app rather than as a gap in the artwork.
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
