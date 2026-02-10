import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's org
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    // Get request body
    const { folderPath } = await request.json();

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { error: "Folder path is required" },
        { status: 400 }
      );
    }

    // Validate folder path
    if (!/^[a-zA-Z0-9-_ /]+$/.test(folderPath)) {
      return NextResponse.json(
        { error: "Invalid folder path. Use only letters, numbers, spaces, hyphens, underscores, and slashes" },
        { status: 400 }
      );
    }

    // Get AWS config
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!bucketName || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "AWS S3 is not configured" },
        { status: 500 }
      );
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Create the folder by uploading an empty object with a trailing slash
    // S3 uses trailing slash to indicate a folder/prefix
    const orgPrefix = `org_${profile.organization_id}`;
    const isPrivileged =
      profile.role === "super_admin" || profile.role === "staff";

    let s3Key: string;

    if (isPrivileged) {
      // Staff/admin: create folder in org directory
      s3Key = `${orgPrefix}/${folderPath}/`;
    } else {
      // Client: create folder in their user directory
      s3Key = `${orgPrefix}/user_${user.id}/${folderPath}/`;
    }

    // Upload empty object to create the folder
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: "",
      ContentType: "application/x-directory",
    });

    await s3Client.send(command);

    return NextResponse.json(
      {
        success: true,
        message: "Folder created successfully",
        data: {
          folderPath,
          s3Key,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
