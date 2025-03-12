import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { useDispatch, useSelector } from 'react-redux'
import { fetchWeeklyProgress } from '@/store/slices/FetchWeeklyProgress'
import { Button } from './ui/button'
import { TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Sample data for each course
const courseData1 = {
  course1: [
    { month: 'Monday', Average: 186, User: 80 },
    { month: 'Tuesday', Average: 150, User: 90 },
    { month: 'Wednesday', Average: 170, User: 85 },
    { month: 'Thursday', Average: 160, User: 95 },
    { month: 'Friday', Average: 180, User: 100 },
    { month: 'Saturday', Average: 190, User: 110 },
    { month: 'Sunday', Average: 200, User: 120 },
  ],
  course2: [
    { month: 'Monday', Average: 200, User: 100 },
    { month: 'Tuesday', Average: 180, User: 110 },
    { month: 'Wednesday', Average: 190, User: 105 },
    { month: 'Thursday', Average: 170, User: 115 },
    { month: 'Friday', Average: 160, User: 120 },
    { month: 'Saturday', Average: 150, User: 130 },
    { month: 'Sunday', Average: 140, User: 140 },
  ],
  course3: [
    { month: 'Monday', Average: 210, User: 90 },
    { month: 'Tuesday', Average: 220, User: 95 },
    { month: 'Wednesday', Average: 230, User: 100 },
    { month: 'Thursday', Average: 240, User: 105 },
    { month: 'Friday', Average: 250, User: 110 },
    { month: 'Saturday', Average: 260, User: 115 },
    { month: 'Sunday', Average: 270, User: 120 },
  ],
  course4: [
    { month: 'Monday', Average: 160, User: 70 },
    { month: 'Tuesday', Average: 170, User: 75 },
    { month: 'Wednesday', Average: 180, User: 80 },
    { month: 'Thursday', Average: 190, User: 85 },
    { month: 'Friday', Average: 200, User: 90 },
    { month: 'Saturday', Average: 210, User: 95 },
    { month: 'Sunday', Average: 220, User: 100 },
  ],
  course5: [
    { month: 'Monday', Average: 130, User: 60 },
    { month: 'Tuesday', Average: 140, User: 65 },
    { month: 'Wednesday', Average: 150, User: 70 },
    { month: 'Thursday', Average: 160, User: 75 },
    { month: 'Friday', Average: 170, User: 80 },
    { month: 'Saturday', Average: 180, User: 85 },
    { month: 'Sunday', Average: 190, User: 90 },
  ],
}

const chartConfig = {
  Average: {
    label: 'Average',
    color: 'black',
  },
  User: {
    label: 'User',
    color: 'gray',
  },
} satisfies ChartConfig

export function Chart() {
  const dispatch = useDispatch()
  const courses = useSelector((state) => state.courses.courses ?? null)
  const courseData = useSelector(
    (state) => state.weeklyProgress?.weeklyProgress?.courseData
  )
  console.log('courseData1', courseData1)
  console.log('courseData', courseData)

  useEffect(() => {
    if (!courseData || Object.keys(courseData || '').length === 0) {
      console.log('Dispatching fetchWeeklyProgress')
      dispatch(fetchWeeklyProgress())
    }
  }, [dispatch, courseData])

  // Assuming the initial selected course is 'course1'
  const [selectedCourse, setSelectedCourse] = useState()
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    // Update chart data whenever the selected course or weeklyProgress changes
    if (courseData && courseData[selectedCourse]) {
      setChartData(courseData[selectedCourse])
    }
  }, [courseData, selectedCourse])

  const calculateAverageProgress = (data) => {
    const courseAverages = Object.keys(data).map((courseKey) => {
      const entries = data[courseKey]
      const total = entries.reduce((acc, curr) => acc + curr.User, 0)
      return total / entries.length // Average per course
    })

    return (
      courseAverages.reduce((acc, curr) => acc + curr, 0) /
      courseAverages.length
    )
  }

  // State for average progress
  const [averageProgress, setAverageProgress] = useState(0)
  console.log('averageProgress', averageProgress)

  useEffect(() => {
    if (Object.keys(courseData || '').length > 0) {
      setAverageProgress(calculateAverageProgress(courseData))
    }
  }, [courseData])

  const handleSelectChange = (value) => {
    setSelectedCourse(value)
  }

  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <div className='flex w-full items-center justify-between'>
          <div className='flex flex-col gap-1'>
            <CardTitle>Progress Chart</CardTitle>
            <CardDescription>Updates once a day</CardDescription>
          </div>
          <div className='flex gap-2'>
            <Button className='text-gray-700' onClick={() => navigate('/analytics')} variant={'outline'}><TrendingUp/> View Full Analytics</Button>
            <Select onValueChange={handleSelectChange}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Select Course' />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(courseData || {}).map((courseKey) => {
                  // Find the corresponding course info from the courses state using courseKey
                  const courseInfo = courses?.find(
                    (course) => course.course_id === courseKey
                  )

                  return (
                    <SelectItem
                      key={courseInfo ? courseInfo.course_id : courseKey} // Fallback to courseKey if courseInfo is undefined
                      value={courseInfo ? courseInfo.course_id : courseKey}
                    >
                      {courseInfo ? courseInfo.name : 'Unknown Course'}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', { weekday: 'short' })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dashed' />}
            />
            <Bar dataKey='Average' fill='var(--color-Average)' radius={4} />
            <Bar dataKey='User' fill='var(--color-User)' radius={4} />
          </BarChart>
          <h1 className='flex justify-center text-sm font-semibold text-gray-600'>
            Compare, Compete, Conquer!
          </h1>
          <h1 className='flex justify-center text-sm text-gray-600'>
            Class Average / Your Progress
          </h1>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
