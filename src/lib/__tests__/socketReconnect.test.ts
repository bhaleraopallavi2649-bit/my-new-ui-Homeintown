// D12: socket.ts runs onSocketReconnect listeners on every REconnect, after the
// rooms are rejoined, and never on the first connect of a session.
type Handler = (...a: any[]) => void;
type FakeSocket = { connected: boolean; auth: any; handlers: Record<string, Handler>; on: jest.Mock; emit: jest.Mock; connect: jest.Mock; disconnect: jest.Mock };
let mockLastSocket: FakeSocket | null = null;
const mockIo = jest.fn((_url: string, opts: any) => {
  const s: FakeSocket = {
    connected: false,
    auth: opts.auth,
    handlers: {},
    on: jest.fn((ev: string, h: Handler) => { s.handlers[ev] = h; }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  mockLastSocket = s;
  return s;
});

jest.mock('socket.io-client', () => ({ io: (u: string, o: any) => mockIo(u, o) }));
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => {} }) } }));
jest.mock('../api', () => ({ API_URL: 'https://x/api' }));
jest.mock('../storage', () => ({ tokenStorage: { get: jest.fn(async () => 'tkn') } }));

(global as any).__DEV__ = false;

import { getSocket, disconnectSocket, onSocketReconnect, trackJoinGroup } from '../socket';

describe('onSocketReconnect (D12)', () => {
  const unsubs: (() => void)[] = [];
  beforeEach(() => {
    disconnectSocket();
    jest.clearAllMocks();
    mockLastSocket = null;
  });
  afterEach(() => { while (unsubs.length) unsubs.pop()!(); });

  it('listener not called on the initial connect', async () => {
    const cb = jest.fn();
    unsubs.push(onSocketReconnect(cb));
    await getSocket();
    mockLastSocket!.handlers.connect();
    expect(cb).not.toHaveBeenCalled();
  });

  it('listener called once per reconnect, after rejoin emits', async () => {
    const order: string[] = [];
    await getSocket();
    const s = mockLastSocket!;
    s.emit.mockImplementation((ev: string) => { order.push(`emit:${ev}`); });
    trackJoinGroup('r1');
    order.length = 0;
    unsubs.push(onSocketReconnect(() => order.push('reconnect')));
    s.handlers.connect(); // first
    order.length = 0;
    s.handlers.connect(); // reconnect
    expect(order).toEqual(['emit:join_group', 'reconnect']);
    s.handlers.connect();
    expect(order.filter(x => x === 'reconnect')).toHaveLength(2);
  });

  it('unsubscribe stops calls', async () => {
    const cb = jest.fn();
    const off = onSocketReconnect(cb);
    await getSocket();
    mockLastSocket!.handlers.connect();
    off();
    mockLastSocket!.handlers.connect();
    expect(cb).not.toHaveBeenCalled();
  });

  it("disconnectSocket resets so the next session's first connect does not fire", async () => {
    const cb = jest.fn();
    unsubs.push(onSocketReconnect(cb));
    await getSocket();
    mockLastSocket!.handlers.connect();
    disconnectSocket();
    await getSocket();
    mockLastSocket!.handlers.connect();
    expect(cb).not.toHaveBeenCalled();
    mockLastSocket!.handlers.connect();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not stop the others', async () => {
    const good = jest.fn();
    unsubs.push(onSocketReconnect(() => { throw new Error('boom'); }));
    unsubs.push(onSocketReconnect(good));
    await getSocket();
    mockLastSocket!.handlers.connect();
    expect(() => mockLastSocket!.handlers.connect()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
