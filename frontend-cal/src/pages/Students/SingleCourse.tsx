import React from "react";
import { useParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFetchCoursesWithAuthQuery, useFetchModulesWithAuthQuery } from "../../store/apiService";

const SingleCourse = () => {
  const { courseId } = useParams(); // Get courseId from route params

  // Fetch all courses to get course details
  const { data: courseData, isLoading: courseLoading, error: courseError } = useFetchCoursesWithAuthQuery();

  // Fetch modules for the specific course
  const { data: moduleData, isLoading: moduleLoading, error: moduleError } = useFetchModulesWithAuthQuery(parseInt(courseId, 10));

  if (courseLoading || moduleLoading) {
    return <p>Loading course and modules...</p>;
  }

  if (courseError) {
    return <p>Error fetching course: {courseError.message}</p>;
  }

  if (moduleError) {
    return <p>Error fetching modules: {moduleError.message}</p>;
  }

  // Find the specific course details
  const course = courseData?.find((c) => c.id === parseInt(courseId, 10));

  if (!course) {
    return <p>Course not found!</p>;
  }

  const defaultImage =
    "https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg";

  // Modules data
  const modules = moduleData || [];
  console.log("modules",modules);

  return (
    <div className="flex justify-between h-full">
      {/* Left Section: Background Image with Course Info */}
      <div
        className="w-1/2 h-full bg-cover bg-center text-white p-8 flex flex-col justify-end"
        style={{
          backgroundImage: `url('${course.image || defaultImage}')`,
        }}
      >
        <h1 className="text-4xl font-bold mb-2">{course.name}</h1>
        <h2 className="text-2xl">{course.description}</h2>
      </div>

      {/* Right Section: Modules Table */}
      <div className="w-1/2 h-full p-4 bg-white">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-700">Course Modules</h1>
        </div>
        <div className="px-6 py-4 overflow-auto custom-scroll">
          <Table>
            <TableCaption>All modules of this course.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Module Title</TableHead>
                <TableHead className="text-right">Sequence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell className="font-medium">{module.id}</TableCell>
                  <TableCell>{module.title}</TableCell>
                  <TableCell className="text-right">{module.sequence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default SingleCourse;
