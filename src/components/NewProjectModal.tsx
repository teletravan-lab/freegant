import { useState, FormEvent } from 'react';
import { Calendar, Plus } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, startDate: string) => void;
  isFirstProject?: boolean;
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onSubmit,
  isFirstProject = false,
}: NewProjectModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState(isFirstProject ? 'Mon Premier Projet' : 'Nouveau Projet');
  const [date, setDate] = useState(today);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date) return;
    onSubmit(name.trim() || 'Nouveau Projet', date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#16304a] border border-[#3a75a3] shadow-2xl p-6 text-white animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-[#5bc0de] mb-1">
          {isFirstProject ? 'Bienvenue !' : 'Nouveau Projet Gantt'}
        </h2>
        <p className="text-xs text-slate-300 mb-4">
          Définissez le nom et la date initiale de référence (J0) :
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nom du projet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Refonte Site Web"
              className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5bc0de]" />
              Date de début (J0)
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white text-center focus:outline-none focus:border-[#5bc0de]"
              required
            />
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            {!isFirstProject && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white cursor-pointer transition"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              Créer le Gantt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
