const GITHUB_USUARIO_RAW_URL =
  'https://raw.githubusercontent.com/grossifisica/Mb/main/usuario.txt';
const GITHUB_USUARIO_COMMIT_URL =
  'https://raw.githubusercontent.com/grossifisica/Mb/f6eb5c0845cc545f20466eb15359e3716b1fd6c8/usuario.txt';

function parseUsuarioText(text: string) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const users: any[] = [];

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

    users.push({
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || username,
      username,
      password,
      entryDate,
      phone,
      email,
    });
  }

  return users;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { username, password } = body || {};
  const cleanUsername = (username || '').toString().trim();
  const cleanPassword = (password || '').toString().trim();

  if (!cleanUsername || !cleanPassword) {
    return res.status(400).json({ error: 'Informe o nome de usuário e a senha.' });
  }

  try {
    const timestamp = Date.now();
    let text = '';

    // 1. Fetch from GitHub main
    try {
      const fetchRes = await fetch(`${GITHUB_USUARIO_RAW_URL}?_t=${timestamp}`, {
        cache: 'no-store',
      });
      if (fetchRes.ok) {
        text = await fetchRes.text();
      }
    } catch (e) {
      console.warn('Vercel login: raw main fetch failed:', e);
    }

    // 2. Fetch from GitHub commit URL
    if (!text) {
      try {
        const commitRes = await fetch(`${GITHUB_USUARIO_COMMIT_URL}?_t=${timestamp}`, {
          cache: 'no-store',
        });
        if (commitRes.ok) {
          text = await commitRes.text();
        }
      } catch (e) {
        console.warn('Vercel login: commit URL fetch failed:', e);
      }
    }

    let users = parseUsuarioText(text);

    // Fallback seed user if GitHub is totally unreachable
    if (users.length === 0) {
      users = [
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

    const matchedUser = users.find(
      (u) => (u.username || '').toLowerCase() === cleanUsername.toLowerCase()
    );

    if (!matchedUser) {
      return res.status(401).json({ error: 'Nome de usuário não encontrado.' });
    }

    if (matchedUser.password?.trim() !== cleanPassword) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const safeUser = {
      firstName: matchedUser.firstName,
      lastName: matchedUser.lastName,
      fullName: matchedUser.fullName,
      username: matchedUser.username,
      entryDate: matchedUser.entryDate,
      phone: matchedUser.phone,
      email: matchedUser.email,
    };

    const token = `tok_std_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    return res.status(200).json({
      success: true,
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('Erro na autenticação Vercel:', err);
    return res.status(500).json({ error: 'Erro interno ao validar login.' });
  }
}
