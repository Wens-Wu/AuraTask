import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Task } from "../types";
import TaskItem from "./TaskItem";

interface Props {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onReorder: (tasks: Task[]) => void;
}

function sameOrder(a: Task[], b: Task[]): boolean {
  return a.length === b.length && a.every((task, index) => task.id === b[index]?.id);
}

function moveTask(tasks: Task[], fromId: number, beforeId: number | null): Task[] {
  const fromIndex = tasks.findIndex((task) => task.id === fromId);
  if (fromIndex < 0) return tasks;

  const next = [...tasks];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return tasks;

  if (beforeId === null) {
    next.push(moved);
    return next;
  }

  const toIndex = next.findIndex((task) => task.id === beforeId);
  if (toIndex < 0) return tasks;
  next.splice(toIndex, 0, moved);
  return next;
}

export default function TaskList({ tasks, onToggle, onDelete, onEdit, onReorder }: Props) {
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const suppressNextEdit = useRef(false);

  useEffect(() => {
    if (draggingId === null) setOrderedTasks(tasks);
  }, [tasks, draggingId]);

  const clearPressTimer = () => {
    if (pressTimer.current === null) return;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const finishDrag = () => {
    if (draggingId !== null && !sameOrder(orderedTasks, tasks)) onReorder(orderedTasks);
    setDraggingId(null);
    window.setTimeout(() => {
      suppressNextEdit.current = false;
    }, 0);
  };

  useEffect(() => {
    const onPointerUp = () => {
      clearPressTimer();
      if (draggingId !== null) finishDrag();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearPressTimer();
        setOrderedTasks(tasks);
        setDraggingId(null);
        suppressNextEdit.current = false;
      }
    };

    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [draggingId, orderedTasks, tasks]);

  const previewMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingId === null) return;

    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(".task-card[data-task-id]"),
    ).filter((card) => Number(card.dataset.taskId) !== draggingId);

    let beforeId: number | null = null;
    for (const [index, card] of cards.entries()) {
      const rect = card.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        beforeId = Number(card.dataset.taskId);
        break;
      }
      if (event.clientY <= rect.bottom) {
        const nextCard = cards[index + 1];
        beforeId = nextCard ? Number(nextCard.dataset.taskId) : null;
        break;
      }
    }

    setOrderedTasks((current) => {
      const next = moveTask(current, draggingId, beforeId);
      return sameOrder(next, current) ? current : next;
    });
  };

  const startPress = (taskId: number, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      suppressNextEdit.current = true;
      setOrderedTasks(tasks);
      setDraggingId(taskId);
      pressTimer.current = null;
    }, 180);
  };

  return (
    <div
      className={`task-list ${draggingId !== null ? "reordering" : ""}`}
      onPointerMove={previewMove}
    >
      {orderedTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          dragging={draggingId === task.id}
          onTaskPointerDown={(event) => startPress(task.id, event)}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={(task) => {
            if (suppressNextEdit.current) return;
            onEdit(task);
          }}
        />
      ))}
    </div>
  );
}
