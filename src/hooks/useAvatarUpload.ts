'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface UseAvatarUploadReturn {
  inputRef: React.RefObject<HTMLInputElement>;
  /** Currently saved avatar URL (from DB) */
  url: string | null;
  setUrl: (url: string | null) => void;
  /** Local preview data URL (not yet saved) */
  preview: string | null;
  /** True when a new image has been picked but not yet saved */
  hasUnsaved: boolean;
  uploading: boolean;
  error: string;
  /** Pick a file — sets local preview, does NOT upload */
  handlePick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Save the picked image — uploads to server */
  handleSave: () => Promise<void>;
  /** Cancel the picked image — discard preview */
  handleCancel: () => void;
  /** Remove saved avatar from server */
  handleRemove: () => Promise<void>;
}

export function useAvatarUpload(initialUrl: string | null = null): UseAvatarUploadReturn {
  const { update: updateSession } = useSession();
  const inputRef = useRef<HTMLInputElement>(null!);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const hasUnsaved = preview !== null;

  // Pick file → resize → show local preview (no upload yet)
  const handlePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Use JPG, PNG, WebP, or GIF');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Resize to 256x256 and create local preview
    (async () => {
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

        // Create local preview URL
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        setPreview(dataUrl);
        setPendingBlob(blob);
      } catch {
        setError('Failed to process image');
      }
    })();

    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // Save → upload the pending blob to server
  const handleSave = useCallback(async () => {
    if (!pendingBlob) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('avatar', pendingBlob, 'avatar.webp');
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Upload failed');
      } else {
        setUrl(json.image);
        setPreview(null);
        setPendingBlob(null);
        await updateSession();
      }
    } catch {
      setError('Upload failed');
    }
    setUploading(false);
  }, [pendingBlob, updateSession]);

  // Cancel → discard preview
  const handleCancel = useCallback(() => {
    setPreview(null);
    setPendingBlob(null);
    setError('');
  }, []);

  // Remove saved avatar
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
        setPreview(null);
        setPendingBlob(null);
        await updateSession();
      }
    } catch {
      setError('Remove failed');
    }
    setUploading(false);
  }, [url, updateSession]);

  return { inputRef, url, setUrl, preview, hasUnsaved, uploading, error, handlePick, handleSave, handleCancel, handleRemove };
}
