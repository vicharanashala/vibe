import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectLabel,
  SelectGroup,
} from '@/components/ui/select' // Adjust path as necessary
import { fetchSectionsWithAuth } from '@/store/slices/fetchSections'

export function SectionDropdown({ moduleId, courseId, onSectionSelected }) {
  const dispatch = useDispatch()
  const sections = useSelector(
    (state) => state.sections.sections[moduleId] ?? null
  )

  useEffect(() => {
    if (moduleId && !sections) {
      dispatch(
        fetchSectionsWithAuth({
          courseId: courseId,
          moduleId: moduleId,
        })
      )
    }
  }, [courseId, moduleId, dispatch])

  const [selectedSectionId, setSelectedSectionId] = useState('')

  const handleChange = (value) => {
    setSelectedSectionId(value)
    onSectionSelected(value)
  }

  return (
    <Select onValueChange={handleChange} value={selectedSectionId}>
      <SelectTrigger>
        <SelectValue placeholder='Select a Section' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Sections</SelectLabel>
          {sections?.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              {section.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
