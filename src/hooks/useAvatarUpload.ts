'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface UseAvatarUploadReturn {
  inputRef: React.RefObject<HTMLInputElement>;
  url: string | null;
  setUrl: (url: string | null) => void;
  uploading: boolean;
  error: string;
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemove: () => Promise<void>;
}

export function useAvatarUpload(initialUrl: string | null = null): UseAvatarUploadReturn {
  const { update: updateSession } = useSession();
  const inputRef = useRef<HTMLInputElement>(null!);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Use JPG, PNG, WebP, or GIF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }

    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const size = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - size) / 2;
      const sy = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas conversion failed'))),
          'image/webp',
          0.85,
        );
      });

      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.webp');
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Upload failed');
      } else {
        setUrl(json.image);
        await updateSession();
      }
    } catch {
      setError('Upload failed');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [updateSession]);

  const handleRemove = useCallback(async () => {
    if (!url) return;
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Remove failed');
      } else {
        setUrl(null);
        await updateSession();
      }
    } catch {
      setError('Remove failed');
    }
    setUploading(false);
  }, [url, updateSession]);

  return { inputRef, url, setUrl, uploading, error, handleUpload, handleRemove };
}
