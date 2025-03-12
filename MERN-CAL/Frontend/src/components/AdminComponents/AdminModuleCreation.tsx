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
import { useCreateModuleMutation } from '@/store/apiService'
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'

export function AdminModuleCreation() {
  const [createModule, { isSuccess, isError }] = useCreateModuleMutation();
  const dispatch = useDispatch()
  const courses = useSelector((state) => state.courses.courses ?? [])
  const isLoading = useSelector((state) => state.courses.isLoading ?? true)
  const error = useSelector((state) => state.courses.error ?? null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const courseId = selectedCourseId
  const [moduleName, setModuleName] = useState('')

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

  const handleSubmit = async () => {
    console.log('Creating module:', moduleName)
    const result = await createModule({ title: moduleName, courseId: courseId })
    console.log('i am course id in module data',result.data)
    if (result.data) {
      dispatch(fetchModulesWithAuth(result?.data?.data?.course))
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>
          <Plus /> Add Module
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className='flex justify-center items-center'>
          <AlertDialogTitle className='mb-4 text-xl'>
            Creating a Module
          </AlertDialogTitle>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='w-1/3'>Course : </span>
            <CourseDropdown onCourseSelected={handleCourseSelected} />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='w-1/3'>Module Name : </span>
            <Input
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
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
