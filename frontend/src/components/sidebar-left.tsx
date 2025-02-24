import * as React from 'react'
import { Lock, Minus, Plus } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { CourseSwitcher } from './course-switcher'
import { ModuleSwitcher } from './module-switcher'
import { useDispatch, useSelector } from 'react-redux'
import { fetchSectionsWithAuth } from '@/store/slices/fetchSections'
import { fetchSectionItemsWithAuth } from '@/store/slices/fetchItems'
import { fetchSectionProgress } from '@/store/slices/sectionProgressSlice'
import { fetchProgress } from '@/store/slices/fetchStatusSlice'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'INCOMPLETE':
      return 'bg-red-500'
    case 'IN_PROGRESS':
      return 'bg-yellow-500'
    case 'COMPLETE':
      return 'bg-green-500'
    default:
      return 'bg-gray-400'
  }
}

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>('')
  const [selectedModuleId, setSelectedModuleId] = React.useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = React.useState<string>('')
  const navigate = useNavigate()

  const dispatch = useDispatch()
  const sections = useSelector(
    (state) => state.sections.sections[selectedModuleId] ?? null
  )
  const sectionItems = useSelector(
    (state) => state.items?.items[selectedSectionId] ?? null
  )

  React.useEffect(() => {
    if (selectedModuleId && !sections) {
      dispatch(
        fetchSectionsWithAuth({
          courseId: selectedCourseId,
          moduleId: selectedModuleId,
        })
      )
    }
  }, [selectedCourseId, selectedModuleId, dispatch])

  React.useEffect(() => {
    if (selectedSectionId && !sectionItems) {
      dispatch(fetchSectionItemsWithAuth(selectedSectionId))
    }
  }, [selectedSectionId, dispatch])

  const progressKey = `${selectedCourseId}-${selectedSectionId}`

  // Retrieve section progress from Redux state
  const sectionProgress = useSelector((state) => state.sectionProgress)
  console.log(
    'section items',
    useSelector((state) => state.sections.sections)
  )

  // Fetch section progress when component mounts or ids change
  React.useEffect(() => {
    if (selectedCourseId !== '' && selectedModuleId !== '') {
      ;(sections || []).forEach((section) => {
        const progressKey = `${selectedCourseId}-${section.id}`
        if (!sectionProgress[progressKey]) {
          dispatch(
            fetchSectionProgress({
              courseInstanceId: selectedCourseId,
              sectionId: section.id,
            })
          )
        }
      })
    }
  }, [dispatch, selectedCourseId, sections, sectionProgress])

  // Retrieve progress from Redux state
  const sectionItemProgress = useSelector((state) => state.progress)

  // Dispatch fetchProgress on component mount or when ids change
  React.useEffect(() => {
    if (
      selectedSectionId !== '' &&
      selectedCourseId !== '' &&
      selectedModuleId !== '' &&
      sections
    ) {
      ;(sectionItems || []).forEach((item) => {
        const progressKey = `${selectedCourseId}-${item.id}`
        if (!sectionItemProgress[progressKey]) {
          dispatch(
            fetchProgress({
              courseInstanceId: selectedCourseId,
              sectionItemId: item.id,
            })
          )
        }
      })
    }
  }, [dispatch, selectedCourseId, sectionItems, sectionItemProgress])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <CourseSwitcher
          onCourseSelect={(courseId) => {
            setSelectedCourseId(courseId)
          }}
        />
        {selectedCourseId && (
          <ModuleSwitcher
            selectedCourseId={selectedCourseId}
            onModuleSelect={(moduleId) => {
              setSelectedModuleId(moduleId)
            }}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {sections?.map((section) => {
              const progressKey = `${selectedCourseId}-${section.id}`
              const progressStatus = sectionProgress[progressKey] || 'Pending'
              const sectionDotColor = getStatusColor(progressStatus) // Get color for section status

              return (
                <Collapsible
                  key={section.id}
                  defaultOpen={false}
                  className='group/collapsible'
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        onClick={() => setSelectedSectionId(section.id)}
                      >
                        <span
                          className={`size-2 rounded-full ${sectionDotColor}`}
                        />{' '}
                        {/* Section status dot */}
                        <span className='ml-2'>{section.title}</span>{' '}
                        {/* Section Title */}
                        <Plus className='ml-auto group-data-[state=open]/collapsible:hidden' />
                        <Minus className='ml-auto group-data-[state=closed]/collapsible:hidden' />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    {sectionItems && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {sectionItems.map((item) => {
                            const itemProgressKey = `${selectedCourseId}-${item.id}`
                            const itemProgress =
                              sectionItemProgress[itemProgressKey] || 'Pending'
                            const itemDotColor = getStatusColor(itemProgress)
                            const courseId = selectedCourseId
                            const moduleId = selectedModuleId
                            const sectionId = selectedSectionId
                            const assignment = item

                            return (
                              <SidebarMenuSubItem key={item.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={item.isActive}
                                >
                                  <div
                                    className='flex items-center gap-2'
                                    onClick={() => {
                                      if (item.item_type === 'video') {
                                        navigate('/content-scroll-view', {
                                          state: {
                                            assignment,
                                            sectionId,
                                            courseId,
                                            moduleId,
                                          },
                                        })
                                      } else if (
                                        item.item_type === 'assessment'
                                      ) {
                                        toast('Watch video first')
                                      }
                                    }}
                                  >
                                    <span
                                      className={`size-2 rounded-full ${itemDotColor}`}
                                    />{' '}
                                    {/* Item status dot */}
                                    {item.item_type}
                                    {(item.item_type === 'assessment' ||
                                      itemProgress === 'INCOMPLETE') && (
                                      <Lock className='ml-auto' />
                                    )}
                                  </div>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
