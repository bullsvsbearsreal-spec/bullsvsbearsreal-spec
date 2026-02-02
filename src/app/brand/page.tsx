'use client';

import Header from '@/components/Header';
import Logo from '@/components/brand/Logo';
import { brandColors, typography, spacing, socialDimensions, ColorSwatch } from '@/components/brand/BrandAssets';
import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-hub-gray/50 transition-colors"
    >
      {copied ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4 text-hub-gray-text" />
      )}
    </button>
  );
}

function ColorCard({ name, hex, description }: { name: string; hex: string; description?: string }) {
  return (
    <div className="glass-card p-4 rounded-xl">
      <div
        className="w-full h-20 rounded-lg mb-3 border border-white/10"
        style={{ backgroundColor: hex }}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium text-sm">{name}</p>
          <p className="text-hub-gray-text text-xs font-mono">{hex}</p>
        </div>
        <CopyButton text={hex} />
      </div>
      {description && (
        <p className="text-hub-gray-text text-xs mt-2">{description}</p>
      )}
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">Brand </span>
            <span className="text-gradient">Guidelines</span>
          </h1>
          <p className="text-hub-gray-text text-lg max-w-2xl mx-auto">
            Official brand assets and guidelines for InfoHub. Download logos, colors, and assets for consistent brand representation.
          </p>
        </div>

        {/* Logo Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Logo</h2>
          <div className="glass-card p-8 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Full Logo - Gradient */}
              <div className="text-center">
                <div className="bg-hub-gray/30 rounded-xl p-8 mb-4 flex items-center justify-center min-h-[120px]">
                  <Logo variant="full" size="lg" theme="gradient" />
                </div>
                <p className="text-white font-medium text-sm">Full Logo</p>
                <p className="text-hub-gray-text text-xs">Primary usage</p>
              </div>

              {/* Icon Only */}
              <div className="text-center">
                <div className="bg-hub-gray/30 rounded-xl p-8 mb-4 flex items-center justify-center min-h-[120px]">
                  <Logo variant="icon" size="xl" theme="gradient" />
                </div>
                <p className="text-white font-medium text-sm">Icon Only</p>
                <p className="text-hub-gray-text text-xs">App icons, favicons</p>
              </div>

              {/* Dark Theme */}
              <div className="text-center">
                <div className="bg-white rounded-xl p-8 mb-4 flex items-center justify-center min-h-[120px]">
                  <Logo variant="icon" size="xl" theme="dark" />
                </div>
                <p className="text-white font-medium text-sm">Dark Version</p>
                <p className="text-hub-gray-text text-xs">Light backgrounds</p>
              </div>

              {/* Mono */}
              <div className="text-center">
                <div className="bg-hub-gray/30 rounded-xl p-8 mb-4 flex items-center justify-center min-h-[120px]">
                  <Logo variant="icon" size="xl" theme="mono" />
                </div>
                <p className="text-white font-medium text-sm">Monochrome</p>
                <p className="text-hub-gray-text text-xs">Single color usage</p>
              </div>
            </div>

            {/* Download buttons */}
            <div className="mt-8 pt-6 border-t border-hub-gray/30">
              <p className="text-hub-gray-text text-sm mb-4">Download Assets</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/favicon.svg"
                  download
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  Favicon SVG
                </a>
                <a
                  href="/icon-512.svg"
                  download
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  Icon 512px
                </a>
                <a
                  href="/og-image.svg"
                  download
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  OG Image
                </a>
                <a
                  href="/twitter-header.svg"
                  download
                  className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  Twitter Header
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Color Palette</h2>

          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Primary Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <ColorCard name="Yellow" hex={brandColors.primary.yellow} description="Main brand color" />
              <ColorCard name="Orange" hex={brandColors.primary.orange} description="Accent color" />
              <ColorCard name="Gold" hex={brandColors.primary.gold} description="Highlight color" />
            </div>
          </div>

          {/* Background Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Background Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <ColorCard name="Primary BG" hex={brandColors.background.primary} />
              <ColorCard name="Secondary BG" hex={brandColors.background.secondary} />
              <ColorCard name="Tertiary BG" hex={brandColors.background.tertiary} />
              <ColorCard name="Card BG" hex={brandColors.background.card} />
            </div>
          </div>

          {/* Semantic Colors */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Semantic Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <ColorCard name="Success" hex={brandColors.semantic.success} />
              <ColorCard name="Error" hex={brandColors.semantic.error} />
              <ColorCard name="Warning" hex={brandColors.semantic.warning} />
              <ColorCard name="Info" hex={brandColors.semantic.info} />
            </div>
          </div>
        </section>

        {/* Gradients */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Gradients</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl">
              <div
                className="w-full h-24 rounded-lg mb-4"
                style={{ background: brandColors.gradients.primary }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Primary Gradient</p>
                  <p className="text-hub-gray-text text-xs font-mono mt-1">
                    linear-gradient(135deg, #FFD700, #FFA500, #FF8C00)
                  </p>
                </div>
                <CopyButton text="linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <div
                className="w-full h-24 rounded-lg mb-4"
                style={{ background: brandColors.gradients.secondary }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Secondary Gradient</p>
                  <p className="text-hub-gray-text text-xs font-mono mt-1">
                    linear-gradient(135deg, #FFA500, #FF6B00)
                  </p>
                </div>
                <CopyButton text="linear-gradient(135deg, #FFA500 0%, #FF6B00 100%)" />
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Typography</h2>
          <div className="glass-card p-8 rounded-2xl">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Font Family</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-hub-gray/30 rounded-xl">
                  <p className="text-hub-gray-text text-xs mb-2">Primary</p>
                  <p className="text-white text-2xl font-semibold" style={{ fontFamily: typography.fontFamily.primary }}>
                    Inter
                  </p>
                  <p className="text-hub-gray-text text-sm mt-2 font-mono">
                    {typography.fontFamily.primary}
                  </p>
                </div>
                <div className="p-4 bg-hub-gray/30 rounded-xl">
                  <p className="text-hub-gray-text text-xs mb-2">Monospace</p>
                  <p className="text-white text-2xl font-semibold" style={{ fontFamily: typography.fontFamily.mono }}>
                    JetBrains Mono
                  </p>
                  <p className="text-hub-gray-text text-sm mt-2 font-mono">
                    {typography.fontFamily.mono}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Font Weights</h3>
              <div className="space-y-3">
                {Object.entries(typography.fontWeight).map(([name, weight]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-hub-gray/20 rounded-lg">
                    <span className="text-white" style={{ fontWeight: weight }}>
                      The quick brown fox ({name})
                    </span>
                    <span className="text-hub-gray-text text-sm font-mono">{weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Logo Usage Guidelines */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Usage Guidelines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl border-l-4 border-success">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-success/20 rounded-full flex items-center justify-center text-success text-sm">✓</span>
                Do
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>• Use the logo on dark backgrounds (#0D0D0D or darker)</li>
                <li>• Maintain minimum clear space equal to the "i" height</li>
                <li>• Use gradient version as the primary choice</li>
                <li>• Scale proportionally</li>
                <li>• Use monochrome for single-color contexts</li>
              </ul>
            </div>

            <div className="glass-card p-6 rounded-xl border-l-4 border-error">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-error/20 rounded-full flex items-center justify-center text-error text-sm">✕</span>
                Don't
              </h3>
              <ul className="space-y-2 text-hub-gray-text text-sm">
                <li>• Don't stretch or distort the logo</li>
                <li>• Don't change the logo colors arbitrarily</li>
                <li>• Don't add effects like shadows or glows</li>
                <li>• Don't place on busy backgrounds</li>
                <li>• Don't rotate the logo</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Social Media Sizes */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Social Media Sizes</h2>
          <div className="glass-card p-6 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hub-gray/30">
                  <th className="text-left py-3 px-4 text-hub-gray-text font-medium">Platform</th>
                  <th className="text-left py-3 px-4 text-hub-gray-text font-medium">Asset</th>
                  <th className="text-left py-3 px-4 text-hub-gray-text font-medium">Dimensions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-hub-gray/20">
                  <td className="py-3 px-4 text-white">Twitter/X</td>
                  <td className="py-3 px-4 text-hub-gray-text">Header</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.twitterHeader.width} x {socialDimensions.twitterHeader.height}</td>
                </tr>
                <tr className="border-b border-hub-gray/20">
                  <td className="py-3 px-4 text-white">Twitter/X</td>
                  <td className="py-3 px-4 text-hub-gray-text">Profile</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.twitterProfile.width} x {socialDimensions.twitterProfile.height}</td>
                </tr>
                <tr className="border-b border-hub-gray/20">
                  <td className="py-3 px-4 text-white">LinkedIn</td>
                  <td className="py-3 px-4 text-hub-gray-text">Banner</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.linkedinBanner.width} x {socialDimensions.linkedinBanner.height}</td>
                </tr>
                <tr className="border-b border-hub-gray/20">
                  <td className="py-3 px-4 text-white">Discord</td>
                  <td className="py-3 px-4 text-hub-gray-text">Server Icon</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.discordServer.width} x {socialDimensions.discordServer.height}</td>
                </tr>
                <tr className="border-b border-hub-gray/20">
                  <td className="py-3 px-4 text-white">Discord</td>
                  <td className="py-3 px-4 text-hub-gray-text">Banner</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.discordBanner.width} x {socialDimensions.discordBanner.height}</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-white">General</td>
                  <td className="py-3 px-4 text-hub-gray-text">OG Image</td>
                  <td className="py-3 px-4 text-hub-gray-text font-mono">{socialDimensions.ogImage.width} x {socialDimensions.ogImage.height}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
