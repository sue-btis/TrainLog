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
 * Settings (§32) will live here too. Only the data actions exist today.
 */

import { useRef, useState } from 'react';
import { Database, Download, FileUp, TriangleAlert, Upload } from 'lucide-react';
import { exportBackup, listSetsForCsv, restoreBackup, restoreSummary } from '@/db';
import type { RestoreSummary } from '@/db';
import { Button } from '@/components/ui/button';
import { formatPath, parseBackup, toCsv } from '@/domain/backup';
import type { BackupDocument, StructuralError } from '@/domain/backup';
import { formatLocalDate } from '@/domain/dates';
import { plural } from '@/features/ui/format';
import { ICON_STROKE, LABEL, RULED, WELL, alert } from '@/features/ui/styles';
import { download } from '@/features/more/download';

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
