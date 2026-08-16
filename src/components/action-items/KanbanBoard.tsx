'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  type KeyboardCoordinateGetter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ListChecks, AlertTriangle, PauseCircle } from 'lucide-react';
import {
  BOARD_COLUMNS,
  boardColumnFor,
  isActionItemOverdue,
  lateText,
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_STYLES,
  ACTION_ITEM_STATUS_DOT,
  type ActionItemStatus,
  type BoardActionItem,
} from '@/lib/types/events';

/** What an empty column means, which differs by column. */
const COLUMN_EMPTY: Record<string, string> = {
  TODO: 'Nothing waiting to start',
  IN_PROGRESS: 'Nothing under way',
  COMPLETED: 'Nothing finished yet',
};

/**
 * Ordering inside a column.
 *
 * Blocked rides in To Do, and the server orders by status — which puts every
 * blocked item *below* every not-started one, burying the tasks that need
 * somebody to intervene. They go first here. Cancelled rides in Done and goes
 * last, so abandoned work does not sit above work that was actually finished.
 */
function orderWithin(
  column: ActionItemStatus,
  list: BoardActionItem[],
): BoardActionItem[] {
  if (column === 'TODO') {
    return [...list].sort(
      (a, b) => Number(b.status === 'BLOCKED') - Number(a.status === 'BLOCKED'),
    );
  }
  if (column === 'COMPLETED') {
    return [...list].sort(
      (a, b) =>
        Number(a.status === 'CANCELLED') - Number(b.status === 'CANCELLED'),
    );
  }
  return list;
}

/**
 * Arrow keys move a card a whole column, not 25 pixels.
 *
 * dnd-kit's default getter translates by a fixed pixel step, so crossing a
 * ~300px column took roughly twenty-six presses — while the live region told
 * the user "use the arrow keys to choose a column". The instruction was right
 * about the intent and wrong about the behaviour; this makes the behaviour
 * match. Left and right jump to the neighbouring column's centre; up and down
 * are left alone so a card can still be nudged within a column.
 */
const columnCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, droppableRects, droppableContainers, collisionRect } },
) => {
  if (!collisionRect || !active) return undefined;

  const isLeft = event.code === 'ArrowLeft';
  const isRight = event.code === 'ArrowRight';
  if (!isLeft && !isRight) return undefined;

  event.preventDefault();

  // Columns in the order they are drawn, so "next" means what it looks like.
  const columns = BOARD_COLUMNS.map((c) =>
    droppableContainers.get(c.status),
  ).filter(Boolean);

  const rects = columns.map((c) => ({
    id: c!.id,
    rect: droppableRects.get(c!.id),
  }));

  const currentIndex = rects.findIndex(
    (r) =>
      r.rect &&
      collisionRect.left + collisionRect.width / 2 >= r.rect.left &&
      collisionRect.left + collisionRect.width / 2 <= r.rect.right,
  );

  const nextIndex = currentIndex + (isRight ? 1 : -1);
  const next = rects[nextIndex];
  if (!next?.rect) return undefined;

  return {
    x: next.rect.left + next.rect.width / 2 - collisionRect.width / 2,
    y: collisionRect.top,
  };
};

