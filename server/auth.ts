import fs from 'fs';
import path from 'path';

export interface StudentUser {
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  password?: string;
  entryDate: string;
  phone: string;
  email: string;
}

export interface AuthSession {
  token: string;
  user: Omit<StudentUser, 'password'>;
  createdAt: number;
}

export const GITHUB_USUARIO_RAW_URL =
  'https://raw.githubusercontent.com/grossifisica/Basis/main/usuario.txt';
export const GITHUB_USUARIO_COMMIT_URL =
  'https://raw.githubusercontent.com/grossifisica/Basis/main/usuario.txt';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'users-cache.json');
const LOCAL_USUARIO_PATH = path.join(process.cwd(), 'usuario.txt');
const PUBLIC_USUARIO_PATH = path.join(process.cwd(), 'public', 'usuario.txt');

// In-memory cache
let cachedUsers: StudentUser[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds auto-refresh

// Active sessions in-memory: token -> AuthSession
const activeSessions = new Map<string, AuthSession>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Parses usuario.txt lines in the format:
 * |Primeiro nome|Último nome|Usuário|Senha|Data de entrada na plataforma|Telefone|E-mail
 * or
 * Primeiro nome|Último nome|Usuário|Senha|Data de entrada na plataforma|Telefone|E-mail
 */
export function parseUsuarioText(text: string): StudentUser[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const users: StudentUser[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    let parts = rawLine.split('|').map((p) => p.trim());
    if (parts.length > 0 && parts[0] === '') {
      parts.shift();
    }

    const firstName = parts[0] || '';
    const lastName = parts[1] || '';
    const username = parts[2] || '';
    const password = parts[3] || '';
    const entryDate = parts[4] || '';
    const phone = parts[5] || '';
    const email = parts[6] || '';

    const lowerUser = username.toLowerCase();
    const lowerFirst = firstName.toLowerCase();

    // Check header
    if (
      !username ||
      !password ||
      lowerUser === 'usuário' ||
      lowerUser === 'usuario' ||
      lowerUser === 'username' ||
      lowerFirst === 'primeiro nome' ||
      lowerFirst === 'primeiro'
    ) {
      continue;
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ') || username;

    users.push({
      firstName,
      lastName,
      fullName,
      username,
      password,
      entryDate,
      phone,
      email,
    });
  }

  return users;
}

/**
 * Loads cached users from disk if available
 */
function loadDiskCache(): StudentUser[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read users disk cache:', err);
  }
  return [];
}

/**
 * Saves users to disk cache
 */
function saveDiskCache(users: StudentUser[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write users disk cache:', err);
  }
}

/**
 * Fetches latest student users from GitHub usuario.txt (with disk fallback)
 */
export async function fetchStudentsFromSheet(forceRefresh = false): Promise<StudentUser[]> {
  const now = Date.now();
  if (!forceRefresh && cachedUsers.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedUsers;
  }

  let text = '';

  // 1. Fetch from GitHub raw main branch
  try {
    const res = await fetch(`${GITHUB_USUARIO_RAW_URL}?_t=${now}`);
    if (res.ok) {
      text = await res.text();
    }
  } catch (err) {
    console.warn('Network fetch for GitHub usuario.txt main failed:', err);
  }

  // 2. Fetch from commit URL if main failed
  if (!text) {
    try {
      const res = await fetch(`${GITHUB_USUARIO_COMMIT_URL}?_t=${now}`);
      if (res.ok) {
        text = await res.text();
      }
    } catch (err) {
      console.warn('Network fetch for GitHub usuario.txt commit failed:', err);
    }
  }

  // 3. Disk fallback (local files)
  if (!text && fs.existsSync(LOCAL_USUARIO_PATH)) {
    try {
      text = fs.readFileSync(LOCAL_USUARIO_PATH, 'utf-8');
    } catch {
      // ignore
    }
  }

  if (!text && fs.existsSync(PUBLIC_USUARIO_PATH)) {
    try {
      text = fs.readFileSync(PUBLIC_USUARIO_PATH, 'utf-8');
    } catch {
      // ignore
    }
  }

  if (text) {
    const parsed = parseUsuarioText(text);
    if (parsed.length > 0) {
      cachedUsers = parsed;
      lastFetchTime = now;
      saveDiskCache(parsed);
      return parsed;
    }
  }

  // Fallback to disk cache if available
  if (cachedUsers.length === 0) {
    cachedUsers = loadDiskCache();
  }

  if (cachedUsers.length === 0) {
    // Default fallback
    cachedUsers = [
      {
        firstName: 'Pedro',
        lastName: 'Grossi',
        fullName: 'Pedro Grossi',
        username: 'grossi',
        password: '102030',
        entryDate: '17-09-2026',
        phone: '16981698768',
        email: 'pedropav@gmail.com',
      },
    ];
  }

  return cachedUsers;
}

/**
 * Authenticates student user with username and password
 */
export async function authenticateStudent(
  usernameInput: string,
  passwordInput: string
): Promise<{
  success: boolean;
  message?: string;
  user?: Omit<StudentUser, 'password'>;
  token?: string;
}> {
  const cleanUsername = (usernameInput || '').trim();
  const cleanPassword = (passwordInput || '').trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, message: 'Informe o nome de usuário e a senha.' };
  }

  // First check in-memory / cache
  let students = await fetchStudentsFromSheet(false);
  let matched = students.find(
    (s) => s.username.trim().toLowerCase() === cleanUsername.toLowerCase()
  );

  // If not found in cache, force refresh from GitHub to catch newly added students
  if (!matched) {
    students = await fetchStudentsFromSheet(true);
    matched = students.find(
      (s) => s.username.trim().toLowerCase() === cleanUsername.toLowerCase()
    );
  }

  if (!matched) {
    return { success: false, message: 'Usuário não encontrado.' };
  }

  // Password matching
  if (matched.password?.trim() !== cleanPassword) {
    return { success: false, message: 'Senha incorreta.' };
  }

  // Generate safe session token
  const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const safeUser: Omit<StudentUser, 'password'> = {
    firstName: matched.firstName,
    lastName: matched.lastName,
    fullName: matched.fullName,
    username: matched.username,
    entryDate: matched.entryDate,
    phone: matched.phone,
    email: matched.email,
  };

  const session: AuthSession = {
    token,
    user: safeUser,
    createdAt: Date.now(),
  };

  activeSessions.set(token, session);

  return {
    success: true,
    user: safeUser,
    token,
  };
}

/**
 * Validates an active session token
 */
export function getSession(token: string): AuthSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  // Session TTL: 30 days
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > maxAge) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Invalidates a session token
 */
export function invalidateSession(token: string): boolean {
  return activeSessions.delete(token);
}
