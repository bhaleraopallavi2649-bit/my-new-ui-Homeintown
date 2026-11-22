// D9: role → landing route and the Chats-pane error copy. Pure so it can be
// tested under jest node (app/index.tsx and ChatEmbedded.tsx are .tsx screens).

// Roles that see the Overview nav item. PREVIOUS BEHAVIOUR: Sidebar listed only
// admin/builder/captain/agent, while app/index.tsx already sent user and
// unassigned accounts to the Overview screen — so they landed there with no
// way back to it from the drawer. Employees keep Field Check-in instead.
export const OVERVIEW_ROLES = ['admin', 'builder', 'captain', 'agent', 'user', 'unassigned'] as const;

export type HomeRoute = '/(dashboard)/field' | '/(dashboard)/crm';

export function homeRouteForRole(role?: string | null): HomeRoute {
  return role === 'employee' ? '/(dashboard)/field' : '/(dashboard)/crm';
}

// chat.routes.js is restrictTo('admin','builder','agent','captain','employee'),
// so a user/unassigned account gets a 403 for /chat/sessions. PREVIOUS
// BEHAVIOUR: ChatEmbedded swallowed every error and rendered "No conversations
// yet", which hid both the role gate and a plain network failure.
export function isChatsForbidden(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 403;
}

export function chatsErrorMessage(err: unknown): string {
  if (isChatsForbidden(err)) return 'Chats are available after your account is assigned a role.';
  return "Couldn't load conversations. Check your connection and try again.";
}
