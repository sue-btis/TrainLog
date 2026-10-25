import { useId, useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MIN_PASSWORD_LENGTH } from '@/domain/backup';
import { ICON_STROKE, LABEL } from '@/features/ui/styles';

function passwordProblem(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== again) return 'The two passwords differ. Type the same one twice.';
  return null;
}

export function EncryptBackupForm({
  busy,
  onCancel,
  onSave,
}: {
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (password: string) => void;
}) {
  const passwordId = useId();
  const againId = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const problem = passwordProblem(password, again);

  return (
    <form
      className="arrive flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem === null) onSave(password);
      }}
    >
      <p className="type-body-sm text-ink-2">
        The password is not stored anywhere. Forget it and this backup cannot be opened —
        not by the app, not by anyone.
      </p>
      <label className="flex flex-col gap-1.5" htmlFor={passwordId}>
        <span className={LABEL}>password</span>
        <Input
          autoComplete="new-password"
          id={passwordId}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      <label className="flex flex-col gap-1.5" htmlFor={againId}>
        <span className={LABEL}>same password again</span>
        <Input
          autoComplete="new-password"
          id={againId}
          onChange={(event) => setAgain(event.target.value)}
          type="password"
          value={again}
        />
      </label>
      {tried && problem !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {problem}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="compact" type="button" variant="quiet">
          Cancel
        </Button>
        <Button className="whitespace-nowrap" disabled={busy} size="compact" type="submit" variant="primary">
          <Lock aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {busy ? 'Encrypting…' : 'Encrypt & save'}
        </Button>
      </div>
    </form>
  );
}

export function UnlockBackupForm({
  busy,
  fileName,
  problem,
  onCancel,
  onUnlock,
}: {
  readonly busy: boolean;
  readonly fileName: string;
  readonly problem: string | null;
  readonly onCancel: () => void;
  readonly onUnlock: (password: string) => void;
}) {
  const passwordId = useId();
  const [password, setPassword] = useState('');

  return (
    <form
      className="arrive flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onUnlock(password);
      }}
    >
      <p className="type-body-sm text-ink-2">
        {fileName} is encrypted. Type the password it was saved with.
      </p>
      <label className="flex flex-col gap-1.5" htmlFor={passwordId}>
        <span className={LABEL}>password</span>
        <Input
          autoComplete="current-password"
          id={passwordId}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      {problem !== null && (
        <p className="type-body-sm text-missed-ink" role="alert">
          {problem}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="compact" type="button" variant="quiet">
          Cancel
        </Button>
        <Button disabled={busy || password === ''} size="compact" type="submit" variant="primary">
          <KeyRound aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </div>
    </form>
  );
}
