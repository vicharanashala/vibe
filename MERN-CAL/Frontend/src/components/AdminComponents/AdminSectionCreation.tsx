import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Input } from '../ui/input'
import { CourseDropdown } from './AdminUiComponents/CourseDropdown'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { useCreateSectionMutation } from '@/store/apiService'
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'
import { ModuleDropdown } from './AdminUiComponents/ModuleDropdown'
import { fetchSectionsWithAuth } from '@/store/slices/fetchSections'

export function AdminSectionCreation() {
  const [createSection] = useCreateSectionMutation()
  const [sectionName, setSectionName] = useState('')
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

  const handleSubmit = async () => {
    console.log('Creating section:', sectionName)
    const result = await createSection({
      title: sectionName,
      moduleId: moduleId,
    })
    if (result.data) {
      console.log(
        'dsjbvkkkkkkkkdvbjksdvksdvkjksdjvbkjbdsv',
        result?.data?.data?.module
      )
      const moduleId = result?.data?.data?.module
      dispatch(
        fetchSectionsWithAuth({
          courseId: courseId,
          moduleId: moduleId,
        })
      )
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>
          <Plus /> Add Section
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className='flex justify-center items-center'>
          <AlertDialogTitle className='mb-4 text-xl'>
            Creating a Section
          </AlertDialogTitle>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='w-1/3'>Course : </span>
            <CourseDropdown onCourseSelected={handleCourseSelected} />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='w-1/3'>Module : </span>
            <ModuleDropdown
              courseId={selectedCourseId}
              onModuleSelected={handleModuleSelected}
            />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='w-1/3'>Section Name : </span>
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className='w-2/3'
            />
          </div>
          <AlertDialogDescription></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isLoading}>
            Create
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
