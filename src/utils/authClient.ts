import { StudentUser } from '../types';
import { fetchGitHubUsers, GITHUB_USUARIO_REPO_URL, GITHUB_USUARIO_RAW_URL } from './githubUserParser';

export { GITHUB_USUARIO_REPO_URL, GITHUB_USUARIO_RAW_URL };

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: StudentUser;
  token?: string;
}

/**
 * Authenticates the student with username and password.
 * First queries `/api/auth/login`. If unreachable (e.g. network offline or static SPA preview),
 * falls back to direct client-side fetch from GitHub usuario.txt.
 */
export async function authenticateStudentClient(
  usernameInput: string,
  passwordInput: string
): Promise<LoginResult> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, message: 'Por favor, preencha o nome de usuário e a senha.' };
  }

  // Attempt 1: Server endpoint (/api/auth/login)
  try {
    const res = await fetch(`/api/auth/login?_t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('student_token', data.token || `tok_${Date.now()}`);
        localStorage.setItem('student_user', JSON.stringify(data.user));
        return { success: true, user: data.user, token: data.token };
      }
    } else if (res.status === 401) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, message: errorData.error || 'Nome de usuário ou senha incorretos.' };
    }
  } catch (apiErr) {
    console.warn('Endpoint /api/auth/login indisponível, usando fallback GitHub direto:', apiErr);
  }

  // Attempt 2: Direct GitHub usuario.txt fetch (works on static hosting and client-side)
  try {
    const users = await fetchGitHubUsers();
    const matched = users.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (!matched) {
      return { success: false, message: 'Nome de usuário não encontrado.' };
    }

    if (matched.password?.trim() !== cleanPassword) {
      return { success: false, message: 'Senha incorreta.' };
    }

    const safeUser: StudentUser = {
      firstName: matched.firstName,
      lastName: matched.lastName,
      fullName: matched.fullName,
      username: matched.username,
      entryDate: matched.entryDate,
      phone: matched.phone,
      email: matched.email,
    };

    const token = `tok_client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('student_token', token);
    localStorage.setItem('student_user', JSON.stringify(safeUser));

    return {
      success: true,
      user: safeUser,
      token,
    };
  } catch (gitErr) {
    console.error('Falha no fallback direto de login pelo GitHub:', gitErr);
  }

  return {
    success: false,
    message: 'Não foi possível validar o login. Verifique sua conexão e tente novamente.',
  };
}

/**
 * Validates the current session token or stored user
 */
export async function validateCurrentSession(): Promise<StudentUser | null> {
  const token = localStorage.getItem('student_token');
  const storedUserJson = localStorage.getItem('student_user');

  if (!token || !storedUserJson) {
    return null;
  }

  try {
    const user = JSON.parse(storedUserJson);
    return user;
  } catch {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
    return null;
  }
}

/**
 * Logs out the student
 */
export async function logoutStudentClient(): Promise<void> {
  const token = localStorage.getItem('student_token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }
  localStorage.removeItem('student_token');
  localStorage.removeItem('student_user');
}
