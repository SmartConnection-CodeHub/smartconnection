export const prerender = false;

import type { APIRoute } from 'astro';
import { verifySession } from './auth';
import { runAgentsParallel } from '../../lib/agents/orchestrator';
import { supabaseQuery, supabaseInsert } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = verifySession(cookies.get('sc_session')?.value);
  if (!session.valid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action, agentId, task, agents: agentIds, prompt, taskType, context } = body;

    // Parallel execution of multiple agents
    if (action === 'parallel' && agentIds && task) {
      const { results, totalMs } = await runAgentsParallel(task, agentIds, context);
      return new Response(JSON.stringify({ success: true, results, totalMs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Single agent execution
    if (action === 'execute' && agentId) {
      const systemPrompts: Record<string, string> = {
        'code-review': 'Eres un experto en code review. Analiza el código y sugiere mejoras de calidad, rendimiento y seguridad. Responde en español.',
        content: 'Eres un copywriter experto en tecnología y SAP. Genera contenido profesional. Responde en español.',
        seo: 'Eres un experto en SEO técnico. Sugiere mejoras de posicionamiento para un sitio de consultoría SAP e IA en Chile. Responde en español.',
        research: 'Eres un analista de mercado tecnológico. Investiga tendencias en SAP e IA empresarial. Responde en español.',
        general: 'Eres un asistente de Smart Connection, empresa chilena de consultoría SAP y desarrollo con IA. Responde en español.',
      };

      const fullTask = `${systemPrompts[taskType || 'general'] || systemPrompts.general}\n\n${prompt || task}`;
      const { results, totalMs } = await runAgentsParallel(fullTask, [agentId]);
      const result = results[0];

      return new Response(JSON.stringify({ success: result.status === 'success', result: result.result, tokens: result.tokens, durationMs: totalMs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Toggle agent
    if (action === 'toggle' && agentId) {
      const agents = await supabaseQuery<{ active: boolean }>('agent_config', 'GET', { filter: `agent_id=eq.${agentId}`, limit: 1 });
      if (agents.length === 0) {
        return new Response(JSON.stringify({ error: 'Agente no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const newActive = !agents[0].active;
      await supabaseQuery('agent_config', 'PATCH', { filter: `agent_id=eq.${agentId}`, body: { active: newActive, updated_at: new Date().toISOString() } });
      await supabaseInsert('agent_logs', { agent_id: agentId, agent_name: agentId, action: 'toggle', detail: newActive ? 'Activado' : 'Desactivado', status: 'success' });
      return new Response(JSON.stringify({ success: true, active: newActive }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Get logs
    if (action === 'logs' && agentId) {
      const logs = await supabaseQuery('agent_logs', 'GET', { filter: `agent_id=eq.${agentId}`, order: 'created_at.desc', limit: 20 });
      return new Response(JSON.stringify({ logs }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // List all agents
    if (action === 'list') {
      const allAgents = await supabaseQuery('agent_config', 'GET', { order: 'agent_id' });
      return new Response(JSON.stringify({ agents: allAgents }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Generic query (for intranet pages)
    if (action === 'query' && body.table) {
      const allowed = ['leads', 'reuniones', 'analytics', 'agent_logs', 'agent_config'];
      if (!allowed.includes(body.table)) {
        return new Response(JSON.stringify({ error: 'Tabla no permitida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const data = await supabaseQuery(body.table, 'GET', {
        order: body.order || 'created_at.desc',
        limit: body.limit || 50,
        filter: body.filter,
      });
      return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
