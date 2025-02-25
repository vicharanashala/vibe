'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useDispatch, useSelector } from 'react-redux'
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'

export function ModuleSwitcher({
  selectedCourseId,
  onModuleSelect, // Callback function for module selection
}: {
  selectedCourseId: string
  onModuleSelect: (moduleId: string) => void
}) {
  const [selectedModule, setSelectedModule] = React.useState('Select')
  const [selectedModuleName, setSelectedModuleName] = React.useState('Select')

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModule(moduleId)
    onModuleSelect(moduleId) // Notify parent component
  }
  const dispatch = useDispatch()
  console.log('helloooo', selectedCourseId)
  const moduleData = useSelector(
    (state) => state.modules?.modules?.[selectedCourseId] ?? null
  )

  React.useEffect(() => {
    if (moduleData === null) {
      console.log('fetching modules')
      dispatch(fetchModulesWithAuth(selectedCourseId))
    }
  }, [dispatch, selectedCourseId, moduleData])
  console.log('module data', moduleData)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <GalleryVerticalEnd className='size-4' />
              </div>
              <div className='flex flex-col gap-0.5 leading-none'>
                <span className='font-semibold'>Select Module</span>
                <span className=''>{selectedModuleName}</span>
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width]'
            align='start'
          >
            {(moduleData || []).map((module) => (
              <DropdownMenuItem
                key={module.module_id}
                onSelect={() => {
                  handleModuleSelect(module.module_id)
                  setSelectedModuleName(module.title)
                }}
              >
                {module.title}{' '}
                {module.module_id === selectedModule && (
                  <Check className='ml-auto' />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
