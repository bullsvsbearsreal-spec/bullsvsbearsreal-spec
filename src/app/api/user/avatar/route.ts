import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { put, del } from '@vercel/blob';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

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

    // Upload to Vercel Blob — overwrites previous avatar for this user
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'webp';
    const pathname = `avatars/${session.user.id}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false, // deterministic path per user
      contentType: file.type,
    });

    const imageUrl = blob.url;

    // Update user record
    const db = getSQL();
    await db`UPDATE users SET image = ${imageUrl} WHERE id = ${session.user.id}`;

    return NextResponse.json({ image: imageUrl });
  } catch (err: any) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getSQL();

    // Get current avatar URL to delete from blob storage
    const rows = await db`SELECT image FROM users WHERE id = ${session.user.id}`;
    const currentImage = rows[0]?.image as string | null;

    // Delete from Vercel Blob if it's a blob URL
    if (currentImage && currentImage.includes('blob.vercel-storage.com')) {
      try {
        await del(currentImage);
      } catch (err) {
        console.error('Avatar blob delete error (non-fatal):', err);
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
