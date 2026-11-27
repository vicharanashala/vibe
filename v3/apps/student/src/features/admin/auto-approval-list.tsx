import { SearchIcon, Trash2Icon, UploadIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  likelyEmailColumn,
  listFitsInOneSave,
  mergeEntries,
  parseCsv,
  parseEntry,
  splitEntries,
  summarizeColumn,
  toCsvTable,
  type CsvTable,
} from './auto-approval-entries';

const PAGE = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function count(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const kindOf = (entry: string) => parseEntry(entry)?.kind ?? 'invalid';
const KIND_ORDER = { invalid: 0, domain: 1, address: 2 };

/**
 * The list being edited, plus any text still in the Add box. Save reads the box
 * itself rather than adding on blur: a blur adds a row, which moves the Save
 * button out from under the pointer, so the click would be lost.
 */
export function useAutoApprovalEntries(saved: string[]) {
  const savedKey = saved.join('\n');
  const [entries, setEntries] = useState(saved);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  // The backend tidies what it saves (case, duplicates); show what it kept.
  useEffect(() => setEntries(savedKey ? savedKey.split('\n') : []), [savedKey]);

  /** Adds what's valid. Returns the full list, or null if any text was invalid, which stays in the box. */
  function commitDraft(): string[] | null {
    const typed = splitEntries(draft);
    const bad = typed.filter((t) => !parseEntry(t));
    const merged = mergeEntries(entries, typed);
    setEntries(merged);
    setDraft(bad.join(' '));
    setDraftError(
      bad.length
        ? `These aren't an email address or a domain: ${bad.join(', ')}`
        : null,
    );
    return bad.length ? null : merged;
  }

  return {
    entries,
    setEntries,
    draft,
    setDraft: (text: string) => {
      setDraft(text);
      setDraftError(null);
    },
    draftError,
    commitDraft,
    /** The list as it would be saved now, counting valid text in the box. */
    withDraft: mergeEntries(entries, splitEntries(draft)),
    isChanged:
      !!draft.trim() ||
      [...entries].sort().join('\n') !== [...saved].sort().join('\n'),
    reset: () => {
      setEntries(saved);
      setDraft('');
      setDraftError(null);
    },
  };
}

/** The list of who is approved automatically. Nothing is stored until Save. */
export function AutoApprovalList({
  list,
}: {
  list: ReturnType<typeof useAutoApprovalEntries>;
}) {
  const { entries, setEntries: onChange, draft, setDraft, draftError } = list;
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState(false);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          KIND_ORDER[kindOf(a)] - KIND_ORDER[kindOf(b)] || a.localeCompare(b),
      ),
    [entries],
  );
  const query = search.trim().toLowerCase();
  const matches = query
    ? sorted.filter((e) => e.toLowerCase().includes(query))
    : sorted;
  const domains = entries.filter((e) => kindOf(e) === 'domain').length;
  const invalid = entries.filter((e) => kindOf(e) === 'invalid').length;
  const addresses = entries.length - domains - invalid;

  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor="reg-patterns">Emails and domains</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImporting(true)}
        >
          <UploadIcon />
          Upload CSV
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          id="reg-patterns"
          value={draft}
          aria-invalid={!!draftError}
          placeholder="student@example.com or iitrpr.ac.in"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              list.commitDraft();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => list.commitDraft()}
        >
          Add
        </Button>
      </div>
      {draftError && (
        <p role="alert" className="text-sm text-destructive">
          {draftError}
        </p>
      )}
      <FieldDescription>
        A full address matches only that address. A domain such as iitrpr.ac.in
        matches only that domain, not its subdomains. Anyone else waits for you.
      </FieldDescription>

      {entries.length === 0 ? (
        <FieldDescription>
          Nobody will be approved automatically until you add an email or
          domain.
        </FieldDescription>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {[
                addresses > 0 && count(addresses, 'email'),
                domains > 0 && count(domains, 'domain'),
                invalid > 0 && `${invalid.toLocaleString()} not valid`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange([]);
                setSearch('');
              }}
            >
              <Trash2Icon />
              Remove all
            </Button>
          </div>
          {entries.length > 8 && (
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search the list"
                placeholder="Search the list"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShown(PAGE);
                }}
              />
            </InputGroup>
          )}
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email or domain</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.slice(0, shown).map((entry) => {
                  const kind = kindOf(entry);
                  return (
                    <TableRow key={entry}>
                      <TableCell className="max-w-0 truncate" title={entry}>
                        {entry}
                      </TableCell>
                      <TableCell>
                        {kind === 'invalid' ? (
                          <Badge variant="destructive">Not valid</Badge>
                        ) : kind === 'domain' ? (
                          <Badge variant="secondary">Domain</Badge>
                        ) : (
                          <span className="text-muted-foreground">Email</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${entry}`}
                          onClick={() =>
                            onChange(entries.filter((e) => e !== entry))
                          }
                        >
                          <XIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {matches.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Nothing on the list matches.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {matches.length > shown && (
              <div className="flex justify-center border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShown((s) => s + PAGE)}
                >
                  Show more ({(matches.length - shown).toLocaleString()} left)
                </Button>
              </div>
            )}
          </div>
          {invalid > 0 && (
            <FieldDescription>
              Remove the entries marked not valid before saving.
            </FieldDescription>
          )}
        </div>
      )}

      <CsvImportDialog
        open={importing}
        onOpenChange={setImporting}
        existing={entries}
        onAdd={(emails) => {
          onChange(mergeEntries(entries, emails));
          setSearch('');
          toast.success(
            `Added ${count(emails.length, 'email')} to the list. Press Save to apply.`,
          );
        }}
      />
    </Field>
  );
}

function CsvImportDialog({
  open,
  onOpenChange,
  existing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: string[];
  onAdd: (emails: string[]) => void;
}) {
  const [table, setTable] = useState<CsvTable | null>(null);
  const [column, setColumn] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTable(null);
    setColumn(0);
    setError(null);
  }

  async function readFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('This file is larger than 5 MB. Upload a smaller CSV.');
      return;
    }
    try {
      const text = await file.text();
      // Excel workbooks and UTF-16 exports are full of NUL bytes; CSV never is.
      if (text.includes('\0')) {
        setError(
          "This doesn't look like a CSV file. In Excel or Google Sheets, save or download it as CSV first.",
        );
        return;
      }
      const parsed = toCsvTable(parseCsv(text));
      if (parsed.rows.length === 0) {
        setError('This file has no rows to read.');
        return;
      }
      setTable(parsed);
      setColumn(likelyEmailColumn(parsed));
    } catch {
      setError("This file couldn't be read. Try uploading it again.");
    }
  }

  const summary = useMemo(
    () => (table ? summarizeColumn(table, column, existing) : null),
    [table, column, existing],
  );

  const tooLong =
    !!summary?.toAdd.length &&
    !listFitsInOneSave(mergeEntries(existing, summary.toAdd));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-aleo text-xl">
            Add emails from a CSV
          </DialogTitle>
          <DialogDescription>
            Choose a file, then the column that holds the emails. Only full
            email addresses are added, and nothing changes until you press Save.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="reg-csv-file">CSV file</FieldLabel>
            <Input
              id="reg-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </Field>
          {table && summary && (
            <>
              <Field>
                <FieldLabel htmlFor="reg-csv-column">
                  Column with the emails
                </FieldLabel>
                <NativeSelect
                  id="reg-csv-column"
                  className="w-full"
                  value={column}
                  onChange={(e) => setColumn(Number(e.target.value))}
                >
                  {table.columns.map((name, index) => (
                    <NativeSelectOption key={index} value={index}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <ColumnPreview {...summary} />
              {tooLong && (
                <p role="alert" className="text-sm text-destructive">
                  With these, the list would be too long to save. The limit is
                  about 3,500 emails. Use a domain for large groups, or upload a
                  shorter file.
                </p>
              )}
            </>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!summary?.toAdd.length || tooLong}
            onClick={() => {
              onAdd(summary?.toAdd ?? []);
              onOpenChange(false);
              reset();
            }}
          >
            {summary?.toAdd.length
              ? `Add ${count(summary.toAdd.length, 'email')}`
              : 'Add emails'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnPreview({
  toAdd,
  alreadyListed,
  repeated,
  skipped,
}: ReturnType<typeof summarizeColumn>) {
  const sample = skipped.slice(0, 3).join(', ');
  const more = skipped.length - 3;
  return (
    <div className="grid gap-2 text-sm">
      <p className="font-medium">
        {toAdd.length > 0
          ? `${count(toAdd.length, 'new email')} to add`
          : alreadyListed > 0
            ? 'Every email in this column is already on the list.'
            : 'No email addresses in this column. Try another one.'}
      </p>
      {toAdd.length > 0 && (
        <ul className="grid gap-0.5 rounded-md border px-3 py-2 text-muted-foreground">
          {toAdd.slice(0, 4).map((email) => (
            <li key={email} className="truncate">
              {email}
            </li>
          ))}
          {toAdd.length > 4 && (
            <li>and {(toAdd.length - 4).toLocaleString()} more</li>
          )}
        </ul>
      )}
      {alreadyListed > 0 && toAdd.length > 0 && (
        <p className="text-muted-foreground">
          {alreadyListed.toLocaleString()} already on the list.
        </p>
      )}
      {repeated > 0 && (
        <p className="text-muted-foreground">
          {count(repeated, 'repeat')} in the file will be added once.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="break-words text-muted-foreground">
          {count(skipped.length, 'value')} skipped because{' '}
          {skipped.length === 1 ? "it isn't an email" : "they aren't emails"}:{' '}
          {sample}
          {more > 0 && ` and ${more.toLocaleString()} more`}
        </p>
      )}
    </div>
  );
}
