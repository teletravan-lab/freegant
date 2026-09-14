import { useRef, useState, useEffect, useCallback, UIEvent, RefObject } from 'react';
import { Task } from '../types';
import {
  ComputedTimelineParams,
  generateTimelineHeaders,
  diffDays,
  addDays,
  formatDateToISO,
  TASK_COLOR_MAP,
} from '../utils/ganttUtils';

interface GanttChartProps {
  tasks: Task[];
  timelineParams: ComputedTimelineParams;
  dayWidth: number;
  onMoveTaskInCalendar?: (taskId: string, deltaDays: number) => void;
  onResizeTaskInCalendar?: (taskId: string, newDuration: number, deltaDuration: number) => void;
  onUpdateTask?: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

export default function GanttChart({
  tasks,
  timelineParams,
  dayWidth,
  onMoveTaskInCalendar,
  onResizeTaskInCalendar,
  onUpdateTask,
  onSelectTask,
  scrollRef,
  onScroll,
}: GanttChartProps) {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef || localContainerRef;
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    taskId: string;
    startX: number;
    initialOffsetDays: number;
    initialDuration: number;
    currentDeltaDays: number;
  } | null>(null);

  const { quarters, months } = generateTimelineHeaders(timelineParams);
  const safeDayWidth = typeof dayWidth === 'number' && !isNaN(dayWidth) && dayWidth > 0 ? dayWidth : 30;
  const totalWidth = Math.max(Math.ceil((timelineParams.totalDays || 30) * safeDayWidth) + 160, 50);

  // Handle Drag / Resize End
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    const task = tasks.find((t) => t.id === dragState.taskId);
    if (task && dragState.currentDeltaDays !== 0) {
      if (dragState.type === 'move') {
        const newOffsetDays = Math.max(0, dragState.initialOffsetDays + dragState.currentDeltaDays);
        const effectiveDeltaDays = newOffsetDays - dragState.initialOffsetDays;
        if (effectiveDeltaDays !== 0) {
          if (onMoveTaskInCalendar) {
            onMoveTaskInCalendar(task.id, effectiveDeltaDays);
          } else if (onUpdateTask) {
            const newStartDate = addDays(timelineParams.start, newOffsetDays);
            onUpdateTask({
              ...task,
              manualStart: formatDateToISO(newStartDate),
              dependsOn: null,
              offset: 0,
            });
          }
        }
      } else if (dragState.type === 'resize') {
        const newDuration = Math.max(1, dragState.initialDuration + dragState.currentDeltaDays);
        const deltaDuration = newDuration - dragState.initialDuration;
        if (deltaDuration !== 0) {
          if (onResizeTaskInCalendar) {
            onResizeTaskInCalendar(task.id, newDuration, deltaDuration);
          } else if (onUpdateTask) {
            onUpdateTask({
              ...task,
              duration: newDuration,
            });
          }
        }
      }
    }

