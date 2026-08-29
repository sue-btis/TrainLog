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
