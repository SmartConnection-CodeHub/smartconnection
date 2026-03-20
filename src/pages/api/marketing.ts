export const prerender = false;

import type { APIRoute } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { event, source, medium, campaign, page, referrer, lang } = await request.json();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/analytics`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event: event || 'pageview',
        source: source || 'direct',
        medium: medium || 'none',
        campaign: campaign || null,
        page: page || '/',
        referrer: referrer || null,
        lang: lang || 'es',
        user_agent: request.headers.get('user-agent'),
      }),
    });

    return new Response(JSON.stringify({ success: res.ok }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
