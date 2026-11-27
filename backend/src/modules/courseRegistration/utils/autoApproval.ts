/**
 * The rules for who is approved automatically on registration (spec
 * backend/course-registration-auto-approval). Pure, so the course and cohort
 * paths can't drift apart.
 */

export const AUTO_APPROVAL_MODES = ['EVERYONE', 'LIST'] as const;
export type AutoApprovalMode = (typeof AUTO_APPROVAL_MODES)[number];

export interface AutoApprovalSettings {
  registrationsAutoApproved?: boolean | null;
  autoApprovalMode?: AutoApprovalMode | null;
  autoapproval_emails?: string[] | null;
}

export type ParsedEntry = {kind: 'address' | 'domain'; value: string};

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const LOCAL_PART = /^[^\s@]+$/;

/**
 * Text before the `@` makes an entry a full address. A leading `@`, or no `@`,
 * makes it a domain. Anything else returns null.
 */
export function parseEntry(entry: string): ParsedEntry | null {
  const value = entry.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  const domain = value.slice(at + 1);
  if (!DOMAIN.test(domain)) return null;
  if (at <= 0) return {kind: 'domain', value: domain};
  return LOCAL_PART.test(value.slice(0, at)) ? {kind: 'address', value} : null;
}

/** Settings saved before the mode existed mean: empty list = everyone. */
export function resolveMode(
  settings: Pick<
    AutoApprovalSettings,
    'autoApprovalMode' | 'autoapproval_emails'
  >,
): AutoApprovalMode {
  if (settings.autoApprovalMode) return settings.autoApprovalMode;
  return settings.autoapproval_emails?.length ? 'LIST' : 'EVERYONE';
}

function entryMatches(entry: string, email: string): boolean {
  const parsed = parseEntry(entry);
  if (!parsed) return false;
  if (parsed.kind === 'address') return parsed.value === email;
  return parsed.value === email.slice(email.lastIndexOf('@') + 1);
}

/** `email` is the account's email; it's only needed in LIST mode. */
export function shouldAutoApprove(
  settings: AutoApprovalSettings | null | undefined,
  email?: string | null,
): boolean {
  if (!settings?.registrationsAutoApproved) return false;
  if (resolveMode(settings) === 'EVERYONE') return true;
  const normalized = email?.trim().toLowerCase();
  if (!normalized?.includes('@')) return false;
  return (settings.autoapproval_emails ?? []).some(entry =>
    entryMatches(entry, normalized),
  );
}

/**
 * Trims, lower-cases and de-duplicates entries, treating `x.com` and `@x.com`
 * as the same entry. Entries that aren't an address or domain go in `invalid`.
 */
export function normalizeEntries(entries: string[]): {
  entries: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of entries) {
    const text = raw.trim().toLowerCase();
    if (!text) continue;
    const parsed = parseEntry(text);
    if (!parsed) {
      if (!invalid.includes(text)) invalid.push(text);
      continue;
    }
    if (seen.has(parsed.value)) continue;
    seen.add(parsed.value);
    valid.push(text);
  }
  return {entries: valid, invalid};
}
