import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';

const uploadSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number().max(5 * 1024 * 1024), // 5MB limit
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = uploadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, contentType, size } = result.data;
    
    // Create a unique key for the file
    // Structure: {org_id}/{ticket_id or temp}/{timestamp}-{filename}
    // For simplicity, we'll use a temp folder and move it or just reference it directly.
    // Better: uploads/{user_id}/{uuid}-{filename}
    const key = `uploads/${user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({ 
      uploadUrl: url, 
      key: key 
    });

  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
