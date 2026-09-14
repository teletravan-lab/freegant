import { Project, SyncStatus } from '../types';
import { User, signOut, auth } from '../firebase';
import {
  Menu,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  CloudCheck,
  RotateCw,
  LogOut,
  User as UserIcon,
  Calendar,
} from 'lucide-react';

interface HeaderProps {
  project: Project | null;
  onUpdateProjectName: (name: string) => void;
  onUpdateProjectJ0: (j0: string) => void;
  onToggleSidebar: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAutoScale: () => void;
  user: User | null;
  onOpenAuth: () => void;
  syncStatus: SyncStatus;
}

export default function Header({
  project,
  onUpdateProjectName,
  onUpdateProjectJ0,
  onToggleSidebar,
  onZoomIn,
  onZoomOut,
  onAutoScale,
  user,
  onOpenAuth,
  syncStatus,
}: HeaderProps) {
  const handleSignOut = async () => {
    if (confirm('Se déconnecter de votre espace privé ?')) {
      await signOut(auth);
    }
  };

  return (
    <header className="h-14 bg-[#11263a] border-b border-[#3a75a3] px-4 flex items-center justify-between gap-3 shrink-0 z-40 select-none">
      {/* Left: Sidebar toggle + App Branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-[#3a75a3] text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
          title="Afficher/Masquer les projets"
        >
          <Menu className="w-4 h-4 text-[#5bc0de]" />
          <span>Projets</span>
        </button>

        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm md:text-base text-white tracking-tight flex items-center gap-1.5">
            Free Gantt <span className="text-[#5bc0de] text-xs font-normal">by Télétravan</span>
          </h1>
          <span
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#16304a] text-[#5bc0de] border border-[#3a75a3]/50"
            title="Espace privé sécurisé"
          >
            <Lock className="w-2.5 h-2.5" />
            Privé
          </span>
        </div>
      </div>

      {/* Middle: Project Name & J0 Inputs */}
      {project && (
        <div className="flex items-center gap-2 md:gap-3 flex-1 max-w-xl justify-center">
          <input
            type="text"
            value={project.name}
            onChange={(e) => onUpdateProjectName(e.target.value)}
            placeholder="Nom du projet"
            className="px-3 py-1 bg-black/25 border border-[#3a75a3] rounded-lg text-xs md:text-sm font-semibold text-white w-36 md:w-56 focus:outline-none focus:border-[#5bc0de] focus:ring-1 focus:ring-[#5bc0de] transition"
            title="Modifier le nom du projet"
          />

          <div className="flex items-center gap-1 bg-black/25 border border-[#3a75a3] px-2 py-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-[#5bc0de] shrink-0" />
            <span className="text-[11px] font-bold text-slate-400">J0:</span>
            <input
              type="date"
              value={project.j0}
              onChange={(e) => onUpdateProjectJ0(e.target.value)}
              className="bg-transparent text-xs font-mono text-white focus:outline-none cursor-pointer"
              title="Date de référence du projet (J0)"
            />
          </div>
        </div>
      )}

      {/* Right: Zoom controls + Firestore status + Auth */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Firestore status pill */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#16304a] border border-[#3a75a3]/50 text-[11px]"
          title="Statut de persistance Firestore"
        >
          {syncStatus === 'saving' ? (
            <span className="flex items-center gap-1.5 text-amber-300">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Enregistrement...</span>
            </span>
          ) : syncStatus === 'error' ? (
            <span className="flex items-center gap-1.5 text-red-400">
              <span>Erreur sync</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-300">
              <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firestore auto</span>
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center bg-black/20 border border-[#3a75a3] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onZoomOut()}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Dézoomer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAutoScale()}
            className="px-2 py-0.5 rounded hover:bg-white/10 text-[11px] font-semibold text-slate-300 hover:text-[#5bc0de] transition cursor-pointer"
            title="Ajustement automatique à l'écran"
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => onZoomIn()}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Zoomer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auth / Profile */}
        {user ? (
          <div className="flex items-center gap-1.5 pl-1 border-l border-[#3a75a3]/50">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 max-w-[140px] md:max-w-[180px] truncate"
              title={user.email || 'Utilisateur connecté'}
            >
              <UserIcon className="w-3.5 h-3.5 text-[#5bc0de] shrink-0" />
              <span className="truncate">{user.email || 'Invité'}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-2.5 py-1 rounded-lg bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow"
          >
            <Lock className="w-3 h-3" />
            Connexion
          </button>
        )}
      </div>
    </header>
  );
}
