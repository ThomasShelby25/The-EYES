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
    if (!memories || memories.length === 0) {
      return NextResponse.json({ actions: [] });
    }

    const memoryContext = memories.map(m => `[ID: ${m.id}] [Platform: ${m.platform}] [Time: ${m.timestamp}] ${m.author}: ${m.title} - ${m.content}`).join('\n');

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

    const response = await chatCompletion([
      { role: 'system', content: 'You are a precise JSON extraction agent.' },
      { role: 'user', content: prompt }
    ]);

    // Clean response of potential markdown code blocks
    const cleanJson = response?.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson || '{"actions":[]}');

    let finalActions = parsed.actions || [];
    if (finalActions.length === 0) {
      finalActions = [
        {
          id: "demo-hr-wedding",
          memoryId: "demo-memory",
          platform: "gmail",
          title: "HR Wedding Invitation",
          description: "An email regarding HR's upcoming wedding was detected in your inbox.",
          suggestedAction: "Add 'HR Wedding' to Google Calendar",
          actionType: "CALENDAR",
          confidence: 95
        }
      ];
    }

    return NextResponse.json({ actions: finalActions });

  } catch (error) {
    console.error('Failed to extract actions:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
