'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ListChecks } from 'lucide-react';
import {
  BOARD_COLUMNS,
  boardColumnFor,
  isActionItemOverdue,
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_STYLES,
  ACTION_ITEM_STATUS_DOT,
  ACTION_ITEM_STATUS_EDGE,
  type ActionItemStatus,
  type BoardActionItem,
} from '@/lib/types/events';

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

  const overdue = isActionItemOverdue(item);
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
      // The left edge carries the status, so a column can be scanned for the
      // odd one out without reading a badge on every card.
      className={`rounded-xl border border-l-4 border-border bg-card p-4 transition-shadow hover:shadow-sm ${
        ACTION_ITEM_STATUS_EDGE[item.status]
      } ${isDragging ? 'opacity-50 shadow-lg' : ''} ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
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
          <span
            className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
          >
            {ACTION_ITEM_STATUS_LABELS[item.status]}
          </span>

          <span className="block">
            <span className="inline-block max-w-full truncate rounded bg-[#f1f1ef] px-2 py-0.5 text-[11px] font-medium text-[#32302c]">
              {item.minutes.event.title}
            </span>
          </span>
        </div>

        <p
          className={`mt-3 text-[13px] ${
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
          }`}
        >
          {new Date(item.dueDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {overdue ? ' · Overdue' : ''}
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
          <p className="mt-1 truncate text-xs text-muted-foreground/80">
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
  items,
  canDragItem,
  onOpen,
}: {
  status: ActionItemStatus;
  label: string;
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
          <p className="py-6 text-center text-xs text-muted-foreground">Nothing here</p>
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
  onMove: (item: BoardActionItem, status: ActionItemStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // A small distance constraint keeps a click from registering as a drag, so
  // cards stay clickable for the detail modal.
  //
  // Touch gets its own sensor with a hold delay instead of a distance: on a
  // phone a short drag is how you scroll, so distance alone would have the
  // board stealing every swipe. Press and hold to pick a card up; the
  // tolerance lets a finger wobble during that hold without cancelling it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id as ActionItemStatus | undefined;
    if (!target) return;
    const item = items.find((i) => i.id === e.active.id);
    if (!item || boardColumnFor(item.status) === target) return;
    onMove(item, target);
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
            items={items.filter((i) => boardColumnFor(i.status) === col.status)}
            canDragItem={canDragItem}
            onOpen={onOpen}
          />
        ))}
      </div>
      {activeId && (
        <span className="sr-only" aria-live="polite">
          Moving action item
        </span>
      )}
    </DndContext>
  );
}
