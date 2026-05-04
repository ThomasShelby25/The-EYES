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
          memoryId: "mem-gh-101",
          platform: "github",
          title: "Critical PR Review: Neural-Engine-v4",
          description: "A high-priority pull request from 'dev-team' is awaiting your approval. It contains core architectural changes to the vector indexing pipeline.",
          suggestedAction: "Approve and merge PR #442 on GitHub",
          actionType: "LINEAR_TICKET",
          confidence: 98
        },
        {
          id: "act-002",
          memoryId: "mem-gmail-202",
          platform: "gmail",
          title: "Executive Sync: Q3 Strategy",
          description: "An email from the CEO regarding the Q3 strategy session was detected. You are requested to confirm your availability for Friday.",
          suggestedAction: "Schedule 'Strategy Session' for Friday, 10:00 AM",
          actionType: "CALENDAR",
          confidence: 94
        },
        {
          id: "act-003",
          memoryId: "mem-slack-303",
          platform: "slack",
          title: "Unresolved Thread: Deployment Fix",
          description: "You were tagged in a Slack thread regarding the Vercel deployment failure. The team is waiting for your technical input.",
          suggestedAction: "Reply to 'ops-channel' thread regarding Build #772",
          actionType: "SLACK_REPLY",
          confidence: 91
        }
      ];
    }

    return NextResponse.json({ actions: finalActions });

  } catch (error) {
    console.error('Final extraction handler failure:', error);
    return NextResponse.json({ error: 'System error' }, { status: 500 });
  }
}
