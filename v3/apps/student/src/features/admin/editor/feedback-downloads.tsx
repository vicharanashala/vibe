import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useCourseVersion } from '@/features/courses/queries';

import type { FeedbackDownload } from './lesson-api';

export interface DownloadChoice {
  label: string;
  description: string;
  format: FeedbackDownload['format'];
  type?: FeedbackDownload['type'];
}

/**
 * A "Download" menu for feedback exports: a few file choices, plus "Include
 * earlier versions" (off: each student's current answer only). Shows progress
 * while the file is prepared and offers to try again if it fails.
 */
export function FeedbackDownloadMenu({
  choices,
  cohortId,
  download,
  label = 'Download',
}: {
  choices: DownloadChoice[];
  cohortId?: string;
  download: (options: FeedbackDownload) => Promise<string>;
  label?: string;
}) {
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(choice: DownloadChoice) {
    setBusy(true);
    try {
      const name = await download({
        format: choice.format,
        type: choice.type,
        history: history ? 'all' : 'latest',
        cohortId,
      });
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error((e as Error).message || 'Couldn’t prepare the file.', {
        action: { label: 'Try again', onClick: () => void run(choice) },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={busy} />}>
        {busy ? <Spinner /> : <DownloadIcon aria-hidden />}
        {busy ? 'Preparing file…' : label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Download</DropdownMenuLabel>
          {choices.map((choice) => (
            <DropdownMenuItem key={choice.label} onClick={() => void run(choice)}>
              <div>
                <p>{choice.label}</p>
                <p className="text-xs text-muted-foreground">{choice.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={history}
            onCheckedChange={(c) => setHistory(c === true)}
            closeOnClick={false}
          >
            Include earlier versions
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The version's cohorts, when it has any. */
export function useVersionCohorts(versionId: string) {
  const version = useCourseVersion(versionId);
  return version.data?.cohortDetails ?? [];
}

/** "All cohorts" or one cohort; renders nothing for a course without cohorts. */
export function CohortSelect({
  versionId,
  value,
  onChange,
}: {
  versionId: string;
  value: string;
  onChange: (cohortId: string) => void;
}) {
  const cohorts = useVersionCohorts(versionId);
  if (!cohorts.length) return null;
  return (
    <NativeSelect
      aria-label="Cohort"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="sm:w-56"
    >
      <NativeSelectOption value="">All cohorts</NativeSelectOption>
      {cohorts.map((c) => (
        <NativeSelectOption key={c.id} value={c.id}>
          {c.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
