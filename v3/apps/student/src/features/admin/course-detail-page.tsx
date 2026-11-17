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
import { lazy, Suspense, useState } from 'react';

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
import { FinishedStudents } from './finished-students';
import { DEFAULT_PEOPLE_SORT, isDefaultSort, type PeopleSort } from './people-sort';
import { CourseIntegrity } from './course-integrity';
import { DETECTORS } from './course-proctoring';
import { CourseRegistration } from './course-registration';
import { useCourse } from './queries';
import { useRecordCourseVisit } from './recent-courses';
import { CourseFeedback } from './course-feedback';
import { DEFAULT_INSIGHTS_RANGE, type InsightsRange } from './insights/types';
import { ErrorText, SectionHeading, StudioPage } from './studio-ui';

// The insights carry the chart library, so they load only when a teacher opens the Overview.
const CourseInsightsSection = lazy(() => import('./insights/course-insights'));

export type CourseTab =
  | 'overview'
  | 'content'
  | 'people'
  | 'registration'
  | 'feedback'
  | 'proctoring';
export const COURSE_TABS: CourseTab[] = [
  'overview',
  'content',
  'people',
  'registration',
  'feedback',
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
  peopleSort = DEFAULT_PEOPLE_SORT,
  peopleQuery = '',
  range = DEFAULT_INSIGHTS_RANGE,
}: {
  courseId: string;
  versionId: string;
  tab?: CourseTab;
  /** People's order, kept in the URL so links (and a reload) keep it. */
  peopleSort?: PeopleSort;
  /** People's search box, kept in the URL so the Overview can link to one student. */
  peopleQuery?: string;
  /** The Overview insights' range in days, kept in the URL. */
  range?: InsightsRange;
}) {
  const course = useCourse(courseId);
  const version = useCourseVersion(versionId);
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  useRecordCourseVisit(courseId, versionId);

  function goTo(next: CourseTab) {
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: next === 'overview' ? {} : { tab: next },
      replace: true,
    });
  }

  function peopleSearch(sort: PeopleSort, q: string) {
    return {
      tab: 'people' as const,
      ...(isDefaultSort(sort) ? {} : { sort: sort.by, order: sort.order }),
      ...(q ? { q } : {}),
    };
  }

  function sortPeople(sort: PeopleSort) {
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: peopleSearch(sort, peopleQuery),
      replace: true,
    });
  }

  function searchPeople(q: string) {
    if (q === peopleQuery) return;
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: peopleSearch(peopleSort, q),
      replace: true,
    });
  }

  function openStudent(email: string) {
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: { tab: 'people', q: email },
    });
  }

  function changeRange(next: InsightsRange) {
    void navigate({
      to: '/admin/courses/$courseId/$versionId',
      params: { courseId, versionId },
      search: next === DEFAULT_INSIGHTS_RANGE ? {} : { range: next },
      replace: true,
    });
  }

  return (
    <StudioPage className={tab === 'overview' ? 'max-w-6xl' : 'max-w-4xl'}>
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
              <h1 className="font-aleo text-2xl leading-tight tracking-tight text-balance break-words sm:text-3xl">
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
          <TabsTrigger value="feedback" className="flex-none px-0.5">
            Feedback
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
            range={range}
            onRangeChange={changeRange}
            onOpenStudent={openStudent}
            onSeeFinished={() => sortPeople({ by: 'progress', order: 'desc' })}
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
            sort={peopleSort}
            onSortChange={sortPeople}
            query={peopleQuery}
            onQueryChange={searchPeople}
          />
        </TabsContent>
        <TabsContent value="registration" className="pt-6">
          <CourseRegistration
            courseId={courseId}
            versionId={versionId}
            registrationLink={<RegistrationLink versionId={versionId} />}
          />
        </TabsContent>
        <TabsContent value="feedback" className="pt-6">
          <CourseFeedback courseId={courseId} versionId={versionId} />
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
  onSeeFinished,
  range,
  onRangeChange,
  onOpenStudent,
}: {
  courseId: string;
  versionId: string;
  description?: string;
  onGo: (tab: CourseTab) => void;
  onInvite: () => void;
  onSeeFinished: () => void;
  range: InsightsRange;
  onRangeChange: (range: InsightsRange) => void;
  onOpenStudent: (email: string) => void;
}) {
  const version = useCourseVersion(versionId);
  const settings = useCourseSettings(courseId, versionId);

  const modules = version.data?.modules.filter((m) => !m.isDeleted) ?? [];
  const checksOn = (settings.data?.settings.proctors?.detectors ?? []).filter(
    (d) => d.settings.enabled,
  ).length;
  const lessonSummary = Object.entries(version.data?.itemCounts ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([t, n]) => `${n} ${typeLabel(ITEM_TYPES[t]?.label ?? t, n ?? 0)}`)
    .join(' · ');

  return (
    <div className="grid grid-cols-1 gap-8">
      <Suspense
        fallback={
          <div className="grid gap-4" data-testid="insights-loading" aria-busy="true">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        }
      >
        <CourseInsightsSection
          courseId={courseId}
          versionId={versionId}
          range={range}
          onRangeChange={onRangeChange}
          onInvite={onInvite}
          onOpenStudent={onOpenStudent}
        />
      </Suspense>

      <FinishedStudents courseId={courseId} versionId={versionId} onSeeAll={onSeeFinished} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ActionTile
          icon={LayersIcon}
          title="Content"
          detail={
            version.data
              ? [`${modules.length} ${modules.length === 1 ? 'module' : 'modules'}`, lessonSummary]
                  .filter(Boolean)
                  .join(' · ')
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
          <p className="max-w-2xl text-sm leading-6 break-words text-foreground/80">
            {description}
          </p>
        </section>
      )}
    </div>
  );
}

/** "1 quiz", "3 quizzes", "2 case studies". */
function typeLabel(label: string, n: number) {
  const lower = label.toLowerCase();
  if (n === 1) return lower;
  if (lower.endsWith('z')) return `${lower}zes`;
  if (lower.endsWith('y')) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
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
            {copied ? <CheckIcon aria-hidden className="text-emerald-600 animate-in zoom-in-50 duration-200" /> : <CopyIcon aria-hidden className="animate-in fade-in-0 duration-200" />}
            {copied ? 'Copied' : 'Copy'}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