function initials(name?: string | null) {
  if (!name) return '—';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function Card({
  item,
  canDrag,
  onOpen,
}: {
  item: BoardActionItem;
  canDrag: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !canDrag,
  });

  const late = isActionItemOverdue(item);
  const lateLabel = lateText(item);
  const blocked = item.status === 'BLOCKED';
  const owner = item.owner?.name ?? item.ownerName;

  return (
    <div
      ref={setNodeRef}
      style={{
        // dnd-kit's pointer and touch sensors need the browser to stop
        // claiming the gesture for scrolling, and only while the card is
        // actually draggable — otherwise a read-only board cannot be scrolled
        // with a finger at all.
        touchAction: canDrag ? 'none' : undefined,
        ...(transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : {}),
      }}
      // The 4px status stripe is gone: the card already states its status in
      // words below, and the column it sits in says the same thing a third
      // time. A thick coloured edge on a list item is decoration standing in
      // for information that is already there.
      className={`rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...listeners}
      {...attributes}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        {/* One property per line, in the order you read them: what it is, how
            it is classified, when it is due, whose it is. */}
        <div className="flex items-start gap-2">
          <ListChecks
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          />
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
            {item.title}
          </p>
        </div>

        <div className="mt-3 space-y-1.5">
          {/* Every card says its status now, not only the two that sit in a
              column other than their own. Blocked and Cancelled used to share
              one red tint, which read as though a cancelled item needed
              attention; they have their own colours here. */}
          {/* Blocked rides in the To Do column, so without a carrier of its own
              it read as an ordinary not-started task — the one status that
              means "somebody else has to move first" was the one the board hid.
              These sort to the top of the column too. */}
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
          >
            {blocked && <PauseCircle className="h-3 w-3" aria-hidden="true" />}
            {ACTION_ITEM_STATUS_LABELS[item.status]}
          </span>

          <span className="block">
            <span className="inline-block max-w-full truncate rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {item.minutes.event.title}
            </span>
          </span>
        </div>

        {/* alert, not destructive. This column is full of red To Do pills, so
            overdue in the same red was one red string among twenty-five — and
            globals.css defines the alert tokens for exactly this distinction:
            destructive is a control colour, alert is a state. The icon carries
            the meaning where colour cannot. */}
        <p
          className={`mt-3 flex items-center gap-1.5 text-[13px] ${
            late ? 'font-medium text-alert-fg' : 'text-muted-foreground'
          }`}
        >
          {late && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>
            {new Date(item.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {lateLabel ? ` · ${lateLabel}` : ''}
          </span>
        </p>

        <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
            {initials(owner)}
          </span>
          <span className="truncate">{owner ?? 'Unassigned'}</span>
        </p>

        {/* Who put this on you. Read from assignedBy, which is what the API
            returns — it was read from createdBy, which never arrives. */}
        {item.assignedBy?.name && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Assigned by {item.assignedBy.name}
          </p>
        )}
      </button>
    </div>
  );
}

function Column({
  status,
  label,
  emptyText,
  items,
  canDragItem,
  onOpen,
}: {
  status: ActionItemStatus;
  label: string;
  emptyText: string;
  items: BoardActionItem[];
  canDragItem: (item: BoardActionItem) => boolean;
  onOpen: (item: BoardActionItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      // No panel around the column: only the drop target is drawn, and only
      // while something is being dragged over it.
      className={`flex flex-col rounded-2xl p-1 transition-colors ${
        isOver ? 'bg-primary/5 ring-2 ring-primary/30' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${ACTION_ITEM_STATUS_STYLES[status]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${ACTION_ITEM_STATUS_DOT[status]}`}
          />
          {label}
        </span>
        <span
          className={`rounded-full px-2 text-[13px] font-medium ${ACTION_ITEM_STATUS_STYLES[status]}`}
        >
          {items.length}
        </span>
      </div>

      <div className="flex-1 space-y-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              item={item}
              canDrag={canDragItem(item)}
              onOpen={() => onOpen(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  items,
  canDragItem,
  onOpen,
  onMove,
}: {
  items: BoardActionItem[];
  canDragItem: (item: BoardActionItem) => boolean;
  onOpen: (item: BoardActionItem) => void;
  onMove: (item: BoardActionItem, status: ActionItemStatus) => void | Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // A small distance constraint keeps a click from registering as a drag, so
  // cards stay clickable for the detail modal.
  //
  // Touch gets its own sensor with a hold delay instead of a distance: on a
  // phone a short drag is how you scroll, so distance alone would have the
  // board stealing every swipe. Press and hold to pick a card up; the
  // tolerance lets a finger wobble during that hold without cancelling it.
  //
  // KeyboardSensor last, and it is not an extra: the cards already spread
  // dnd-kit's attributes, so each one announced itself as draggable and took a
  // tab stop while Space and Enter did nothing. Moving a task is the board's
  // only real interaction, which made this a 2.1.1 failure on the primary
  // action of the page. Space picks a card up, arrows move it between columns,
  // Space drops it, Escape cancels.
  const sensors = useSensors(
    // PointerSensor is restricted to a fine pointer. It was first in the list
    // and listens to pointerdown, which fires on touch too — so it claimed
    // every touch gesture before the TouchSensor's hold delay could apply, and
    // with touch-action: none on the card a finger on your own card could
    // neither scroll nor be released. The delay below is the whole point of
    // having a separate touch sensor; this is what lets it do its job.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id as ActionItemStatus | undefined;
    const item = items.find((i) => i.id === e.active.id);
    if (!target || !item) {
      setAnnouncement(
        item ? `${item.title} was left in place.` : 'Move cancelled.',
      );
      return;
    }
    if (boardColumnFor(item.status) === target) {
      setAnnouncement(`${item.title} was left in place.`);
      return;
    }
    const label =
      BOARD_COLUMNS.find((c) => c.status === target)?.label ?? String(target);
    // Announced after the move resolves, not before it. Saying "moved to Done"
    // and then firing the request meant a failed PATCH was announced as a
    // success, and nothing ever corrected it.
    setAnnouncement(`Moving ${item.title} to ${label}…`);
    void Promise.resolve(onMove(item, target))
      .then(() => setAnnouncement(`${item.title} moved to ${label}.`))
      .catch(() =>
        setAnnouncement(
          `${item.title} did not move. It is still in ${ACTION_ITEM_STATUS_LABELS[item.status]}.`,
        ),
      );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {BOARD_COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            emptyText={COLUMN_EMPTY[col.status]}
            items={orderWithin(
              col.status,
              items.filter((i) => boardColumnFor(i.status) === col.status),
            )}
            canDragItem={canDragItem}
            onOpen={onOpen}
          />
        ))}
      </div>
      {/* One region, always mounted, so a screen reader hears the pick-up and
          the outcome. Previously it mounted on drag start saying "Moving action
          item" and unmounted without ever saying where the card landed. */}
      <span className="sr-only" role="status" aria-live="polite">
        {activeId
          ? `${items.find((i) => i.id === activeId)?.title ?? 'Action item'} picked up. Left and right arrows move it between columns, space drops it, escape cancels.`
          : announcement}
      </span>
    </DndContext>
  );
}
