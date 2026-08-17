import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { phoneOrId } = await request.json();

    if (!phoneOrId) {
      return NextResponse.json({ error: 'Phone number or User ID required' }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('name, role, phone_number')
      .or(`phone_number.eq.${phoneOrId},name.eq.${phoneOrId}`)
      .maybeSingle();

    const emailBody = user
      ? `PIN reset requested.\n\nName: ${user.name}\nRole: ${user.role}\nPhone/ID: ${user.phone_number || phoneOrId}\n\nReset this in Supabase Dashboard → Authentication → Users, then run:\nupdate users set must_change_pin = true where phone_number = '${user.phone_number || phoneOrId}';`
      : `PIN reset requested for an unrecognized ID: "${phoneOrId}". No matching user found in the users table — please check manually.`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Gobyk Daily Ops <onboarding@resend.dev>',
        to: 'ciifrol@gmail.com',
        subject: 'Gobyk Daily Ops — PIN Reset Request',
        text: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.json();
      return NextResponse.json({ error: 'Email send failed', details }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}