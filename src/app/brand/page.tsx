'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Logo from '@/components/Logo';
import { Download, Copy, Check, ExternalLink, Package, Palette, Type, FileDown, Sparkles, Eye, Grid3X3 } from 'lucide-react';

// Brand Colors
const brandColors = {
  primary: [
    { name: 'Yellow', hex: '#FFDF00', rgb: '255, 223, 0' },
    { name: 'Gold', hex: '#FFD000', rgb: '255, 208, 0' },
    { name: 'Amber', hex: '#FFAA00', rgb: '255, 170, 0' },
    { name: 'Orange', hex: '#FF9500', rgb: '255, 149, 0' },
    { name: 'Deep Orange', hex: '#FF7700', rgb: '255, 119, 0' },
  ],
  dark: [
    { name: 'Black', hex: '#0D0D0D', rgb: '13, 13, 13' },
    { name: 'Dark', hex: '#1A1A1A', rgb: '26, 26, 26' },
    { name: 'Gray Dark', hex: '#2A2A2A', rgb: '42, 42, 42' },
    { name: 'Gray', hex: '#3A3A3A', rgb: '58, 58, 58' },
  ],
  semantic: [
    { name: 'Success', hex: '#22C55E', rgb: '34, 197, 94' },
    { name: 'Error', hex: '#EF4444', rgb: '239, 68, 68' },
    { name: 'Warning', hex: '#F59E0B', rgb: '245, 158, 11' },
    { name: 'Info', hex: '#3B82F6', rgb: '59, 130, 246' },
  ],
};

const assets = [
  { name: 'Logo Icon', file: '/logo-icon.svg', desc: 'Primary gradient logo', size: '512x512' },
  { name: 'Logo Full', file: '/logo-full.svg', desc: 'Logo with wordmark', size: '400x100' },
  { name: 'Logo Dark', file: '/logo-icon-dark.svg', desc: 'Dark background version', size: '512x512' },
  { name: 'Logo White', file: '/logo-icon-white.svg', desc: 'White/light version', size: '512x512' },
  { name: 'Favicon', file: '/favicon.svg', desc: 'Browser tab icon', size: '32x32' },
  { name: 'OG Image', file: '/og-image.svg', desc: 'Social media preview', size: '1200x630' },
  { name: 'Twitter Banner', file: '/twitter-header.svg', desc: 'Twitter/X header', size: '1500x500' },
  { name: 'Discord Banner', file: '/discord-banner.svg', desc: 'Discord server', size: '960x540' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-hub-gray-text" />}
    </button>
  );
}

function ColorSwatch({ name, hex, rgb }: { name: string; hex: string; rgb: string }) {
  return (
    <div className="group">
      <div
        className="h-20 rounded-xl mb-3 ring-1 ring-white/10 group-hover:ring-white/20 group-hover:scale-105 transition-all cursor-pointer"
        style={{ backgroundColor: hex }}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">{name}</p>
          <p className="text-hub-gray-text text-xs font-mono">{hex}</p>
        </div>
        <CopyButton text={hex} />
      </div>
    </div>
  );
}

