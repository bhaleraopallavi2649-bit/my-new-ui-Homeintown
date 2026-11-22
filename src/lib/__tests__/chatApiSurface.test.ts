// D15: chatApi.qualify was dead code (zero callers, wrong body key), so it was removed.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn'), set: jest.fn(), clear: jest.fn() } }));

export {};

describe('chatApi surface', () => {
  let api: typeof import('../api');
  beforeEach(() => {
    jest.resetModules();
    api = require('../api');
  });

  it('chatApi no longer exposes the dead qualify call', () => {
    expect((api.chatApi as any).qualify).toBeUndefined();
  });

  it('chatApi keeps getContacts/getSessions/getMessages/getBuildersNetwork', () => {
    for (const k of ['getContacts', 'getSessions', 'getMessages', 'getBuildersNetwork']) {
      expect(typeof (api.chatApi as any)[k]).toBe('function');
    }
  });
});
