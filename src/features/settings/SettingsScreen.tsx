/**
 * Settings (§32) and the backup (§17, §18, §19).
 *
 * Reached from the gear in the top bar rather than from a tab, which is what
 * puts it one press away from wherever a lifter already is. It used to live at
 * the bottom of More, mixed in with the places you go; those are destinations
 * and these are the app's own knobs, and one screen holding both meant neither
 * had a name.
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
 * Settings lead, because they are what the screen is for day to day, while a
 * backup is what it is for once.
 */

import { useEffect, useId, useRef, useState } from 'react';
import {
  Bell,
  Database,
  Download,
  FileUp,
  Gauge,
  HardDrive,
  LoaderCircle,
  RotateCcw,
  Scale,
  Smartphone,
  Sun,
  Table,
  TriangleAlert,
  Upload,
  Vibrate,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  exportBackup,
  listSetsForCsv,
  restoreBackup,
  restoreSummary,
  setDefaultRir,
  setDefaultUnit,
  setKeepScreenAwake,
  setLastBackupAt,
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
import { longDate, plural } from '@/features/ui/format';
import { ICON_STROKE, LABEL, RULED, WELL, alert } from '@/features/ui/styles';
import { download } from '@/features/settings/download';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import {
  isInstalled,
  readStorageDurability,
  type StorageDurability,
} from '@/pwa/persistence';
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

export function SettingsScreen() {
  const input = useRef<HTMLInputElement>(null);
  // One flag for the whole screen: while a restore is rewriting every table,
  // an export is not something a lifter should be able to start beside it.
  const { busy, failure, run } = useAsyncAction();
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
    const at = Date.now();
    const document = await exportBackup(at);
    download(stamp('trainlog-backup', 'json'), JSON.stringify(document), 'application/json');
    // Stamped after the file is handed over, so a failed export does not claim
    // a backup that was never taken.
    await setLastBackupAt(at);
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
      <SettingsSection />

      <section className={WELL}>
        <Head icon={Database}>backup</Head>
        <p className="type-body-sm text-ink-2">
          One file holding every routine, session and set. Restoring it on another phone
          brings your training across whole.
        </p>
        <BackupAge />

        <Button
          disabled={busy}
          onClick={() => void run(exportJson)}
          size="block"
          type="button"
          variant="primary"
        >
          <Working busy={busy} icon={Download} />
          {busy ? 'Exporting…' : 'Export backup'}
        </Button>

        <div className={RULED}>
          <Head icon={RotateCcw}>restore</Head>
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
              if (chosen) void run(() => choose(chosen));
            }}
            ref={input}
            tabIndex={-1}
            type="file"
          />

          <Button
            disabled={busy}
            onClick={() => input.current?.click()}
            size="block"
            type="button"
            variant="secondary"
          >
            <Working busy={busy} icon={FileUp} />
            {busy ? 'Reading the file…' : 'Choose a backup file'}
          </Button>

          {pending !== null && (
            <RestoreConfirmation
              busy={busy}
              onCancel={reset}
              onConfirm={() => void run(confirmRestore)}
              pending={pending}
            />
          )}

          {refusal !== null && <RestoreRefusal refusal={refusal} />}
        </div>
      </section>

      <section className={WELL}>
        <Head icon={Table}>history as csv</Head>
        <p className="type-body-sm text-ink-2">
          One line per set, for a spreadsheet. Export only — nothing reads it back.
        </p>

        <Button
          disabled={busy}
          onClick={() => void run(exportCsv)}
          size="block"
          type="button"
          variant="secondary"
        >
          <Working busy={busy} icon={Upload} />
          {busy ? 'Exporting…' : 'Export history'}
        </Button>
      </section>

      {failure !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}

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
        <p className="type-body-sm text-ink-2">Reading your settings…</p>
      </section>
    );
  }

  const { defaultUnit, defaultRir, timerVibration, timerSound, keepScreenAwake } = settings;

  return (
    <section className={WELL}>
      <div className="flex flex-col gap-2">
        <label className="type-title flex items-center gap-2" htmlFor={unitId}>
          <Scale aria-hidden="true" className="text-ink" size={20} strokeWidth={2.5} />
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
        <label className="type-title flex items-center gap-2" htmlFor={rirId}>
          <Gauge aria-hidden="true" className="text-ink" size={20} strokeWidth={2.5} />
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
          RIR is <em>reps in reserve</em> — how many more you could have done when you
          stopped. RIR 2 means two left in the tank; RIR 0 means none.
        </p>
        <p className="type-body-sm text-ink-2">
          This is where the RIR readout opens for an exercise with no plan and no
          history. A planned exercise still opens on its own target.
        </p>
      </div>

      <div className={cn(RULED, 'gap-0')}>
        <Head className="pb-2" icon={Bell}>alerts</Head>
        <Toggle
          checked={timerVibration}
          hint="A short buzz when the rest is up."
          icon={Vibrate}
          label="Timer vibration"
          onChange={(on) => void setTimerVibration(on)}
        />
        <Toggle
          checked={timerSound}
          hint="A beep when the rest is up. Silent by default — the gym is not."
          icon={Volume2}
          label="Timer sound"
          onChange={(on) => void setTimerSound(on)}
        />
      </div>

      <div className={cn(RULED, 'gap-0')}>
        <Head className="pb-2" icon={Smartphone}>screen</Head>
        <Toggle
          checked={keepScreenAwake}
          hint="Keeps the screen on while a session is open, so it does not sleep between sets."
          icon={Sun}
          label="Keep screen awake"
          onChange={(on) => void setKeepScreenAwake(on)}
        />
      </div>

      <Durability />
    </section>
  );
}

