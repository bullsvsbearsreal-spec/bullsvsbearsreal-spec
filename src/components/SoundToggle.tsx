'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useSound } from '@/hooks/useSound'

export default function SoundToggle() {
  const { enabled, toggle } = useSound()

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-white/5 text-neutral-500 hover:text-neutral-300"
      aria-label={enabled ? 'Mute sound effects' : 'Enable sound effects'}
      title={enabled ? 'Sound on' : 'Sound off'}
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  )
}
