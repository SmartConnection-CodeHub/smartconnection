export const prerender = false;

import type { APIRoute } from 'astro';

const GOOGLE_SERVICE_ACCOUNT = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const CALENDAR_ID = import.meta.env.GOOGLE_CALENDAR_ID || 'contacto@smconnection.cl';

// Helper to create JWT for Google Service Account auth
async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT || '{}');

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    sub: CALENDAR_ID, // impersonate the calendar owner
  }));

  // For proper RS256 signing, we need crypto
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`)
  );

  const jwt = `${header}.${claim}.${arrayBufferToBase64Url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '');
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { nombre, email, fecha, hora, tema } = await request.json();

    if (!nombre || !email || !fecha || !hora) {
      return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse date and time
    const [h, m] = hora.split(':').map(Number);
    const startDateTime = `${fecha}T${hora}:00`;
    const endH = m + 30 >= 60 ? h + 1 : h;
    const endM = (m + 30) % 60;
    const endDateTime = `${fecha}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

    // If no Google service account configured, fallback to generating Google Calendar URL
    if (!GOOGLE_SERVICE_ACCOUNT) {
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reunión Smart Connection — ' + tema)}&dates=${fecha.replace(/-/g, '')}T${hora.replace(':', '')}00/${fecha.replace(/-/g, '')}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00&ctz=America/Santiago&details=${encodeURIComponent(`Reunión con Smart Connection\n\nTema: ${tema}\nContacto: ${nombre} (${email})\n\nwww.smconnection.cl`)}&location=${encodeURIComponent('Google Meet')}&add=contacto@smconnection.cl`;

      return new Response(JSON.stringify({ fallback: true, calendarUrl: calUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken();

    // Create Google Calendar event with Google Meet
    const event = {
      summary: `Reunión Smart Connection — ${tema}`,
      description: `Contacto: ${nombre} (${email})\nTema: ${tema}\n\nAgendado desde www.smconnection.cl`,
      start: { dateTime: startDateTime, timeZone: 'America/Santiago' },
      end: { dateTime: endDateTime, timeZone: 'America/Santiago' },
      attendees: [
        { email: 'contacto@smconnection.cl' },
        { email },
      ],
      conferenceData: {
        createRequest: {
          requestId: `sc-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!calRes.ok) {
      const err = await calRes.text();
      console.error('Google Calendar error:', err);
      return new Response(JSON.stringify({ error: 'Error al crear evento' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const calEvent = await calRes.json();

    return new Response(JSON.stringify({
      success: true,
      eventId: calEvent.id,
      meetLink: calEvent.hangoutLink || calEvent.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: calEvent.htmlLink,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Schedule error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
