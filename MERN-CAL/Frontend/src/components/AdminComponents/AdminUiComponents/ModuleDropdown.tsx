import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectLabel,
  SelectGroup,
} from '@/components/ui/select' // Adjust path as necessary
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'

export function ModuleDropdown({ courseId, onModuleSelected  }) {
  const dispatch = useDispatch()
  const moduleData = useSelector(
    (state) => state.modules?.modules?.[courseId] ?? null
  )

  React.useEffect(() => {
    if (moduleData === null) {
      console.log('fetching modules')
      dispatch(fetchModulesWithAuth(courseId))
    }
  }, [dispatch, courseId, moduleData])
  console.log('module data', moduleData)

  const [selectedModuleId, setSelectedModuleId] = useState('');
  
    const handleChange = (value) => {
        setSelectedModuleId(value);
        onModuleSelected(value);
    };

  return (
    <Select onValueChange={handleChange} value={selectedModuleId}>
      <SelectTrigger>
        <SelectValue placeholder='Select a module' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Modules</SelectLabel>
          {moduleData?.map((module) => (
            <SelectItem key={module.module_id} value={module.module_id}>
              {module.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
