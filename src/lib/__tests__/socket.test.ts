// P7-02: socket.ts reconnect options + the AppState foreground hook.
// Previously: reconnectionAttempts 5, no AppState listener, so after a ~30 s
// outage the shared socket stayed dead for the rest of the session.

const mockRemove = jest.fn();
let mockAppStateHandler: ((s: string) => void) | null = null;
const mockAddEventListener = jest.fn((_ev: string, h: (s: string) => void) => {
  mockAppStateHandler = h;
  return { remove: mockRemove };
});

type FakeSocket = { connected: boolean; auth: any; on: jest.Mock; emit: jest.Mock; connect: jest.Mock; disconnect: jest.Mock };
let mockLastSocket: FakeSocket | null = null;
const mockIo = jest.fn((_url: string, _opts: any) => {
  mockLastSocket = {
    connected: false,
    auth: _opts.auth,
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  return mockLastSocket;
});

jest.mock('socket.io-client', () => ({ io: (u: string, o: any) => mockIo(u, o) }));
jest.mock('react-native', () => ({ AppState: { addEventListener: (e: string, h: any) => mockAddEventListener(e, h) } }));
jest.mock('../api', () => ({ API_URL: 'https://x/api' }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn') } }));

(global as any).__DEV__ = false;

import { getSocket, disconnectSocket } from '../socket';

describe('socket.ts', () => {
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
    mockAppStateHandler = null;
    mockLastSocket = null;
  });

  it('uses bounded reconnect options (10 attempts, 5 s max delay)', async () => {
    await getSocket();
    expect(mockIo).toHaveBeenCalledTimes(1);
    const opts = mockIo.mock.calls[0][1];
    expect(opts.reconnection).toBe(true);
    expect(opts.reconnectionAttempts).toBe(10);
    expect(opts.reconnectionDelay).toBe(1000);
    expect(opts.reconnectionDelayMax).toBe(5000);
  });

  it('registers the AppState listener once, even across getSocket() calls', async () => {
    await getSocket();
    await getSocket(); // socket still disconnected → reuse path, no new io()
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('foreground with a disconnected socket calls connect() on the same socket', async () => {
    await getSocket();
    const s = mockLastSocket!;
    s.connect.mockClear();
    mockAppStateHandler!('active');
    expect(s.connect).toHaveBeenCalledTimes(1);
    mockAppStateHandler!('background');
    expect(s.connect).toHaveBeenCalledTimes(1);
    s.connected = true;
    mockAppStateHandler!('active');
    expect(s.connect).toHaveBeenCalledTimes(1);
    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('disconnectSocket removes the listener; a later resume neither creates nor connects', async () => {
    await getSocket();
    const s = mockLastSocket!;
    const handler = mockAppStateHandler!;
    s.connect.mockClear();
    disconnectSocket();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    handler('active'); // even if RN delivered one last event
    expect(s.connect).not.toHaveBeenCalled();
    expect(mockIo).toHaveBeenCalledTimes(1);
  });
});
