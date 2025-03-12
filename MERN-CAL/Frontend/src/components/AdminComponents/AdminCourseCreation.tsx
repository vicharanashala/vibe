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
import { useState } from 'react'
import { useCreateCourseMutation } from '@/store/apiService'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { useDispatch } from 'react-redux'

export function AdminCourseCreation() {
  const dispatch = useDispatch()
  const [createCourse, { isLoading }] = useCreateCourseMutation()
  const [courseName, setCourseName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSubmit = async () => {
    const result = await createCourse({ title: courseName, description, startDate, endDate });
    if (result.data) {
      dispatch(fetchCoursesWithAuth());
    }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>
          <Plus /> Add Course
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className='flex justify-center items-center'>
          <AlertDialogTitle className='mb-4 text-xl'>
            Creating a Course
          </AlertDialogTitle>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='1/3'>Course Name : </span>
            <Input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className='w-2/3'
            />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='1/3'>Desciption : </span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-2/3'
            />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='1/3'>Starting Date : </span>
            <Input
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className='w-2/3 flex justify-between items-center'
            />
          </div>
          <div className='flex w-full gap-2 justify-between items-center'>
            <span className='1/3'>End Date : </span>
            <Input
              type='date'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className='w-2/3 flex justify-between items-center'
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
