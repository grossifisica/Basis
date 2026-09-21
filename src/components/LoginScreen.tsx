import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { StudentUser } from '../types';
import { authenticateStudentClient } from '../utils/authClient';

interface LoginScreenProps {
  onLoginSuccess: (user: StudentUser, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Por favor, preencha o nome de usuário e a senha.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authenticateStudentClient(cleanUser, cleanPass);

      if (!result.success || !result.user) {
        setErrorMessage(result.message || 'Nome de usuário ou senha incorretos.');
        return;
      }

      onLoginSuccess(result.user, result.token || '');
    } catch (err: any) {
      console.error('Erro de login:', err);
      setErrorMessage('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-950 p-4 sm:p-6 text-stone-100 selection:bg-amber-400 selection:text-stone-950">
      {/* Background subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Branding Card */}
        <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Plataforma Basis
              </h1>
              <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-xs">
                Matemática básica com foco em exatas - Prof. Grossi
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/60 text-rose-200 text-xs animate-shake"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-username"
                className="text-xs font-semibold text-stone-300 flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                Nome de Usuário
              </label>
              <div className="relative">
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu nome de usuário cadastrado"
                  disabled={isLoading}
                  className="w-full px-3.5 py-3 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/80 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold text-stone-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha de acesso"
                  disabled={isLoading}
                  className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/80 focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer p-1"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando dados...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
            <span>Acesso individual protegido para alunos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
