'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ImagePlus, X } from 'lucide-react';

export interface ImageAttachment {
  base64: string; // raw base64, no data: prefix
  mediaType: string;
  dataUrl: string; // for preview display
}

interface ChatInputProps {
  onSend: (message: string, image?: ImageAttachment) => void;
  isLoading: boolean;
  remaining?: number;
}

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5MB after resize

function resizeImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // If small enough, use directly
        const dataUrl = reader.result as string;
        const [header, base64] = dataUrl.split(',');
        const mediaType = header.match(/:(.*?);/)?.[1] || 'image/png';

        if (file.size <= MAX_IMAGE_SIZE) {
          resolve({ base64, mediaType, dataUrl });
          return;
        }

        // Resize: cap at 1200px wide, compress as JPEG
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const maxW = 1200;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const [rHeader, rBase64] = resizedDataUrl.split(',');
        const rMediaType = rHeader.match(/:(.*?);/)?.[1] || 'image/jpeg';
        resolve({ base64: rBase64, mediaType: rMediaType, dataUrl: resizedDataUrl });
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({ onSend, isLoading, remaining }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB hard cap
    try {
      const attachment = await resizeImage(file);
      setImage(attachment);
    } catch {
      // silently fail
    }
  }, []);

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFile]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && !image) || isLoading) return;
    if (trimmed.length > 1000) return;
    onSend(trimmed || 'Analyze this chart', image || undefined);
    setInput('');
    setImage(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-white/[0.06] p-3">
      {remaining !== undefined && remaining <= 10 && (
        <div className="text-[10px] text-neutral-600 mb-1.5 text-center">
          {remaining} messages remaining today
        </div>
      )}

      {/* Image preview */}
      {image && (
        <div className="mb-2 relative inline-block">
          <img
            src={image.dataUrl}
            alt="Chart"
            className="h-20 rounded-lg border border-white/[0.08] object-cover"
          />
          <button
            onClick={() => setImage(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white
              flex items-center justify-center hover:bg-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {/* Image upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isLoading || !!image}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
            text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200"
          title="Upload chart (or Ctrl+V to paste)"
        >
          <ImagePlus className="w-4 h-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={image ? 'Describe what to analyze...' : 'Ask MK.II anything...'}
          rows={1}
          maxLength={1000}
          className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5
            text-[13px] text-white placeholder-neutral-600 outline-none
            focus:border-amber-500/30 focus:bg-white/[0.06]
            transition-colors duration-200 scrollbar-thin"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSubmit}
          disabled={(!input.trim() && !image) || isLoading}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
            bg-amber-500 text-black font-semibold
            hover:bg-amber-400 active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
