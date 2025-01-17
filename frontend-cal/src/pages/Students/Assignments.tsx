import React, { useState } from 'react'

const assignmentsData: {
  id: number
  title: string
  course: string
  dueDate: string
  status: 'Pending' | 'In Progress' | 'Completed'
  grade: string
}[] = [
  {
    id: 1,
    title: 'Math Assignment',
    course: 'Algebra',
    dueDate: '2023-12-15',
    status: 'Pending',
    grade: 'A',
  },
  {
    id: 2,
    title: 'Science Project',
    course: 'Physics',
    dueDate: '2023-12-20',
    status: 'In Progress',
    grade: 'B',
  },
  {
    id: 3,
    title: 'History Essay',
    course: 'World History',
    dueDate: '2023-12-25',
    status: 'Completed',
    grade: 'A+',
  },
  {
    id: 4,
    title: 'English Literature',
    course: 'Literature',
    dueDate: '2023-12-18',
    status: 'Pending',
    grade: 'B+',
  },
  {
    id: 5,
    title: 'Computer Science Assignment',
    course: 'Programming',
    dueDate: '2023-12-22',
    status: 'In Progress',
    grade: 'A',
  },
  {
    id: 6,
    title: 'Chemistry Lab Report',
    course: 'Chemistry',
    dueDate: '2023-12-28',
    status: 'Completed',
    grade: 'A-',
  },
  {
    id: 7,
    title: 'Geography Presentation',
    course: 'Geography',
    dueDate: '2023-12-30',
    status: 'Pending',
    grade: 'B-',
  },
  {
    id: 8,
    title: 'Art Project',
    course: 'Art',
    dueDate: '2023-12-29',
    status: 'In Progress',
    grade: 'A+',
  },
]

const statusClasses = {
  Pending: 'bg-yellow-200 text-yellow-800',
  'In Progress': 'bg-blue-200 text-blue-800',
  Completed: 'bg-green-200 text-green-800',
}

const StatusBadge = ({ status }: { status: keyof typeof statusClasses }) => (
  <span
    className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[status] || ''}`}
  >
    {status}
  </span>
)

interface AssignmentRowProps {
  title: string
  course: string
  dueDate: string
  status: keyof typeof statusClasses
  grade: string
}

const AssignmentRow: React.FC<AssignmentRowProps> = ({
  title,
  course,
  dueDate,
  status,
  grade,
}) => (
  <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4'>
    <div>
      <div className='text-xl font-semibold'>{title}</div>
      <div className='text-gray-600'>{course}</div>
    </div>
    <div className='flex items-center justify-between'>
      <span>{dueDate}</span>
      <span>{grade}</span>
      <StatusBadge status={status} />
    </div>
  </div>
)

const Assignments = () => {
  const [assignments] = useState(assignmentsData)

  return (
    <div className='p-4'>
      <h1 className='mb-6 text-center text-3xl font-bold'>Assessments</h1>
      <div className='mx-auto max-w-4xl'>
        {assignments.length > 0 ? (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 font-semibold text-gray-800'>
              <div>Title / Course</div>
              <div className='flex justify-between'>
                <span>Due Date</span>
                <span>Grade</span>
                <span>Status</span>
              </div>
            </div>
            <div
              className='max-h-96 space-y-2 overflow-y-auto'
              style={{
                scrollbarWidth: 'none', // For Firefox
                msOverflowStyle: 'none', // For IE/Edge
              }}
            >
              <style>
                {`
                /* Hide scrollbar for Chrome, Safari, and Edge */
                .max-h-96::-webkit-scrollbar {
                  display: none;
                }
                `}
              </style>
              {assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  title={assignment.title}
                  course={assignment.course}
                  dueDate={assignment.dueDate}
                  grade={assignment.grade}
                  status={assignment.status}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className='text-center text-gray-500'>No assignments available.</p>
        )}
      </div>
    </div>
  )
}

export default Assignments
