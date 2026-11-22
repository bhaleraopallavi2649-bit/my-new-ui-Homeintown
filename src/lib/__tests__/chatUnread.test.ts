// P4-08: live unread bump from the server's `notification` new_chat_message.
import { bumpSessionUnread } from '../chatUnread';

const rows = () => [
  { id: 'a', unreadCount: 0, name: 'A' },
  { id: 'b', unreadCount: 2, name: 'B' },
];

describe('bumpSessionUnread', () => {
  it('increments the matching row', () => {
    const next = bumpSessionUnread(rows(), 'b', null);
    expect(next.find((s) => s.id === 'b')!.unreadCount).toBe(3);
  });

  it('leaves other rows untouched (same objects)', () => {
    const prev = rows();
    const next = bumpSessionUnread(prev, 'b', null);
    expect(next[0]).toBe(prev[0]);
    expect(next[0].unreadCount).toBe(0);
  });

  it('active thread → same array reference', () => {
    const prev = rows();
    expect(bumpSessionUnread(prev, 'b', 'b')).toBe(prev);
  });

  it('unknown session → same array reference', () => {
    const prev = rows();
    expect(bumpSessionUnread(prev, 'zzz', null)).toBe(prev);
  });

  it('undefined sessionId → same array reference', () => {
    const prev = rows();
    expect(bumpSessionUnread(prev, undefined, null)).toBe(prev);
  });
});