/**
 * How long ago the last backup was taken, or that there has never been one.
 *
 * An export button with no memory is pressed once and forgotten; the age is
 * what makes it a habit. The wording gets blunter the older it gets, and the
 * "never" case is the one that matters most — it is the state every lifter
 * starts in and the one the app used to say nothing about.
 */
function BackupAge() {
  const settings = useSettings();
  // Read once, on mount. `Date.now()` in the body would be an impure render,
  // and the age of a backup does not need to tick — the screen is opened, read,
  // and left.
  const [now] = useState(Date.now);
  if (settings === undefined) return null;

  const at = settings.lastBackupAt ?? null;
  if (at === null) {
    return (
      <p className="type-body-sm text-missed-ink">
        You have never exported a backup. Nothing outside this phone holds your training.
      </p>
    );
  }

  const days = Math.floor((now - at) / 86_400_000);
  return (
    <p className={cn('type-body-sm', days >= 14 ? 'text-missed-ink' : 'text-ink-2')}>
      Last backup{' '}
      {days === 0 ? 'today' : days === 1 ? 'yesterday' : `${plural(days, 'day')} ago`} ·{' '}
      {longDate(formatLocalDate(new Date(at)))}
    </p>
  );
}

/**
 * Where a lifter's training actually stands on this device.
 *
 * The app has no account and no server, so this is the honest answer to "what
 * happens to my history" — and until now it was answered nowhere. The state is
 * read, not asked for: the request itself happens where the lifter has just
 * invested something (`ensurePersistentStorage`, called on import and on
 * finishing a session), because that is when a browser is willing to grant it.
 *
 * Installing is named separately because it is a different mechanism, not a
 * nicer version of the same one. WebKit deletes a site's IndexedDB after seven
 * days of Safari use without visiting it, and a home-screen app is the exemption
 * — no API call reaches that.
 */
function Durability() {
  const [durability, setDurability] = useState<StorageDurability | null>(null);
  const installed = isInstalled();

  useEffect(() => {
    let live = true;
    void readStorageDurability().then((state) => {
      if (live) setDurability(state);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className={cn(RULED, 'gap-2')}>
      <Head className="pb-1" icon={HardDrive}>this device</Head>
      <p className="type-body-sm text-ink-2">
        {durability === null
          ? 'Checking how this browser is holding your training…'
          : durability.state === 'persisted'
            ? 'Your training is stored persistently. This browser will not clear it to reclaim space.'
            : durability.state === 'unsupported'
              ? 'This browser does not say whether it will clear stored data to reclaim space. Keep a backup.'
              : 'This browser may clear your training to reclaim space, and it clears all of it at once. Keeping the app on your home screen and exporting a backup are what prevent that.'}
      </p>
      {!installed && (
        <p className="type-body-sm text-ink-2">
          You are running in a browser tab. Add TrainLog to your home screen —
          on iPhone, Share then <em>Add to Home Screen</em> — and it stops being a
          site the browser can clear after a week of not opening it.
        </p>
      )}
    </div>
  );
}

/**
 * The leading glyph of a control that is working, or the one it wears at rest.
 *
 * Every control on this screen reads or writes the whole database, so every one
 * of them can take long enough to look like nothing happened — and the spinner
 * is the only thing that separates "exporting" from "pressed and ignored".
 */
function Working({ busy, icon: Icon }: { readonly busy: boolean; readonly icon: LucideIcon }) {
  if (busy) {
    return (
      <LoaderCircle aria-hidden="true" className="animate-spin" size={20} strokeWidth={ICON_STROKE} />
    );
  }
  return <Icon aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />;
}

/** A section heading with the icon that names it at a glance. */
function Head({
  children,
  className,
  icon: Icon,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly icon: LucideIcon;
}) {
  return (
    <p className={cn(LABEL, 'flex items-center gap-1.5', className)}>
      <Icon aria-hidden="true" className="text-ink" size={16} strokeWidth={2.5} />
      {children}
    </p>
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
  icon: Icon,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly hint: string;
  readonly icon: LucideIcon;
  readonly checked: boolean;
  readonly onChange: (on: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <label className="type-title flex items-center gap-2" htmlFor={id}>
          <Icon aria-hidden="true" className="text-ink" size={20} strokeWidth={2.5} />
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
  busy,
  onCancel,
  onConfirm,
}: {
  readonly pending: Pending;
  /** The restore itself, in flight. It replaces every table, so it is never twice. */
  readonly busy: boolean;
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
          <Button disabled={busy} onClick={onCancel} size="compact" type="button" variant="quiet">
            Keep what I have
          </Button>
          <Button
            className="ml-auto"
            disabled={busy}
            onClick={onConfirm}
            size="compact"
            type="button"
            variant="danger"
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={18} strokeWidth={ICON_STROKE} />
            ) : (
              <Database aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
            )}
            {busy ? 'Restoring…' : 'Replace it all'}
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
