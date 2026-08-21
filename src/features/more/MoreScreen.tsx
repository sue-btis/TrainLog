/**
 * More — the data screen (§17, §18, §19).
 *
 * There is no server and no account, so the backup on this screen is the only
 * thing standing between a lifter and losing every session they have logged.
 * That shapes the whole screen: exporting is one press, and restoring — the one
 * irreversible thing the app can do — is deliberately three, with the middle
 * one spent telling you exactly what you are about to destroy.
 *
 * Restore never repairs. A document that fails validation is reported and
 * dropped; nothing partial is ever written (§18), and the database is not
 * touched until the lifter has seen the summary and pressed again.
 *
 * Routines and session history hang off here as well: each is a place you go
 * rather than an action you take, so they lead the screen and the data actions
 * follow. Routines lost its tab to Progress (DESIGN.md §Navigation caps the
 * navigation at four) and landed here, which is where a screen you visit after
 * an import rather than during a session belongs.
 *
 * Settings (§32) live here too, above the data actions: they are what the
 * screen is for day to day, while a backup is what it is for once.
 */

import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ChevronRight,
  Database,
  Download,
  Dumbbell,
  FileUp,
  History,
  ScrollText,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import {
  exportBackup,
  listSetsForCsv,
  restoreBackup,
  restoreSummary,
  setDefaultRir,
  setDefaultUnit,
  setKeepScreenAwake,
  setTimerSound,
  setTimerVibration,
} from '@/db';
import type { RestoreSummary } from '@/db';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ResolvedSettings } from '@/domain/types';
import { useSettings } from '@/features/data/queries';
import { formatPath, parseBackup, toCsv } from '@/domain/backup';
import type { BackupDocument, StructuralError } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import { plural } from '@/features/ui/format';
import { ICON_STROKE, LABEL, PRESS, RULED, WELL, alert } from '@/features/ui/styles';
import { download } from '@/features/more/download';
import { cn } from '@/lib/utils';

/** A validated document waiting for the lifter to confirm replacing everything. */
interface Pending {
  readonly fileName: string;
  readonly document: BackupDocument;
  readonly summary: RestoreSummary;
}

/** A refused document: why, and where. */
interface Refusal {
  readonly fileName: string;
  readonly errors: readonly StructuralError[];
}

/** `trainlog-backup-2026-08-18` — today, locally. */
function stamp(prefix: string, extension: string): string {
  return `${prefix}-${formatLocalDate(new Date())}.${extension}`;
}

export function MoreScreen() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setPending(null);
    setRefusal(null);
    setDone(null);
  }

  async function exportJson() {
    reset();
    const document = await exportBackup(Date.now());
    download(stamp('trainlog-backup', 'json'), JSON.stringify(document), 'application/json');
    setDone('Backup saved. Keep it somewhere that is not this phone.');
  }

  async function exportCsv() {
    reset();
    const rows = await listSetsForCsv();
    download(stamp('trainlog-history', 'csv'), toCsv(rows), 'text/csv');
    setDone(
      rows.length === 0
        ? 'Nothing logged yet, so the file holds only its column names.'
        : `${plural(rows.length, 'set')} exported.`,
    );
  }

  /** Validates a chosen file. Writes nothing — that waits for the confirmation. */
  async function choose(file: File) {
    reset();
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setRefusal({ fileName: file.name, errors: result.errors });
      return;
    }
    setPending({
      fileName: file.name,
      document: result.document,
      summary: await restoreSummary(result.document),
    });
  }

  async function confirmRestore() {
    if (pending === null) return;
    await restoreBackup(pending.document);
    reset();
    setDone('Restored. Your calendar and history are what the backup held.');
  }

  return (
    <>
      <p className="type-lede text-ink-2">
        Everything you log lives on this phone and nowhere else. A backup is the only
        copy that survives a lost device or a cleared browser.
      </p>

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/routines">
        <ScrollText aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Routines</span>
          <span className="block type-body-sm text-ink-2">
            Every programme you have imported, and what each one asks of you.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/sessions">
        <History aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Session history</span>
          <span className="block type-body-sm text-ink-2">
            Every workout you have finished, and every set in it.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/exercises">
        <Dumbbell aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Exercises</span>
          <span className="block type-body-sm text-ink-2">
            Every movement the app knows, and the history behind each one.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <SettingsSection />

      <section className={WELL}>
        <p className={LABEL}>backup</p>
        <p className="type-body-sm text-ink-2">
          One file holding every routine, session and set. Restoring it on another phone
          brings your training across whole.
        </p>

        <Button onClick={() => void exportJson()} size="block" type="button" variant="primary">
          <Download aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          Export backup
        </Button>

        <div className={RULED}>
          <p className={LABEL}>restore</p>
          <p className="type-body-sm text-ink-2">
            Replaces everything on this phone with the contents of a backup file. Your
            default unit stays as you have it here.
          </p>

          {/* The visible button is the control; this input is only its
              mechanism, so it is out of the tab order rather than an invisible
              stop in it. */}
          <input
            accept=".json,application/json"
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              // Clearing the value lets the same file be chosen twice in a row.
              event.target.value = '';
              if (chosen) void choose(chosen);
            }}
            ref={input}
            tabIndex={-1}
            type="file"
          />

          <Button
            onClick={() => input.current?.click()}
            size="block"
            type="button"
            variant="secondary"
          >
            <FileUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            Choose a backup file
          </Button>

          {pending !== null && (
            <RestoreConfirmation
              onCancel={reset}
              onConfirm={() => void confirmRestore()}
              pending={pending}
            />
          )}

          {refusal !== null && <RestoreRefusal refusal={refusal} />}
        </div>
      </section>

      <section className={WELL}>
        <p className={LABEL}>history as csv</p>
        <p className="type-body-sm text-ink-2">
          Every set you have logged, one per line, for a spreadsheet or anything else
          that reads numbers. This one is an export only — nothing reads it back.
        </p>

        <Button onClick={() => void exportCsv()} size="block" type="button" variant="secondary">
          <Upload aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          Export history
        </Button>
      </section>

      {done !== null && (
        <p aria-live="polite" className="type-body-sm text-ink-2">
          {done}
        </p>
      )}
    </>
  );
}

