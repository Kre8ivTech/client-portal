import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check S3 configuration
    if (!BUCKET_NAME) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: "Storage credentials not configured" },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Get file extension
    const extension = file.type.split("/")[1];
    const filename = `avatar.${extension}`;
    const objectKey = `avatars/${user.id}/${filename}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        userId: user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Store the S3 object key in the profile rather than a hardcoded public URL.
    // This avoids assuming the bucket allows public reads and lets us generate
    // presigned URLs on demand. Consumers of avatar_url should check whether the
    // stored value is a full URL or an object key and resolve accordingly.
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({
        avatar_url: objectKey,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    // Generate a presigned URL for immediate client use (valid for 1 hour)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600,
    });

    return NextResponse.json({
      success: true,
      avatar_url: presignedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
