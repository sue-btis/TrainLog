import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExerciseId, ExerciseSessionId } from '@/domain/ids';
import type { ExerciseSession } from '@/domain/types';
import { exerciseStatusLabel } from '@/features/ui/format';
import { ICON_STROKE, WELL, chip } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

interface ExerciseReorderProps {
  readonly exerciseSessions: readonly ExerciseSession[];
  readonly names: ReadonlyMap<ExerciseId, string> | undefined;
  readonly onMove: (id: ExerciseSessionId, toPosition: number) => void;
  readonly onDone: () => void;
  readonly busy: boolean;
}

export function ExerciseReorder({
  exerciseSessions,
  names,
  onMove,
  onDone,
  busy,
}: ExerciseReorderProps) {
  const ordered = [...exerciseSessions].sort((a, b) => a.order - b.order);

  // A press-and-hold before a drag starts, so a flick down the list still
  // scrolls it. The tolerance is what a thumb drifts while holding still.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;

    const to = ordered.findIndex((it) => it.id === over.id);
    if (to === -1) return;
    onMove(active.id as ExerciseSessionId, to);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-headline">Reorder exercises</h2>

      <p className="type-body-sm text-ink-2">
        The session keeps the order you leave here. Drag by the handle, or use the
        arrows.
      </p>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={ordered.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {ordered.map((exerciseSession, index) => (
              <Row
                busy={busy}
                count={ordered.length}
                exerciseSession={exerciseSession}
                key={exerciseSession.id}
                name={names?.get(exerciseSession.exerciseId) ?? '…'}
                onMove={onMove}
                position={index + 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button onClick={onDone} size="block" type="button" variant="secondary">
        Back to training
      </Button>
    </section>
  );
}

function Row({
  exerciseSession,
  name,
  position,
  count,
  onMove,
  busy,
}: {
  readonly exerciseSession: ExerciseSession;
  readonly name: string;
  readonly position: number;
  readonly count: number;
  readonly onMove: (id: ExerciseSessionId, toPosition: number) => void;
  readonly busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: exerciseSession.id, disabled: busy });

  return (
    <article
      className={cn(WELL, 'py-3', isDragging && 'relative z-10 shadow-dome-lift')}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex items-center gap-3">
        <span className="type-measure-sm text-ink-3">{position}</span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="type-title">{name}</span>
          <div className="flex flex-wrap items-center gap-2">
            {exerciseSession.plannedExerciseId === null && (
              <span className={chip('neutral')}>Unplanned</span>
            )}
            {exerciseSession.status !== 'pending' && (
              <span className={chip(exerciseSession.status === 'skipped' ? 'missed' : 'actual')}>
                {exerciseStatusLabel(exerciseSession.status)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label={`Move ${name} up`}
            disabled={busy || position === 1}
            onClick={() => onMove(exerciseSession.id, position - 2)}
            size="icon"
            type="button"
            variant="nav"
          >
            <ChevronUp aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          </Button>
          <Button
            aria-label={`Move ${name} down`}
            disabled={busy || position === count}
            onClick={() => onMove(exerciseSession.id, position)}
            size="icon"
            type="button"
            variant="nav"
          >
            <ChevronDown aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          </Button>
          <button
            aria-label={`Reorder ${name}`}
            className="flex size-12 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3 active:cursor-grabbing"
            disabled={busy}
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </div>
    </article>
  );
}
