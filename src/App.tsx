import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Search,
  BookOpen,
  Layers,
  LogOut,
} from 'lucide-react';
import { LessonItem, SheetDataState, StudentUser } from './types';
import { fetchSheetData, triggerSheetSync } from './utils/sheetApi';
import { DEFAULT_SHEET_DATA } from './data/defaultSheetData';
import { logoutStudentClient } from './utils/authClient';
import { AulaCard } from './components/AulaCard';
import { ClassroomViewer } from './components/ClassroomViewer';

export default function App() {
  // User Authentication State (opcional enquanto login estiver suprimido)
  const [currentUser, setCurrentUser] = useState<StudentUser | null>(() => {
    try {
      const saved = localStorage.getItem('student_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sheet Data State - inicializa com dados salvos ou default para renderização imediata ao abrir
  const [sheetData, setSheetData] = useState<SheetDataState | null>(() => {
    try {
      const local = localStorage.getItem('didatic_classroom_github_content_v2');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && Array.isArray(parsed.aulas) && parsed.aulas.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SHEET_DATA;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active Lesson being studied in ClassroomViewer
  const [activeLessonItem, setActiveLessonItem] = useState<LessonItem | null>(null);

  // Filters
  const [selectedAulaId, setSelectedAulaId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Validate student session on mount silently if token exists
  useEffect(() => {
    const token = localStorage.getItem('student_token');
    const savedUser = localStorage.getItem('student_user');
    if (!token || !savedUser) {
      return;
    }

    fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token inválido');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('student_user', JSON.stringify(data.user));
        } else if (data.authenticated === false) {
          localStorage.removeItem('student_token');
          localStorage.removeItem('student_user');
          setCurrentUser(null);
        }
      })
      .catch(() => {
        // Keeps local user on temporary network glitch or static hosting
      });
  }, []);

  // Carregamento e sincronização automática das aulas
  const refreshAulas = async (showFullLoading = false) => {
    if (showFullLoading) {
      setIsLoading(true);
    }
    setIsSyncing(true);
    try {
      const freshData = await triggerSheetSync();
      setSheetData(freshData);
    } catch (err) {
      console.warn('Falha na sincronização direta, obtendo dados do cache:', err);
      try {
        const fallbackData = await fetchSheetData();
        setSheetData(fallbackData);
      } catch (e) {
        console.error('Falha ao carregar aulas:', e);
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  // 1. Atualização automática ao abrir o aplicativo, ao focar na janela e periodicamente
  useEffect(() => {
    // Sincroniza imediatamente com o GitHub ao abrir o app
    refreshAulas(false);

    const handleFocus = () => {
      // Revalida silenciosamente quando o usuário volta para a aba do navegador
      refreshAulas(false);
    };

    window.addEventListener('focus', handleFocus);
    // Intervalo de verificação a cada 30 segundos para detectar alterações no GitHub
    const interval = setInterval(() => {
      refreshAulas(false);
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // 2. Atualização automática ao voltar à tela inicial
  const prevActiveLessonRef = useRef<LessonItem | null>(activeLessonItem);
  useEffect(() => {
    if (prevActiveLessonRef.current !== null && activeLessonItem === null) {
      // Usuário acabou de retornar à tela inicial vindo de uma aula
      refreshAulas(false);
    }
    prevActiveLessonRef.current = activeLessonItem;
  }, [activeLessonItem]);

  // Logout handler
  const handleLogout = async () => {
    await logoutStudentClient();
    setCurrentUser(null);
    setActiveLessonItem(null);
  };

  // Aulas list
  const aulas = sheetData?.aulas || [];
  const allItems = sheetData?.allItems || [];
  const subjects = sheetData?.subjects || [];

  // Current active Aula when viewing a lesson
  const currentActiveAula = useMemo(() => {
    if (!activeLessonItem) return undefined;
    return aulas.find((a) => a.name === activeLessonItem.aulaName || a.items.some((i) => i.id === activeLessonItem.id));
  }, [activeLessonItem, aulas]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Filter by Aula (tab)
      if (selectedAulaId !== 'all') {
        const aulaObj = aulas.find((a) => a.id === selectedAulaId);
        if (aulaObj && item.aulaName !== aulaObj.name) {
          return false;
        }
      }

      // Filter by Subject (Coluna B)
      if (selectedSubject !== 'all' && item.subject !== selectedSubject) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSubject = item.subject.toLowerCase().includes(q);
        const matchesAula = item.aulaName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesAula) {
          return false;
        }
      }

      return true;
    });
  }, [allItems, aulas, selectedAulaId, selectedSubject, searchQuery]);

  // Tela de login omitida para acesso direto e imediato às aulas
  // Se houver usuário salvo na sessão, seus dados continuam sendo exibidos no topo

  // If currently studying a lesson in the Classroom Viewer
  if (activeLessonItem) {
    return (
      <ClassroomViewer
        item={activeLessonItem}
        currentAula={currentActiveAula}
        currentUser={currentUser}
        onLogout={handleLogout}
        onBack={() => setActiveLessonItem(null)}
        onSelectItem={(newItem) => setActiveLessonItem(newItem)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 selection:bg-amber-200 selection:text-stone-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo & Platform Title */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-lg tracking-tight">
                    Plataforma Basis
                  </span>
                  {isSyncing && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                      Atualizando...
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 hidden sm:block">
                  Matemática básica com foco em exatas - Prof. Grossi
                </p>
              </div>
            </div>

            {/* Quick Search */}
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por título, assunto ou aula..."
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 font-medium px-1.5 py-0.5"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Actions: Student Profile & Logout */}
            <div className="flex items-center gap-2">
              {currentUser && (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs">
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-[11px] shadow-2xs">
                      {currentUser.firstName?.[0] || 'A'}
                    </div>
                    <span className="font-semibold text-stone-800">
                      {currentUser.firstName} {currentUser.lastName}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                    title="Sair do portal"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Mobile Search */}
        <div className="md:hidden">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, assunto ou aula..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        {/* Navigation by Aulas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-600 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>Selecionar Aula</span>
            </span>
            <span className="text-[11px] text-stone-400 lowercase font-normal">
              {filteredItems.length} {filteredItems.length === 1 ? 'item exibido' : 'itens exibidos'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedAulaId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 shadow-2xs flex items-center gap-1.5 ${
                selectedAulaId === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
              }`}
            >
              <span>Todas as Aulas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-800 text-amber-300">
                {allItems.length}
              </span>
            </button>

            {aulas.map((aula) => (
              <button
                key={aula.id}
                onClick={() => setSelectedAulaId(aula.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 shadow-2xs flex items-center gap-2 ${
                  selectedAulaId === aula.id
                    ? 'bg-amber-500 text-stone-950 font-extrabold shadow-xs'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                }`}
              >
                <span>{aula.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                  {aula.items.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter: Subjects */}
        {subjects.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-stone-400 font-semibold shrink-0">Assunto:</span>
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                selectedSubject === 'all'
                  ? 'bg-stone-800 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              Todos
            </button>
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                  selectedSubject === sub
                    ? 'bg-stone-800 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Content Cards Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-stone-700">Carregando aulas e conteúdos didáticos...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <AulaCard
                key={item.id}
                item={item}
                onOpenClassroom={(it) => setActiveLessonItem(it)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center flex flex-col items-center max-w-lg mx-auto">
            <BookOpen className="w-12 h-12 text-stone-400 mb-3" />
            <h3 className="text-base font-bold text-stone-900">Nenhum conteúdo encontrado</h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Não encontramos aulas com os filtros selecionados. Tente ajustar os termos de busca ou selecionar outra aula.
            </p>
            <button
              onClick={() => {
                setSelectedAulaId('all');
                setSelectedSubject('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
