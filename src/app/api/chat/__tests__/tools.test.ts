import { describe, it, expect } from 'vitest';
import { CHAT_TOOLS } from '../tools';

describe('CHAT_TOOLS', () => {
  it('is non-empty', () => {
    expect(CHAT_TOOLS.length).toBeGreaterThan(0);
  });

  it('every tool has a name + description + input_schema', () => {
    CHAT_TOOLS.forEach((tool) => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    });
  });

  it('tool names are unique (no duplicate registrations)', () => {
    const names = CHAT_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('tool names follow snake_case (Anthropic SDK convention)', () => {
    CHAT_TOOLS.forEach((tool) => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });

  it('every input_schema has properties (even if empty object)', () => {
    CHAT_TOOLS.forEach((tool) => {
      const schema = tool.input_schema as { properties?: unknown };
      expect(schema.properties).toBeDefined();
    });
  });

  it('contains the core market-data tools (smoke test)', () => {
    const names = CHAT_TOOLS.map((t) => t.name);
    expect(names).toContain('get_funding_rates');
    expect(names).toContain('get_open_interest');
    expect(names).toContain('get_tickers');
    expect(names).toContain('get_top_movers');
    expect(names).toContain('get_fear_greed_index');
  });

  it('contains advanced analysis tools (whales, ETF, onchain)', () => {
    const names = CHAT_TOOLS.map((t) => t.name);
    expect(names).toContain('get_whale_positions');
    expect(names).toContain('get_etf_flows');
    expect(names).toContain('get_onchain_metrics');
    expect(names).toContain('get_market_cycle');
  });

  it('contains prediction market + macro tools', () => {
    const names = CHAT_TOOLS.map((t) => t.name);
    expect(names).toContain('get_prediction_markets');
    expect(names).toContain('get_economic_calendar');
    expect(names).toContain('get_news');
  });

  it('tools with required fields declare them in input_schema.required', () => {
    // get_funding_history requires `symbol`
    const fundingHistory = CHAT_TOOLS.find((t) => t.name === 'get_funding_history');
    expect(fundingHistory).toBeDefined();
    const schema = fundingHistory!.input_schema as { required?: string[] };
    expect(schema.required).toContain('symbol');
  });

  it('every description is short enough to fit in a system prompt without bloating context', () => {
    // Soft constraint — descriptions should be useful but not excessive.
    // Threshold picked from observation: longest current description is ~400 chars.
    CHAT_TOOLS.forEach((tool) => {
      expect(tool.description!.length).toBeLessThan(1000);
    });
  });

  it('enum-typed parameters declare valid enum arrays', () => {
    CHAT_TOOLS.forEach((tool) => {
      const schema = tool.input_schema as {
        properties?: Record<string, { enum?: unknown[] }>;
      };
      if (!schema.properties) return;
      Object.values(schema.properties).forEach((p) => {
        if (p.enum) {
          expect(Array.isArray(p.enum)).toBe(true);
          expect(p.enum.length).toBeGreaterThan(0);
        }
      });
    });
  });

  it('asset class enum (where present) contains all 5 known classes', () => {
    const fundingRates = CHAT_TOOLS.find((t) => t.name === 'get_funding_rates');
    const schema = fundingRates!.input_schema as {
      properties: { assetClass: { enum: string[] } };
    };
    expect(schema.properties.assetClass.enum).toEqual(
      expect.arrayContaining(['crypto', 'stocks', 'forex', 'commodities', 'all']),
    );
  });
});
