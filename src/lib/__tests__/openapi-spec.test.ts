/**
 * Defensive checks on the OpenAPI spec so a schema $ref typo or
 * accidental deletion of a referenced component fails CI instead of
 * silently breaking codegen / Swagger UI / Postman imports.
 *
 * Test scope: structural integrity only — not API correctness. The
 * /api/v1/openapi route serves whatever `openApiSpec` exports; if
 * this test passes, the spec parses and every $ref resolves.
 */

import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../openapi-spec';

type AnyObj = Record<string, unknown>;

/** Collect every $ref string anywhere in the spec, recursively. */
function collectRefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach(n => collectRefs(n, out));
    return out;
  }
  if (node && typeof node === 'object') {
    const obj = node as AnyObj;
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$ref' && typeof v === 'string') out.push(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

describe('openApiSpec', () => {
  it('declares OpenAPI 3.x', () => {
    expect(openApiSpec.openapi).toMatch(/^3\.\d+\.\d+$/);
  });

  it('has info.title + version', () => {
    expect(openApiSpec.info?.title).toBeTruthy();
    expect(openApiSpec.info?.version).toBeTruthy();
  });

  it('defines components.schemas', () => {
    const schemas = (openApiSpec.components as AnyObj | undefined)?.schemas as AnyObj | undefined;
    expect(schemas).toBeTruthy();
    expect(Object.keys(schemas!).length).toBeGreaterThan(5);
  });

  it('every $ref resolves to a defined component', () => {
    const schemas = ((openApiSpec.components as AnyObj | undefined)?.schemas as AnyObj | undefined) ?? {};
    const refs = collectRefs(openApiSpec);
    const unresolved: string[] = [];
    for (const ref of refs) {
      // Only check #/components/schemas/* refs (the only shape we use)
      const m = /^#\/components\/schemas\/(.+)$/.exec(ref);
      if (!m) {
        unresolved.push(ref + ' (unrecognized $ref format)');
        continue;
      }
      if (!(m[1] in schemas)) unresolved.push(m[1]);
    }
    expect(unresolved, `Unresolved $refs: ${unresolved.join(', ')}`).toEqual([]);
  });

  it('includes the new fee-aware endpoints', () => {
    const paths = (openApiSpec.paths as AnyObj | undefined) ?? {};
    expect('/arbitrage' in paths).toBe(true);
    expect('/spreads' in paths).toBe(true);
    expect('/funding-arb' in paths).toBe(true);
  });

  it('FeeModel schema is referenced from at least the fee-sensitive endpoints', () => {
    const refs = collectRefs(openApiSpec);
    const feeModelHits = refs.filter(r => r === '#/components/schemas/FeeModel');
    expect(feeModelHits.length).toBeGreaterThanOrEqual(1);
  });

  it('ArbitrageResponse + SpreadsResponse + FeeModel are defined', () => {
    const schemas = ((openApiSpec.components as AnyObj | undefined)?.schemas as AnyObj | undefined) ?? {};
    expect('ArbitrageResponse' in schemas).toBe(true);
    expect('ArbitrageOpportunity' in schemas).toBe(true);
    expect('SpreadsResponse' in schemas).toBe(true);
    expect('SpreadRow' in schemas).toBe(true);
    expect('FeeModel' in schemas).toBe(true);
  });
});
