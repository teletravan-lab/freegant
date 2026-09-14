import { useState, useRef, ChangeEvent } from 'react';
import { Project, SyncStatus } from '../types';
import { Plus, Download, Upload, Trash2, Folder, Cloud, CloudOff, Check, RotateCw, RotateCcw, AlertTriangle, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onExportJSON: () => void;
  onImportJSON: (imported: Project[]) => void;
  onResetDefaultTasks?: () => void;
  syncStatus: SyncStatus;
}

export default function Sidebar({
  isOpen,
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onExportJSON,
  onImportJSON,
  onResetDefaultTasks,
  syncStatus,
}: SidebarProps) {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let importedProjects: Project[] = [];
        if (Array.isArray(parsed.projects)) {
          importedProjects = parsed.projects;
        } else if (Array.isArray(parsed)) {
          importedProjects = parsed;
        } else if (parsed.id && parsed.tasks) {
          importedProjects = [parsed];
        }

        if (importedProjects.length > 0) {
          onImportJSON(importedProjects);
        } else {
          alert('Fichier JSON non reconnu ou vide.');
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <aside
      className={`h-full bg-[#11263a] text-white flex flex-col border-r border-[#3a75a3] transition-all duration-300 z-30 shrink-0 overflow-hidden ${
        isOpen ? 'w-72' : 'w-0 border-r-0'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#3a75a3] flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm tracking-wide text-slate-100">
          <Folder className="w-4 h-4 text-[#5bc0de]" />
          <span>Mes Projets</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#16304a] text-slate-300 border border-[#3a75a3]/40">
            {projects.length}
          </span>
        </div>

        {/* Sync Indicator */}
        <div className="flex items-center gap-1.5 text-[11px]">
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-amber-300" title="Synchronisation Firestore...">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-400" title="Synchronisé avec Firestore">
              <Cloud className="w-3.5 h-3.5" />
              <Check className="w-3 h-3 -ml-2 text-emerald-300" />
            </span>
          )}
          {syncStatus === 'offline' && (
            <span className="flex items-center gap-1 text-slate-400" title="Mode hors ligne (sauvegarde locale)">
              <CloudOff className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {projects.map((p) => {
          const isActive = p.id === currentProjectId;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition text-xs font-medium ${
                isActive
                  ? 'bg-white/15 text-white border-l-4 border-[#5bc0de] shadow-sm'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="truncate flex-1 mr-2" title={p.name}>
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-[10px] text-slate-400">
                  {p.tasks?.length || 0} tâche(s) • Début : {p.j0 || 'J0'}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProjectToDelete(p);
                }}
                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer shrink-0"
                title={`Supprimer le projet "${p.name}"`}
                aria-label={`Supprimer le projet "${p.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            Aucun projet. Créez-en un pour commencer.
          </div>
        )}
      </div>

      {/* Sidebar Actions */}
      <div className="p-3 bg-[#0d1e2e]/50 border-t border-[#3a75a3] space-y-2">
        <button
          type="button"
          onClick={onNewProject}
          className="w-full py-2 px-3 rounded-lg bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
        >
          <Plus className="w-4 h-4" />
          Nouveau Projet
        </button>

        {onResetDefaultTasks && (
          <button
            type="button"
            onClick={onResetDefaultTasks}
            className="w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-[11px] font-medium text-slate-300 hover:text-amber-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Rétablir les 8 tâches du modèle par défaut pour le projet actif"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            Réinitialiser au modèle par défaut
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onExportJSON}
            className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Exporter tous les projets en JSON"
          >
            <Download className="w-3.5 h-3.5 text-[#5bc0de]" />
            Exporter
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Importer un fichier JSON de projets"
          >
            <Upload className="w-3.5 h-3.5 text-[#5bc0de]" />
            Importer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="bg-[#11263a] border border-[#3a75a3] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Supprimer le projet</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cette action est irréversible</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le projet{' '}
              <strong className="text-white font-semibold">« {projectToDelete.name} »</strong> ?
              Toutes ses tâches associées ({projectToDelete.tasks?.length || 0} tâche(s)) seront définitivement supprimées de votre espace Firestore.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3a75a3]/40">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition shadow-md flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
