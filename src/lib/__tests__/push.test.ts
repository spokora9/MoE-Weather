import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock web-push BEFORE importing the module under test.
// Use vi.hoisted so mocks are defined ABOVE the hoisted vi.mock calls.
const { mockSendNotification, mockSetVapidDetails, mockGenerateVAPIDKeys } = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
  mockSetVapidDetails: vi.fn(),
  mockGenerateVAPIDKeys: vi.fn(() => ({ publicKey: 'gen-public', privateKey: 'gen-private' })),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
    generateVAPIDKeys: mockGenerateVAPIDKeys,
  },
  setVapidDetails: mockSetVapidDetails,
  sendNotification: mockSendNotification,
  generateVAPIDKeys: mockGenerateVAPIDKeys,
}));

import {
  isPushConfigured,
  sendPushNotification,
  generateVAPIDKeys,
  getPublicVapidKey,
  _resetPushConfigForTests,
} from '../push.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSendNotification.mockReset();
  mockSetVapidDetails.mockReset();
  mockGenerateVAPIDKeys.mockClear();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  _resetPushConfigForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  _resetPushConfigForTests();
});

describe('isPushConfigured', () => {
  it('returns false when env vars are missing', () => {
    expect(isPushConfigured()).toBe(false);
    expect(mockSetVapidDetails).not.toHaveBeenCalled();
  });

  it('returns true and initializes web-push when all VAPID env vars present', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    expect(isPushConfigured()).toBe(true);
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.com',
      'pub',
      'priv',
    );
  });

  it('memoizes the result (only calls setVapidDetails once)', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    isPushConfigured();
    isPushConfigured();
    isPushConfigured();
    expect(mockSetVapidDetails).toHaveBeenCalledTimes(1);
  });

  it('returns false when web-push initialization throws', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    mockSetVapidDetails.mockImplementationOnce(() => {
      throw new Error('bad key');
    });

    expect(isPushConfigured()).toBe(false);
  });
});

describe('getPublicVapidKey', () => {
  it('returns null when not configured', () => {
    expect(getPublicVapidKey()).toBeNull();
  });

  it('returns the configured public key', () => {
    process.env.VAPID_PUBLIC_KEY = 'my-public-key';
    expect(getPublicVapidKey()).toBe('my-public-key');
  });
});

describe('sendPushNotification', () => {
  const sub = {
    endpoint: 'https://push.example.com/abc',
    keys: { p256dh: 'p', auth: 'a' },
  };
  const payload = { title: 'Hello', body: 'World' };

  it('returns false and skips send when VAPID not configured', async () => {
    const result = await sendPushNotification(sub, payload);
    expect(result).toBe(false);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('returns true on successful send', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    mockSendNotification.mockResolvedValueOnce({ statusCode: 201 });

    const result = await sendPushNotification(sub, payload);
    expect(result).toBe(true);
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
  });

  it('returns false on send failure (does not throw)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    mockSendNotification.mockRejectedValueOnce(
      Object.assign(new Error('gone'), { statusCode: 410 }),
    );

    const result = await sendPushNotification(sub, payload);
    expect(result).toBe(false);
  });

  it('returns false on generic 5xx failure', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    mockSendNotification.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { statusCode: 503 }),
    );

    const result = await sendPushNotification(sub, payload);
    expect(result).toBe(false);
  });
});

describe('generateVAPIDKeys', () => {
  it('delegates to web-push.generateVAPIDKeys', () => {
    const keys = generateVAPIDKeys();
    expect(keys).toEqual({ publicKey: 'gen-public', privateKey: 'gen-private' });
    expect(mockGenerateVAPIDKeys).toHaveBeenCalledTimes(1);
  });
});
