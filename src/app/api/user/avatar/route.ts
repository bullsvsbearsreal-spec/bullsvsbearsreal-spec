import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import postgres from 'postgres';

export const runtime = 'nodejs';

const DATABASE_URL = process.env.DATABASE_URL || '';
const DO_SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT || '';
const DO_SPACES_KEY = process.env.DO_SPACES_KEY || '';
const DO_SPACES_SECRET = process.env.DO_SPACES_SECRET || '';
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'infohub';
const DO_SPACES_CDN = process.env.DO_SPACES_CDN || '';

let sql: ReturnType<typeof postgres> | null = null;
function getSQL() {
  if (!sql) sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 20, ssl: 'require' });
  return sql;
}

function getS3() {
  return new S3Client({
    endpoint: DO_SPACES_ENDPOINT,
    region: 'us-east-1', // DO Spaces ignores region but SDK requires it
    credentials: {
      accessKeyId: DO_SPACES_KEY,
      secretAccessKey: DO_SPACES_SECRET,
    },
    forcePathStyle: false,
  });
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB (already resized client-side)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let imageUrl: string;

    if (DO_SPACES_ENDPOINT && DO_SPACES_KEY && DO_SPACES_SECRET) {
      // Upload to DO Spaces (S3-compatible)
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'webp';
      const key = `avatars/${session.user.id}.${ext}`;
      const s3 = getS3();
      await s3.send(new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read',
      }));
      // Cache-bust: append timestamp so CDN/browser fetches the new version
      const cacheBust = `?v=${Date.now()}`;
      imageUrl = DO_SPACES_CDN
        ? `${DO_SPACES_CDN}/${key}${cacheBust}`
        : `${DO_SPACES_ENDPOINT}/${DO_SPACES_BUCKET}/${key}${cacheBust}`;
    } else {
      // No S3 storage configured — reject upload instead of storing base64 in DB.
      // Base64 data URIs bloat JWT cookies past Vercel's 32KB header limit (494 error).
      return NextResponse.json(
        { error: 'Avatar uploads are temporarily unavailable. Please try again later.' },
        { status: 503 },
      );
    }

    // Update user record
    const db = getSQL();
    await db`UPDATE users SET image = ${imageUrl} WHERE id = ${session.user.id}`;

    return NextResponse.json({ image: imageUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getSQL();

    // Get current avatar URL to determine if S3 cleanup is needed
    const rows = await db`SELECT image FROM users WHERE id = ${session.user.id}`;
    const currentImage = rows[0]?.image as string | null;

    // Delete from S3 if it's a cloud URL (not a data: URL)
    if (currentImage && !currentImage.startsWith('data:') && DO_SPACES_ENDPOINT && DO_SPACES_KEY) {
      try {
        // Derive the S3 key from the URL pathname
        // CDN URL pathname: /avatars/userId.ext → key: avatars/userId.ext
        // Endpoint URL pathname: /bucket/avatars/userId.ext → key: avatars/userId.ext
        const urlPath = new URL(currentImage).pathname;
        const parts = urlPath.split('/').filter(Boolean);
        const avatarIdx = parts.indexOf('avatars');
        const s3Key = avatarIdx >= 0 ? parts.slice(avatarIdx).join('/') : parts.join('/');
        const s3 = getS3();
        await s3.send(new DeleteObjectCommand({
          Bucket: DO_SPACES_BUCKET,
          Key: s3Key,
        }));
      } catch (err) {
        console.error('Avatar S3 delete error (non-fatal):', err);
      }
    }

    // Clear image in DB
    await db`UPDATE users SET image = NULL WHERE id = ${session.user.id}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Avatar delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
