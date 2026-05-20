import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_EXCHANGES,
  EXCHANGES_WITH_PASSPHRASE,
  SUPPORTED_CHAINS,
  isSupportedExchange,
  isSupportedChain,
  isValidAddress,
} from '../supported-exchanges';

describe('SUPPORTED_EXCHANGES', () => {
  it('is non-empty', () => {
    expect(SUPPORTED_EXCHANGES.length).toBeGreaterThan(0);
  });

  it('contains the major CEXes (Binance, Bybit, OKX, Bitget, MEXC, Blofin)', () => {
    expect(SUPPORTED_EXCHANGES).toContain('Binance');
    expect(SUPPORTED_EXCHANGES).toContain('Bybit');
    expect(SUPPORTED_EXCHANGES).toContain('OKX');
    expect(SUPPORTED_EXCHANGES).toContain('Bitget');
    expect(SUPPORTED_EXCHANGES).toContain('MEXC');
    expect(SUPPORTED_EXCHANGES).toContain('Blofin');
  });

  it('has no duplicates', () => {
    const unique = new Set(SUPPORTED_EXCHANGES);
    expect(unique.size).toBe(SUPPORTED_EXCHANGES.length);
  });
});

describe('EXCHANGES_WITH_PASSPHRASE', () => {
  it('contains OKX, Bitget, and Blofin (these need a 3rd secret)', () => {
    expect(EXCHANGES_WITH_PASSPHRASE.has('OKX')).toBe(true);
    expect(EXCHANGES_WITH_PASSPHRASE.has('Bitget')).toBe(true);
    expect(EXCHANGES_WITH_PASSPHRASE.has('Blofin')).toBe(true);
  });

  it('does NOT contain Binance / Bybit / MEXC (no passphrase needed)', () => {
    expect(EXCHANGES_WITH_PASSPHRASE.has('Binance')).toBe(false);
    expect(EXCHANGES_WITH_PASSPHRASE.has('Bybit')).toBe(false);
    expect(EXCHANGES_WITH_PASSPHRASE.has('MEXC')).toBe(false);
  });

  it('every member of EXCHANGES_WITH_PASSPHRASE is also in SUPPORTED_EXCHANGES', () => {
    // Regression: an entry can't be in the passphrase set without being
    // supported in the first place. Catches typos like 'BlofinX'.
    EXCHANGES_WITH_PASSPHRASE.forEach((ex) => {
      expect(SUPPORTED_EXCHANGES).toContain(ex);
    });
  });
});

describe('isSupportedExchange', () => {
  it('returns true for supported exchanges', () => {
    expect(isSupportedExchange('Binance')).toBe(true);
    expect(isSupportedExchange('OKX')).toBe(true);
  });

  it('returns false for unsupported strings', () => {
    expect(isSupportedExchange('Coinbase')).toBe(false);
    expect(isSupportedExchange('Kraken')).toBe(false);
    expect(isSupportedExchange('NotAnExchange')).toBe(false);
  });

  it('is case-sensitive (must match canonical casing)', () => {
    expect(isSupportedExchange('binance')).toBe(false);
    expect(isSupportedExchange('BYBIT')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(isSupportedExchange(123)).toBe(false);
    expect(isSupportedExchange(null)).toBe(false);
    expect(isSupportedExchange(undefined)).toBe(false);
    expect(isSupportedExchange({})).toBe(false);
  });
});

describe('SUPPORTED_CHAINS', () => {
  it('contains hyperliquid + major EVM chains + solana', () => {
    expect(SUPPORTED_CHAINS).toContain('hyperliquid');
    expect(SUPPORTED_CHAINS).toContain('ethereum');
    expect(SUPPORTED_CHAINS).toContain('arbitrum');
    expect(SUPPORTED_CHAINS).toContain('base');
    expect(SUPPORTED_CHAINS).toContain('solana');
  });

  it('chain names are lowercase', () => {
    SUPPORTED_CHAINS.forEach((c) => {
      expect(c).toBe(c.toLowerCase());
    });
  });
});

describe('isSupportedChain', () => {
  it('accepts known chains', () => {
    expect(isSupportedChain('hyperliquid')).toBe(true);
    expect(isSupportedChain('ethereum')).toBe(true);
    expect(isSupportedChain('solana')).toBe(true);
  });

  it('rejects unknown chains', () => {
    expect(isSupportedChain('cosmos')).toBe(false);
    expect(isSupportedChain('tron')).toBe(false);
    expect(isSupportedChain('Ethereum')).toBe(false);  // case-sensitive
  });

  it('rejects non-string inputs', () => {
    expect(isSupportedChain(1)).toBe(false);
    expect(isSupportedChain([])).toBe(false);
  });
});

describe('isValidAddress', () => {
  describe('EVM addresses (ethereum / arbitrum / base / hyperliquid)', () => {
    it('accepts a valid 0x-prefixed 40-hex address', () => {
      expect(isValidAddress('ethereum', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
      expect(isValidAddress('arbitrum', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
      expect(isValidAddress('base', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
      expect(isValidAddress('hyperliquid', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
    });

    it('rejects too-short addresses', () => {
      expect(isValidAddress('ethereum', '0x123')).toBe(false);
      expect(isValidAddress('ethereum', '0x' + 'a'.repeat(39))).toBe(false);
    });

    it('rejects too-long addresses', () => {
      expect(isValidAddress('ethereum', '0x' + 'a'.repeat(41))).toBe(false);
    });

    it('rejects addresses missing the 0x prefix', () => {
      expect(isValidAddress('ethereum', 'd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    });

    it('rejects non-hex characters', () => {
      expect(isValidAddress('ethereum', '0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(false);
    });

    it('handles mixed case (EIP-55 checksums)', () => {
      // Both lower + checksummed addresses pass the basic shape test
      expect(isValidAddress('ethereum', '0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true);
      expect(isValidAddress('ethereum', '0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(isValidAddress('ethereum', '  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  ')).toBe(true);
    });
  });

  describe('Solana addresses', () => {
    it('accepts a valid base58 32-44 char address', () => {
      // Vitalik would have one too if he ever held SOL :)
      expect(isValidAddress('solana', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH')).toBe(true);
      expect(isValidAddress('solana', '9EYEWbFFeXxyZSixUaCkfQjbiMDGxnZQycGuAhbMjFjg')).toBe(true);
    });

    it('rejects too-short addresses', () => {
      expect(isValidAddress('solana', 'shortaddr')).toBe(false);
    });

    it('rejects addresses with invalid base58 chars (0, O, I, l)', () => {
      // base58 excludes 0, O, I, l to avoid visual confusion
      expect(isValidAddress('solana', '0'.repeat(40))).toBe(false);
      expect(isValidAddress('solana', 'O'.repeat(40))).toBe(false);
    });

    it('rejects EVM-style 0x addresses on solana', () => {
      expect(isValidAddress('solana', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    });
  });
});
