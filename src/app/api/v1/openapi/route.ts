import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi-spec';

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
 * Cache: 1 hour at the edge — the spec only changes when we ship.
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
