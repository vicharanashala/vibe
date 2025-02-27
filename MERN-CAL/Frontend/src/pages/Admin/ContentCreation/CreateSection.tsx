import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { CourseDropdown } from '@/components/AdminComponents/AdminUiComponents/CourseDropdown'
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'
import { ModuleDropdown } from '@/components/AdminComponents/AdminUiComponents/ModuleDropdown'
import { fetchSectionsWithAuth } from '@/store/slices/fetchSections'
import { AdminSectionCreation } from '@/components/AdminComponents/AdminSectionCreation'

const CreateSection = () => {
  const dispatch = useDispatch()
  const courses = useSelector((state) => state.courses.courses ?? [])
  const isLoading = useSelector((state) => state.courses.isLoading ?? true)
  const error = useSelector((state) => state.courses.error ?? null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const courseId = selectedCourseId
  const moduleId = selectedModuleId

  // Effect to fetch courses
  useEffect(() => {
    if (!courses.length) {
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, courses.length])

  // Callback function to handle course selection
  const handleCourseSelected = (courseId) => {
    setSelectedCourseId(courseId)
    console.log('Selected course ID:', courseId)
    // Additional logic can be placed here if needed
  }

  const moduleData = useSelector(
    (state) => state.modules?.modules?.[courseId] ?? null
  )

  useEffect(() => {
    if (moduleData === null) {
      console.log('fetching modules')
      dispatch(fetchModulesWithAuth(courseId))
    }
  }, [dispatch, courseId, moduleData])
  console.log('module data', moduleData)

  const handleModuleSelected = (moduleId) => {
    setSelectedModuleId(moduleId)
    console.log('Selected module ID:', moduleId)
  }

  const sections = useSelector(
    (state) => state.sections.sections[selectedModuleId] ?? null
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

  return (
    <div className='p-5'>
      <div className='mb-4 flex justify-between items-center'>
        <h1 className='text-xl font-semibold'>All Modules</h1>
        <AdminSectionCreation />
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className='text-red-500'>Error: {error}</p>
      ) : (
        <div>
          <p>Select a course to view its modules : </p>
          <CourseDropdown onCourseSelected={handleCourseSelected} />
          <p>Select a module to view its sections : </p>
          {selectedCourseId && (
            <ModuleDropdown
              courseId={selectedCourseId}
              onModuleSelected={handleModuleSelected}
            />
          )}
          <p className='mt-2'>Sections :</p>
          <ul className='list-disc list-inside'>
            {sections?.map((section) => (
              <li key={section.id} className='mb-2'>
                {section.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default CreateSection
