import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generatePresignedUrl } from '@/lib/storage/s3'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/contracts/[id]/download
 * Generate presigned S3 URL for contract download
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info for permission check
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get contract - RLS handles access control
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, title, organization_id, s3_key, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if contract has a file stored
    if (!contract.s3_key) {
      return NextResponse.json(
        { error: 'Contract file not available' },
        { status: 404 }
      )
    }

    // Check permissions - user must belong to same org or be admin
    const isAdmin = userRow.role === 'super_admin' || userRow.role === 'staff'
    const isSameOrg = userRow.organization_id === contract.organization_id

    if (!isAdmin && !isSameOrg) {
      return NextResponse.json(
        { error: 'You do not have permission to download this contract' },
        { status: 403 }
      )
    }

    // Generate presigned URL (valid for 1 hour)
    let presignedUrl: string

    try {
      presignedUrl = await generatePresignedUrl(contract.s3_key, 3600)
    } catch (s3Error) {
      console.error('S3 error:', s3Error)
      return NextResponse.json(
        {
          error: 'Failed to generate download URL',
          details: s3Error instanceof Error ? s3Error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        url: presignedUrl,
        expires_in: 3600,
        filename: `${contract.title}.pdf`,
      },
    })
  } catch (err) {
    console.error('Error generating download URL:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
