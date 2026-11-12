import { Link } from '@tanstack/react-router';
import { BookOpenIcon, CircleAlertIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { enterClass, stagger } from '@/lib/motion';

import { CourseCover, ProgressMeter, StudyProgressSummary, percentOf } from './course-ui';
import { useEnrollments } from './queries';

type Tab = 'active' | 'archived';

export function CoursesPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const query = useEnrollments(tab, deferredSearch);
  const data = query.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">My courses</h1>
      <p className="mt-2 text-sm text-muted-foreground">Everything you’re enrolled in, with your progress.</p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-8 flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList aria-label="Course status">
            {(['active', 'archived'] as const).map((t) => (
              <TabsTrigger key={t} value={t}>
                {t === 'active' ? 'Active' : 'Archived'}
                {/* The backend's activeCount/archivedCount are unreliable; count what this tab lists. */}
                {tab === t && data && (
                  <Badge variant="outline" className="ml-0.5 tabular-nums">
                    {data.totalDocuments}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <InputGroup className="h-11 sm:h-10 sm:w-72">
            <InputGroupInput
              type="search"
              aria-label="Search your courses"
              placeholder="Search your courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <TabsContent value={tab}>
          {query.isPending ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-72 rounded-3xl" />
              ))}
            </ul>
          ) : query.isError ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>We couldn’t load your courses.</AlertTitle>
              <AlertDescription>
                <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={() => query.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : data && data.enrollments.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.enrollments.map((e, i) => {
                const pct = percentOf(e);
                const total = e.contentCounts?.totalItems ?? 0;
                return (
                  <li key={e._id} className={enterClass} style={stagger(i)}>
                    <Link
                      to="/courses/$courseId/$versionId"
                      params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                      className="group block h-full rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <Card size="sm" className="h-full transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md">
                        <CardContent className="flex h-full flex-col">
                          <CourseCover name={e.course.name} seed={e.courseId} className="h-36 w-full" />
                          <p className="mt-4 flex justify-between gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            <span className="truncate">Course{e.cohortName ? ` · ${e.cohortName}` : ''}</span>
                            {total > 0 && <span className="shrink-0">{total} lessons</span>}
                          </p>
                          <h2 className="mt-1 line-clamp-2 font-medium">{e.course.name}</h2>
                          {e.course.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.course.description}</p>
                          )}
                          <div className="mt-auto grid gap-2.5 pt-4">
                            <ProgressMeter
                              size="sm"
                              tone="strict"
                              label={pct >= 100 ? 'Completed' : 'Strict'}
                              value={pct}
                              ariaLabel={`${e.course.name} progress`}
                            />
                            <StudyProgressSummary courseId={e.courseId} versionId={e.courseVersionId} variant="compact" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {deferredSearch ? `No courses match “${deferredSearch}”` : tab === 'active' ? 'No active courses yet' : 'No archived courses'}
                </EmptyTitle>
                <EmptyDescription>
                  {tab === 'active' && !deferredSearch
                    ? 'Join a course through an invite or registration link from your course team.'
                    : 'Try a different search or tab.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
