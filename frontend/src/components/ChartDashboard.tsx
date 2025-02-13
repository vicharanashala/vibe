'use client'

import { TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

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
const chartData = [
  { month: 'Course 1', average: 186, user: 80 },
  { month: 'Course 2', average: 305, user: 200 },
  { month: 'Course 3', average: 237, user: 120 },
  { month: 'Course 4', average: 73, user: 190 },
  { month: 'Course 5', average: 209, user: 130 },
]

const chartConfig = {
  average: {
    label: 'average',
    color: 'hsl(var(--chart-1))',
  },
  user: {
    label: 'user',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

export function Chart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress comparision chart</CardTitle>
        <CardDescription>
          Showing progress comparision between you and average users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='month'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 12)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            <Area
              dataKey='user'
              type='natural'
              fill='var(--color-user)'
              fillOpacity={0.4}
              stroke='var(--color-user)'
              stackId='a'
            />
            <Area
              dataKey='average'
              type='natural'
              fill='var(--color-average)'
              fillOpacity={0.4}
              stroke='var(--color-average)'
              stackId='a'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none text-muted-foreground'>
              Progress of courses
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
