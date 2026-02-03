import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createConversationSchema, sendMessageSchema } from '@/lib/validators/conversation'
import { z } from 'zod'

/**
 * GET /api/conversations
 * List user's conversations with participants and last message
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch conversations where user is a participant
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants!inner(
          user_id,
          last_read_at,
          is_muted,
          user:users(
            id,
            email,
            role,
            profiles(name, avatar_url, presence_status)
          )
        )
      `)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter to only conversations where user is a participant
    // and transform the data to include participant info
    const userConversations = (conversations as any)?.filter((conv: any) =>
      conv.conversation_participants?.some((p: any) => p.user_id === user.id)
    ).map((conv: any) => ({
      ...conv,
      participants: conv.conversation_participants?.map((p: any) => ({
        userId: p.user_id,
        lastReadAt: p.last_read_at,
        isMuted: p.is_muted,
        ...p.user,
      })),
    })) || []

    return NextResponse.json({ data: userConversations })
  } catch (err) {
    console.error('Error fetching conversations:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/conversations
 * Create a new conversation or find existing direct conversation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()

    // Allow optional initial message
    const extendedSchema = createConversationSchema.extend({
      initialMessage: z.string().min(1).max(10000).optional(),
    })

    const result = extendedSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { type, participantIds, title, ticketId, initialMessage } = result.data

    // For direct conversations, check if one already exists
    if (type === 'direct' && participantIds.length === 1) {
      const otherUserId = participantIds[0]

      // Check if user can message the target user (same org, or partner/client relationship)
      const { data: targetUser, error: targetError } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', otherUserId)
        .single()

      if (targetError || !targetUser) {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        )
      }

      // Check messaging permissions
      const isStaff = ['super_admin', 'staff'].includes((currentUser as any).role)
      const sameOrg = (currentUser as any).organization_id === (targetUser as any).organization_id

      if (!isStaff && !sameOrg) {
        // Check partner/client relationship
        const { data: currentOrg } = await supabase
          .from('organizations')
          .select('parent_org_id')
          .eq('id', (currentUser as any).organization_id)
          .single()

        const { data: targetOrg } = await supabase
          .from('organizations')
          .select('parent_org_id')
          .eq('id', (targetUser as any).organization_id)
          .single()

        const isPartnerClient =
          (currentOrg as any)?.parent_org_id === (targetUser as any).organization_id ||
          (targetOrg as any)?.parent_org_id === (currentUser as any).organization_id

        if (!isPartnerClient) {
          return NextResponse.json(
            { error: 'You are not allowed to message this user' },
            { status: 403 }
          )
        }
      }

      // Check for existing direct conversation
      const { data: existingConversations } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(id, type)
        `)
        .eq('user_id', user.id)

      if (existingConversations) {
        for (const cp of existingConversations) {
          if ((cp.conversations as any)?.type !== 'direct') continue

          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', (cp as any).conversation_id)
            .eq('user_id', otherUserId)
            .single()

          if (otherParticipant) {
            // Found existing conversation - optionally send initial message
            if (initialMessage) {
              await supabase.from('messages').insert({
                conversation_id: (cp as any).conversation_id,
                sender_id: user.id,
                content: initialMessage,
                message_type: 'text',
              })
            }

            // Fetch the full conversation with participants
            const { data: conv } = await supabase
              .from('conversations')
              .select(`
                *,
                conversation_participants(
                  user_id,
                  last_read_at,
                  is_muted,
                  user:users(
                    id,
                    email,
                    role,
                    profiles(name, avatar_url, presence_status)
                  )
                )
              `)
              .eq('id', (cp as any).conversation_id)
              .single()

            return NextResponse.json({ data: conv, existing: true })
          }
        }
      }
    }

    // Create new conversation
    const allParticipantIds = [user.id, ...participantIds.filter(id => id !== user.id)]

    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        organization_id: currentUser.organization_id,
        type,
        title: type !== 'direct' ? title : null,
        ticket_id: ticketId || null,
        participant_ids: allParticipantIds,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating conversation:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Add participants to the join table
    const participantInserts = allParticipantIds.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
    }))

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts)

    if (participantsError) {
      console.error('Error adding participants:', participantsError)
      // Clean up the conversation
      await supabase.from('conversations').delete().eq('id', conversation.id)
      return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 })
    }

    // Send initial message if provided
    if (initialMessage) {
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: initialMessage,
        message_type: 'text',
      })
    }

    // Fetch the full conversation with participants
    const { data: fullConversation } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants(
          user_id,
          last_read_at,
          is_muted,
          user:users(
            id,
            email,
            role,
            profiles(name, avatar_url, presence_status)
          )
        )
      `)
      .eq('id', conversation.id)
      .single()

    return NextResponse.json({ data: fullConversation }, { status: 201 })
  } catch (err) {
    console.error('Error creating conversation:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
