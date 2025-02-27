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

  const dummy = {
    courseInstanceId: '5f36d4ba-b97f-4f7d-b882-181721a05594',
    studentIds: ['firebase_uid'],
    modules: [
      {
        moduleId: '84df0e01-6f61-488b-a4cf-b0d0cfbd90e1',
        sequence: 1,
        sections: [
          {
            sectionId: '080558c2-0e55-44e3-9367-c11bd0bfa19e',
            sequence: 1,
            sectionItems: [
              {
                sectionItemId: '4cb3015b-36d9-45c5-bf5f-bb98d9df5270',
                sequence: 1,
              },
              {
                sectionItemId: 'e6eb1b57-68d3-4b5c-a4ca-0054f611be9d',
                sequence: 2,
              },
              {
                sectionItemId: 'f1546a38-1768-4775-b10a-7d49c16d28b6',
                sequence: 3,
              },
              {
                sectionItemId: '8255a101-3913-4b7c-b03c-16c2f7554fa8',
                sequence: 4,
              },
            ],
          },
          {
            sectionId: '31d5ead2-4c2e-4705-b828-6a883ccf9689',
            sequence: 2,
            sectionItems: [
              {
                sectionItemId: '36fcb3ac-2bd4-4a1b-ae94-a7e26ae4a76d',
                sequence: 1,
              },
              {
                sectionItemId: 'e7239f6c-d691-453b-b62e-b9b67ca8e54d',
                sequence: 2,
              },
              {
                sectionItemId: '1a1c4ec1-a555-4af2-a425-cedf3c979a6d',
                sequence: 3,
              },
              {
                sectionItemId: '0e35a884-79c5-4ea6-b6b8-3bfaf5a93585',
                sequence: 4,
              },
            ],
          },
        ],
      },
    ],
  }

  console.log('dummy', dummy)

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
