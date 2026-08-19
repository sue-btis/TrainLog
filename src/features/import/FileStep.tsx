/**
 * Choosing a file, and the structural refusal (§11.1 "Structural").
 *
 * A structural failure is terminal by design: there is no partial result to
 * show and nothing in the wizard could repair a file it could not read. So the
 * screen says what happened, says exactly where, and offers the only move that
 * helps — another file.
 */

import { useRef } from 'react';
import { FileUp, TriangleAlert } from 'lucide-react';
import { formatPath, type StructuralError } from '@/domain/routine-file';
import { CARD, ICON_STROKE, LABEL, WELL, alert, button } from '@/features/ui/styles';

interface FileStepProps {
  readonly fileName: string | null;
  readonly errors: readonly StructuralError[] | null;
  readonly unreadable: string | null;
  readonly onFile: (file: File) => void;
}

export function FileStep({ fileName, errors, unreadable, onFile }: FileStepProps) {
  const input = useRef<HTMLInputElement>(null);
  const rejected = errors !== null || unreadable !== null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="type-display">Import a routine</h1>
        <p className="type-lede text-ink-2">
          Your programme is a YAML file. Review it here, correct anything that is off,
          and nothing is stored until you accept it.
        </p>
      </header>

      <section className={CARD}>
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
            <FileUp aria-hidden="true" className="text-ink-3" size={28} strokeWidth={ICON_STROKE} />
            <p className="type-title">No routine file chosen</p>
            <p className="type-body-sm text-ink-2">
              Pick the <code className="type-measure-sm">.yaml</code> file that declares your
              programme — its Workouts, their exercises, and the days they are meant to fall on.
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
        <button
          className={button(rejected ? 'secondary' : 'primary', 'block')}
          onClick={() => input.current?.click()}
          type="button"
        >
          <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          {rejected ? 'Choose another file' : 'Choose a routine file'}
        </button>
      </section>
    </>
  );
}
