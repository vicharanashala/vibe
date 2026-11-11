import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useCourseVersion,
  useSectionItems,
  type CourseSection,
} from '@/features/courses/queries';

import { DragHandle, SortableList, draggingClass, useSortableRow, type Position } from '../arrange';
import { ITEM_TYPES } from '../course-content';
import { useMoveItem } from '../queries';
import {
  lessonQueryOptions,
  quizQuestionsQueryOptions,
  type LessonLocation,
  type LessonType,
} from './lesson-api';

const EDITABLE = ['VIDEO', 'BLOG', 'QUIZ', 'FEEDBACK'];
const NEW_TYPES: { type: LessonType; label: string }[] = [
  { type: 'VIDEO', label: 'Video' },
  { type: 'BLOG', label: 'Article' },
  { type: 'QUIZ', label: 'Quiz' },
  { type: 'FEEDBACK', label: 'Feedback' },
];

const ordered = <T extends { order: string; isDeleted?: boolean }>(list: T[]) =>
  list
    .filter((x) => !x.isDeleted)
    .sort((a, b) => a.order.localeCompare(b.order));

/** Left sidebar in the lesson editors: the current module's sections and lessons, for jumping between them. */
export function EditorOutline({
  loc,
  itemId,
}: {
  loc: LessonLocation;
  itemId?: string;
}) {
  const version = useCourseVersion(loc.versionId);
  const modules = version.data ? ordered(version.data.modules) : [];
  const moduleIndex = modules.findIndex((m) => m.moduleId === loc.moduleId);
  const module = modules[moduleIndex];

  return (
    <Sidebar aria-label="Module outline">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        {module ? (
          <>
            <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
              Module {String(moduleIndex + 1).padStart(2, '0')}
            </p>
            <p className="font-aleo text-base leading-snug">{module.name}</p>
          </>
        ) : (
          <div className="grid gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-40" />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {module
          ? ordered(module.sections).map((section, si) => (
              <OutlineSection
                key={section.sectionId}
                loc={{ ...loc, sectionId: section.sectionId }}
                section={section}
                label={`${moduleIndex + 1}.${si + 1}`}
                itemId={itemId}
                isNewHere={!itemId && section.sectionId === loc.sectionId}
              />
            ))
          : [0, 1].map((i) => (
              <SidebarGroup key={i}>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
              </SidebarGroup>
            ))}
      </SidebarContent>
    </Sidebar>
  );
}

function OutlineSection({
  loc,
  section,
  label,
  itemId,
  isNewHere,
}: {
  loc: LessonLocation;
  section: CourseSection;
  label: string;
  itemId?: string;
  isNewHere: boolean;
}) {
  const items = useSectionItems(loc.versionId, loc.moduleId, loc.sectionId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isMobile, setOpenMobile } = useSidebar();
  const moveItem = useMoveItem();
  const lessons = items.data ? [...items.data].sort((a, b) => a.order.localeCompare(b.order)) : [];
  // Load a lesson as soon as the pointer or focus lands on it, so opening it is instant.
  const prefetch = (id: string, type: string) => {
    void queryClient.prefetchQuery(lessonQueryOptions(loc, id));
    if (type === 'QUIZ')
      void queryClient.prefetchQuery(quizQuestionsQueryOptions(id));
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <span className="tabular-nums">{label}</span>
        <span className="truncate">{section.name}</span>
      </SidebarGroupLabel>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarGroupAction title={`Add a lesson to ${section.name}`} />
          }
        >
          <PlusIcon />
          <span className="sr-only">Add a lesson to {section.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-40">
          {NEW_TYPES.map(({ type, label: typeLabel }) => {
            const t = ITEM_TYPES[type];
            return (
              <DropdownMenuItem
                key={type}
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                  void navigate({
                    to: '/admin/courses/$courseId/$versionId/lesson',
                    params: loc,
                    search: {
                      module: loc.moduleId,
                      section: loc.sectionId,
                      type,
                    },
                  });
                }}
              >
                <t.icon /> {typeLabel}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.isPending && <SidebarMenuSkeleton showIcon />}
          {items.data && (
            <SortableList
              items={lessons}
              getId={(i) => i._id}
              getLabel={(i) => i.name}
              onMove={(id, position, next) => {
                if (moveItem.isPending) return;
                moveItem
                  .mutateAsync({ versionId: loc.versionId, moduleId: loc.moduleId, sectionId: loc.sectionId, itemId: id, to: toItem(position), next })
                  .catch((e: Error) => toast.error(`The lesson wasn’t moved: ${e.message}`));
              }}
            >
              {lessons.map((item) => (
                <OutlineLesson
                  key={item._id}
                  loc={loc}
                  item={item}
                  isActive={item._id === itemId}
                  onPrefetch={() => prefetch(item._id, item.type)}
                  onNavigate={() => isMobile && setOpenMobile(false)}
                  onAddBelow={(type) => {
                    if (isMobile) setOpenMobile(false);
                    void navigate({
                      to: '/admin/courses/$courseId/$versionId/lesson',
                      params: { courseId: loc.courseId, versionId: loc.versionId },
                      search: { module: loc.moduleId, section: loc.sectionId, type, after: item._id },
                    });
                  }}
                />
              ))}
            </SortableList>
          )}
          {items.data && items.data.length === 0 && !isNewHere && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No lessons yet.
            </p>
          )}
          {isNewHere && (
            <SidebarMenuItem>
              <SidebarMenuButton isActive className="italic">
                <PlusIcon />
                <span>New lesson</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const toItem = (p: Position) => ('beforeId' in p ? { beforeItemId: p.beforeId } : { afterItemId: p.afterId });

type OutlineItem = { _id: string; name: string; type: string; order: string };

/** One lesson in the editor outline: drag handle, link, and "add a lesson below" on hover/focus. */
function OutlineLesson({
  loc,
  item,
  isActive,
  onPrefetch,
  onNavigate,
  onAddBelow,
}: {
  loc: LessonLocation;
  item: OutlineItem;
  isActive: boolean;
  onPrefetch: () => void;
  onNavigate: () => void;
  onAddBelow: (type: LessonType) => void;
}) {
  const row = useSortableRow(item._id);
  const t = ITEM_TYPES[item.type];
  const Icon = t?.icon;
  const editable = EDITABLE.includes(item.type);
  return (
    <SidebarMenuItem ref={row.setNodeRef} style={row.style} className={cn('flex items-center gap-0.5', draggingClass(row.isDragging))}>
      <DragHandle
        name={item.name}
        handle={row.handle}
        className="size-6 opacity-60 group-hover/menu-item:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      />
      <SidebarMenuButton
        isActive={isActive}
        disabled={!editable}
        className="min-w-0 flex-1 pr-7"
        tooltip={editable ? undefined : 'Can’t be edited in the studio yet'}
        render={
          editable ? (
            <Link
              to="/admin/courses/$courseId/$versionId/lesson"
              params={{ courseId: loc.courseId, versionId: loc.versionId }}
              search={{ module: loc.moduleId, section: loc.sectionId, item: item._id }}
              onPointerEnter={onPrefetch}
              onFocus={onPrefetch}
              onClick={onNavigate}
            />
          ) : undefined
        }
      >
        {Icon && <Icon />}
        <span>{item.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuAction showOnHover title={`Add a lesson below ${item.name}`} />}>
          <PlusIcon />
          <span className="sr-only">Add a lesson below {item.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-40">
          {NEW_TYPES.map(({ type, label }) => {
            const nt = ITEM_TYPES[type];
            return (
              <DropdownMenuItem key={type} onClick={() => onAddBelow(type)}>
                <nt.icon /> {label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
