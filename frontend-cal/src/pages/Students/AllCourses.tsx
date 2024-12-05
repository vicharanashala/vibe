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

// Example course data with statuses
const courseData = [
  { id: 1, title: "Course 1", image: "https://via.placeholder.com/150", enrollLink: "#", status: "New" },
  { id: 2, title: "Course 2", image: "https://via.placeholder.com/150", enrollLink: "#", status: "On going" },
  { id: 3, title: "Course 3", image: "https://via.placeholder.com/150", enrollLink: "#", status: "Completed" },
  { id: 4, title: "Course 4", image: "https://via.placeholder.com/150", enrollLink: "#", status: "New" },
  { id: 5, title: "Course 5", image: "https://via.placeholder.com/150", enrollLink: "#", status: "On going" },
  { id: 6, title: "Course 6", image: "https://via.placeholder.com/150", enrollLink: "#", status: "Completed" },
  { id: 7, title: "Course 7", image: "https://via.placeholder.com/150", enrollLink: "#", status: "New" },
  { id: 8, title: "Course 8", image: "https://via.placeholder.com/150", enrollLink: "#", status: "On going" },
  { id: 9, title: "Course 9", image: "https://via.placeholder.com/150", enrollLink: "#", status: "Completed" },
  { id: 10, title: "Course 10", image: "https://via.placeholder.com/150", enrollLink: "#", status: "New" },
];

const AllCourses = () => {
  const [filter, setFilter] = useState("On going"); // Default filter

  // Filtered courses based on selected filter
  const filteredCourses = filter === "All"
    ? courseData
    : courseData.filter((course) => course.status === filter);

  return (
    <div className="p-4">
      <div className='flex justify-between items-center'>
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
              <div className='flex justify-between items-center'>
              <CardTitle>{course.title}</CardTitle>
              {/* Status Badge */}
              <div className={`text-xs p-1 rounded-sm text-white w-20 flex justify-center ${
                course.status === "New"
                  ? "bg-green-500"
                  : course.status === "On going"
                  ? "bg-yellow-500"
                  : "bg-gray-500"
              }`}>
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
              <a
                href={course.enrollLink}
                target="_blank"
                className="w-full inline-block text-center bg-gray-800 text-white py-2 px-4 rounded"
              >
                View
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AllCourses;
