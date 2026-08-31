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
  Weight,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  exportBackup,
  listSetsForCsv,
  restoreBackup,
  restoreSummary,
  setBodyweightKg,
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
import { Reading } from '@/features/ui/Reading';
import { ICON_STROKE, LABEL, RULED, WELL, alert } from '@/features/ui/styles';
import { download } from '@/features/settings/download';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import {
  isInstalled,
  readStorageDurability,
  type StorageDurability,
} from '@/pwa/persistence';
import { cn } from '@/lib/utils';

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
        <p className="arrive type-body-sm text-missed-ink" role="alert">
          {failure}
        </p>
      )}

      {done !== null && (
        <p aria-live="polite" className="arrive type-body-sm text-ink-2">
          {done}
        </p>
      )}
    </>
  );
}

const RIR_OPTIONS = ['none', '0', '1', '2', '3', '4'] as const;

function SettingsSection() {
  const settings = useSettings();
  const unitId = useId();
  const rirId = useId();
  const bodyweightId = useId();

  if (settings === undefined) {
    return <Reading>your settings</Reading>;
  }

  const { defaultUnit, defaultRir, bodyweightKg, timerVibration, timerSound, keepScreenAwake } =
    settings;

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

      <div className={cn(RULED, 'gap-2')}>
        <label className="type-title flex items-center gap-2" htmlFor={bodyweightId}>
          <Weight aria-hidden="true" className="text-ink" size={20} strokeWidth={2.5} />
          Bodyweight · kg
        </label>
        <Bodyweight id={bodyweightId} value={bodyweightKg} />
        <p className="type-body-sm text-ink-2">
          What pull-ups, dips and every other movement measured against you are read
          against. A session records what this said when it started, so changing it
          never rewrites a session already logged.
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

function Bodyweight({ id, value }: { readonly id: string; readonly value: number | null }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const text = draft.trim().replace(',', '.');
    setDraft(null);
    if (text === '') {
      if (value !== null) void setBodyweightKg(null);
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== value) {
      void setBodyweightKg(Math.round(parsed * 100) / 100);
    }
  }

  return (
    <input
      className="w-full rounded-md bg-transparent px-3 py-2 type-measure text-ink ring-1 ring-rule"
      id={id}
      inputMode="decimal"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      placeholder="Not set"
      value={draft ?? (value === null ? '' : String(value))}
    />
  );
}

function BackupAge() {
  const settings = useSettings();
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

function Working({ busy, icon: Icon }: { readonly busy: boolean; readonly icon: LucideIcon }) {
  if (busy) {
    return (
      <LoaderCircle aria-hidden="true" className="animate-spin" size={20} strokeWidth={ICON_STROKE} />
    );
  }
  return <Icon aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />;
}

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

function RestoreConfirmation({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  readonly pending: Pending;
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
