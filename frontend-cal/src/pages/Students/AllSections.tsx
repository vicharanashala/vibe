import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useFetchSectionsWithAuthQuery } from '@/store/apiService'

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
  module: string
  sectionId: number
  status: keyof typeof statusClasses
}

const AssignmentRow: React.FC<AssignmentRowProps> = ({
  title,
  module,
  sectionId,
  status,
}) => {
  const navigate = useNavigate()
  const { courseId, moduleId } = useParams()

  return (
    <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4'>
      <div>
        <div className='text-xl font-semibold'>{title}</div>
        <div className='text-gray-600'>{module}</div>
      </div>
      <div className='flex items-center justify-between'>
        <span>{sectionId}</span>
        <StatusBadge status={status} />
        <Button
          onClick={() =>
            navigate(`/section/${sectionId}`, {
              state: { courseId, moduleId },
            })
          }
        >
          View
        </Button>
      </div>
    </div>
  )
}

const AllSections = () => {
  const { courseId, moduleId } = useParams()
  const { data, error, isLoading } = useFetchSectionsWithAuthQuery({
    courseId: Number(courseId),
    moduleId: Number(moduleId),
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading sections</div>

  return (
    <div className='p-4'>
      <h1 className='mb-6 text-center text-3xl font-bold'>
        All Sections of Module {moduleId}
      </h1>
      <div className='mx-auto max-w-4xl'>
        <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 font-semibold text-gray-800'>
          <div>Title / Module</div>
          <div className='flex justify-between'>
            <span>Section ID</span>
            <span>Status</span>
            <span>Action</span>
          </div>
        </div>
        <div
          className='max-h-96 space-y-4 overflow-y-auto'
          style={{
            scrollbarWidth: 'none', // For Firefox
            msOverflowStyle: 'none', // For IE/Edge
          }}
        >
          <style>{`
                        /* Hide scrollbar for Chrome, Safari, and Edge */
                        .max-h-96::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
          {data?.results?.map((section) => (
            <AssignmentRow
              key={section.id}
              title={section.title}
              module={section.content}
              sectionId={section.id}
              status='Pending' // Replace with actual status if available
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default AllSections
