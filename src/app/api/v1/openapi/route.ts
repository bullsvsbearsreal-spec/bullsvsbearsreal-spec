import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi-spec';
import { FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT } from '@/lib/constants/exchanges';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

/**
 * GET /api/v1/openapi
 *
 * Returns the OpenAPI 3.1 specification for the v1 API in JSON form.
 * Public — no auth required (the schema is public knowledge anyway).
 *
 * Plug into Swagger UI / Redoc / Insomnia / Postman / Stoplight Studio
 * directly via this URL. Useful for codegen too:
 *   openapi-typescript https://info-hub.io/api/v1/openapi -o src/api-types.ts
 *
 * X-Fee-Model-Version is mirrored on the response so codegen tools that
 * cache the schema know when to refresh after a fee-model bump.
 *
 * Cache: 1 hour at the edge — the spec only changes when we ship.
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      // Expose the X-Fee-Model-* headers to cross-origin JavaScript.
      // Without this, browser clients caching the spec couldn't read
      // X-Fee-Model-Version (despite Allow-Origin: *) and would have
      // to refetch the whole spec body just to detect a fee-table
      // bump — defeats the cheap-poll pattern the spec advertises.
      'Access-Control-Expose-Headers': 'X-Fee-Model-Version, X-Fee-Model-Updated-At',
      'X-Fee-Model-Version': FEE_MODEL_VERSION,
      'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
    },
  });
}
