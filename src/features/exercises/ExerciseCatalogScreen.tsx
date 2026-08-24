/**
 * Exercises (§11.12) — every movement the app knows, to be browsed.
 *
 * The bundled catalog and the Exercises a lifter's routine files created, in
 * one list. They are disjoint by DEC-007 — the catalog never enters the table —
 * so they concatenate rather than merge, and a lifter looking for "front squat"
 * does not have to know which of the two it came from.
 *
 * Two hundred movements in one scroll is a wall, so the screen opens on the
 * muscle groups themselves — a figure, a name, a count — and one tap opens the
 * group. Typing skips the index: a search is already a destination, and making
 * it name a body part first would be one tap for nothing.
 *
 * The open group lives in the query string rather than in state, so back leaves
 * the group before it leaves the screen, and a group can be linked to.
 *
 * A row goes to that exercise's history (§11.10), which already renders "No
 * history yet" for a movement never trained, so a catalog entry is a
 * destination on the day it ships.
 *
 * The screen creates, and picks nothing. Creating means owning §26's name
 * matching — get it wrong and a lifter's history splits in two — so it does not
 * own it: `findExerciseByName` in `@/domain/catalog` is the one matcher, and
 * the import pipeline asks it the same question (REQ-102). A name the app
 * already knows binds to the incumbent and says so, rather than minting a
 * second movement (REQ-101).
 *
 * Grouping and filtering are `groupExercises`, in the domain, because "a search
 * matches the way §26 matches" and "an uncategorized exercise is grouped, not
 * dropped" are rules worth testing without a browser.
 */

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
import { createUserExercise, type CreatedExercise } from '@/db';
import {
  CATALOG,
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENT,
  groupExercises,
} from '@/domain/catalog';
import type { Exercise } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { MuscleIcon } from '@/features/exercises/MuscleIcon';
import { plural } from '@/features/ui/format';
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

/**
 * The bands the index is read in: what trains everything, then the half of the
 * body above the hips, then the half below. It is the split a lifter already
 * thinks in — upper day, lower day — so twelve cards become three short reads.
 *
 * A category the catalog does not name — one a routine file invented, or
 * `uncategorized` — is not forced into a half it may not belong to; it falls to
 * the last band, which says only "other".
 */
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

  // Taken from every exercise, never from the filtered ones: an option list
  // that shrinks as you use it leaves no way back to the value you just left.
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
  // A group that the current filters emptied is no group at all: fall back to
  // the index rather than drawing a heading over nothing.
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
                // A hairline and a word, not a card: the bands order the index,
                // they are not objects in it.
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
                  <Link
                    className={cn(ROW, PRESS)}
                    key={exercise.id}
                    to={`/exercises/${exercise.id}`}
                  >
                    <span className="type-title">{exercise.name}</span>
                    {exercise.equipment !== null && (
                      <span className="type-measure-sm capitalize text-ink-3">
                        {exercise.equipment}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

/** The Select value standing for "no category" / "no equipment" (REQ-105). */
const UNSPECIFIED = 'unspecified';

/**
 * Naming a movement the app does not ship with (REQ-100, REQ-101, REQ-105).
 *
 * The screen's own list refreshes itself — `useUserExercises` is a live query —
 * so a created Exercise appears under its group with nothing to reload.
 *
 * A collision is the interesting case. The import path reuses an incumbent
 * silently, which is right when a *file* is describing a movement; here a lifter
 * has deliberately pressed Create, and reporting success while writing nothing
 * would make the screen lie. So the outcome says which Exercise already carries
 * the name and offers it — the guard's behaviour is unchanged, only its silence
 * is (§26, DEC-Q7).
 *
 * Category and equipment are closed choices over the catalog's own vocabulary,
 * never free text: a routine file can already write anything into `category`,
 * and PRD §39 item 8 needs that vocabulary clean to count muscle volume at all.
 */
function NewExercise() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(UNSPECIFIED);
  const [equipment, setEquipment] = useState(UNSPECIFIED);
  const [outcome, setOutcome] = useState<CreatedExercise | null>(null);
  const { busy, failure, run } = useAsyncAction();

  function close() {
    setOpen(false);
    setName('');
    setCategory(UNSPECIFIED);
    setEquipment(UNSPECIFIED);
  }

  async function submit() {
    await run(async () => {
      const result = await createUserExercise({
        name,
        category: category === UNSPECIFIED ? null : category,
        equipment: equipment === UNSPECIFIED ? null : equipment,
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

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>name</span>
        <Input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          placeholder="Zercher good morning"
          value={name}
        />
      </label>

      <VocabularyField
        id="new-exercise-category"
        label="category"
        none="No category"
        onChange={setCategory}
        options={CATALOG_CATEGORIES}
        value={category}
      />

      <VocabularyField
        id="new-exercise-equipment"
        label="equipment"
        none="No equipment"
        onChange={setEquipment}
        options={CATALOG_EQUIPMENT}
        value={equipment}
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

/** One closed-vocabulary Select, with an explicit "none" that means `null`. */
function VocabularyField({
  id,
  label,
  none,
  onChange,
  options,
  value,
}: {
  readonly id: string;
  readonly label: string;
  readonly none: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="capitalize" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSPECIFIED}>{none}</SelectItem>
          {options.map((option) => (
            <SelectItem className="capitalize" key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * What just happened, and the way to the Exercise it happened to.
 *
 * A collision is not an error — nothing went wrong, the movement was already
 * known — so it reads as a statement with a destination rather than as a
 * failure (REQ-101).
 */
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
