/**
 * Section Detail Page
 *
 * This page displays the content items within a specific section of a course module.
 * It shows a list of content items like videos and assessments with their details
 * and allows students to access them.
 *
 * Features:
 * - Fetches and displays section content items using RTK Query
 * - Shows content type (video, assessment etc)
 * - Displays status of each content item (Pending, In Progress, Completed)
 * - Provides action buttons to start/continue content items
 * - Handles loading and error states
 * - Responsive layout with scrollable content list
 *
 * Key Components:
 * - StatusBadge: Displays colored status indicator
 * - AssignmentRow: Renders individual content item with details and actions
 * - Section: Main component managing data fetching and layout
 */

import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useFetchItemsWithAuthQuery, useFetchSectionItemsProgressQuery } from '@/store/apiService'
import { Button } from '@/components/ui/button'
import { Check, Lock } from 'lucide-react'

// Tailwind classes for different status badges
const statusClasses = {
  Pending: 'bg-yellow-200 text-yellow-800',
  'In Progress': 'bg-blue-200 text-blue-800',
  Completed: 'bg-green-200 text-green-800',
}

/**
 * StatusBadge Component
 * Displays a colored badge indicating content item status
 */
const StatusBadge = ({ status }) => (
  <span
    className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[status] || ''}`}
  >
    {status}
  </span>
)

/**
 * AssignmentRow Component
 * Displays a single content item with its details and action button
 */
const AssignmentRow = ({ assignment, sectionId, courseId, moduleId }) => {
  const navigate = useNavigate()
  console.log('courseId:', courseId, moduleId)
  let alpha = 'v'
  if(assignment.item_type === 'video') {
    alpha = 'v'
  }else{
    alpha = 'a'
  }
  const sectionItemId1 = `${alpha}${assignment.id}`

  const { data: progressData, isLoading, isError } = useFetchSectionItemsProgressQuery({
    courseInstanceId: courseId, // Ensure this is the correct ID needed for your API
    sectionItemId: sectionItemId1
  });

  const displayStatus = () => {
    if (isLoading) return "Loading...";
    if (isError) return "Error";
    return progressData?.progress || "Unknown";
  };

  return (
    <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4'>
      <div>
        <div className='text-xl font-semibold'>Content {assignment.title}</div>
        <div className='text-gray-600'>{assignment.course}</div>
      </div>
      <div className='flex items-center justify-between'>
        <span className='w-12 '>{assignment.item_type}</span>
        <span className=''><StatusBadge status={displayStatus()}  /></span>
        <span className='w-14 flex justify-center'>
          {assignment.item_type === 'video' && progressData?.progress === 'IN_PROGRESS' ? (
            <Button
              onClick={() =>
                navigate('/content-scroll-view', {
                  state: { assignment, sectionId, courseId, moduleId },
                })
              }
            >
              Start
            </Button>
          ) : progressData?.progress === 'COMPLETE' ? (
            <Check />
          ) : (
            <Lock />
          )}
        </span>
      </div>
    </div>
  )
}

/**
 * Main Section Component
 * Manages fetching content items and rendering the complete section view
 */
const SectionDetails = () => {
  const { sectionId } = useParams()
  const location = useLocation()
  const courseId = location.state?.courseId // Access the sectionId from state
  const moduleId = location.state?.moduleId // Access the sectionId from state
  console.log('courseId:', courseId, moduleId)
  const {
    data: assignmentsData,
    isLoading,
    isError,
  } = useFetchItemsWithAuthQuery(sectionId)

  if (isLoading) return <p>Loading...</p>
  if (isError) return <p>Error loading assignments.</p>

  return (
    <div className='p-4'>
      <h1 className='mb-6 text-center text-3xl font-bold'>
        Content of Section {sectionId}
      </h1>
      <div className='mx-auto max-w-4xl'>
        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 font-semibold text-gray-800'>
            <div>Title</div>
            <div className='flex justify-between'>
              <span>Type</span>
              <span>Status</span>
              <span className='mr-8'>Action</span>
            </div>
          </div>
          <div className='max-h-96 space-y-2 overflow-y-auto'>
            {assignmentsData.map((assignment) => (
              <AssignmentRow
                key={assignment.sequence}
                assignment={assignment}
                sectionId={sectionId}
                courseId={courseId}
                moduleId={moduleId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SectionDetails
