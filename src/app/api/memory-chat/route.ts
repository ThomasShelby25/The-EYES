import { NextResponse } from 'next/server';

import { POST as chatPost } from '@/app/api/chat/route';
import type { ChatRequest, ChatResponse } from '@/types/dashboard';

export async function POST(request: Request) {
  let payload: ChatRequest | null = null;

  try {
    payload = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const prompt = payload?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  try {
    const delegatedRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, history: [] }),
    });

    const delegatedResponse = await chatPost(delegatedRequest);
    const delegatedBody = (await delegatedResponse.json()) as { answer?: string; error?: string };

    if (!delegatedResponse.ok) {
      return NextResponse.json(
        {
          reply: delegatedBody.error || 'I could not process your memory query right now.',
        } satisfies ChatResponse,
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        reply: delegatedBody.answer || 'No response received from memory assistant.',
      } satisfies ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('memory-chat error:', error);
    return NextResponse.json(
      { reply: 'I could not process your memory query right now.' } satisfies ChatResponse,
      { status: 200 }
    );
  }
}
