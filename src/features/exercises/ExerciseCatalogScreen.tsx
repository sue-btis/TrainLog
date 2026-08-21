/**
 * Exercises (§11.12) — every movement the app knows, to be browsed.
 *
 * The bundled catalog and the Exercises a lifter's routine files created, in
 * one list. They are disjoint by DEC-007 — the catalog never enters the table —
 * so they concatenate rather than merge, and a lifter looking for "front squat"
 * does not have to know which of the two it came from.
 *
 * This screen picks nothing and creates nothing. A row goes to that exercise's
 * history (§11.10), which already renders "No history yet" for a movement never
 * trained, so a catalog entry is a destination on the day it ships. Creating an
 * exercise stays out for the reason `ExercisePicker` states: it would mean
 * owning §26's name matching, and getting it wrong splits a history in two.
 *
 * Grouping and filtering are `groupExercises`, in the domain, because "a search
 * matches the way §26 matches" and "an uncategorized exercise is grouped, not
 * dropped" are rules worth testing without a browser.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATALOG, groupExercises } from '@/domain/catalog';
import type { Exercise } from '@/domain/types';
import { useUserExercises } from '@/features/data/queries';
import { plural } from '@/features/ui/format';
import { ICON_STROKE, LABEL, PRESS, ROW, ROW_LIST, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/** The Select's "no filter" value. Radix reserves the empty string. */
const ANY = 'any';

export function ExerciseCatalogScreen() {
  const user = useUserExercises();
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
            <SelectTrigger id="catalog-equipment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any equipment</SelectItem>
              {equipmentOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {groups.length === 0 ? (
        <section className={WELL}>
          <p className="type-title">No exercise matches “{query}”</p>
          <p className="type-body-sm text-ink-2">
            The catalog ships with the app and the rest arrive by importing a routine that
            names them. Nothing is created here.
          </p>
        </section>
      ) : (
        groups.map((group) => (
          <Card key={group.category}>
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="type-title">{group.category}</h2>
              <span className={LABEL}>{plural(group.exercises.length, 'exercise')}</span>
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
                    <span className="type-measure-sm text-ink-3">{exercise.equipment}</span>
                  )}
                </Link>
              ))}
            </div>
          </Card>
        ))
      )}
    </>
  );
}
