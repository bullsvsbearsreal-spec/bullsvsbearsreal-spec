/**
 * GET /api/mod/spam-detector
 *
 * Flags suspected multi-account / spam signups based on email pattern
 * normalisation. Detected signals:
 *
 *   1. gmail '+tag' suffixes — alice+test@gmail.com, alice+foo@gmail.com
 *   2. gmail '.' dot-tricks  — a.lice@gmail.com vs alice@gmail.com
 *   3. sequential numeric suffix — alice1@x.com, alice2@x.com, alice3@x.com
 *
 * For each cluster, returns the members + the normalised "canonical"
 * email + a heuristic confidence score (0-100). Flag-only — no auto
 * actions, mods review and click suspend manually.
 *
 * Gated by requireMod (admin/owner/moderator). Not for support role
 * (would expose account-linking data they don't need).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireMod } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GMAIL_HOSTS = new Set(['gmail.com', 'googlemail.com']);
const NUMERIC_RE = /^(.+?)(\d{1,4})$/;

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  suspended_at: string | null;
  acq_referer: string | null;
}

interface Cluster {
  canonicalEmail: string;
  signal: 'gmail-tag' | 'gmail-dot' | 'numeric-suffix';
  confidence: number;
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    suspendedAt: string | null;
  }>;
}

/** Normalize email for clustering. Strips gmail dots + +tag, lowercases. */
function gmailCanonical(email: string): string | null {
  const [local, host] = email.toLowerCase().split('@');
  if (!local || !host || !GMAIL_HOSTS.has(host)) return null;
  const tagless = local.split('+')[0];
  const dotless = tagless.replace(/\./g, '');
  if (!dotless) return null;
  // Always normalize host to gmail.com so googlemail.com aliases collapse
  return `${dotless}@gmail.com`;
}

/** Strip a 1-4 digit numeric suffix off the local part. Returns the base
 *  if a suffix was present, null otherwise. */
function stripNumericSuffix(email: string): string | null {
  const [local, host] = email.toLowerCase().split('@');
  if (!local || !host) return null;
  const m = local.match(NUMERIC_RE);
  if (!m) return null;
  // Skip cases where the entire local part is digits (random number-only
  // logins are not "alice1" — they're a different category).
  if (m[1].length < 2) return null;
  return `${m[1]}@${host}`;
}

export async function GET(_req: NextRequest) {
  const denied = await requireMod();
  if (denied) return denied;
  if (!isDBConfigured()) return NextResponse.json({ clusters: [] });

  await initDB();
  const db = getSQL();

  let users: UserRow[] = [];
  try {
    // Cap at 5000 users — anything larger needs proper batching. At
    // current scale this is the full user table and the per-cluster math
    // below stays under a few ms.
    users = await db`
      SELECT id, email, name, role, created_at, suspended_at, acq_referer
      FROM users
      WHERE email IS NOT NULL
        AND email != ''
        AND role NOT IN ('owner', 'admin')
      ORDER BY created_at DESC
      LIMIT 5000
    ` as unknown as UserRow[];
  } catch (e) {
    console.warn('spam detector query failed:', e);
    return NextResponse.json({ clusters: [], error: 'query_failed' }, { status: 500 });
  }

  // Cluster by canonical
  const gmailMap = new Map<string, UserRow[]>();
  const numericMap = new Map<string, UserRow[]>();
  for (const u of users) {
    const email = u.email.toLowerCase();
    const gm = gmailCanonical(email);
    if (gm) {
      const cur = gmailMap.get(gm) ?? [];
      cur.push(u);
      gmailMap.set(gm, cur);
    }
    const num = stripNumericSuffix(email);
    if (num) {
      const cur = numericMap.get(num) ?? [];
      cur.push(u);
      numericMap.set(num, cur);
    }
  }

  const clusters: Cluster[] = [];

  // Gmail clusters (only flag when 2+ members share the canonical).
  // Use forEach to avoid TS iterator config issues with Map entries.
  gmailMap.forEach((members, canonical) => {
    if (members.length < 2) return;
    const someHasTag = members.some((m: UserRow) => m.email.toLowerCase().split('@')[0].includes('+'));
    const signal: Cluster['signal'] = someHasTag ? 'gmail-tag' : 'gmail-dot';
    // Confidence: 60 base + 10 per member (capped at 95). If all signups
    // are within 24h of each other, bump by 15.
    const times = members.map((m: UserRow) => new Date(m.created_at).getTime()).sort((a: number, b: number) => a - b);
    const span = times[times.length - 1] - times[0];
    const burst = span < 24 * 3600 * 1000;
    const confidence = Math.min(95, 60 + members.length * 10 + (burst ? 15 : 0));
    clusters.push({
      canonicalEmail: canonical,
      signal,
      confidence,
      members: members.map((m: UserRow) => ({
        id: m.id, email: m.email, name: m.name, role: m.role,
        createdAt: m.created_at, suspendedAt: m.suspended_at,
      })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    });
  });

  // Numeric-suffix clusters
  numericMap.forEach((members, canonical) => {
    if (members.length < 2) return;
    // Skip if these are already in a gmail cluster (avoid double-counting)
    const alreadyFlagged = members.some((m: UserRow) => {
      const gm = gmailCanonical(m.email);
      return gm && (gmailMap.get(gm)?.length ?? 0) > 1;
    });
    if (alreadyFlagged) return;
    const times = members.map((m: UserRow) => new Date(m.created_at).getTime()).sort((a: number, b: number) => a - b);
    const span = times[times.length - 1] - times[0];
    const burst = span < 24 * 3600 * 1000;
    const confidence = Math.min(85, 40 + members.length * 8 + (burst ? 20 : 0));
    clusters.push({
      canonicalEmail: canonical,
      signal: 'numeric-suffix',
      confidence,
      members: members.map((m: UserRow) => ({
        id: m.id, email: m.email, name: m.name, role: m.role,
        createdAt: m.created_at, suspendedAt: m.suspended_at,
      })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    });
  });

  // Sort by confidence DESC, then member count DESC.
  clusters.sort((a, b) => b.confidence - a.confidence || b.members.length - a.members.length);

  return NextResponse.json({
    clusters: clusters.slice(0, 100),
    total: clusters.length,
  });
}
