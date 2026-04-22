import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ 
    success: true, 
    message: 'Linear sync initiated (Awaiting OAuth credentials)',
    items: 0,
    status: 'pending_auth'
  });
}
