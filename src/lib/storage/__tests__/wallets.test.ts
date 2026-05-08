import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSavedWallets,
  addWallet,
  removeWallet,
  getWalletLabel,
  detectChain,
} from '../wallets';

const storage = new Map<string, string>();
const mockLS = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLS, writable: true });
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

beforeEach(() => storage.clear());

describe('detectChain — address format → chain', () => {
  it('detects ETH addresses (0x + 40 hex)', () => {
    expect(detectChain('0x742d35Cc6634C0532925a3b844Bc9e7595f8b1f3')).toBe('eth');
    expect(detectChain('0x0000000000000000000000000000000000000000')).toBe('eth');
    expect(detectChain('0xffffffffffffffffffffffffffffffffffffffff')).toBe('eth');
  });

  it('detects ETH case-insensitive (checksum vs lowercase)', () => {
    expect(detectChain('0x742D35cc6634c0532925a3B844bc9e7595f8B1F3')).toBe('eth');
  });

  it('detects BTC legacy (starts with 1 or 3)', () => {
    expect(detectChain('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('btc'); // genesis
    expect(detectChain('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('btc');
  });

  it('detects BTC bech32 (bc1...)', () => {
    expect(detectChain('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('btc');
    expect(detectChain('BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ')).toBe('btc');
  });

  it('detects SOL (base58, 32-44 chars, no 0/O/I/l)', () => {
    // Real Solana wallet addresses are 32-44 chars, mixed-case base58.
    // The 44-char SPL token program ID — unambiguously SOL because BTC
    // legacy maxes at 35 chars.
    expect(detectChain('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe('sol');
    // 43-char Solana account
    expect(detectChain('vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg')).toBe('sol');
  });

  it('known limitation: short all-digit base58 strings collide with BTC legacy', () => {
    // The Solana system program address ('111111…' × 32) starts with '1'
    // and falls inside BTC legacy's 26-35 char range, so detectChain
    // returns 'btc'. Real user wallets don't look like this — locking
    // the behaviour in so a future fix can intentionally remove this
    // test instead of accidentally regressing other cases.
    expect(detectChain('11111111111111111111111111111111')).toBe('btc');
  });

  it('returns null for empty / whitespace input', () => {
    expect(detectChain('')).toBe(null);
    expect(detectChain('   ')).toBe(null);
  });

  it('returns null for unrecognised formats', () => {
    expect(detectChain('not an address')).toBe(null);
    expect(detectChain('0xtoo-short')).toBe(null);
    expect(detectChain('0x' + '1'.repeat(41))).toBe(null); // wrong length
    // Invalid base58 chars (0, O, I, l)
    expect(detectChain('0OIlOOIIlOIlOIlOIlOIlOIlOIlOIlOI')).toBe(null);
  });

  it('trims whitespace before detection', () => {
    expect(detectChain('  0x742d35Cc6634C0532925a3b844Bc9e7595f8b1f3  ')).toBe('eth');
  });
});

describe('addWallet + getSavedWallets', () => {
  it('starts empty', () => {
    expect(getSavedWallets()).toEqual([]);
  });

  it('adds a wallet with addedAt timestamp', () => {
    addWallet('0x742d35Cc6634C0532925a3b844Bc9e7595f8b1f3', 'eth', 'My Hot Wallet');
    const list = getSavedWallets();
    expect(list).toHaveLength(1);
    expect(list[0].address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f8b1f3');
    expect(list[0].chain).toBe('eth');
    expect(list[0].label).toBe('My Hot Wallet');
    expect(list[0].addedAt).toBeGreaterThan(0);
  });

  it('preserves the address case (do not normalise — it might be checksum)', () => {
    addWallet('0x742D35cc6634c0532925a3B844bc9e7595f8B1F3', 'eth');
    expect(getSavedWallets()[0].address).toBe('0x742D35cc6634c0532925a3B844bc9e7595f8B1F3');
  });

  it('rejects empty address', () => {
    addWallet('', 'eth');
    addWallet('   ', 'eth');
    expect(getSavedWallets()).toEqual([]);
  });

  it('dedupes case-insensitively (no double-add)', () => {
    const addr = '0x742d35Cc6634C0532925a3b844Bc9e7595f8b1f3';
    addWallet(addr, 'eth');
    addWallet(addr.toUpperCase(), 'eth');
    addWallet(addr.toLowerCase(), 'eth');
    expect(getSavedWallets()).toHaveLength(1);
  });

  it('caps at 10 wallets (MAX_WALLETS)', () => {
    for (let i = 0; i < 12; i++) {
      addWallet('0x' + i.toString().padStart(40, '0'), 'eth');
    }
    expect(getSavedWallets().length).toBe(10);
  });

  it('label is trimmed; empty label becomes undefined', () => {
    addWallet('0x' + '1'.repeat(40), 'eth', '  My Wallet  ');
    expect(getSavedWallets()[0].label).toBe('My Wallet');
    addWallet('0x' + '2'.repeat(40), 'eth', '   ');
    expect(getSavedWallets()[1].label).toBeUndefined();
  });
});

describe('removeWallet + getWalletLabel', () => {
  beforeEach(() => {
    addWallet('0x' + 'a'.repeat(40), 'eth', 'A');
    addWallet('0x' + 'b'.repeat(40), 'eth', 'B');
  });

  it('removeWallet by address (case-insensitive)', () => {
    removeWallet('0x' + 'A'.repeat(40));
    expect(getSavedWallets().map(w => w.label)).toEqual(['B']);
  });

  it('removeWallet no-op for unknown address', () => {
    removeWallet('0x' + 'c'.repeat(40));
    expect(getSavedWallets()).toHaveLength(2);
  });

  it('getWalletLabel returns the label (case-insensitive lookup)', () => {
    expect(getWalletLabel('0x' + 'A'.repeat(40))).toBe('A');
    expect(getWalletLabel('0x' + 'a'.repeat(40))).toBe('A');
  });

  it('getWalletLabel returns undefined for unknown address', () => {
    expect(getWalletLabel('0x' + 'd'.repeat(40))).toBeUndefined();
  });
});

describe('defensive: bad localStorage data', () => {
  it('returns empty list on corrupt JSON', () => {
    storage.set('ih_wallets', '{not-json');
    expect(getSavedWallets()).toEqual([]);
  });

  it('filters malformed entries', () => {
    const mixed = [
      { address: '0xa', chain: 'eth', addedAt: 1 },                 // valid
      { address: 123, chain: 'eth', addedAt: 1 },                    // bad address type
      null,                                                          // null entry
      { address: '0xb', chain: 'eth', addedAt: 'recent' },           // bad addedAt
      { address: '0xc', chain: 'eth', addedAt: 2 },                  // valid
    ];
    storage.set('ih_wallets', JSON.stringify(mixed));
    expect(getSavedWallets().map(w => w.address)).toEqual(['0xa', '0xc']);
  });
});
