import { AnalyticsGraphTab } from '@/components/AnalyticsGraphTab'
import { Card } from '@/components/ui/card'
import React from 'react'

const Analytics = () => {
  return (
    <div className='flex justify-between w-full h-full'>
      <div className='w-full'>
        <AnalyticsGraphTab />
      </div>
    </div>
  )
}

export default Analytics
