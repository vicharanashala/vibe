import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AnalyticsGraphTab() {
  return (
    <Tabs defaultValue='branchWiseAverage' className='flex size-full'>
      <div className='flex h-full flex-col pt-4'>
        <TabsList className='flex size-full flex-col items-start justify-start pt-4'>
          <div className='mb-4 flex w-full justify-center font-semibold text-black'>
            Select a Graph
          </div>
          <TabsTrigger
            value='branchWiseAverage'
            className='mb-2 w-full rounded border px-4 py-2 hover:bg-gray-400'
          >
            Branch Wise Average
          </TabsTrigger>
          <TabsTrigger
            value='averageAttemptsVsAverageProgress'
            className='w-full rounded border px-4 py-2 hover:bg-gray-400'
          >
            Average Attempts vs Average Progress
          </TabsTrigger>
        </TabsList>
      </div>
      <div className='w-full h-full p-2'>
        <TabsContent value='branchWiseAverage' className='h-full'>
          <Card className='h-full'>
            <CardHeader className='h-1/5 flex justify-center'>
              <CardTitle>Branch Wise Average</CardTitle>
              <CardDescription>This is a read-only graph</CardDescription>
            </CardHeader>
            <CardContent className='flex justify-center space-y-2 h-4/5 items-center'>
              <Card className='p-4 w-full h-full flex justify-center items-center'>
                <iframe
                  width='600'
                  height='371'
                  seamless
                  frameBorder='0'
                  scrolling='no'
                  src='https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8HF7TalEizRI6vUetMnJHa4fPvbNHq5mr3pjFI3s_wnBMFhKko_39ENjiUSt6p80ltL4rjG3b3ewO/pubchart?oid=1944201922&amp;format=interactive'
                ></iframe>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value='averageAttemptsVsAverageProgress' className='h-full'>
          <Card className='h-full'>
            <CardHeader className='h-1/5 flex justify-center'>
              <CardTitle>Average Attempts vs Average Progress</CardTitle>
              <CardDescription>This is a read-only graph</CardDescription>
            </CardHeader>
            <CardContent className='flex justify-center space-y-2 h-4/5 items-center'>
              <Card className='p-4 w-full h-full flex justify-center items-center'>
                <iframe
                  width='600'
                  height='371'
                  seamless
                  frameBorder='0'
                  scrolling='no'
                  src='https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8HF7TalEizRI6vUetMnJHa4fPvbNHq5mr3pjFI3s_wnBMFhKko_39ENjiUSt6p80ltL4rjG3b3ewO/pubchart?oid=1199452282&amp;format=interactive'
                ></iframe>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </div>
    </Tabs>
  )
}
