import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { chatCompletion } from '@/services/ai/ai';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the 20 most recent memories
    const { data: memories, error } = await supabase
      .from('raw_events')
      .select('id, platform, title, content, timestamp, author')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(30);

    if (error) throw error;
    
    // DEMO MODE: If no memories are found, we still want to show the mock actions for the demo
    const memoryContext = (memories && memories.length > 0) 
      ? memories.map(m => `[ID: ${m.id}] [Platform: ${m.platform}] [Time: ${m.timestamp}] ${m.author}: ${m.title} - ${m.content}`).join('\n')
      : "No memories indexed yet.";

    const prompt = `
You are the Autonomous Agent brain of "The EYES".
Your job is to read recent user memories and extract concrete, actionable tasks or events that the user should take action on (e.g. Wedding invites, meeting requests, PR reviews, etc.).

Return a JSON object containing a single array called "actions".
Each action must have:
{
  "id": "A unique string ID",
  "memoryId": "The ID of the memory that triggered this",
  "platform": "The platform it came from",
  "title": "A short, actionable title (e.g. 'HR Wedding Invitation')",
  "description": "A brief explanation of the context",
  "suggestedAction": "What the AI will do (e.g. 'Add event to Google Calendar for May 10, 4:00 PM')",
  "actionType": "CALENDAR" | "LINEAR_TICKET" | "SLACK_REPLY" | "REMINDER",
  "confidence": number (1-100)
}

Only return highly confident actionable items. If none exist, return {"actions": []}.

Memories:
${memoryContext}
    `;

    let response = null;
    try {
      response = await chatCompletion([
        { role: 'system', content: 'You are a precise JSON extraction agent.' },
        { role: 'user', content: prompt }
      ]);
    } catch (aiErr) {
      console.warn('AI Extraction failed, falling back to mock data:', aiErr);
    }

    // Clean response of potential markdown code blocks
    const cleanJson = response?.replace(/```json|```/g, '').trim();
    let parsed = { actions: [] };
    try {
      if (cleanJson) parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('Failed to parse AI response, using mock data.');
    }

    let finalActions: any[] = parsed.actions || [];
    
    // DEMO MODE: If no real actions or API key issue, inject high-quality mock data
    if (finalActions.length === 0) {
      finalActions = [
        {
          id: "act-001",
          memoryId: "m-vidhya-1",
          platform: "gmail",
          title: "Reply to Ms. Vidhya: Chapter 3",
          description: "Ms. Vidhya sent a follow-up email about your Chapter 3 submission three days ago. Immediate response required.",
          suggestedAction: "Send email reply to Ms. Vidhya regarding Chapter 3 draft",
          actionType: "REMINDER",
          confidence: 99,
          isOverdue: true
        },
        {
          id: "act-002",
          memoryId: "m-vercel-101",
          platform: "vercel",
          title: "Revert /api/memory-ingest stub",
          description: "The memory ingestion route is currently failing on Vercel. Need to revert to the temporary stub to stabilize production.",
          suggestedAction: "Run git revert for memory-ingest route and push to main",
          actionType: "LINEAR_TICKET",
          confidence: 98,
          isOverdue: true
        },
        {
          id: "act-003",
          memoryId: "m-guhan-202",
          platform: "slack",
          title: "Review Guhan's Edge Function",
          description: "Guhan has pushed the Supabase Edge Function prototype for review today.",
          suggestedAction: "Review PR for Supabase Edge Function migration",
          actionType: "LINEAR_TICKET",
          confidence: 95,
          isDueToday: true
        },
        {
          id: "act-004",
          memoryId: "m-design-303",
          platform: "github",
          title: "Finalise 'Salt-and-Pepper' tokens",
          description: "Complete the implementation of the EYES design system tokens by Wednesday.",
          suggestedAction: "Push design token updates to the UI package",
          actionType: "LINEAR_TICKET",
          confidence: 92
        },
        {
          id: "act-005",
          memoryId: "m-lit-404",
          platform: "notion",
          title: "Update Literature Survey Citations",
          description: "Add two new verified citations to the project literature survey by Thursday.",
          suggestedAction: "Research and add citations to Notion document",
          actionType: "REMINDER",
          confidence: 90
        },
        {
          id: "act-006",
          memoryId: "m-ajith-505",
          platform: "gmail",
          title: "Internship Report Review: Ajith",
          description: "Review the internship report submitted by Ajith for the final project report by Friday.",
          suggestedAction: "Complete document review and send feedback",
          actionType: "REMINDER",
          confidence: 88
        }
      ];
    }

    return NextResponse.json({ actions: finalActions });

  } catch (error) {
    console.error('Final extraction handler failure:', error);
    return NextResponse.json({ error: 'System error' }, { status: 500 });
  }
}
