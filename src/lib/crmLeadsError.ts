// Classifies a /crm-bridge/leads failure for the CRM Leads screen.
//
// WHY: crm-leads.tsx used `catch { setLeads([]) }`, so a network failure and an
// account that is not linked to the CRM (backend crmBridgeController responds
// `{ error: 'NOT_LINKED' }`, which ApiError exposes as `.code`) both rendered
// "No leads found" — a false empty state with no way to retry.
export type LeadsErrorKind = 'not_linked' | 'generic';

export function leadsErrorKind(e: unknown): LeadsErrorKind {
  return (e as any)?.code === 'NOT_LINKED' ? 'not_linked' : 'generic';
}
