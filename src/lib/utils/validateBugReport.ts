/**
 * Pure validation for the /api/feedback POST body. Extracted from the
 * route handler so the validation contract is unit-testable without
 * spinning up Next.js + Postgres for every assertion.
 *
 * Returns either a successful normalised payload (ready to insert into
 * bug_reports) or a validation error message + HTTP status.
 */

const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 4;
const MAX_PAGE_URL = 500;
const MAX_PAGE_TITLE = 200;
const MAX_USER_AGENT = 500;
const MAX_VIEWPORT = 32;

const VALID_SEVERITIES = ['low', 'normal', 'high'] as const;
type Severity = typeof VALID_SEVERITIES[number];

export interface ValidatedBugReport {
  message: string;
  pageUrl: string;
  severity: Severity;
  pageTitle: string | null;
  userAgent: string | null;
  viewport: string | null;
}

export type ValidationResult =
  | { ok: true; data: ValidatedBugReport }
  | { ok: false; error: string; status: 400 };

export function validateBugReport(body: unknown): ValidationResult {
  // Body must be an object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be an object', status: 400 };
  }
  const b = body as Record<string, unknown>;

  // Message: required, 4-2000 chars after trim
  const messageRaw = typeof b.message === 'string' ? b.message.trim() : '';
  if (messageRaw.length < MIN_MESSAGE) {
    return {
      ok: false,
      error: `Message must be at least ${MIN_MESSAGE} characters`,
      status: 400,
    };
  }
  if (messageRaw.length > MAX_MESSAGE) {
    return {
      ok: false,
      error: `Message must be at most ${MAX_MESSAGE} characters`,
      status: 400,
    };
  }

  // pageUrl: required, sliced to 500
  const pageUrl = typeof b.pageUrl === 'string' ? b.pageUrl.slice(0, MAX_PAGE_URL) : '';
  if (!pageUrl) {
    return { ok: false, error: 'pageUrl required', status: 400 };
  }

  // severity: enum, default 'normal'
  const severity: Severity = VALID_SEVERITIES.includes(b.severity as Severity)
    ? (b.severity as Severity)
    : 'normal';

  // Optional string fields, sliced to per-field caps
  const pageTitle = typeof b.pageTitle === 'string'
    ? b.pageTitle.slice(0, MAX_PAGE_TITLE)
    : null;
  const userAgent = typeof b.userAgent === 'string' && b.userAgent
    ? b.userAgent.slice(0, MAX_USER_AGENT)
    : null;
  const viewport = typeof b.viewport === 'string' && b.viewport
    ? b.viewport.slice(0, MAX_VIEWPORT)
    : null;

  return {
    ok: true,
    data: {
      message: messageRaw,
      pageUrl,
      severity,
      pageTitle,
      userAgent,
      viewport,
    },
  };
}
