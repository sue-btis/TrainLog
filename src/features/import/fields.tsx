/**
 * The wizard's form controls.
 *
 * Two things they all do, because §11.1 and DESIGN.md both require them: an
 * invalid control carries `aria-invalid` and points at its error line with
 * `aria-describedby`, and every control keeps a local draft of what is being
 * typed so a half-entered value ("", "-", "1.") never reaches the routine file.
 * The draft is dropped on blur, so the field always settles on the truth.
 */

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FieldFrameProps {
  readonly id: string;
  readonly label: string;
  readonly error: string | null;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Caption above, control, then the error line the control points at. */
function FieldFrame({ id, label, error, className, children }: FieldFrameProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error !== null && (
        <p className="type-caption text-missed-ink" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface NumberFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: number | undefined;
  readonly onCommit: (value: number | undefined) => void;
  readonly error?: string | null;
  /** An absent value is legitimate — `rest_seconds` and `rir` are optional. */
  readonly optional?: boolean;
  readonly className?: string;
}

export function NumberField({
  id,
  label,
  value,
  onCommit,
  error = null,
  optional = false,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? '' : String(value));

  function change(raw: string) {
    setDraft(raw);
    if (raw.trim() === '') {
      if (optional) onCommit(undefined);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onCommit(parsed);
  }

  return (
    <FieldFrame id={id} label={label} error={error} className={className}>
      <Input
        aria-describedby={error === null ? undefined : `${id}-error`}
        aria-invalid={error !== null}
        className="type-measure"
        id={id}
        invalid={error !== null}
        inputMode="numeric"
        onBlur={() => setDraft(null)}
        onChange={(event) => change(event.target.value)}
        type="number"
        value={shown}
      />
    </FieldFrame>
  );
}

interface SelectFieldProps<T extends string> {
  readonly id: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onCommit: (value: T) => void;
  readonly className?: string;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onCommit,
  className,
}: SelectFieldProps<T>) {
  return (
    <FieldFrame id={id} label={label} error={null} className={className}>
      <Select onValueChange={(next) => onCommit(next as T)} value={value}>
        <SelectTrigger className="type-measure" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem className="type-measure" key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

interface NotesFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: readonly string[];
  readonly onCommit: (notes: string[]) => void;
}

/**
 * One note per line. Blank lines are dropped on the way into the file but not
 * out of the textarea, so pressing Enter does not delete the line being typed.
 */
export function NotesField({ id, label, value, onCommit }: NotesFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.join('\n');

  return (
    <FieldFrame id={id} label={label} error={null}>
      <Textarea
        className="type-body-sm leading-relaxed"
        id={id}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value);
          onCommit(
            event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line !== ''),
          );
        }}
        rows={3}
        value={shown}
      />
    </FieldFrame>
  );
}
