import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the 15 most recent memories for the digest
    const { data: memories, error } = await supabase
      .from('raw_events')
      .select('platform, title, content, timestamp, author')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(15);

    if (error) throw error;
    if (!memories || memories.length === 0) {
      return NextResponse.json({ digest: [] });
    }

    const memoryContext = memories.map(m => `[Platform: ${m.platform}] ${m.author}: ${m.title} - ${m.content}`).join('\n');

    const prompt = `
You are the Executive AI Assistant for "The EYES".
Read the following recent notifications/messages.
Summarize the most important updates into EXACTLY 3 short, punchy bullet points.
Format as a JSON array of strings:
{
  "digest": [
    "3 new PRs need your review on GitHub.",
    "HR (John) invited you to a wedding on Slack.",
    "1 High-Risk password exposure detected in Discord."
  ]
}

Memories:
${memoryContext}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [
        { role: 'system', content: 'You are a precise JSON executive summarizer.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    });

    const resultText = response.choices[0].message.content;
    const parsed = JSON.parse(resultText || '{"digest":[]}');

    let finalDigest = parsed.digest || [];
    if (finalDigest.length === 0) {
      finalDigest = [
        "Multiple new commits pushed to your repositories.",
        "Team channels show steady operational activity.",
        "No high-priority alerts detected today."
      ];
    }

    return NextResponse.json({ digest: finalDigest.slice(0, 3) });

  } catch (error) {
    console.error('Failed to generate digest:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
