// D4: failed group send → text restored + a real error message, no fake bubble.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

import { restoreDraftAfterFailedSend, sendFailureMessage } from '../sendFailure';
import { ApiError } from '../api';

const GENERIC = 'Message not sent. Check your connection and try again.';

describe('sendFailure (D4)', () => {
  it('blank input → restores the failed text', () => {
    expect(restoreDraftAfterFailedSend('', 'hello')).toBe('hello');
  });

  it('whitespace-only input → restores', () => {
    expect(restoreDraftAfterFailedSend('  \n ', 'hello')).toBe('hello');
  });

  it('text typed after the failure is kept after the restored text', () => {
    expect(restoreDraftAfterFailedSend('second', 'first')).toBe('first\nsecond');
  });

  it('429 ApiError → rate-limit message', () => {
    const e = new ApiError('Too many requests. Please try again in 60 seconds.', 429);
    expect(sendFailureMessage(e)).toBe('Too many requests. Please try again in 60 seconds.');
  });

  it('403 with server message → that message', () => {
    expect(sendFailureMessage(new ApiError('You are not a member of this group', 403))).toBe('You are not a member of this group');
  });

  it('network TypeError / 500 → generic not-sent message', () => {
    expect(sendFailureMessage(new TypeError('Network request failed'))).toBe(GENERIC);
    expect(sendFailureMessage(new ApiError('Internal', 500))).toBe(GENERIC);
    expect(sendFailureMessage(null)).toBe(GENERIC);
  });
});