/** The RIR options a lifter picks from, `none` standing for no opinion (§32). */
const RIR_OPTIONS = ['none', '0', '1', '2', '3', '4'] as const;

/**
 * Settings (§32).
 *
 * Every one of these is a *default* — the value used when nothing more specific
 * is known — and none of them reaches backwards. Changing the unit does not
 * convert a single logged set: the unit an Exercise trains in was fixed when it
 * was imported (§11.7), and rewriting history to match a preference is how a
 * lifter's numbers stop meaning what they meant.
 *
 * Each control saves on change. There is no Save button for the same reason a
 * set is written the moment it is logged (NFR-03): the app does not hold what
 * you told it in memory and hope you come back.
 *
 * No theme control: dark was rejected from the use scene (DESIGN.md, the
 * No-Dark-Variant Rule), so §32's theme row was removed rather than shipped.
 */
function SettingsSection() {
  const settings = useSettings();
  const unitId = useId();
  const rirId = useId();

  // One read, in flight. Rendering the controls at their defaults first would
  // show a lifter their settings reset for a frame before snapping back.
  if (settings === undefined) {
    return (
      <section className={WELL}>
        <p className={LABEL}>settings</p>
        <p className="type-body-sm text-ink-2">Reading your settings…</p>
      </section>
    );
  }

  const { defaultUnit, defaultRir, timerVibration, timerSound, keepScreenAwake } = settings;

  return (
    <section className={WELL}>
      <p className={LABEL}>settings</p>

      <div className="flex flex-col gap-2">
        <label className="type-title" htmlFor={unitId}>
          Default unit
        </label>
        <Select onValueChange={(next) => void setDefaultUnit(next as ResolvedSettings['defaultUnit'])} value={defaultUnit}>
          <SelectTrigger className="type-measure" id={unitId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="type-measure" value="kg">
              kg
            </SelectItem>
            <SelectItem className="type-measure" value="lb">
              lb
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="type-body-sm text-ink-2">
          What a routine file inherits when it names no unit. Each exercise keeps its
          own from then on, and nothing already logged is converted.
        </p>
      </div>

      <div className={cn(RULED, 'gap-2')}>
        <label className="type-title" htmlFor={rirId}>
          Default RIR
        </label>
        <Select
          onValueChange={(next) => void setDefaultRir(next === 'none' ? null : Number(next))}
          value={defaultRir === null ? 'none' : String(defaultRir)}
        >
          <SelectTrigger className="type-measure" id={rirId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RIR_OPTIONS.map((option) => (
              <SelectItem className="type-measure" key={option} value={option}>
                {option === 'none' ? 'No default' : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="type-body-sm text-ink-2">
          Where the RIR readout opens for an exercise with no plan and no history. A
          planned exercise still opens on its own target.
        </p>
      </div>

      <div className={cn(RULED, 'gap-0')}>
        <Toggle
          checked={timerVibration}
          hint="A short buzz when the rest is up."
          label="Timer vibration"
          onChange={(on) => void setTimerVibration(on)}
        />
        <Toggle
          checked={timerSound}
          hint="A beep when the rest is up. Silent by default — the gym is not."
          label="Timer sound"
          onChange={(on) => void setTimerSound(on)}
        />
        <Toggle
          checked={keepScreenAwake}
          hint="Keeps the screen on while a session is open, so it does not sleep between sets."
          label="Keep screen awake"
          onChange={(on) => void setKeepScreenAwake(on)}
        />
      </div>
    </section>
  );
}

/**
 * One switch and the sentence saying what it does.
 *
 * A plain `<label>` rather than the shared `Label`: that component binds
 * `type-label` — the 10px uppercase mono of a section heading — and a settings
 * row is titled, not headed. Passing `type-title` alongside it would leave two
 * type utilities on one element with CSS source order deciding which wins,
 * which is the kind of thing that silently flips a screen's typography the next
 * time `theme.css` is reordered. `htmlFor` gives the same click-to-toggle
 * either way.
 */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly hint: string;
  readonly checked: boolean;
  readonly onChange: (on: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <label className="type-title" htmlFor={id}>
          {label}
        </label>
        <p className="type-body-sm text-ink-2">{hint}</p>
      </div>
      <Switch checked={checked} id={id} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * What restoring costs, said before it happens (DEC-C).
 *
 * Counts on both sides rather than "are you sure": the number that matters is
 * how many sessions are about to stop existing, and only the lifter knows
 * whether that is the right trade.
 */
function RestoreConfirmation({
  pending,
  onCancel,
  onConfirm,
}: {
  readonly pending: Pending;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { current, incoming } = pending.summary;

  return (
    <div className={alert('missed')} role="alert">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        size={20}
        strokeWidth={ICON_STROKE}
      />
      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="type-title">This replaces everything</p>
          <p className="type-body-sm">
            {pending.fileName} is a valid backup. Restoring it deletes what is on this
            phone — it does not merge.
          </p>
        </div>

        <dl className="flex flex-col gap-1">
          <Row label="Routines" from={current.routines} to={incoming.routines} />
          <Row label="Sessions" from={current.sessions} to={incoming.sessions} />
          <Row label="Sets logged" from={current.completedSets} to={incoming.completedSets} />
        </dl>

        {pending.summary.losesSessionInProgress && (
          <p className="type-body-sm">
            A training session is still open on this phone. Restoring ends it, and what
            you logged in it goes too.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={onCancel} size="compact" type="button" variant="quiet">
            Keep what I have
          </Button>
          <Button
            className="ml-auto"
            onClick={onConfirm}
            size="compact"
            type="button"
            variant="danger"
          >
            <Database aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            Replace it all
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `Sessions  12 → 40` — what you have now, and what you would have. */
function Row({
  label,
  from,
  to,
}: {
  readonly label: string;
  readonly from: number;
  readonly to: number;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="type-body-sm text-ink-2">{label}</dt>
      <dd className="type-measure-sm ml-auto text-ink">
        {from} <span aria-label="becomes">→</span> {to}
      </dd>
    </div>
  );
}

/**
 * Why a file was refused, and where (R-4).
 *
 * Every failing field is listed rather than only the first: a backup is
 * repaired in a text editor, if at all, and one fault at a time would make that
 * a very long evening.
 */
function RestoreRefusal({ refusal }: { readonly refusal: Refusal }) {
  return (
    <div className={alert('missed')} role="alert">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        size={20}
        strokeWidth={ICON_STROKE}
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <p className="type-title">That file was not restored</p>
          <p className="type-body-sm">
            {refusal.fileName} is not a backup this app can read, so nothing on this
            phone was touched.
          </p>
        </div>

        {refusal.errors.slice(0, 10).map((error, index) => (
          <div className="flex flex-col gap-0.5" key={`${formatPath(error.path)}-${index}`}>
            <p className="type-measure-sm text-ink-3">
              {error.path.length === 0 ? 'the file itself' : formatPath(error.path)}
            </p>
            <p className="type-body-sm text-ink">{error.message}</p>
          </div>
        ))}

        {refusal.errors.length > 10 && (
          <p className="type-caption text-ink-3">
            …and {plural(refusal.errors.length - 10, 'more problem')}.
          </p>
        )}
      </div>
    </div>
  );
}
