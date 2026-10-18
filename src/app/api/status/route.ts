import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    pagespeed: !!process.env.GOOGLE_PSI_API_KEY,
    serper: !!process.env.SERPER_API_KEY,
  });
}
