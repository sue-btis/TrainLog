/**
 * The way into the import wizard (§11.1).
 *
 * It opens the file picker itself and only then navigates. Pressing
 * `Import routine` used to land on a wizard whose first step's entire content
 * was a second button asking for the same thing — a screen between the lifter
 * and the file, justifying itself with nothing.
 *
 * The chosen `File` is handed over in a module variable rather than in router
 * state: a `File` in `history.state` has to survive structured cloning into the
 * session history, which is a lot of contract for a value that lives for one
 * navigation inside one tab. If the handover is lost — a reload, a bookmarked
 * `/import` — the wizard falls back to its own file step, which is exactly what
 * that step is still for after `Import another`.
 */

import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';

/** The file chosen on the way in, waiting for the wizard to mount and take it. */
let handed: File | null = null;

/** Takes the handed-over file, if there is one. Reading it clears it. */
export function takeHandedOffFile(): File | null {
  const file = handed;
  handed = null;
  return file;
}

export function ImportRoutineButton({ children }: { readonly children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  return (
    <>
      {/* The visible button is the control; this input is only its mechanism,
          so it is out of the tab order rather than an invisible stop in it. */}
      <input
        accept=".yaml,.yml,application/yaml,text/yaml"
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          // Clearing the value lets the same file be chosen twice in a row.
          event.target.value = '';
          if (chosen === undefined) return;
          handed = chosen;
          void navigate('/import');
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />

      <Button onClick={() => input.current?.click()} size="block" type="button" variant="primary">
        {children}
      </Button>
    </>
  );
}