    setDragState(null);
  }, [dragState, tasks, timelineParams, onMoveTaskInCalendar, onResizeTaskInCalendar, onUpdateTask]);

  // Handle Drag / Resize Move
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const deltaPx = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaPx / dayWidth);
      if (deltaDays !== dragState.currentDeltaDays) {
        setDragState((prev) => (prev ? { ...prev, currentDeltaDays: deltaDays } : null));
      }
    },
    [dragState, dayWidth]
  );

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 h-full overflow-auto bg-[#16304a] relative select-none"
    >
      <div style={{ width: `${totalWidth}px` }} className="relative min-h-full min-w-full">
        {/* Sticky Timeline Header */}
        <div
          style={{ width: `${totalWidth}px` }}
          className="sticky top-0 z-20 bg-[#16304a] border-b border-[#3a75a3] shadow-md min-w-full"
        >
          {/* Quarters Row */}
          <div className="flex h-5 border-b border-[#3a75a3]/50 w-full">
            {quarters.map((q, idx) => {
              const qWidth = q.days * safeDayWidth;
              return (
                <div
                  key={`q-${idx}`}
                  style={{ width: `${qWidth}px` }}
                  className="h-full shrink-0 border-r border-[#3a75a3]/50 text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-center overflow-hidden whitespace-nowrap bg-[#11263a]/80"
                >
                  {qWidth > 35 ? q.name : ''}
                </div>
              );
            })}
          </div>

          {/* Months Row */}
          <div className="flex h-5 w-full">
            {months.map((m, idx) => {
              const widthPx = m.days * safeDayWidth;
              const showText = widthPx > 28;
              return (
                <div
                  key={`m-${idx}`}
                  style={{ width: `${widthPx}px` }}
                  className="h-full shrink-0 border-r border-[#3a75a3]/50 text-[11px] font-semibold text-[#5bc0de] flex items-center justify-center overflow-hidden whitespace-nowrap bg-[#16304a]"
                >
                  {showText ? m.name : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid Background */}
        <div
          className="absolute inset-0 top-10 pointer-events-none"
          style={{
            backgroundImage:
              safeDayWidth >= 6
                ? `linear-gradient(to right, rgba(58, 117, 163, 0.2) 1px, transparent 1px)`
                : 'none',
            backgroundSize: `${safeDayWidth}px 100%`,
          }}
        />

        {/* Chart Rows */}
        <div className="relative pt-0">
          {tasks.map((task) => {
            const isBeingDragged = dragState?.taskId === task.id;
            const initialOffset = task.computedStart
              ? diffDays(timelineParams.start, task.computedStart)
              : 0;

            let currentOffsetDays = isNaN(initialOffset) ? 0 : initialOffset;
            let currentDuration = Math.max(1, Number(task.duration) || 1);

            if (isBeingDragged && dragState) {
              if (dragState.type === 'move') {
                currentOffsetDays = Math.max(0, dragState.initialOffsetDays + dragState.currentDeltaDays);
              } else if (dragState.type === 'resize') {
                currentDuration = Math.max(1, dragState.initialDuration + dragState.currentDeltaDays);
              }
            }

            const barLeft = Math.max(0, currentOffsetDays * safeDayWidth);
            const barWidth = Math.max(Math.round(currentDuration * safeDayWidth), 6);
            const colorMeta = TASK_COLOR_MAP[task.color] || TASK_COLOR_MAP['Bleu'];

            // Duration display rules:
            // 1. If task lasts 1 day: do not display duration text anywhere.
            // 2. If task lasts > 1 day:
            //    - If bar is wide enough (>= 42px), display duration inside the bar.
            //    - If bar is not wide enough (< 42px), display duration to the left of the bar.
            // 3. Always maintain an identical gap (GAP = 10px) with the box.
            const isSingleDay = currentDuration === 1;
            const canFitInside = !isSingleDay && barWidth >= 42;
            const showDurationLeft = !isSingleDay && !canFitInside;
            const GAP = 10;

            return (
              <div
                key={task.id}
                className="h-10 border-b border-[#3a75a3]/30 relative hover:bg-white/5 transition-colors flex items-center"
              >
                {/* Duration text on the LEFT of the bar if duration > 1 and bar is too narrow */}
                {showDurationLeft && (
                  <div
                    style={{ left: `${barLeft - GAP}px` }}
                    className="absolute -translate-x-full text-xs font-semibold text-slate-300 pointer-events-none select-none whitespace-nowrap"
                  >
                    {currentDuration} j
                  </div>
                )}

                {/* Gantt Bar */}
                <div
                  style={{
                    left: `${barLeft}px`,
                    width: `${barWidth}px`,
                    backgroundColor: colorMeta.hex,
                  }}
                  className={`absolute h-[24px] rounded shadow-md flex items-center justify-center text-xs font-bold text-slate-950 cursor-grab active:cursor-grabbing transition-shadow select-none group z-10 box-border overflow-hidden ${
                    isBeingDragged ? 'ring-2 ring-white shadow-xl opacity-90' : 'hover:brightness-105'
                  }`}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                    setDragState({
                      type: 'move',
                      taskId: task.id,
                      startX: e.clientX,
                      initialOffsetDays: currentOffsetDays,
                      initialDuration: currentDuration,
                      currentDeltaDays: 0,
                    });
                  }}
                  onDoubleClick={() => onSelectTask(task)}
                >
                  {/* Inner Duration Text (only if duration > 1 and fits cleanly inside) */}
                  {canFitInside && (
                    <span className="truncate select-none pointer-events-none px-1">
                      {currentDuration} j
                    </span>
                  )}

                  {/* Right Resize Handle */}
                  <div
                    className={`resize-handle absolute right-0 top-0 bottom-0 ${
                      barWidth > 20 ? 'w-2.5 hover:bg-black/25' : 'w-full'
                    } cursor-ew-resize rounded-r transition flex items-center justify-center`}
                    title="Glisser pour modifier la durée"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({
                        type: 'resize',
                        taskId: task.id,
                        startX: e.clientX,
                        initialOffsetDays: currentOffsetDays,
                        initialDuration: currentDuration,
                        currentDeltaDays: 0,
                      });
                    }}
                  >
                    {barWidth >= 28 && (
                      <div className="w-0.5 h-3 bg-black/30 rounded-full pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* External Task Label (always placed at barLeft + barWidth + GAP) */}
                <div
                  style={{ left: `${barLeft + barWidth + GAP}px` }}
                  className="absolute text-xs font-medium text-slate-200 truncate pointer-events-none select-none max-w-sm whitespace-nowrap"
                >
                  {task.name}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-300">Aucune tâche dans ce projet</p>
              <p className="text-xs text-slate-400 mt-1">
                Ajoutez votre première tâche depuis le tableau à gauche pour voir apparaître la frise de Gantt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
