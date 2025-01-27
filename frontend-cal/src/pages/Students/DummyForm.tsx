/**
 * DummyForm
 *
 * This page displays a list of courses with their details including modules.
 * It fetches course data from an API using RTK Query and handles loading/error states.
 *
 * Features:
 * - Fetches and displays course data including:
 *   - Course name, description, visibility
 *   - Institution details
 *   - Course thumbnail image
 *   - Enrollment status
 *   - Associated modules with their details
 * - Handles loading and error states gracefully
 * - Responsive layout with nested lists
 */

import React from 'react'
import { useFetchCoursesWithAuthQuery } from '../../store/apiService'

// Interface for module data structure
interface Module {
  id: string
  title: string
  description: string
  sequence: number
}

const DummyForm = () => {
  // Fetch courses using RTK Query hook
  const { data, error, isLoading } = useFetchCoursesWithAuthQuery()

  // Show loading state while fetching data
  if (isLoading) {
    return <p>Loading courses...</p>
  }

  // Show error message if fetch fails
  if (error) {
    return (
      <p>
        Error loading courses:
        {'status' in error ? error.status : error.message}
      </p>
    )
  }

  return (
    <div>
      <h1>Courses</h1>
      <ul>
        {/* Map through courses and render each course's details */}
        {data?.courses?.map((course) => (
          <li key={course.id}>
            <h3>{course.name}</h3>
            <p>
              <strong>Description:</strong> {course.description}
            </p>
            <p>
              <strong>Visibility:</strong> {course.visibility}
            </p>
            <p>
              <strong>Institution:</strong> {course.institution_details.name} -{' '}
              {course.institution_details.description}
            </p>
            {/* Conditionally render course image or placeholder */}
            {course.image ? (
              <img src={course.image} alt={`${course.name} thumbnail`} />
            ) : (
              <p>No image available</p>
            )}
            <p>
              <strong>Enrolled:</strong> {course.enrolled ? 'Yes' : 'No'}
            </p>
            {/* Render modules section if modules exist */}
            {course.modules && course.modules.length > 0 && (
              <div>
                <h4>Modules:</h4>
                <ul>
                  {/* Map through modules and render each module's details */}
                  {course.modules.map((module: Module) => (
                    <li key={module.id}>
                      <p>
                        <strong>Title:</strong> {module.title}
                      </p>
                      <p>
                        <strong>Description:</strong> {module.description}
                      </p>
                      <p>
                        <strong>Sequence:</strong> {module.sequence}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DummyForm
