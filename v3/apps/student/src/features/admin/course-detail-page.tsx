import { Link, useNavigate } from '@tanstack/react-router';
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  LayersIcon,
  MailPlusIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { GeneratedCover } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCourseVersion } from '@/features/courses/queries';
import { useCourseSettings } from '@/features/learn/queries';

import { CourseContent, ITEM_TYPES } from './course-content';
import { CoursePeople } from './course-people';
import { CourseIntegrity } from './course-integrity';
import { DETECTORS } from './course-proctoring';
import { CourseRegistration } from './course-registration';
import { useCourse, useCourseEnrollments } from './queries';
import { ErrorText, SectionHeading, StatStrip, StudioPage } from './studio-ui';

export type CourseTab =
  'overview' | 'content' | 'people' | 'registration' | 'proctoring';
export const COURSE_TABS: CourseTab[] = [
  'overview',
  'content',
  'people',
  'registration',
  'proctoring',
];

export function parseCourseTab(raw: unknown): CourseTab | undefined {
  return COURSE_TABS.includes(raw as CourseTab)
    ? (raw as CourseTab)
    : undefined;
}

/** One course version, Luma "manage event"-style: title, then Overview / Content / People / Proctoring tabs. */
export function CourseDetailPage({
  courseId,
  versionId,
  tab = 'overview',
}: {
  courseId: string;
  versionId: string;
  tab?: CourseTab;
}) {
  const course = useCourse(courseId);
  const version = useCourseVersion(versionId);
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);

  function goTo(next: CourseTab) {
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: next === 'overview' ? {} : { tab: next },
      replace: true,
    });
  }

  return (
    <StudioPage className="max-w-4xl">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link to="/admin/courses" className="hover:text-foreground">
          Courses
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <span className="truncate">{version.data?.version ?? 'Version'}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <GeneratedCover
            seed={courseId}
            title={course.data?.name ?? ''}
            compact
            className="size-14 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            {course.isPending ? (
              <Skeleton className="h-8 w-64" />
            ) : (
              <h1 className="font-aleo text-3xl leading-tight tracking-tight text-balance">
                {course.data?.name ?? 'Course'}
              </h1>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link
              to="/courses/$courseId/$versionId"
              params={{ courseId, versionId }}
            />
          }
        >
          Student view <ExternalLinkIcon aria-hidden />
        </Button>
      </div>
      {course.isError && <ErrorText error={course.error} className="mt-2" />}

      <Tabs
        value={tab}
        onValueChange={(v) => goTo(v as CourseTab)}
        className="mt-6 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-4 overflow-x-auto overflow-y-hidden border-b border-border px-0 [scrollbar-width:none]"
        >
          <TabsTrigger value="overview" className="flex-none px-0.5">
            Overview
          </TabsTrigger>
          <TabsTrigger value="content" className="flex-none px-0.5">
            Content
          </TabsTrigger>
          <TabsTrigger value="people" className="flex-none px-0.5">
            People
          </TabsTrigger>
          <TabsTrigger value="registration" className="flex-none px-0.5">
            Registration
          </TabsTrigger>
          <TabsTrigger value="proctoring" className="flex-none px-0.5">
            Proctoring
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-6">
          <CourseOverview
            courseId={courseId}
            versionId={versionId}
            description={course.data?.description}
            onGo={goTo}
            onInvite={() => {
              goTo('people');
              setInviteOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="content" className="pt-6">
          <CourseContent courseId={courseId} versionId={versionId} />
        </TabsContent>
        <TabsContent value="people" className="pt-6">
          <CoursePeople
            courseId={courseId}
            versionId={versionId}
            inviteOpen={inviteOpen}
            onInviteOpenChange={setInviteOpen}
          />
        </TabsContent>
        <TabsContent value="registration" className="pt-6">
          <CourseRegistration
            versionId={versionId}
            registrationLink={<RegistrationLink versionId={versionId} />}
          />
        </TabsContent>
        <TabsContent value="proctoring" className="pt-6">
          <CourseIntegrity courseId={courseId} versionId={versionId} />
        </TabsContent>
      </Tabs>
    </StudioPage>
  );
}

function CourseOverview({
  courseId,
  versionId,
  description,
  onGo,
  onInvite,
}: {
  courseId: string;
  versionId: string;
  description?: string;
  onGo: (tab: CourseTab) => void;
  onInvite: () => void;
}) {
  const version = useCourseVersion(versionId);
  const enrollments = useCourseEnrollments(courseId, versionId);
  const settings = useCourseSettings(courseId, versionId);

  const modules = version.data?.modules.filter((m) => !m.isDeleted) ?? [];
  const students = (enrollments.data ?? []).filter((e) => e.role === 'STUDENT');
  const finished = students.filter((e) => (e.progress ?? 0) >= 100).length;
  const avg = students.length
    ? Math.round(
        students.reduce((s, e) => s + (e.progress ?? 0), 0) / students.length,
      )
    : null;
  const checksOn = (settings.data?.settings.proctors?.detectors ?? []).filter(
    (d) => d.settings.enabled,
  ).length;
  const lessonSummary = Object.entries(version.data?.itemCounts ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([t, n]) => `${n} ${(ITEM_TYPES[t]?.label ?? t).toLowerCase()}`)
    .join(' · ');

  return (
    <div className="grid gap-8">
      <section>
        <SectionHeading>At a glance</SectionHeading>
        <StatStrip
          stats={[
            {
              label: 'Students',
              value: enrollments.data ? students.length : '–',
            },
            {
              label: 'Average progress',
              value: avg === null ? '–' : `${avg}%`,
            },
            { label: 'Finished', value: enrollments.data ? finished : '–' },
            {
              label: 'Lessons',
              value: version.data ? (version.data.totalItems ?? 0) : '–',
              hint: lessonSummary || undefined,
            },
          ]}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ActionTile
          icon={LayersIcon}
          title="Content"
          detail={
            version.data
              ? `${modules.length} ${modules.length === 1 ? 'module' : 'modules'}`
              : '…'
          }
          onClick={() => onGo('content')}
        />
        <ActionTile
          icon={MailPlusIcon}
          title="Invite people"
          detail="Students or instructors"
          onClick={onInvite}
        />
        <ActionTile
          icon={ShieldCheckIcon}
          title="Proctoring"
          detail={
            settings.data
              ? checksOn
                ? `${checksOn} of ${DETECTORS.filter((d) => d.implemented).length} checks on`
                : 'Off'
              : '…'
          }
          onClick={() => onGo('proctoring')}
        />
      </section>

      <section>
        <SectionHeading>Registration link</SectionHeading>
        <RegistrationLink versionId={versionId} />
      </section>

      {description && (
        <section>
          <SectionHeading>About this course</SectionHeading>
          <p className="max-w-2xl text-sm leading-6 text-foreground/80">
            {description}
          </p>
        </section>
      )}
    </div>
  );
}

function ActionTile({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blush text-blush-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
      <ChevronRightIcon
        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function RegistrationLink({ versionId }: { versionId: string }) {
  const url = `${window.location.origin}/register/${versionId}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the field stays selectable.
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Share this link so students can register for this course.
      </p>
      <InputGroup className="mt-3">
        <InputGroupInput
          readOnly
          value={url}
          aria-label="Registration link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={() => void copy()} aria-label="Copy link">
            {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
