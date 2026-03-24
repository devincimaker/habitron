jest.mock('react-native', () => ({
  NativeModules: {
    SourceCode: {},
  },
}));

import {
  buildApiUrl,
  isLocalApiUrl,
  resolveApiBaseUrl,
} from '../services/apiUrl';

describe('resolveApiBaseUrl', () => {
  it('keeps remote API URLs unchanged', () => {
    expect(
      resolveApiBaseUrl(
        'https://fioris-api.onrender.com',
        'http://192.168.1.56:8081/index.bundle?platform=ios',
        true
      )
    ).toBe('https://fioris-api.onrender.com');
  });

  it('keeps localhost when the dev bundle is also running on localhost', () => {
    expect(
      resolveApiBaseUrl(
        'http://localhost:3001',
        'http://localhost:8081/index.bundle?platform=ios',
        true
      )
    ).toBe('http://localhost:3001');
  });

  it('rewrites localhost to the dev bundle host in development', () => {
    expect(
      resolveApiBaseUrl(
        'http://localhost:3001',
        'http://192.168.1.56:8081/index.bundle?platform=ios',
        true
      )
    ).toBe('http://192.168.1.56:3001');
  });

  it('does not rewrite localhost outside development', () => {
    expect(
      resolveApiBaseUrl(
        'http://localhost:3001',
        'http://192.168.1.56:8081/index.bundle?platform=ios',
        false
      )
    ).toBe('http://localhost:3001');
  });
});

describe('buildApiUrl', () => {
  it('joins the base URL and path cleanly', () => {
    expect(buildApiUrl('http://localhost:3001/', '/api/chat')).toBe(
      'http://localhost:3001/api/chat'
    );
  });
});

describe('isLocalApiUrl', () => {
  it('detects local API URLs', () => {
    expect(isLocalApiUrl('http://localhost:3001')).toBe(true);
    expect(isLocalApiUrl('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalApiUrl('https://fioris-api.onrender.com')).toBe(false);
  });
});
