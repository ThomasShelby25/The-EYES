import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ 
    success: true, 
    message: 'Sync initiated (Awaiting authentication)',
    items: 0,
    status: 'pending_auth'
  });
}
