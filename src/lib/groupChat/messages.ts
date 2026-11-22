// Message-shape helpers lifted out of GroupChatEmbedded.tsx. Types only — the
// GroupMessage import must stay `import type` because src/lib/api.ts imports
// expo-constants at module scope.
import type { GroupMessage } from '../api';

// ── The server's pinned project-summary dump ──────────────────────────────────
//
// The backend's buildProjectDetailsContent opens with `📋 ${project.projectName}`,
// so the old test — `msg.content?.startsWith('📋 Project:')` — could NEVER match
// and the whole multi-line property dump rendered as a grey system bubble at the
// top of every project thread. The flag is the real test; the `^📋` content check
// covers the UNFLAGGED `📋` system messages that refreshProjectSubGroupPin
// `create()`d on every project edit (its lookup regex '^📋 Project:' never
// matched what it wrote). The backend now writes through the single flagged pin,
// but those historical duplicates are still in the DB, so keep this fallback.
//
// What still renders: join / exit notices, '<subject> deleted by X', and
// '<agent> joined — requirement matched …' are plain text and none start with 📋.
// The `messageType === 'system'` conjunct means a USER typing '📋 …' (a `text`
// message) is never suppressed.
//
// Accepted scope (design review #9): getMessages is paginated at 50 server-side
// and the client asks for no page, so the summary — usually the room's OLDEST
// message — is often not even in the loaded window. Suppression therefore
// operates on the loaded page only. No pagination work is in scope.
export const isProjectSummaryMessage = (msg: GroupMessage) =>
  msg.messageType === 'system' &&
  (msg.isProjectDetails === true || (msg.content ?? '').trimStart().startsWith('📋'));

/**
 * Explains WHY a property matched, quoting the requirement the user actually
 * entered. Built from the requirement card on the same message, so it needs no
 * extra data from the server.
 */
export function matchReason(req: any): string {
  if (!req) return '';
  const need = [
    req.bhkType,
    req.area ? `in ${req.area}` : '',
    req.budget ? `under ${req.budget}L` : '',
  ].filter(Boolean).join(' ');
  return need ? `Teri need "${need}" se match` : '';
}

// Normalize a message from REST history, a post echo or a socket arrival into
// our GroupMessage shape. The single mapper for all three.
let _msgSeq = 0;
export function normalizeMsg(m: any, roomId: string): GroupMessage {
  return {
    id: String(m._id || m.id || `tmp_${Date.now()}_${_msgSeq++}`),
    room: String(m.room || roomId),
    sender: {
      id: String(m.sender?._id || m.sender?.id || ''),
      name: m.sender?.name || '',
      role: m.sender?.role || '',
      companyName: m.sender?.companyName,
      isVerified: m.sender?.isVerified === true,
      verificationStatus: m.sender?.verificationStatus,
      // Present on inventory cards only — the card's Call button dials it.
      phone: m.sender?.phone,
    },
    messageType: m.messageType || 'text',
    content: m.content || '',
    attachment: m.attachment,
    requirementCard: m.requirementCard,
    inventoryCard: m.inventoryCard,
    matchResults: m.matchResults,
    // Socket arrivals and post echoes come through here, not through
    // groupChatApi.getMessages. Without this line a summary that arrived LIVE
    // (project edited while the room is open) would only be caught by the weaker
    // `^📋` content fallback.
    isProjectDetails: m.isProjectDetails === true,
    // project arrives as an ObjectId string, or populated on some REST paths.
    unitUpdate: m.unitUpdate
      ? { ...m.unitUpdate, project: String(m.unitUpdate.project?._id || m.unitUpdate.project || '') }
      : undefined,
    // groupChatApi.getMessages now maps through this function too. It used to
    // have its own copy, and mapping a typed message in only ONE of the two is
    // how history-loaded unit_update messages once fell through to a plain text
    // bubble (live arrival drew a card, the same message after a reload did not).
    siteVisit: m.siteVisit
      ? {
        ...m.siteVisit,
        project: String(m.siteVisit.project?._id || m.siteVisit.project || ''),
        visit: String(m.siteVisit.visit?._id || m.siteVisit.visit || ''),
      }
      : undefined,
    // This one was never mapped at all, which is why project announcements
    // rendered as grey text bubbles.
    projectAnnouncement: m.projectAnnouncement
      ? { ...m.projectAnnouncement, project: String(m.projectAnnouncement.project?._id || m.projectAnnouncement.project || '') }
      : undefined,
    createdAt: m.createdAt || new Date().toISOString(),
  };
}
