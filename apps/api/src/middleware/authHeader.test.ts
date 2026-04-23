import { describe, expect, it } from 'vitest';
import { extractBearerToken } from './authHeader.js';

describe('extractBearerToken', () => {
  it('returns null when header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null when header does not use bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('bearer abc123')).toBeNull();
  });

  it('returns token for a valid bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('trims extra spaces around the token', () => {
    expect(extractBearerToken('Bearer   abc123   ')).toBe('abc123');
  });

  it('returns null when bearer token is empty', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer    ')).toBeNull();
  });
});
