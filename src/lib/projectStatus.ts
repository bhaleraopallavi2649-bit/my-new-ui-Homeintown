// Status-chip predicate for the Projects list (app/(dashboard)/projects.tsx).
//
// WHY this exists: add-project.tsx writes `projectStatus: 'ready-to-move'`, but
// the Projects "Ready" chip compared `p.projectStatus === 'ready'` exactly, so
// a project created from the app never matched the Ready chip. The backend
// field (models/Project.js) has no enum, so older/web-created rows may still
// carry the legacy 'ready'. The chip now accepts both; stored data is untouched.
export function matchesStatusFilter(projectStatus: string | undefined, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter === 'ready') return projectStatus === 'ready-to-move' || projectStatus === 'ready';
  return projectStatus === filter;
}
