import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Simple in-memory rate limit: 5 per IP per hour
const rateBuckets = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.reset) {
    rateBuckets.set(ip, { count: 1, reset: now + 3600_000 });
    return true;
  }
  if (bucket.count >= 5) return false;
  bucket.count++;
  return true;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Cleanup stale rate-limit buckets every 10 min
let lastRateCleanup = Date.now();
function cleanupRateBuckets() {
  const now = Date.now();
  if (now - lastRateCleanup < 600_000) return;
  lastRateCleanup = now;
  rateBuckets.forEach((v, k) => { if (now > v.reset) rateBuckets.delete(k); });
}

export async function POST(request: NextRequest) {
  try {
    // CSRF: verify Origin header matches our domain
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = ['https://info-hub.io', 'https://www.info-hub.io'];
    if (process.env.NODE_ENV === 'development') allowedOrigins.push('http://localhost:3000');
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Content-Type check
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    cleanupRateBuckets();

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase().slice(0, 254);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Store in PostgreSQL
    if (isDBConfigured()) {
      const sql = getSQL();
      try {
        await sql`
          INSERT INTO waitlist (email, name, source)
          VALUES (${email}, ${name}, 'website')
          ON CONFLICT (email) DO NOTHING
        `;
      } catch (dbErr: any) {
        // Table might not exist yet on first deploy
        if (dbErr.message?.includes('does not exist')) {
          console.warn('[waitlist] Table not yet created, skipping DB insert');
        } else {
          console.error('[waitlist] DB error:', dbErr);
        }
      }
    }

    // Add to Resend audience
    const resend = getResend();
    if (resend) {
      try {
        // Try to add contact to audience (if RESEND_AUDIENCE_ID is set)
        const audienceId = process.env.RESEND_AUDIENCE_ID;
        if (audienceId) {
          await resend.contacts.create({
            audienceId,
            email,
            firstName: name || undefined,
            unsubscribed: false,
          });
        }

        // Send confirmation email
        await resend.emails.send({
          from: 'InfoHub <noreply@info-hub.io>',
          to: email,
          subject: "You're on the InfoHub waitlist! 🚀",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0a0a0a; color: #e5e5e5; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: #ffffff;">
                  Info<span style="color: #ffa500;">Hub</span>
                </h1>
              </div>
              <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px;">You're in! 🎉</h2>
              <p style="color: #a3a3a3; line-height: 1.6; margin: 0 0 16px;">
                Thanks for joining the InfoHub waitlist. You'll be among the first to know when we launch.
              </p>
              <p style="color: #a3a3a3; line-height: 1.6; margin: 0 0 24px;">
                We're building the most comprehensive real-time crypto derivatives dashboard.
                Funding rates, liquidations, open interest, and more from 33+ exchanges.
              </p>
              <div style="background: #1a1a1a; border: 1px solid rgba(255,165,0,0.15); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #ffa500; font-weight: 600; margin: 0 0 8px; font-size: 14px;">What you'll get:</p>
                <ul style="color: #a3a3a3; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                  <li>Real-time funding rates from 33 exchanges</li>
                  <li>Live liquidation feed (WebSocket)</li>
                  <li>Open interest tracking ($70B+)</li>
                  <li>Prediction market arbitrage scanner</li>
                  <li>ETF tracker, screener, and more</li>
                </ul>
              </div>
              <p style="color: #525252; font-size: 11px; text-align: center; margin: 0;">
                InfoHub · Real-time crypto derivatives intelligence
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('[waitlist] Email error:', emailErr);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true, message: "You're on the list!" });
  } catch (err) {
    console.error('[waitlist] Error:', err);
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
