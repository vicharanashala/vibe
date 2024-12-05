"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const chapters = [
  { id: 1, title: "Introduction to the Course", duration: "10 mins" },
  { id: 2, title: "Basics of the Subject", duration: "20 mins" },
  { id: 3, title: "Advanced Concepts", duration: "30 mins" },
  { id: 4, title: "Practical Applications", duration: "25 mins" },
  { id: 5, title: "Final Assessment", duration: "15 mins" },
];

const SingleCourse = () => {
  return (
    <div className="flex justify-between h-full">
      {/* Left Section: Background Image with Course Info */}
      <div
        className="w-1/2 h-full bg-cover bg-center text-white p-8 flex flex-col justify-end"
        style={{
          backgroundImage: "url('https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg')", // Replace with your course image URL
        }}
      >
        <h1 className="text-4xl font-bold mb-2">Course Name</h1>
        <h2 className="text-2xl">Course Duration</h2>
      </div>

      {/* Right Section: Chapters Table */}
      <div className="w-1/2 h-full p-4 bg-white">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-700">Course Chapters</h1>
        </div>
        <div className="px-6 py-4 overflow-auto custom-scroll">
          <Table>
            <TableCaption>All chapters of this course.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Chapter Title</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapters.map((chapter) => (
                <TableRow key={chapter.id}>
                  <TableCell className="font-medium">{chapter.id}</TableCell>
                  <TableCell>{chapter.title}</TableCell>
                  <TableCell className="text-right">{chapter.duration}</TableCell>
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
