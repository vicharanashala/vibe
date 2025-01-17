import React from 'react'
import { useFetchCoursesWithAuthQuery } from '../../store/apiService'

interface Module {
  id: string
  title: string
  description: string
  sequence: number
}

const DummyForm = () => {
  // Fetch courses using the custom hook
  const { data, error, isLoading } = useFetchCoursesWithAuthQuery()

  if (isLoading) {
    return <p>Loading courses...</p>
  }

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
            {course.image ? (
              <img src={course.image} alt={`${course.name} thumbnail`} />
            ) : (
              <p>No image available</p>
            )}
            <p>
              <strong>Enrolled:</strong> {course.enrolled ? 'Yes' : 'No'}
            </p>
            {course.modules && course.modules.length > 0 && (
              <div>
                <h4>Modules:</h4>
                <ul>
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
