export const prerender = false;

import type { APIRoute } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

async function supabaseInsert(table: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  return res.json();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'contact') {
      const { nombre, empresa, email, telefono, servicio, mensaje } = body;

      if (!nombre || !email || !servicio || !mensaje) {
        return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Honeypot check
      if (body.website) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const record = await supabaseInsert('leads', {
        nombre, empresa, email, telefono, servicio, mensaje,
        fuente: 'website',
        estado: 'nuevo',
      });

      return new Response(JSON.stringify({ success: true, id: record[0]?.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'scheduler') {
      const { nombre, email, fecha, hora, tema } = body;

      if (!nombre || !email || !fecha || !hora) {
        return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const record = await supabaseInsert('reuniones', {
        nombre, email, fecha, hora, tema,
        estado: 'pendiente',
      });

      return new Response(JSON.stringify({ success: true, id: record[0]?.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Contact API error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
