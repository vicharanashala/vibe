/**
 * Section View Page
 *
 * This component displays a list of sections within a module for students to view and access.
 * It includes section details like title, content, status and navigation capabilities.
 *
 * Features:
 * - Displays sections in a responsive grid layout
 * - Shows status badges (Pending, In Progress, Completed) 
 * - Allows navigation to individual section views
 * - Handles loading and error states
 * - Custom scrollable container with hidden scrollbars
 *
 * Components:
 * - StatusBadge: Displays colored status indicators
 * - AssignmentRow: Individual section row with details and actions
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useFetchSectionsWithAuthQuery, useFetchSectionItemsProgressQuery } from '@/store/apiService';
import Cookies from 'js-cookie';

// Status styles mapping for different section states
const statusClasses = {
  Pending: 'bg-yellow-200 text-yellow-800',
  'In Progress': 'bg-blue-200 text-blue-800',
  Completed: 'bg-green-200 text-green-800',
};

// Component to render status indicator badge
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[status] || 'bg-gray-200 text-gray-800'}`}
  >
    {status}
  </span>
);

// Props interface for AssignmentRow component
interface AssignmentRowProps {
  title: string;
  module: string;
  sectionId: number;
  courseInstanceId: string;
}

// Component to render individual section rows
const AssignmentRow: React.FC<AssignmentRowProps> = ({
  title,
  module,
  sectionId,
  courseInstanceId,
}) => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const { data, isLoading, error } = useFetchSectionItemsProgressQuery({
    courseInstanceId,
    sectionItemId: String(sectionId),
  });

  const status = isLoading ? 'Loading' : error ? 'Error' : data?.progress || 'Pending';

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
            navigate(`/section-details/${sectionId}`, {
              state: { courseId: courseInstanceId, moduleId },
            })
          }
        >
          View
        </Button>
      </div>
    </div>
  );
};

// Main component to display all sections
const SectionView = () => {
  // Get route parameters
  const { courseId, moduleId } = useParams();

  // Fetch sections data using RTK Query
  const { data, error, isLoading } = useFetchSectionsWithAuthQuery({
    courseId: Number(courseId),
    moduleId: Number(moduleId),
  });

  // Handle loading and error states
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading sections</div>;

  const courseInstanceId = courseId; // Assuming courseId is same as courseInstanceId

  return (
    <div className='p-4'>
      <h1 className='mb-6 text-center text-3xl font-bold'>All Sections of Module {moduleId}</h1>
      <div className='mx-auto max-w-4xl'>
        {/* Header row with column labels */}
        <div className='grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 font-semibold text-gray-800'>
          <div>Title / Module</div>
          <div className='flex justify-between'>
            <span>Section ID</span>
            <span>Status</span>
            <span>Action</span>
          </div>
        </div>
        {/* Scrollable container for section rows */}
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
          {/* Map through sections data to render rows */}
          {data?.results?.map((section) => (
            <AssignmentRow
              key={section.id}
              title={section.title}
              module={section.content}
              sectionId={section.id}
              courseInstanceId={courseInstanceId}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SectionView;
