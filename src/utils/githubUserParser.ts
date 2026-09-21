import { StudentUser } from '../types';

export interface StudentUserRecord extends StudentUser {
  password?: string;
}

export const GITHUB_USUARIO_REPO_URL =
  'https://github.com/grossifisica/Mb/blob/f6eb5c0845cc545f20466eb15359e3716b1fd6c8/usuario.txt';
export const GITHUB_USUARIO_RAW_URL =
  'https://raw.githubusercontent.com/grossifisica/Mb/main/usuario.txt';
export const GITHUB_USUARIO_COMMIT_URL =
  'https://raw.githubusercontent.com/grossifisica/Mb/f6eb5c0845cc545f20466eb15359e3716b1fd6c8/usuario.txt';

/**
 * Parses usuario.txt lines in the format:
 * |Primeiro nome|Último nome|Usuário|Senha|Data de entrada na plataforma|Telefone|E-mail
 * or
 * Primeiro nome|Último nome|Usuário|Senha|Data de entrada na plataforma|Telefone|E-mail
 */
export function parseUsuarioText(text: string): StudentUserRecord[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const users: StudentUserRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    let parts = rawLine.split('|').map((p) => p.trim());
    // If the line starts with '|', parts[0] is empty, so remove it
    if (parts.length > 0 && parts[0] === '') {
      parts.shift();
    }

    // Model:
    // parts[0]: Primeiro nome
    // parts[1]: Último nome
    // parts[2]: Usuário
    // parts[3]: Senha
    // parts[4]: Data de entrada na plataforma
    // parts[5]: Telefone
    // parts[6]: E-mail
    const firstName = parts[0] || '';
    const lastName = parts[1] || '';
    const username = parts[2] || '';
    const password = parts[3] || '';
    const entryDate = parts[4] || '';
    const phone = parts[5] || '';
    const email = parts[6] || '';

    const lowerUser = username.toLowerCase();
    const lowerFirst = firstName.toLowerCase();

    // Check if this row is a header line
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
 * Fetches users directly from GitHub raw URL with anti-cache query parameter.
 * Uses a simple GET request (no custom headers) to avoid CORS preflight failures on raw.githubusercontent.com.
 */
export async function fetchGitHubUsers(): Promise<StudentUserRecord[]> {
  const cacheBuster = Date.now();

  // 1. Try raw main URL
  try {
    const res = await fetch(`${GITHUB_USUARIO_RAW_URL}?_t=${cacheBuster}`);
    if (res.ok) {
      const text = await res.text();
      const parsed = parseUsuarioText(text);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Direct GitHub raw usuario.txt fetch failed, trying commit URL...', err);
  }

  // 2. Try commit URL fallback
  try {
    const res = await fetch(`${GITHUB_USUARIO_COMMIT_URL}?_t=${cacheBuster}`);
    if (res.ok) {
      const text = await res.text();
      const parsed = parseUsuarioText(text);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Commit URL usuario.txt fetch failed, trying local fallback...', err);
  }

  // 3. Try local public/usuario.txt
  try {
    const localRes = await fetch(`/usuario.txt?_t=${cacheBuster}`);
    if (localRes.ok) {
      const text = await localRes.text();
      const parsed = parseUsuarioText(text);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // 4. Default seed user
  return [
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
