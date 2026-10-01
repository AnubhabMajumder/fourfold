// Dragging a Task to a position in a list: the Task List or one of the Matrix's Quadrants. Built on pointer
// events so that mouse and touch share one path. A mouse drag starts once the pointer moves; a touch drag starts
// only after a press-and-hold, so that a quick swipe still scrolls. While dragging, the Task follows the pointer as
// a floating card, and a drop line shows where it will land in the list under the pointer, if that list accepts it.
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

/** How long a touch must be held still before it starts a drag. */
const HOLD_MS = 350;
/** How far (px) a mouse moves before a press becomes a drag, and a touch moves before it becomes a scroll. */
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;

/** Where a dropped Task would land: the list, and its index there once it has moved. */
type DropTarget = { list: string; index: number };

type Dragging = {
  id: string;
  text: string;
  /** The floating card's box, in viewport coordinates. */
  left: number;
  top: number;
  width: number;
  /** Where it would land, with the drop line's offset from the top of that list; null over no list. */
  over: (DropTarget & { lineY: number }) | null;
};

/** A list registered to take drops: its element, whether it accepts a Task, and what to do with one dropped in it. */
type Registered = { el: HTMLElement; accepts: (id: string) => boolean; onDrop: (id: string, index: number) => void };

class DragController {
  private dragging: Dragging | null = null;
  private listeners = new Set<() => void>();
  private lists = new Map<string, Registered>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getDragging = () => this.dragging;

  private set(dragging: Dragging | null) {
    this.dragging = dragging;
    for (const l of this.listeners) l();
  }

  register(list: string, entry: Registered) {
    this.lists.set(list, entry);
    return () => {
      if (this.lists.get(list) === entry) this.lists.delete(list);
    };
  }

  /** The list under the pointer, and where in it a Task dropped there would land. */
  private locate(x: number, y: number, id: string): Dragging['over'] {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-list]');
    const list = el?.dataset.dropList;
    const entry = list === undefined ? undefined : this.lists.get(list);
    // A list that doesn't accept the Task shows no drop line, and dropping there snaps it back.
    if (!el || !list || entry?.el !== el || !entry.accepts(id)) return null;
    // The boxes of the other Tasks in the list: the dragged one isn't counted, as it's about to leave its place.
    const taskBoxes = [...el.querySelectorAll<HTMLElement>('[data-drag-id]')]
      .filter((task) => task.dataset.dragId !== id)
      .map((task) => task.getBoundingClientRect());
    let index = taskBoxes.findIndex((r) => y < r.top + r.height / 2);
    if (index < 0) index = taskBoxes.length;
    const [prev, next] = [taskBoxes[index - 1], taskBoxes[index]];
    const y0 = prev && next ? (prev.bottom + next.top) / 2 : prev ? prev.bottom : next ? next.top : el.getBoundingClientRect().top;
    return { list, index, lineY: y0 - el.getBoundingClientRect().top };
  }

  /** Watches a press on a draggable Task, and runs the drag if it becomes one. */
  press(e: ReactPointerEvent<HTMLElement>, id: string, text: string) {
    if (this.dragging || !e.isPrimary || e.button !== 0) return;
    if ((e.target as Element).closest('button, input, label')) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const touch = e.pointerType === 'touch';
    const start = { x: e.clientX, y: e.clientY };
    let grip: { dx: number; dy: number; width: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const moveTo = (x: number, y: number) => {
      if (!grip) return;
      this.set({ id, text, left: x - grip.dx, top: y - grip.dy, width: grip.width, over: this.locate(x, y, id) });
    };
    const begin = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      grip = { dx: start.x - r.left, dy: start.y - r.top, width: r.width };
      window.getSelection()?.removeAllRanges();
      document.body.classList.add('dragging');
      moveTo(x, y);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!grip) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= (touch ? TOUCH_SLOP : MOUSE_SLOP)) return;
        // A touch that moves before it has been held is a swipe: leave it to the browser to scroll.
        if (touch) return end();
        begin(ev.clientX, ev.clientY);
      }
      moveTo(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const over = this.dragging?.over;
      end();
      if (over) this.lists.get(over.list)?.onDrop(id, over.index);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) end();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') end();
    };
    // Once a touch drag has started, its moves drag the Task instead of scrolling the page.
    const onTouchMove = (ev: TouchEvent) => {
      if (grip) ev.preventDefault();
    };
    // A long press would otherwise open the browser's context menu.
    const onContextMenu = (ev: Event) => ev.preventDefault();

    const end = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('contextmenu', onContextMenu);
      document.body.classList.remove('dragging');
      if (grip) this.set(null);
      grip = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    if (touch) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('contextmenu', onContextMenu);
      timer = setTimeout(() => begin(start.x, start.y), HOLD_MS);
    }
  }
}

const DragContext = createContext<DragController | null>(null);

function useDragging<T>(select: (d: Dragging | null) => T): T {
  const drag = useContext(DragContext)!;
  return useSyncExternalStore(drag.subscribe, () => select(drag.getDragging()));
}

/** Makes drag and drop available below it, and draws the floating card of the Task being dragged. */
export function DragProvider({ children }: { children: ReactNode }) {
  const [drag] = useState(() => new DragController());
  return (
    <DragContext value={drag}>
      {children}
      <FloatingCard />
    </DragContext>
  );
}

function FloatingCard() {
  const dragging = useDragging((d) => d);
  if (!dragging) return null;
  return (
    <div className="floating-card" aria-hidden="true" style={{ left: dragging.left, top: dragging.top, width: dragging.width }}>
      {dragging.text}
    </div>
  );
}

/** Props for a draggable Task's element, and whether it's the one being dragged. */
export function useDraggable(id: string, text: string) {
  const drag = useContext(DragContext)!;
  const isDragging = useDragging((d) => d?.id === id);
  return {
    isDragging,
    props: { 'data-drag-id': id, onPointerDown: (e: ReactPointerEvent<HTMLElement>) => drag.press(e, id, text) },
  };
}

/** A list that draggable Tasks it `accepts` can be dropped into, at a position shown by the drop line. */
export function DropList({
  id,
  accepts,
  onDrop,
  children,
}: {
  id: string;
  accepts: (taskId: string) => boolean;
  onDrop: (taskId: string, index: number) => void;
  children: ReactNode;
}) {
  const drag = useContext(DragContext)!;
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ accepts, onDrop });
  handlers.current = { accepts, onDrop };
  useLayoutEffect(
    () =>
      drag.register(id, {
        el: ref.current!,
        accepts: (taskId) => handlers.current.accepts(taskId),
        onDrop: (taskId, index) => handlers.current.onDrop(taskId, index),
      }),
    [drag, id],
  );
  const lineY = useDragging((d) => (d?.over?.list === id ? d.over.lineY : null));
  return (
    <div ref={ref} className="drop-list" data-drop-list={id}>
      {children}
      {lineY !== null && <div className="drop-line" aria-hidden="true" style={{ top: lineY }} />}
    </div>
  );
}
