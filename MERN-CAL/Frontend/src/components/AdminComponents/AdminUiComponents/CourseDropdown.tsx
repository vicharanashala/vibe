import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectLabel,
  SelectGroup
} from '@/components/ui/select';  // Adjust path as necessary

export function CourseDropdown({ onCourseSelected }) {
  const dispatch = useDispatch();
  const courses = useSelector(state => state.courses.courses ?? []);
  const isLoading = useSelector(state => state.courses.isLoading ?? true);
  const error = useSelector(state => state.courses.error ?? null);

  useEffect(() => {
    if (!courses.length) {
      dispatch(fetchCoursesWithAuth());
    }
  }, [dispatch, courses.length]);

  const [selectedCourseId, setSelectedCourseId] = useState('');

  const handleChange = (value) => {
    setSelectedCourseId(value);
    onCourseSelected(value);
  };

  return (
    <Select onValueChange={handleChange} value={selectedCourseId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a course" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Courses</SelectLabel>
          {courses.map(course => (
            <SelectItem key={course.course_id} value={course.course_id}>
              {course.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
