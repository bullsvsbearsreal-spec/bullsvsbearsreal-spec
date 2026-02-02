'use client';

import Header from '@/components/Header';
import Logo from '@/components/Logo';
import { Download, Copy, Check, ExternalLink, Package, Palette, Type, Image, FileDown } from 'lucide-react';
import { useState } from 'react';

// Brand Colors
const brandColors = {
  primary: [
    { name: 'Gold Light', hex: '#FFE55C', description: 'Highlight accents' },
    { name: 'Gold', hex: '#FFD700', description: 'Primary brand color' },
    { name: 'Orange', hex: '#FFA500', description: 'Main accent' },
    { name: 'Orange Dark', hex: '#FF8C00', description: 'Deep accents' },
  ],
  background: [
    { name: 'Black', hex: '#0D0D0D', description: 'Primary background' },
    { name: 'Dark Gray', hex: '#1A1A1A', description: 'Card backgrounds' },
    { name: 'Gray', hex: '#2A2A2A', description: 'Borders, dividers' },
    { name: 'Light Gray', hex: '#3A3A3A', description: 'Hover states' },
  ],
  text: [
    { name: 'White', hex: '#FFFFFF', description: 'Primary text' },
    { name: 'Gray Light', hex: '#B3B3B3', description: 'Secondary text' },
    { name: 'Gray', hex: '#808080', description: 'Muted text' },
  ],
  semantic: [
    { name: 'Success', hex: '#22C55E', description: 'Positive values' },
    { name: 'Error', hex: '#EF4444', description: 'Negative values' },
    { name: 'Warning', hex: '#F59E0B', description: 'Warnings' },
    { name: 'Info', hex: '#3B82F6', description: 'Information' },
  ],
};

// Downloadable assets
const downloadableAssets = [
  {
    category: 'Logo - Primary',
    items: [
      { name: 'Icon (Gradient)', file: '/logo-icon.svg', format: 'SVG', size: '512x512', description: 'Primary logo icon with gradient' },
      { name: 'Full Logo', file: '/logo-full.svg', format: 'SVG', size: '800x200', description: 'Full logo with wordmark' },
    ]
  },
  {
    category: 'Logo - Variations',
    items: [
      { name: 'Icon (Dark)', file: '/logo-icon-dark.svg', format: 'SVG', size: '512x512', description: 'Dark version for light backgrounds' },
      { name: 'Icon (White)', file: '/logo-icon-white.svg', format: 'SVG', size: '512x512', description: 'Monochrome white version' },
    ]
  },
  {
    category: 'Social Media',
    items: [
      { name: 'OG Image', file: '/og-image.svg', format: 'SVG', size: '1200x630', description: 'Open Graph / link previews' },
      { name: 'Twitter Header', file: '/twitter-header.svg', format: 'SVG', size: '1500x500', description: 'Twitter/X profile banner' },
      { name: 'Discord Banner', file: '/discord-banner.svg', format: 'SVG', size: '960x540', description: 'Discord server banner' },
    ]
  },
  {
    category: 'App Icons',
    items: [
      { name: 'Favicon', file: '/favicon.svg', format: 'SVG', size: '32x32', description: 'Browser tab icon' },
      { name: 'Icon 192px', file: '/icon-192.svg', format: 'SVG', size: '192x192', description: 'Android/PWA icon' },
      { name: 'Icon 512px', file: '/icon-512.svg', format: 'SVG', size: '512x512', description: 'High-res app icon' },
      { name: 'Apple Touch', file: '/apple-touch-icon.svg', format: 'SVG', size: '180x180', description: 'iOS home screen' },
    ]
  },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-hub-gray/50 transition-colors text-xs"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-success" />
          <span className="text-success">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-hub-gray-text" />
          {label && <span className="text-hub-gray-text">{label}</span>}
        </>
      )}
    </button>
  );
}