function AssetCard({ name, file, desc, size }: { name: string; file: string; desc: string; size: string }) {
  return (
    <div className="group bg-hub-gray/20 hover:bg-hub-gray/40 border border-hub-gray/30 hover:border-hub-yellow/30 rounded-2xl p-5 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-hub-gray/50 flex items-center justify-center group-hover:bg-hub-yellow/10 transition-colors">
          <img src={file} alt={name} className="w-8 h-8 object-contain" />
        </div>
        <span className="text-xs font-mono text-hub-gray-text bg-hub-gray/50 px-2 py-1 rounded-lg">{size}</span>
      </div>
      <h3 className="text-white font-semibold mb-1">{name}</h3>
      <p className="text-hub-gray-text text-sm mb-4">{desc}</p>
      <a
        href={file}
        download
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-hub-yellow/10 hover:bg-hub-yellow/20 text-hub-yellow text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        Download SVG
      </a>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-hub-yellow/20 to-hub-orange/20 border border-hub-yellow/30 mb-6">
            <Sparkles className="w-4 h-4 text-hub-yellow" />
            <span className="text-sm text-hub-yellow font-semibold">Brand Kit</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-white">Info</span>
            <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">Hub</span>
            <span className="text-white"> Brand</span>
          </h1>
          <p className="text-hub-gray-text text-lg max-w-xl mx-auto">
            Download official logos, colors, and brand assets for your integrations.
          </p>
        </div>

        {/* Quick Download Banner */}
        <section className="mb-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-hub-yellow/10 via-hub-orange/10 to-hub-yellow/5 border border-hub-yellow/20 p-8 md:p-12">
            <div className="absolute top-0 right-0 w-64 h-64 bg-hub-yellow/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 rounded-3xl bg-hub-gray/30 backdrop-blur flex items-center justify-center ring-1 ring-white/10">
                <Logo variant="icon" size="xl" animated />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Download Logo Pack</h2>
                <p className="text-hub-gray-text mb-6">Get all logo variants in one click - SVG format, ready for any use.</p>
                <a
                  href="/logo-icon.svg"
                  download="infohub-logo.svg"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-hub-yellow to-hub-orange text-black font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-hub-yellow/25"
                >
                  <FileDown className="w-5 h-5" />
                  Download Logo
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Logo Showcase */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Logo</h2>
              <p className="text-hub-gray-text text-sm">Primary and alternate versions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Primary Logo */}
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-3xl p-8">
              <div className="bg-gradient-to-br from-hub-gray/40 to-hub-gray/20 rounded-2xl p-12 mb-6 flex items-center justify-center">
                <Logo variant="full" size="xl" animated />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Full Logo</h3>
                  <p className="text-hub-gray-text text-sm">Icon + wordmark</p>
                </div>
                <a href="/logo-full.svg" download className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-yellow/10 text-hub-yellow text-sm font-medium hover:bg-hub-yellow/20 transition-colors">
                  <Download className="w-4 h-4" />
                  SVG
                </a>
              </div>
            </div>

            {/* Icon Only */}
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-3xl p-8">
              <div className="bg-gradient-to-br from-hub-gray/40 to-hub-gray/20 rounded-2xl p-12 mb-6 flex items-center justify-center">
                <Logo variant="icon" size="xl" animated />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Icon Mark</h3>
                  <p className="text-hub-gray-text text-sm">App icons, favicons</p>
                </div>
                <a href="/logo-icon.svg" download className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hub-yellow/10 text-hub-yellow text-sm font-medium hover:bg-hub-yellow/20 transition-colors">
                  <Download className="w-4 h-4" />
                  SVG
                </a>
              </div>
            </div>
          </div>

          {/* Logo Variations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6 text-center group hover:border-hub-yellow/30 transition-colors">
              <div className="bg-hub-gray/40 rounded-xl p-6 mb-4 flex items-center justify-center">
                <img src="/logo-icon.svg" alt="Gradient" className="w-16 h-16 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-white text-sm font-medium">Gradient</p>
              <p className="text-hub-gray-text text-xs">Dark backgrounds</p>
            </div>
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6 text-center group hover:border-hub-yellow/30 transition-colors">
              <div className="bg-hub-gray/40 rounded-xl p-6 mb-4 flex items-center justify-center">
                <img src="/logo-icon-dark.svg" alt="Dark" className="w-16 h-16 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-white text-sm font-medium">Dark</p>
              <p className="text-hub-gray-text text-xs">Neon style</p>
            </div>
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6 text-center group hover:border-hub-yellow/30 transition-colors">
              <div className="bg-white rounded-xl p-6 mb-4 flex items-center justify-center">
                <img src="/logo-icon-white.svg" alt="White" className="w-16 h-16 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-white text-sm font-medium">White</p>
              <p className="text-hub-gray-text text-xs">Light backgrounds</p>
            </div>
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6 text-center group hover:border-hub-yellow/30 transition-colors">
              <div className="bg-gradient-to-br from-hub-yellow to-hub-orange rounded-xl p-6 mb-4 flex items-center justify-center">
                <img src="/logo-icon-white.svg" alt="On color" className="w-16 h-16 invert group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-white text-sm font-medium">On Color</p>
              <p className="text-hub-gray-text text-xs">Brand backgrounds</p>
            </div>
          </div>
        </section>

        {/* All Assets */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">All Assets</h2>
              <p className="text-hub-gray-text text-sm">Download individual files</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <AssetCard key={asset.name} {...asset} />
            ))}
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Colors</h2>
              <p className="text-hub-gray-text text-sm">Brand color palette</p>
            </div>
          </div>

          {/* Primary Gradient */}
          <div className="mb-8">
            <h3 className="text-white font-semibold mb-4">Brand Gradient</h3>
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
              <div
                className="h-24 rounded-xl mb-4"
                style={{ background: 'linear-gradient(135deg, #FFDF00 0%, #FFD000 25%, #FFAA00 50%, #FF9500 75%, #FF7700 100%)' }}
              />
              <div className="flex items-center justify-between">
                <code className="text-hub-gray-text text-sm font-mono">
                  linear-gradient(135deg, #FFDF00, #FFAA00, #FF7700)
                </code>
                <CopyButton text="linear-gradient(135deg, #FFDF00 0%, #FFD000 25%, #FFAA00 50%, #FF9500 75%, #FF7700 100%)" />
              </div>
            </div>
          </div>

          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-white font-semibold mb-4">Primary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {brandColors.primary.map((c) => <ColorSwatch key={c.hex} {...c} />)}
            </div>
          </div>

          {/* Dark Colors */}
          <div className="mb-8">
            <h3 className="text-white font-semibold mb-4">Dark</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {brandColors.dark.map((c) => <ColorSwatch key={c.hex} {...c} />)}
            </div>
          </div>

          {/* Semantic Colors */}
          <div>
            <h3 className="text-white font-semibold mb-4">Semantic</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {brandColors.semantic.map((c) => <ColorSwatch key={c.hex} {...c} />)}
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Type className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Typography</h2>
              <p className="text-hub-gray-text text-sm">Fonts and weights</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-8">
              <p className="text-hub-gray-text text-sm mb-2">Primary Font</p>
              <p className="text-4xl font-bold text-white mb-4">Inter</p>
              <p className="text-hub-gray-text text-sm mb-4">Used for all UI elements, headings, and body text.</p>
              <div className="flex items-center gap-3">
                <a
                  href="https://fonts.google.com/specimen/Inter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-hub-yellow text-sm hover:underline"
                >
                  Google Fonts <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-8">
              <p className="text-hub-gray-text text-sm mb-2">Monospace Font</p>
              <p className="text-4xl font-bold text-white font-mono mb-4">JetBrains</p>
              <p className="text-hub-gray-text text-sm mb-4">Used for code, numbers, and data values.</p>
              <div className="flex items-center gap-3">
                <a
                  href="https://fonts.google.com/specimen/JetBrains+Mono"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-hub-yellow text-sm hover:underline"
                >
                  Google Fonts <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Guidelines */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Guidelines</h2>
              <p className="text-hub-gray-text text-sm">Logo usage rules</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-success/5 border border-success/20 rounded-2xl p-6">
              <h3 className="text-success font-semibold mb-4 flex items-center gap-2">
                <Check className="w-5 h-5" />
                Do
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>Use gradient logo on dark backgrounds</li>
                <li>Maintain clear space around the logo</li>
                <li>Use white logo on colored backgrounds</li>
                <li>Scale proportionally</li>
              </ul>
            </div>

            <div className="bg-error/5 border border-error/20 rounded-2xl p-6">
              <h3 className="text-error font-semibold mb-4 flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center">✕</span>
                Don't
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>Stretch or distort the logo</li>
                <li>Change logo colors arbitrarily</li>
                <li>Add effects like shadows or glows</li>
                <li>Place on busy backgrounds</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
