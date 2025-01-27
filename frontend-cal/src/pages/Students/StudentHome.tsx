/**
 * StudentHome Page
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

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Clock, Award, TrendingUp } from 'lucide-react'
import { useState } from 'react'

// Mock data for available courses
const courses = [
  { id: 1, name: 'Introduction to AI', duration: '6 weeks' },
  { id: 2, name: 'Data Science Basics', duration: '8 weeks' },
  { id: 3, name: 'Web Development', duration: '10 weeks' },
  { id: 4, name: 'Machine Learning', duration: '12 weeks' },
  { id: 5, name: 'Deep Learning', duration: '14 weeks' },
  { id: 6, name: 'Cloud Computing', duration: '5 weeks' },
  { id: 7, name: 'Cyber Security', duration: '7 weeks' },
  { id: 8, name: 'Blockchain Basics', duration: '9 weeks' },
  { id: 9, name: 'Internet of Things', duration: '11 weeks' },
  { id: 10, name: 'Big Data Analytics', duration: '13 weeks' },
]

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

const StudentHome = () => {
  // State for controlling table expansion
  const [showAllCourses, setShowAllCourses] = useState(false)
  const [showAllOngoing, setShowAllOngoing] = useState(false)

  // Limit displayed courses based on show all state
  const displayedCourses = showAllCourses ? courses : courses.slice(0, 5)
  const displayedOngoing = showAllOngoing
    ? ongoingCourses
    : ongoingCourses.slice(0, 5)

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
            <div className='text-2xl font-bold'>{courses.length}</div>
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
            <div className='text-2xl font-bold'>{ongoingCourses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Average Progress
            </CardTitle>
            <TrendingUp className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {Math.round(
                ongoingCourses.reduce(
                  (acc, course) => acc + parseInt(course.progression),
                  0
                ) / ongoingCourses.length
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
            <div className='text-2xl font-bold'>
              {
                ongoingCourses.filter(
                  (course) => parseInt(course.progression) === 100
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course tables section */}
      <div className='grid h-[calc(100%-140px)] grid-cols-2 gap-4 p-4'>
        {/* All Courses table */}
        <div className='flex h-full flex-col rounded-lg border'>
          <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
            <h1 className='text-xl font-semibold'>All Courses</h1>
            <Button
              variant='outline'
              onClick={() => setShowAllCourses(!showAllCourses)}
            >
              {showAllCourses ? 'Show Less' : 'View All'}
            </Button>
          </div>
          <div className='flex-1 px-6 py-4'>
            <Table>
              <TableCaption>All available courses.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[100px]'>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className='text-right'>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className='font-medium'>{course.id}</TableCell>
                    <TableCell>{course.name}</TableCell>
                    <TableCell className='text-right'>
                      {course.duration}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Ongoing Courses table */}
        <div className='flex h-full flex-col rounded-lg border'>
          <div className='flex items-center justify-between border-b px-6 py-4'>
            <h1 className='text-xl font-semibold'>On-Going Courses</h1>
            <Button
              variant='outline'
              onClick={() => setShowAllOngoing(!showAllOngoing)}
            >
              {showAllOngoing ? 'Show Less' : 'View All'}
            </Button>
          </div>
          <div className='flex-1 px-6 py-4'>
            <Table>
              <TableCaption>
                Your ongoing courses and their progress.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[100px]'>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className='text-right'>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedOngoing.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className='font-medium'>{course.id}</TableCell>
                    <TableCell>{course.name}</TableCell>
                    <TableCell className='text-right'>
                      {course.progression}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentHome
