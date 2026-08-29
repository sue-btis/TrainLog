import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronLeft, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { correctExerciseMeasurement, createUserExercise, type CreatedExercise } from '@/db';
import {
  CATALOG,
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENT,
  groupExercises,
} from '@/domain/catalog';
import type { Measurement } from '@/domain/measurement';
import type { Exercise } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { SelectField, TextField } from '@/features/ui/fields';
import { ExerciseArt } from '@/features/exercises/ExerciseArt';
import { MuscleIcon } from '@/features/exercises/MuscleIcon';
import { MEASUREMENT_OPTIONS, plural } from '@/features/ui/format';
import {
  BUTTON_BASE,
  BUTTON_SIZE,
  BUTTON_VARIANT,
  ICON_STROKE,
  LABEL,
  PRESS,
  ROW,
  ROW_LIST,
  WELL,
} from '@/features/ui/styles';
import { useAsyncAction } from '@/features/ui/useAsyncAction';
import { cn } from '@/lib/utils';

/** The Select's "no filter" value. Radix reserves the empty string. */
const ANY = 'any';

const BANDS: readonly {
  readonly label: string | null;
  readonly categories: readonly string[] | null;
}[] = [
  { label: null, categories: ['full-body'] },
  { label: 'upper', categories: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core'] },
  { label: 'lower', categories: ['quadriceps', 'hamstrings', 'glutes', 'calves'] },
  { label: 'other', categories: null },
];

/** Every category a band names, so the last band can take what is left over. */
const NAMED = new Set(BANDS.flatMap(({ categories }) => categories ?? []));

export function ExerciseCatalogScreen() {
  const user = useUserExercises();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState(ANY);

  const all = useMemo<readonly Exercise[]>(() => [...(user ?? []), ...CATALOG], [user]);

  const mine = useMemo(() => new Set((user ?? []).map((exercise) => exercise.id)), [user]);

  const equipmentOptions = useMemo(
    () =>
      [...new Set(all.map((exercise) => exercise.equipment))]
        .filter((value): value is string => value !== null)
        .sort((a, b) => a.localeCompare(b)),
    [all],
  );

  const groups = useMemo(
    () => groupExercises(all, query, equipment === ANY ? null : equipment),
    [all, query, equipment],
  );

  const searching = query.trim() !== '';
  const opened = searching ? undefined : groups.find((g) => g.category === params.get('group'));
  const shown = opened ? [opened] : groups;

  return (
    <>
      <section className={WELL}>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>
            <Search aria-hidden="true" className="mr-1.5 inline" size={13} strokeWidth={ICON_STROKE} />
            search
          </span>
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Front squat, dip, row…"
            value={query}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="catalog-equipment">
            equipment
          </label>
          <Select onValueChange={setEquipment} value={equipment}>
            {/* The vocabulary is authored lowercase (`src/domain/catalog/data`);
                casing it here keeps the data one spelling and the screen one
                voice, rather than storing a display form beside the real one. */}
            <SelectTrigger className="capitalize" id="catalog-equipment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any equipment</SelectItem>
              {equipmentOptions.map((option) => (
                <SelectItem className="capitalize" key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <NewExercise />

      {groups.length === 0 ? (
        <section className={WELL}>
          <p className="type-title">
            {searching ? `No exercise matches “${query}”` : 'No exercise for that equipment'}
          </p>
          <p className="type-body-sm text-ink-2">
            The catalog ships with the app, the rest arrive by importing a routine that names
            them, and you can add one here.
          </p>
        </section>
      ) : !searching && opened === undefined ? (
        BANDS.map(({ label, categories }) => {
          const band = groups.filter((group) =>
            categories === null ? !NAMED.has(group.category) : categories.includes(group.category),
          );
          if (band.length === 0) return null;

          return (
            <section
              className={cn(
                'flex flex-col gap-3',
                label !== null && 'border-t border-rule pt-4',
              )}
              key={label ?? 'full'}
            >
              {label !== null && <h2 className={LABEL}>{label}</h2>}

              <div className="grid grid-cols-2 gap-3">
                {band.map((group) => (
                  <Link
                    className={cn(
                      'bg-card text-ink rounded-card shadow-dome hover:shadow-dome-lift',
                      'flex flex-col items-center gap-2 p-4 text-center',
                      PRESS,
                    )}
                    key={group.category}
                    to={`?group=${encodeURIComponent(group.category)}`}
                  >
                    <MuscleIcon category={group.category} className="h-16 text-planned-ink" />
                    <span className="type-title capitalize">{group.category}</span>
                    <span className={LABEL}>{plural(group.exercises.length, 'exercise')}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <>
          {opened !== undefined && (
            <Link
              className={cn(
                'inline-flex items-center gap-1 self-start type-body-sm text-planned-ink',
                PRESS,
              )}
              to="/exercises"
            >
              <ChevronLeft aria-hidden="true" size={16} strokeWidth={ICON_STROKE} />
              All muscle groups
            </Link>
          )}

          {shown.map((group) => (
            <Card key={group.category}>
              <header className="flex items-center gap-3">
                <MuscleIcon category={group.category} className="h-10 text-planned-ink" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 className="type-title capitalize">{group.category}</h2>
                  <span className={LABEL}>{plural(group.exercises.length, 'exercise')}</span>
                </div>
              </header>

              <div className={ROW_LIST}>
                {group.exercises.map((exercise) => (
                  <div className={ROW} key={exercise.id}>
                    <Link
                      className={cn('flex items-center gap-3', PRESS)}
                      to={`/exercises/${exercise.id}`}
                    >
                      <ExerciseArt className="size-11 text-planned-ink" id={exercise.id} reserve />
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="type-title">{exercise.name}</span>
                        {exercise.equipment !== null && (
                          <span className="type-measure-sm capitalize text-ink-3">
                            {exercise.equipment}
                          </span>
                        )}
                      </span>
                    </Link>
                    {mine.has(exercise.id) && <CorrectMeasurement exercise={exercise} />}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

const UNSPECIFIED = 'unspecified';

function NewExercise() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(UNSPECIFIED);
  const [equipment, setEquipment] = useState(UNSPECIFIED);
  const [measurement, setMeasurement] = useState<Measurement>('weight_reps');
  const [outcome, setOutcome] = useState<CreatedExercise | null>(null);
  const { busy, failure, run } = useAsyncAction();

  function close() {
    setOpen(false);
    setName('');
    setCategory(UNSPECIFIED);
    setEquipment(UNSPECIFIED);
    setMeasurement('weight_reps');
  }

  async function submit() {
    await run(async () => {
      const result = await createUserExercise({
        name,
        category: category === UNSPECIFIED ? null : category,
        equipment: equipment === UNSPECIFIED ? null : equipment,
        measurement,
      });
      setOutcome(result);
      if (result.created) close();
    });
  }

  if (!open) {
    return (
      <section className="flex flex-col gap-3">
        {outcome !== null && <Outcome onDismiss={() => setOutcome(null)} outcome={outcome} />}
        <Button
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          New exercise
        </Button>
      </section>
    );
  }

  return (
    <section className={WELL}>
      <p className="type-title">New exercise</p>

      <TextField
        autoFocus
        id="new-exercise-name"
        label="name"
        onCommit={setName}
        placeholder="Zercher good morning"
        value={name}
      />

      <SelectField
        id="new-exercise-category"
        label="category"
        onCommit={setCategory}
        optionClass="capitalize"
        options={vocabulary(CATALOG_CATEGORIES, 'No category')}
        value={category}
      />

      <SelectField
        id="new-exercise-equipment"
        label="equipment"
        onCommit={setEquipment}
        optionClass="capitalize"
        options={vocabulary(CATALOG_EQUIPMENT, 'No equipment')}
        value={equipment}
      />

      <SelectField
        id="new-exercise-measurement"
        label="measured as"
        onCommit={setMeasurement}
        optionClass="type-body-sm"
        options={MEASUREMENT_OPTIONS}
        value={measurement}
      />

      {outcome !== null && !outcome.created && (
        <Outcome onDismiss={() => setOutcome(null)} outcome={outcome} />
      )}
      {failure !== null && <p className={cn('type-body-sm', 'text-missed')}>{failure}</p>}

      <div className="flex items-center gap-2">
        <Button disabled={busy || name.trim() === ''} onClick={() => void submit()} type="button">
          Create
        </Button>
        <Button disabled={busy} onClick={close} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function vocabulary(
  options: readonly string[],
  none: string,
): readonly { readonly value: string; readonly label: string }[] {
  return [
    { value: UNSPECIFIED, label: none },
    ...options.map((option) => ({ value: option, label: option })),
  ];
}

function Outcome({
  onDismiss,
  outcome,
}: {
  readonly onDismiss: () => void;
  readonly outcome: CreatedExercise;
}) {
  return (
    <div className={WELL}>
      <p className="type-body-sm text-ink">
        {outcome.created
          ? `${outcome.exercise.name} is yours now.`
          : `${outcome.exercise.name} already exists, so nothing was created.`}
      </p>
      <div className="flex items-center gap-2">
        <Link
          className={cn(BUTTON_BASE, BUTTON_VARIANT.secondary, BUTTON_SIZE.compact)}
          onClick={onDismiss}
          to={`/exercises/${outcome.exercise.id}`}
        >
          Open it
        </Link>
        <Button onClick={onDismiss} size="compact" type="button" variant="ghost">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function CorrectMeasurement({ exercise }: { readonly exercise: Exercise }) {
  const { failure, run } = useAsyncAction();

  return (
    <>
      <SelectField
        id={`measurement-${exercise.id}`}
        label="measured as"
        onCommit={(next) => void run(() => correctExerciseMeasurement(exercise.id, next))}
        optionClass="type-body-sm"
        options={MEASUREMENT_OPTIONS}
        value={exercise.measurement}
      />
      {failure !== null && <p className={cn('type-body-sm', 'text-missed')}>{failure}</p>}
    </>
  );
}