function ColorCard({ name, hex, description }: { name: string; hex: string; description?: string }) {
  return (
    <div className="group relative">
      <div
        className="h-24 rounded-xl mb-3 border border-white/10 transition-transform group-hover:scale-105"
        style={{ backgroundColor: hex }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-medium text-sm">{name}</p>
          <p className="text-hub-gray-text text-xs font-mono">{hex}</p>
          {description && <p className="text-hub-gray-text text-xs mt-1">{description}</p>}
        </div>
        <CopyButton text={hex} />
      </div>
    </div>
  );
}

function DownloadCard({ name, file, format, size, description }: {
  name: string;
  file: string;
  format: string;
  size: string;
  description: string;
}) {
  return (
    <div className="glass-card p-4 rounded-xl hover:border-hub-yellow/30 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-medium">{name}</h4>
          <p className="text-hub-gray-text text-xs mt-1">{description}</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-hub-yellow/10 text-hub-yellow text-xs font-medium">
          {format}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-hub-gray-text text-xs font-mono">{size}</span>
        <a
          href={file}
          download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow/10 text-hub-yellow text-sm font-medium hover:bg-hub-yellow/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 mb-6">
            <Package className="w-4 h-4 text-hub-yellow" />
            <span className="text-sm text-hub-yellow font-medium">Brand Assets</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">Info</span>
            <span className="text-gradient">Hub</span>
            <span className="text-white"> Brand Kit</span>
          </h1>
          <p className="text-hub-gray-text text-lg max-w-2xl mx-auto">
            Download official logos, icons, and brand assets. All assets are free to use for InfoHub-related projects and integrations.
          </p>
        </div>

        {/* Quick Download */}
        <section className="mb-16">
          <div className="glass-card p-8 rounded-2xl border-hub-yellow/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-hub-gray/30 flex items-center justify-center">
                  <Logo variant="icon" size="xl" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Quick Download</h2>
                  <p className="text-hub-gray-text">Get the primary logo and all essential assets in one click</p>
                </div>
              </div>
              <a
                href="/logo-icon.svg"
                download="infohub-logo.svg"
                className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-semibold"
              >
                <FileDown className="w-5 h-5" />
                Download Logo
              </a>
            </div>
          </div>
        </section>

        {/* Logo Preview */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Image className="w-6 h-6 text-hub-yellow" />
            <h2 className="text-2xl font-bold text-white">Logo</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Primary Logo */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="bg-hub-gray/30 rounded-xl p-12 mb-6 flex items-center justify-center">
                <Logo variant="full" size="xl" />
              </div>
              <h3 className="text-white font-semibold mb-2">Primary Logo</h3>
              <p className="text-hub-gray-text text-sm mb-4">Use this as the default logo on dark backgrounds.</p>
              <a
                href="/logo-full.svg"
                download
                className="btn-secondary flex items-center justify-center gap-2 w-full py-2.5 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download SVG
              </a>
            </div>

            {/* Icon Only */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="bg-hub-gray/30 rounded-xl p-12 mb-6 flex items-center justify-center">
                <Logo variant="icon" size="xl" />
              </div>
              <h3 className="text-white font-semibold mb-2">Icon Mark</h3>
              <p className="text-hub-gray-text text-sm mb-4">Square icon for app icons, favicons, and avatars.</p>
              <a
                href="/logo-icon.svg"
                download
                className="btn-secondary flex items-center justify-center gap-2 w-full py-2.5 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Download SVG
              </a>
            </div>
          </div>

          {/* Logo Variations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl text-center">
              <div className="bg-hub-gray/30 rounded-lg p-6 mb-3 flex items-center justify-center">
                <img src="/logo-icon.svg" alt="Gradient" className="w-16 h-16" />
              </div>
              <p className="text-white text-sm font-medium">Gradient</p>
              <p className="text-hub-gray-text text-xs">Dark backgrounds</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center">
              <div className="bg-hub-gray/30 rounded-lg p-6 mb-3 flex items-center justify-center">
                <img src="/logo-icon-dark.svg" alt="Dark" className="w-16 h-16" />
              </div>
              <p className="text-white text-sm font-medium">Dark</p>
              <p className="text-hub-gray-text text-xs">Light backgrounds</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center">
              <div className="bg-white rounded-lg p-6 mb-3 flex items-center justify-center">
                <img src="/logo-icon-white.svg" alt="White" className="w-16 h-16" />
              </div>
              <p className="text-white text-sm font-medium">White</p>
              <p className="text-hub-gray-text text-xs">Any solid color</p>
            </div>
            <div className="glass-card p-4 rounded-xl text-center">
              <div className="bg-hub-yellow rounded-lg p-6 mb-3 flex items-center justify-center">
                <img src="/logo-icon-white.svg" alt="On Brand" className="w-16 h-16 invert" />
              </div>
              <p className="text-white text-sm font-medium">On Brand</p>
              <p className="text-hub-gray-text text-xs">Orange backgrounds</p>
            </div>
          </div>
        </section>

        {/* All Downloads */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <FileDown className="w-6 h-6 text-hub-yellow" />
            <h2 className="text-2xl font-bold text-white">All Assets</h2>
          </div>

          <div className="space-y-8">
            {downloadableAssets.map((category) => (
              <div key={category.category}>
                <h3 className="text-lg font-semibold text-white mb-4">{category.category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.items.map((item) => (
                    <DownloadCard key={item.name} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-hub-yellow" />
            <h2 className="text-2xl font-bold text-white">Color Palette</h2>
          </div>

          <div className="space-y-8">
            {/* Primary */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Primary Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {brandColors.primary.map((color) => (
                  <ColorCard key={color.hex} {...color} />
                ))}
              </div>
            </div>

            {/* Background */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Background Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {brandColors.background.map((color) => (
                  <ColorCard key={color.hex} {...color} />
                ))}
              </div>
            </div>

            {/* Semantic */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Semantic Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {brandColors.semantic.map((color) => (
                  <ColorCard key={color.hex} {...color} />
                ))}
              </div>
            </div>

            {/* Gradient */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Brand Gradient</h3>
              <div className="glass-card p-6 rounded-xl">
                <div
                  className="h-32 rounded-xl mb-4"
                  style={{ background: 'linear-gradient(135deg, #FFE55C 0%, #FFD700 30%, #FFA500 70%, #FF8C00 100%)' }}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Primary Gradient</p>
                    <p className="text-hub-gray-text text-sm font-mono mt-1">
                      linear-gradient(135deg, #FFE55C, #FFD700, #FFA500, #FF8C00)
                    </p>
                  </div>
                  <CopyButton
                    text="linear-gradient(135deg, #FFE55C 0%, #FFD700 30%, #FFA500 70%, #FF8C00 100%)"
                    label="Copy CSS"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Type className="w-6 h-6 text-hub-yellow" />
            <h2 className="text-2xl font-bold text-white">Typography</h2>
          </div>

          <div className="glass-card p-8 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-hub-gray-text text-sm mb-3">Primary Font</h3>
                <p className="text-4xl font-bold text-white mb-2">Inter</p>
                <p className="text-hub-gray-text text-sm mb-4">
                  Used for all UI text, headings, and body copy.
                </p>
                <div className="flex items-center gap-2">
                  <CopyButton text="font-family: 'Inter', system-ui, sans-serif;" label="Copy CSS" />
                  <a
                    href="https://fonts.google.com/specimen/Inter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-hub-yellow text-sm hover:underline"
                  >
                    Google Fonts <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div>
                <h3 className="text-hub-gray-text text-sm mb-3">Monospace Font</h3>
                <p className="text-4xl font-bold text-white font-mono mb-2">JetBrains Mono</p>
                <p className="text-hub-gray-text text-sm mb-4">
                  Used for code, numbers, and data display.
                </p>
                <div className="flex items-center gap-2">
                  <CopyButton text="font-family: 'JetBrains Mono', monospace;" label="Copy CSS" />
                  <a
                    href="https://fonts.google.com/specimen/JetBrains+Mono"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-hub-yellow text-sm hover:underline"
                  >
                    Google Fonts <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-hub-gray/30">
              <h3 className="text-hub-gray-text text-sm mb-4">Font Weights</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                  <span className="text-white font-normal">Regular</span>
                  <span className="text-hub-gray-text text-sm font-mono">400</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                  <span className="text-white font-medium">Medium</span>
                  <span className="text-hub-gray-text text-sm font-mono">500</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                  <span className="text-white font-semibold">Semibold</span>
                  <span className="text-hub-gray-text text-sm font-mono">600</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                  <span className="text-white font-bold">Bold</span>
                  <span className="text-hub-gray-text text-sm font-mono">700</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                  <span className="text-white font-extrabold">Extrabold</span>
                  <span className="text-hub-gray-text text-sm font-mono">800</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Usage Guidelines</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl border-l-4 border-success">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-success/20 rounded-full flex items-center justify-center text-success text-sm">✓</span>
                Do
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>• Use the gradient logo on dark backgrounds (#0D0D0D or darker)</li>
                <li>• Maintain minimum clear space equal to the icon height</li>
                <li>• Use the dark version on light or white backgrounds</li>
                <li>• Scale proportionally without distortion</li>
                <li>• Use monochrome version for single-color printing</li>
                <li>• Credit InfoHub when using assets publicly</li>
              </ul>
            </div>

            <div className="glass-card p-6 rounded-xl border-l-4 border-error">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-error/20 rounded-full flex items-center justify-center text-error text-sm">✕</span>
                Don't
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>• Don't stretch, skew, or distort the logo</li>
                <li>• Don't change the logo colors arbitrarily</li>
                <li>• Don't add shadows, glows, or other effects</li>
                <li>• Don't place on busy or low-contrast backgrounds</li>
                <li>• Don't rotate or flip the logo</li>
                <li>• Don't use the logo to imply endorsement</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
