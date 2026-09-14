import { useState, FormEvent } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
} from '../firebase';
import { Lock, LogIn, Mail, Shield, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export default function AuthModal({ isOpen, onClose, canClose = false }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Connexion annulée par l’utilisateur.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Le popup a été bloqué par le navigateur. Veuillez autoriser les fenêtres pop-up.');
      } else {
        setError(err.message || 'Erreur lors de la connexion Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez renseigner un email et un mot de passe.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Email ou mot de passe incorrect.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Cet email est déjà associé à un compte.');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe doit comporter au moins 6 caractères.');
      } else {
        setError(err.message || 'Erreur d’authentification.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInAnonymously(auth);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Guest Auth Error:', err);
      setError(err.message || 'Erreur de connexion invité.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[#16304a] border border-[#3a75a3] shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[#3a75a3]/50 bg-[#11263a]/80 text-center relative">
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>
          )}
          <div className="mx-auto w-12 h-12 rounded-full bg-[#5bc0de]/20 border border-[#5bc0de]/40 flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-[#5bc0de]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Espace Privé Gantt
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Sauvegarde automatique et sécurisée dans Firestore
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-white text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 hover:bg-slate-100 transition shadow disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continuer avec Google
          </button>

          <div className="flex items-center my-4">
            <div className="grow border-t border-[#3a75a3]/50"></div>
            <span className="px-3 text-xs text-slate-400 uppercase">ou avec email</span>
            <div className="grow border-t border-[#3a75a3]/50"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full pl-9 pr-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de] focus:ring-1 focus:ring-[#5bc0de]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-black/20 border border-[#3a75a3] rounded-lg text-sm text-white focus:outline-none focus:border-[#5bc0de] focus:ring-1 focus:ring-[#5bc0de]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#5bc0de] hover:bg-[#4ab0ce] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {isSignUp ? "S'inscrire et synchroniser" : 'Se connecter'}
            </button>
          </form>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#5bc0de] hover:underline cursor-pointer"
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un profil'}
            </button>

            <button
              type="button"
              onClick={handleGuestSignIn}
              disabled={loading}
              className="text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1"
            >
              Mode invité <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#11263a]/50 border-t border-[#3a75a3]/40 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#5bc0de]" />
          Données strictement privées, isolées par compte dans Firestore.
        </div>
      </div>
    </div>
  );
}
