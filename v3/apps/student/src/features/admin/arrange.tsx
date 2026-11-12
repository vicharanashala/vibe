import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Drag-and-drop ordering for Studio's outlines (lessons in a section, sections
 * in a module, modules in a course). One `SortableList` per parent, so a drag
 * never leaves its parent — the backend's move endpoints keep the parent too.
 */

/** Where a dropped item goes, relative to its new neighbour. */
export type Position = { beforeId: string } | { afterId: string };

/**
 * Turns a move from index `from` to index `to` into a position next to the
 * item currently at `to`: after it when moving down, before it when moving up.
 * Null when nothing moves.
 */
export function positionFor(ids: string[], from: number, to: number): Position | null {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return null;
  return to > from ? { afterId: ids[to] } : { beforeId: ids[to] };
}

/** The new order of `items` once the item at `from` is moved to `to`. */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  return arrayMove(items, from, to);
}

/**
 * The move up / down by one place, for the row menu (and keyboard users who
 * prefer it to dragging). Null at the ends.
 */
export function stepPosition(ids: string[], index: number, step: -1 | 1): Position | null {
  return positionFor(ids, index, index + step);
}

/**
 * Keeps a pointer or touch drag inside its list. Not for keyboard drags: there
 * the clamp stops the keyboard sensor from reaching the neighbouring row.
 */
const restrictPointerToParent: Modifier = (args) =>
  args.activatorEvent instanceof KeyboardEvent ? args.transform : restrictToParentElement(args);

export function SortableList<T>({
  items,
  getId,
  getLabel,
  onMove,
  children,
}: {
  items: T[];
  getId: (item: T) => string;
  /** Spoken in screen-reader announcements, e.g. the lesson's name. */
  getLabel: (item: T) => string;
  /** A drop that changed the order: the moved id, where it goes, and the new order. */
  onMove: (id: string, position: Position, next: T[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const label = (id: unknown) => {
    const item = items.find((i) => getId(i) === id);
    return item ? getLabel(item) : 'Item';
  };
  const place = (id: unknown) => `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}. It is in ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is over ${place(over.id)}.` : `${label(active.id)} is no longer over a place.`),
    onDragEnd: ({ active, over }) => (over ? `${label(active.id)} was dropped in ${place(over.id)}.` : `${label(active.id)} was dropped.`),
    onDragCancel: ({ active }) => `Moving ${label(active.id)} was cancelled.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const position = positionFor(ids, from, to);
    if (position) onMove(String(active.id), position, reorder(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictPointerToParent]}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'To move it, press Space or Enter, use the arrow keys to choose a place, then press Space or Enter to drop it. Press Escape to cancel.',
        },
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** A sortable row: ref and style for the row, props for its drag handle. `disabled` rows can't be picked up. */
export function useSortableRow(id: string, disabled = false) {
  const reduce = useReducedMotion();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging, isOver } = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: reduce ? undefined : transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };
  return { setNodeRef, style, isDragging, isOver, handle: { ref: setActivatorNodeRef, ...attributes, ...listeners } };
}

/** The grip a row is dragged by (also focusable, for keyboard moves). */
export function DragHandle({
  name,
  handle,
  className,
  disabledReason,
}: {
  name: string;
  handle: ReturnType<typeof useSortableRow>['handle'];
  className?: string;
  /** Why this row can't be moved right now; shown as the handle's tooltip and the handle is disabled. */
  disabledReason?: string;
}) {
  const { ref, ...props } = handle;
  if (disabledReason)
    return (
      <span title={disabledReason} className={cn('inline-flex shrink-0', className)}>
        <Button variant="ghost" size="icon-xs" disabled aria-label={`Drag to reorder ${name} (${disabledReason})`} className="text-muted-foreground/50">
          <GripVerticalIcon aria-hidden />
        </Button>
      </span>
    );
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-xs"
      aria-label={`Drag to reorder ${name}`}
      className={cn('shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing', className)}
      {...props}
    >
      <GripVerticalIcon aria-hidden />
    </Button>
  );
}

/** The backend only reorders sections and modules when the course's linear progression is off. */
export const LINEAR_REORDER_HINT = 'Turn off linear progression in the course settings to reorder sections and modules';

/** Classes for a row while it's being dragged: lifted, with an outline where it will land. */
export function draggingClass(isDragging: boolean) {
  return isDragging ? 'bg-card shadow-lg ring-2 ring-primary/40 rounded-lg' : undefined;
}
