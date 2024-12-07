import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useFetchCoursesWithAuthQuery } from '../../store/apiService';
import { Link } from 'react-router-dom';

const AllCourses = () => {
  const [filter, setFilter] = useState("On going"); // Default filter

  // Fetch courses from API
  const { data, error, isLoading } = useFetchCoursesWithAuthQuery();

  if (isLoading) {
    return <p>Loading courses...</p>;
  }

  if (error) {
    return <p>Error loading courses: {error.message}</p>;
  }

  // Default image URL
  const defaultImage =
    "https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg";

  // Map API response to match the expected structure
  const courseData = data?.map((course) => ({
    id: course.id,
    title: course.name,
    image: course.image || defaultImage,
    status: course.enrolled ? "On going" : "New",
  }));

  // Filtered courses based on selected filter
  const filteredCourses =
    filter === "All"
      ? courseData
      : courseData.filter((course) => course.status === filter);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4 uppercase">All Courses</h1>

        {/* Select Filter */}
        <div className="mb-6">
          <Select onValueChange={(value) => setFilter(value)} defaultValue="On going">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Filter</SelectLabel>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="On going">On going</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{course.title}</CardTitle>
                {/* Status Badge */}
                <div
                  className={`text-xs p-1 rounded-sm text-white w-20 flex justify-center ${
                    course.status === "New"
                      ? "bg-green-500"
                      : course.status === "On going"
                      ? "bg-yellow-500"
                      : "bg-gray-500"
                  }`}
                >
                  {course.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <img
                src={course.image}
                alt={course.title}
                className="w-full h-40 object-cover rounded"
              />
            </CardContent>
            <div className="p-4 text-center">
              <Link
                to={`/singleCourse/${course.id}`}
                className="w-full inline-block text-center bg-gray-800 text-white py-2 px-4 rounded"
              >
                View
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AllCourses;
