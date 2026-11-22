// D12: first connect vs reconnect.
import { createReconnectTracker } from '../reconnectTracker';

describe('createReconnectTracker (D12)', () => {
  it('first connect is not a reconnect', () => {
    expect(createReconnectTracker().onConnect()).toBe(false);
  });

  it('second and later connects are reconnects', () => {
    const t = createReconnectTracker();
    t.onConnect();
    expect(t.onConnect()).toBe(true);
    expect(t.onConnect()).toBe(true);
  });

  it('reset makes the next connect a first connect', () => {
    const t = createReconnectTracker();
    t.onConnect();
    t.onConnect();
    t.reset();
    expect(t.onConnect()).toBe(false);
  });
});
