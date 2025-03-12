import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice';
import { CourseDropdown } from '@/components/AdminComponents/AdminUiComponents/CourseDropdown';
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice';
import { AdminModuleCreation } from '@/components/AdminComponents/AdminModuleCreation';

const CreateModule = () => {
  const dispatch = useDispatch();
  const courses = useSelector((state) => state.courses.courses ?? []);
  const isLoading = useSelector((state) => state.courses.isLoading ?? true);
  const error = useSelector((state) => state.courses.error ?? null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const courseId = selectedCourseId;

  // Effect to fetch courses
  useEffect(() => {
    if (!courses.length) {
      dispatch(fetchCoursesWithAuth());
    }
  }, [dispatch, courses.length]);

  // Callback function to handle course selection
  const handleCourseSelected = (courseId) => {
    setSelectedCourseId(courseId);
    console.log('Selected course ID:', courseId);
    // Additional logic can be placed here if needed
  };

  const moduleData = useSelector(
      (state) => state.modules?.modules?.[courseId] ?? null
    )
  
    React.useEffect(() => {
      if (moduleData === null) {
        console.log('fetching modules')
        dispatch(fetchModulesWithAuth(courseId))
      }
    }, [dispatch, courseId, moduleData])
    console.log('module data', moduleData)

  return (
    <div className='p-5'>
      <div className='mb-4 flex justify-between items-center'>
        <h1 className='text-xl font-semibold'>All Modules</h1>
        <AdminModuleCreation />
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className='text-red-500'>Error: {error}</p>
      ) : (
        <div>
          <p>Select a course to view its modules:</p>
          <CourseDropdown onCourseSelected={handleCourseSelected} />
          <p className='mt-2'>Modules:</p>
          <ul className='list-disc list-inside'>
            {moduleData?.map((module) => (
              <li key={module.module_id} className='mb-2'>
                {module.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreateModule;
