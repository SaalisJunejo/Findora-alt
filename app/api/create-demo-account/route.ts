import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabase-admin';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Create user via Admin API with email_confirm: true (bypassing email confirmation & rate limits)
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    const user = createData.user;

    if (!user) {
      return NextResponse.json(
        { error: 'User creation failed.' },
        { status: 500 }
      );
    }

    // Ensure profile row exists in public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          contact_email: email,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.warn('Profile creation note:', profileError.message);
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error during demo account creation.' },
      { status: 500 }
    );
  }
}
