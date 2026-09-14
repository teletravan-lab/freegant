import { useState, useEffect, FormEvent } from 'react';
import { Task, TaskColor } from '../types';
import { TASK_COLOR_MAP } from '../utils/ganttUtils';
import { Edit3, Calendar, Link, Clock, Palette } from 'lucide-react';

interface EditTaskModalProps {
  task: Task | null;
  allTasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
}

const COLORS: { key: TaskColor; label: string }[] = [
  { key: 'Jaune', label: 'Jaune' },
  { key: 'Bleu', label: 'Bleu' },
  { key: 'RougeClair', label: 'Rose / Rouge' },
  { key: 'Vert', label: 'Vert' },
  { key: 'Violet', label: 'Violet' },
  { key: 'Orange', label: 'Orange' },
];

export default function EditTaskModal({
  task,
  allTasks,
  isOpen,
  onClose,
  onSave,
}: EditTaskModalProps) {
  const [name, setName] = useState('');
  const [dependsOn, setDependsOn] = useState<string>('');
  const [offset, setOffset] = useState<number | string>(0);
  const [duration, setDuration] = useState<number>(1);
  const [color, setColor] = useState<TaskColor>('Bleu');
  const [manualStart, setManualStart] = useState<string>('');

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDependsOn(task.dependsOn || 'none');
      setOffset(task.offset !== undefined && task.offset !== 0 ? task.offset : '');
      setDuration(task.duration || 1);
      setColor(task.color || 'Bleu');
      setManualStart(task.manualStart || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const updated: Task = {
      ...task,
      name: name.trim() || task.name,
      dependsOn: dependsOn === 'none' ? null : dependsOn,
      offset: offset === '' ? 0 : Number(offset) || 0,
      duration: Math.max(1, Number(duration) || 1),
      color,
      manualStart: dependsOn === 'none' ? manualStart || null : null,
    };
    onSave(updated);
    onClose();
  };

  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[#16304a] border border-[#3a75a3] shadow-2xl p-6 text-white animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#3a75a3]/60 mb-4">
          <h2 className="text-lg font-bold text-[#5bc0de] flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Modifier la tâche <span className="text-white px-2 py-0.5 rounded bg-black/30 text-sm">[{task.id}]</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Intitulé de la tâche
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#5bc0de]" />
                Durée (jours)
              </label>
              <input
                type="number"
                min="1"
                value={duration}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Link className="w-3.5 h-3.5 text-[#5bc0de]" />
                Dépendance
              </label>
              <select
                value={dependsOn}
                onChange={(e) => setDependsOn(e.target.value)}
                className="w-full px-3 py-2 bg-[#11263a] border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
              >
                <option value="none">Date libre (manuelle)</option>
                <option value="J0">J0 (Début du projet)</option>
                {otherTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    Fin de {t.id} ({t.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dependsOn !== 'none' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Décalage par rapport à la dépendance (jours, +/-)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={offset}
                  onFocus={(e) => {
                    if (offset === 0 || offset === '0') {
                      setOffset('');
                    } else {
                      e.target.select();
                    }
                  }}
                  onBlur={() => {
                    if (offset === '' || offset === '-' || isNaN(Number(offset)) || Number(offset) === 0) {
                      setOffset('');
                    } else {
                      setOffset(Number(offset));
                    }
                  }}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === '' || val === '-') {
                      setOffset(val);
                      return;
                    }
                    // Keep only minus sign and digits
                    val = val.replace(/[^0-9-]/g, '');
                    if (val.includes('-')) {
                      val = '-' + val.replace(/-/g, '');
                    }
                    // Strip leading zero when followed by digits (e.g. "0150" -> "150", "-015" -> "-15")
                    if (/^-?0\d+/.test(val)) {
                      val = val.replace(/^(-?)0+/, '$1');
                    }
                    setOffset(val);
                  }}
                  className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
                  placeholder="0"
                />
                {(() => {
                  const numOffset = Number(offset) || 0;
                  return (
                    <span className="text-xs text-slate-400 shrink-0 min-w-[70px]">
                      {numOffset > 0 ? `+${numOffset} j après` : numOffset < 0 ? `${numOffset} j avant` : 'immédiat'}
                    </span>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#5bc0de]" />
                Date de début manuelle
              </label>
              <input
                type="date"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
                required={dependsOn === 'none'}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-[#5bc0de]" />
              Couleur de la barre
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COLORS.map((c) => {
                const colorInfo = TASK_COLOR_MAP[c.key];
                const isSelected = color === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setColor(c.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      isSelected
                        ? 'border-white ring-2 ring-white/50 bg-white/15'
                        : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: colorInfo.hex }}
                    />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-3 justify-end border-t border-[#3a75a3]/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white cursor-pointer transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 text-xs font-bold cursor-pointer transition"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
