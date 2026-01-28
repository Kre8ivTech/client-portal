import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createTicketSchema } from '@/lib/validators/ticket';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  
  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  
  let query = supabase
    .from('tickets')
    .select('*, created_by:profiles!tickets_created_by_fkey(name, avatar_url), assigned_to:profiles!tickets_assigned_to_fkey(name, avatar_url)')
    .order('created_at', { ascending: false });
    
  if (status) {
    query = query.eq('status', status);
  }
  
  if (priority) {
    query = query.eq('priority', priority);
  }
  
  const { data: tickets, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ data: tickets });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    const body = await request.json();
    const result = createTicketSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
      
    if (!profile?.organization_id) {
       return NextResponse.json({ error: 'User does not belong to an organization' }, { status: 403 });
    }

    // Insert
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        ...result.data,
        organization_id: profile.organization_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
