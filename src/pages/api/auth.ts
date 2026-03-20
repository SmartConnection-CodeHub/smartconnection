export const prerender = false;

import type { APIRoute } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
const SESSION_SECRET = import.meta.env.SESSION_SECRET || 'sm-connection-2026';

function hashSession(user: string): string {
  const data = `${user}:${SESSION_SECRET}:${Math.floor(Date.now() / 86400000)}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + '-' + Buffer.from(user).toString('base64url');
}

export function verifySession(cookie: string | undefined): { valid: boolean; user?: string } {
  if (!cookie) return { valid: false };
  try {
    const parts = cookie.split('-');
    if (parts.length < 2) return { valid: false };
    const user = Buffer.from(parts.slice(1).join('-'), 'base64url').toString();
    const expected = hashSession(user);
    return { valid: cookie === expected, user };
  } catch {
    return { valid: false };
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email y contraseña requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Query Supabase for user
    const url = `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&activo=eq.true&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      console.error('Supabase error:', res.status, await res.text());
      return new Response(JSON.stringify({ error: 'Error de autenticación' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const record = data[0];

    if (password !== record.password) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create session
    const sessionToken = hashSession(email);
    const userName = record.nombre || email.split('@')[0];
    const role = record.rol || 'user';

    cookies.set('sc_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return new Response(JSON.stringify({
      success: true,
      user: { name: userName, email, role },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Auth error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete('sc_session', { path: '/' });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
