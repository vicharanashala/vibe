import { AddQuestion } from '@/components/AddQuestion'
import { QuestionWritingQuery } from '@/components/ui/QuestionWritingQuery'
import { clearProgress } from '@/store/slices/fetchStatusSlice'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

const testing = () => {
  const dispatch = useDispatch()
  const handleShowProgress = () => {
    const progress = useSelector((state) => state.progress['1-1'])
    console.log(' fddddddddddddd vefvfdv: ', progress)
  }

  return (
    <div>
      <h1>Students Page</h1>
      <button onClick={handleShowProgress}>Clear Progress</button>
      <AddQuestion />
      <QuestionWritingQuery />
    </div>
  )
}

export default testing
