/**
 * Student Dashboard Page
 *
 * This page serves as the main dashboard for students, displaying an overview of their courses
 * and learning progress. It shows key metrics and two main tables for course management.
 *
 * Features:
 * - Dashboard cards showing summary statistics:
 *   - Total number of available courses
 *   - Number of active courses
 *   - Average progress across all courses
 *   - Number of completed courses
 * - Interactive tables for:
 *   - All available courses with duration
 *   - Ongoing courses with progress tracking
 * - View all/Show less functionality for both tables
 * - Responsive grid layout
 *
 * Key Components:
 * - Card components for metrics display
 * - Table components for course listings
 * - Button components for table expansion control
 * - Icons from lucide-react library
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Clock, Award, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Chart } from '@/components/ChartDashboard'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { fetchWeeklyProgress } from '@/store/slices/FetchWeeklyProgress'
import { DataTableDemo } from '@/components/dashboardProgressTable'

// Mock data for available courses

// const CourseData = [
//   { id: 1, name: 'Introduction to AI', duration: '6 weeks' },
//   { id: 2, name: 'Data Science Basics', duration: '8 weeks' },
//   { id: 3, name: 'Web Development', duration: '10 weeks' },
//   { id: 4, name: 'Machine Learning', duration: '12 weeks' },
//   { id: 5, name: 'Deep Learning', duration: '14 weeks' },
//   { id: 6, name: 'Cloud Computing', duration: '5 weeks' },
//   { id: 7, name: 'Cyber Security', duration: '7 weeks' },
//   { id: 8, name: 'Blockchain Basics', duration: '9 weeks' },
//   { id: 9, name: 'Internet of Things', duration: '11 weeks' },
//   { id: 10, name: 'Big Data Analytics', duration: '13 weeks' },
// ]

// Mock data for student's ongoing courses
const ongoingCourses = [
  { id: 101, name: 'Introduction to Python', progression: '50%' },
  { id: 102, name: 'Advanced JavaScript', progression: '75%' },
  { id: 103, name: 'Data Science Basics', progression: '30%' },
  { id: 104, name: 'React for Beginners', progression: '90%' },
  { id: 105, name: 'Machine Learning Fundamentals', progression: '20%' },
  { id: 106, name: 'Node.js Essentials', progression: '60%' },
  { id: 107, name: 'Docker and Kubernetes', progression: '40%' },
  { id: 108, name: 'Microservices Architecture', progression: '70%' },
  { id: 109, name: 'DevOps Practices', progression: '80%' },
  { id: 110, name: 'Agile Methodologies', progression: '55%' },
]

const StudentDashboard = () => {
  // State for controlling table expansion
  const [completedCourses, setcompletedCourses] = useState(0)
  const dispatch = useDispatch()

  const CourseData = useSelector(
    (state: {
      courses: { courses: { id: number; name: string; duration: string }[] }
    }) => state.courses.courses ?? null
  )

  useEffect(() => {
    console.log('Courses:', CourseData)
    if (!CourseData || CourseData.length === 0) {
      console.log('Dispatching fetchCoursesWithAuth')
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, CourseData])

  const courseProgressData = useSelector(
    (state: {
      weeklyProgress: {
        weeklyProgress: {
          courseData: Record<string, { User: number; date: string }[]>
        }
      }
    }) => state.weeklyProgress?.weeklyProgress?.courseData
  )

  console.log('courseData', courseProgressData)

  useEffect(() => {
    if (!courseProgressData || Object.keys(courseProgressData).length === 0) {
      console.log('Dispatching fetchWeeklyProgress')
      dispatch(fetchWeeklyProgress())
    }
  }, [dispatch, courseProgressData])

  interface CourseProgressEntry {
    User: number
    date: string
  }

  interface CourseProgressData {
    [courseKey: string]: CourseProgressEntry[]
  }

  const calculateLatestAverageProgress = (data: CourseProgressData): number => {
    let completed = 0
    const latestEntries = Object.keys(data).map((courseKey) => {
      const entries = data[courseKey]
      // Create a copy of the entries array to avoid mutating the original state
      const sortedEntries = [...entries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const latestProgress = sortedEntries[0].User // Latest progress
      if (latestProgress === 100) completed += 1 // Increment if latest progress is 100%
      console.log('Hellossdfncdhbvjsbvjsjdvbjhsdvj', completed)
      return latestProgress
    })
    setcompletedCourses(completed)
    console.log('Latest Entries:', completed)

    // Calculate the average of latest entries across all courses
    if (latestEntries.length === 0) return 0 // Avoid division by zero if no entries exist
    return (
      latestEntries.reduce((acc, curr) => acc + curr, 0) / latestEntries.length
    )
  }

  // State for average progress
  const [averageProgress, setAverageProgress] = useState(0)

  useEffect(() => {
    if (Object.keys(courseProgressData || {}).length > 0) {
      setAverageProgress(calculateLatestAverageProgress(courseProgressData))
    }
  }, [courseProgressData])

  console.log('Average Progress', averageProgress)

  // const { data: newCourses } = useFetchCoursesWithAuthQuery()
  // const CourseData = newCourses?.results
  // console.log(CourseData)

  // Limit displayed courses based on show all state

  return (
    <div className='h-full'>
      {/* Dashboard metrics cards */}
      <div className='grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Courses</CardTitle>
            <BookOpen className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{CourseData?.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Active Courses
            </CardTitle>
            <Clock className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{CourseData?.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              All Courses Average Progress
            </CardTitle>
            <TrendingUp className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {Math.round(
                ongoingCourses.reduce((acc) => acc + averageProgress, 0) /
                  ongoingCourses.length
              )}
              %
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Completed</CardTitle>
            <Award className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{completedCourses}</div>
          </CardContent>
        </Card>
      </div>

      {/* Course tables section */}
      <div className='grid h-[calc(100%-140px)] grid-cols-2 gap-4 p-4'>
        {/* All Courses table */}
        <Chart />

        {/* Ongoing Courses table */}
        <div className='flex h-full flex-col rounded-lg border'>
          <div className='flex-1 px-6 py-4'>
            <DataTableDemo />
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
