import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { invokeModel } from '@/services/ai/ai';

/**
 * Section 04.08: MCP Server Implementation
 * Exposes EYES memory to external AI clients (Claude Desktop, Cursor).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { method, params } = body;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. MCP Method Routing
    switch (method) {
      case 'list_tools':
        return handleListTools();
      case 'call_tool':
        return handleCallTool(params.name, params.arguments, user.id, supabase);
      default:
        return NextResponse.json({ error: `Method ${method} not found` }, { status: 404 });
    }

  } catch (err) {
    console.error('[MCP Server] Failure:', err);
    return NextResponse.json({ error: 'Internal MCP Error' }, { status: 500 });
  }
}

function handleListTools() {
  return NextResponse.json({
    tools: [
      {
        name: 'query_my_history',
        description: 'Search through the user\'s synchronized Gmail, Slack, and GitHub memories.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The natural language search query.' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_recent_commitments',
        description: 'Retrieve the latest commitments and tasks detected by EYES.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of tasks to return.' }
          }
        }
      }
    ]
  });
}

async function handleCallTool(name: string, args: any, userId: string, supabase: any) {
  if (name === 'query_my_history') {
    // Re-use our existing neural search logic
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: args.query }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    return NextResponse.json({ content: [{ type: 'text', text: data.answer }] });
  }

  if (name === 'get_recent_commitments') {
    const { data } = await supabase
      .from('detected_commitments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 5);

    const text = data?.map((c: any) => `- [${c.source}] ${c.commitment_text} (Due: ${c.likely_due_date || 'N/A'})`).join('\n');
    return NextResponse.json({ content: [{ type: 'text', text: text || 'No commitments found.' }] });
  }

  return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
}
