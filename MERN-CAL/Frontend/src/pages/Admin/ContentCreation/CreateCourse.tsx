import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice';
import { Plus } from 'lucide-react';
import { AdminCourseCreation } from '@/components/AdminComponents/AdminCourseCreation';

const CreateCourse = () => {
  const dispatch = useDispatch();
  const courses = useSelector((state) => state.courses.courses ?? []);
  const isLoading = useSelector((state) => state.courses.isLoading ?? true);
  const error = useSelector((state) => state.courses.error ?? null);

  // Effect to fetch courses
  React.useEffect(() => {
    if (!courses || courses.length === 0) {
      dispatch(fetchCoursesWithAuth());
    }
  }, [dispatch, courses]);

  // Handle adding a new course (this function should eventually trigger a dispatch to a redux action or a route change)
  const handleAddCourse = () => {
    console.log("Add Course Clicked");
    // Dispatch an action or route to a form to add a new course
  };

  return (
    <div className="p-5">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">All Courses</h1>
        <AdminCourseCreation />
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <ul className="list-disc list-inside">
          {courses.map((course) => (
            <li key={course.id} className="mb-2">
              {course.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CreateCourse;
