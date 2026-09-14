import { useState, FormEvent, UIEvent, RefObject } from 'react';
import { Task, TaskColor } from '../types';
import { TASK_COLOR_MAP, formatDateToISO, formatDateToFR } from '../utils/ganttUtils';
import { Trash2, Edit2, Plus } from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  onAddTask: (newTask: Partial<Task>) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  width: number;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

export default function TaskTable({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  width,
  scrollRef,
  onScroll,
}: TaskTableProps) {
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState<number>(1);
  const [newColor, setNewColor] = useState<TaskColor>('Bleu');

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault();
    const idTrimmed = newId.trim().toUpperCase();
    const nameTrimmed = newName.trim();
    if (!idTrimmed || !nameTrimmed) {
      alert('Veuillez renseigner un ID et un nom de tâche.');
      return;
    }
    if (tasks.some((t) => t.id === idTrimmed)) {
      alert(`L'ID '${idTrimmed}' existe déjà dans ce projet.`);
      return;
    }

    onAddTask({
      id: idTrimmed,
      name: nameTrimmed,
      dependsOn: null,
      offset: 0,
      duration: Math.max(1, newDuration || 1),
      color: newColor,
      manualStart: newDate || formatDateToISO(new Date()),
    });

    setNewId('');
    setNewName('');
    setNewDate('');
    setNewDuration(1);
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className="h-full bg-[#16304a] flex flex-col border-r border-[#3a75a3] shrink-0 z-10 select-none"
    >
      {/* Table Header */}
      <div className="h-10 bg-[#16304a] border-b border-[#3a75a3] flex items-center px-3 text-[11px] font-bold text-slate-200 uppercase tracking-wider sticky top-0 z-20 shrink-0">
        <div className="w-8 text-center text-slate-400">#</div>
        <div className="w-16">ID</div>
        <div className="flex-1 min-w-[120px]">Tâche</div>
        <div className="w-20 text-center">Début</div>
        <div className="w-14 text-center">Durée</div>
        <div className="w-16 text-center">Actions</div>
      </div>

      {/* Task Rows */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto divide-y divide-[#3a75a3]/40"
      >
        {tasks.map((task) => {
          const colorMeta = TASK_COLOR_MAP[task.color] || TASK_COLOR_MAP['Bleu'];
          const dateStr = task.computedStart
            ? formatDateToFR(task.computedStart)
            : task.manualStart
            ? formatDateToFR(task.manualStart)
            : '-';

          const dependencyLabel = task.dependsOn
            ? task.offset !== 0
              ? `${task.dependsOn} (${task.offset > 0 ? '+' : ''}${task.offset}j)`
              : task.dependsOn
            : 'Libre';

          return (
            <div
              key={task.id}
              className="h-10 flex items-center px-3 text-xs hover:bg-white/5 transition group cursor-pointer"
              onClick={() => onEditTask(task)}
              title="Cliquer pour modifier"
            >
              {/* Color pill */}
              <div className="w-8 flex items-center justify-center">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: colorMeta.hex }}
                />
              </div>

              {/* ID */}
              <div
                className="w-16 font-mono font-bold text-slate-300 truncate"
                title={`ID: ${task.id} (${dependencyLabel})`}
              >
                {task.id}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-[120px] truncate font-medium text-white group-hover:text-[#5bc0de] transition">
                {task.name}
              </div>

              {/* Date */}
              <div className="w-20 text-center text-[11px] text-slate-300 font-mono">
                {dateStr}
              </div>

              {/* Duration */}
              <div className="w-14 text-center text-[11px] text-slate-300">
                {task.duration} j
              </div>

              {/* Actions */}
              <div className="w-16 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTask(task);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Modifier la tâche"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Supprimer la tâche "${task.name}" (${task.id}) ?`)) {
                      onDeleteTask(task.id);
                    }
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                  title="Supprimer la tâche"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">
            Aucune tâche dans ce projet. Ajoutez-en une ci-dessous.
          </div>
        )}
      </div>

      {/* Quick Add Form at Bottom */}
      <form
        onSubmit={handleQuickAdd}
        className="p-2.5 bg-[#11263a] border-t border-[#3a75a3] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={newId}
          onChange={(e) => setNewId(e.target.value.toUpperCase())}
          placeholder="ID"
          maxLength={6}
          className="w-14 px-2 py-1.5 bg-black/25 border border-[#3a75a3] rounded text-xs text-white font-mono text-center focus:outline-none focus:border-[#5bc0de]"
          title="Identifiant court (ex: PPC, DEV1)"
          required
        />

        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nouvelle tâche..."
          className="flex-1 px-2.5 py-1.5 bg-black/25 border border-[#3a75a3] rounded text-xs text-white focus:outline-none focus:border-[#5bc0de]"
          required
        />

        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="w-28 px-2 py-1.5 bg-black/25 border border-[#3a75a3] rounded text-xs text-white focus:outline-none focus:border-[#5bc0de]"
          title="Date de début (optionnel, prendra J0 par défaut)"
        />

        <input
          type="number"
          min="1"
          value={newDuration}
          onChange={(e) => setNewDuration(parseInt(e.target.value) || 1)}
          className="w-14 px-2 py-1.5 bg-black/25 border border-[#3a75a3] rounded text-xs text-white text-center focus:outline-none focus:border-[#5bc0de]"
          title="Durée en jours"
          required
        />

        <button
          type="submit"
          className="p-1.5 bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 font-bold rounded cursor-pointer transition shadow flex items-center justify-center shrink-0"
          title="Ajouter la tâche au projet"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
