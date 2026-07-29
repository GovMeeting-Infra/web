'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CircleDashed, CircleDot, CheckCircle2, Ban, AlertCircle } from 'lucide-react';
import {
  BOARD_COLUMNS,
  boardColumnFor,
  isActionItemOverdue,
  ACTION_ITEM_STATUS_LABELS,
  POINT_LABELS,
  POINT_STYLES,
  type ActionItemStatus,
  type BoardActionItem,
} from '@/lib/types/events';

const STATUS_ICON: Record<ActionItemStatus, React.ReactNode> = {
  TODO: <CircleDashed className="h-3.5 w-3.5" />,
  IN_PROGRESS: <CircleDot className="h-3.5 w-3.5" />,
  BLOCKED: <AlertCircle className="h-3.5 w-3.5" />,
  COMPLETED: <CheckCircle2 className="h-3.5 w-3.5" />,
  CANCELLED: <Ban className="h-3.5 w-3.5" />,
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

  const overdue = isActionItemOverdue(item);
  const owner = item.owner?.name ?? item.ownerName;
  // BLOCKED/CANCELLED sit in a column that isn't literally their status, so
  // label them explicitly rather than letting the column imply it.
  const offColumn = item.status === 'BLOCKED' || item.status === 'CANCELLED';

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={`rounded-xl border border-border bg-card p-3 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            {STATUS_ICON[item.status]}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {item.title}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${POINT_STYLES[item.point]}`}
          >
            {POINT_LABELS[item.point]}
          </span>
          {offColumn && (
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ACTION_ITEM_STATUS_LABELS[item.status]}
            </span>
          )}
        </div>

        <p className="mt-2 truncate text-xs text-muted-foreground">
          {item.minutes.event.title}
        </p>

        {/* Who put this on you. Read from assignedBy, which is what the API
            returns — it was read from createdBy, which never arrives. */}
        {item.assignedBy?.name && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Assigned by {item.assignedBy.name}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
              {initials(owner)}
            </span>
            <span className="truncate">{owner ?? 'Unassigned'}</span>
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              overdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {overdue
              ? 'Overdue'
              : new Date(item.dueDate).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}
          </span>
        </div>
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
      className={`flex flex-col rounded-[1.5rem] border p-4 transition-colors ${
        isOver ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="flex-1 space-y-2">
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
