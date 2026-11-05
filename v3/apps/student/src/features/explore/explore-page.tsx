import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CircleAlertIcon, ClockIcon, CompassIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { CourseCover } from '@/features/courses/course-ui';

import { publicKey, usePendingLookup, usePublicCourses, type PublicCourse } from './queries';

/** The course catalogue: public courses (and public cohorts) a student can register for. */
export function ExplorePage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const query = usePublicCourses(deferredSearch);
  const isPending = usePendingLookup();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">Explore courses</h1>
      <p className="mt-2 text-sm text-muted-foreground">Open courses you can register for. Courses you’ve already joined aren’t listed.</p>

      <InputGroup className="mt-8 h-11 sm:h-10 sm:w-80">
        <InputGroupInput
          type="search"
          aria-label="Search courses"
          placeholder="Search courses"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>

      <div className="mt-6">
        {query.isPending ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </ul>
        ) : query.isError ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>We couldn’t load the course catalogue.</AlertTitle>
            <AlertDescription>
              <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={() => query.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : query.data.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.map((c) => (
                <li key={publicKey(c)}>
                  <PublicCourseCard course={c} requested={isPending(c)} />
                </li>
              ))}
            </ul>
            {query.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {query.isFetchingNextPage && <Spinner />}
                  Show more
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CompassIcon />
              </EmptyMedia>
              <EmptyTitle>{deferredSearch ? `No courses match “${deferredSearch}”` : 'No open courses right now'}</EmptyTitle>
              <EmptyDescription>
                {deferredSearch
                  ? 'Try a different search.'
                  : 'You’ve joined every open course, or none are open yet. Your course team can also send you a registration link.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

/** A catalogue card; opens the course's registration page (with its cohort, if any). */
export function PublicCourseCard({ course: c, compact = false, requested = false }: { course: PublicCourse; compact?: boolean; requested?: boolean }) {
  return (
    <Link
      to="/register/$versionId/{-$cohortId}"
      params={{ versionId: c.courseVersionId, cohortId: c.cohortId ?? undefined }}
      aria-label={`${requested ? 'Request sent' : 'Register'} for ${c.courseName}${c.cohortName ? `, ${c.cohortName}` : ''}`}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex h-full flex-col">
          <CourseCover name={c.courseName} seed={c.courseId} className={compact ? 'h-28 w-full' : 'h-36 w-full'} />
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</span>
            {c.cohortName && (
              <Badge variant="outline" className="gap-1 font-normal">
                <UsersIcon aria-hidden /> {c.cohortName}
              </Badge>
            )}
          </div>
          <h2 className="mt-1 line-clamp-2 font-medium">{c.courseName}</h2>
          {!compact && c.courseDescription && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.courseDescription}</p>}
          {requested ? (
            <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-muted-foreground">
              <ClockIcon className="size-4" aria-hidden /> Request sent
            </span>
          ) : (
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
              Register <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
