/**
 * Where a routine comes from, and the structural refusal (§11.1 "Structural").
 *
 * Two ways in, not one: a file the lifter already has, or nothing at all. Both
 * land on the same step 1 holding the same draft — a routine authored here is a
 * routine file that never sat on disk.
 *
 * A structural failure is terminal by design: there is no partial result to
 * show and nothing in the wizard could repair a file it could not read. So the
 * screen says what happened, says exactly where, and offers the moves that
 * help — another file, or building it here instead.
 */

import { useRef } from 'react';
import { FileUp, LoaderCircle, PencilLine, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPath, type StructuralError } from '@/domain/routine-file';
import { EXAMPLE_ROUTINE_YAML, FIELD_NOTES } from '@/domain/routine-file/example';
import { ICON_STROKE, LABEL, WELL, alert } from '@/features/ui/styles';

interface FileStepProps {
  readonly fileName: string | null;
  readonly errors: readonly StructuralError[] | null;
  readonly unreadable: string | null;
  /** The chosen file is being read and parsed. The control it came from says so. */
  readonly reading: boolean;
  readonly onFile: (file: File) => void;
  /** Start with no file: an empty draft, named and filled in here. */
  readonly onStartBlank: () => void;
}

export function FileStep({
  fileName,
  errors,
  unreadable,
  reading,
  onFile,
  onStartBlank,
}: FileStepProps) {
  const input = useRef<HTMLInputElement>(null);
  const rejected = errors !== null || unreadable !== null;

  return (
    <>
      {rejected ? (
        <>
          <div className={alert('missed')}>
            <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={20} strokeWidth={ICON_STROKE} />
            <div className="flex flex-col gap-1">
              <p className="type-title">Import failed</p>
              <p className="type-body-sm">
                {fileName === null
                  ? 'The file could not be read.'
                  : `${fileName} could not be read.`}
              </p>
            </div>
          </div>

          <div className={WELL}>
            <p className={LABEL}>{unreadable === null ? 'what is wrong' : 'what happened'}</p>
            {unreadable !== null && <p className="type-body-sm text-ink-2">{unreadable}</p>}
            {errors?.map((error, index) => (
              <div className="flex flex-col gap-0.5" key={`${formatPath(error.path)}-${index}`}>
                <p className="type-measure-sm text-ink-3">
                  {error.path.length === 0 ? 'the file itself' : formatPath(error.path)}
                </p>
                <p className="type-body-sm text-ink">{error.message}</p>
              </div>
            ))}
            <p className="type-caption text-ink-3">
              Fix the file in your editor and choose it again. A routine file needs
              <code className="type-measure-sm"> version: 1</code>, a routine name, and a
              name for every Workout and exercise.
            </p>
          </div>
        </>
      ) : (
        <div className={WELL}>
          <p className="type-title">Where is your programme?</p>
          <p className="type-body-sm text-ink-2">
            Pick the <code className="type-measure-sm">.yaml</code> file that declares it — its
            Workouts, their exercises, and the days they are meant to fall on. Or start with
            nothing and build it here.
          </p>
        </div>
      )}

      {/* The visible button is the control; this input is only its mechanism,
          so it is out of the tab order rather than an invisible stop in it. */}
      <input
        accept=".yaml,.yml,application/yaml,text/yaml"
        aria-hidden="true"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          // Clearing the value lets the same file be chosen twice in a row.
          event.target.value = '';
          if (chosen) onFile(chosen);
        }}
        ref={input}
        type="file"
      />
      <Button
        disabled={reading}
        onClick={() => input.current?.click()}
        size="block"
        type="button"
        variant={rejected ? 'secondary' : 'primary'}
      >
        {reading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={20} strokeWidth={ICON_STROKE} />
        ) : (
          <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        )}
        {reading
          ? 'Reading the file…'
          : rejected
            ? 'Choose another file'
            : 'Choose a routine file'}
      </Button>

      {/* The second way in. Secondary next to the file button when a file is
          what the lifter came for, and the same size, because neither is a
          lesser way to end up with a routine. */}
      <Button
        disabled={reading}
        onClick={onStartBlank}
        size="block"
        type="button"
        variant="secondary"
      >
        <PencilLine aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
        Start from scratch
      </Button>

      {/* What the file has to look like, shipped.
          Nothing here is retyped: the example is the same string
          `parse.test.ts` feeds to the parser, so a reference that stops being
          true fails the build rather than misleading someone in a gym. Closed
          by default — it is for the moment a file is wrong, not for every
          import. */}
      <details className={WELL}>
        <summary className="type-title cursor-pointer list-none">
          What a routine file looks like
        </summary>

        <p className="type-body-sm text-ink-2">
          A programme is plain YAML. This one is complete and valid — start from it,
          or check a file that was refused against it.
        </p>

        <pre className="overflow-x-auto rounded-field bg-well p-3 type-measure-sm text-ink">
          <code>{EXAMPLE_ROUTINE_YAML}</code>
        </pre>

        <div className="flex flex-col gap-2 border-t border-rule pt-3">
          <p className={LABEL}>the fields</p>
          <dl className="flex flex-col gap-2">
            {FIELD_NOTES.map((field) => (
              <div className="flex flex-col gap-0.5" key={field.name}>
                <dt className="type-measure-sm text-ink">
                  {field.name}
                  {!field.required && <span className="text-ink-3"> · optional</span>}
                </dt>
                <dd className="type-body-sm text-ink-2">{field.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </>
  );
}
