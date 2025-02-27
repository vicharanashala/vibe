import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBulkContentUploadMutation } from '../../store/apiService'
import { CourseDropdown } from '@/components/AdminComponents/AdminUiComponents/CourseDropdown'
import { ModuleDropdown } from '@/components/AdminComponents/AdminUiComponents/ModuleDropdown'
import { SectionDropdown } from '@/components/AdminComponents/AdminUiComponents/SectionDropdown'

const BlukQuestionUpload = () => {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')

  const handleCourseSelected = (courseId) => {
    setSelectedCourseId(courseId)
    console.log('Selected course ID:', courseId)
    // Additional logic can be placed here if needed
  }

  const handleModuleSelected = (moduleId) => {
    setSelectedModuleId(moduleId)
    console.log('Selected module ID:', moduleId)
  }

  const handleSectionSelected = (sectionId) => {
    setSelectedSectionId(sectionId)
    console.log('Selected section ID:', sectionId)
  }

  const [bulkContentUpload, { isLoading }] = useBulkContentUploadMutation()
  const [file, setFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const originalJson = JSON.parse(e.target?.result as string);
          console.log(originalJson); // Log to see the parsed JSON

          // Transform the data structure
          const transformedJson = {
            sectionId: selectedSectionId,
            data: {}
          };

          // Here assuming we only need to transform the first key "0"
          const key = "0";
          if (originalJson[key]) {
            transformedJson.data[key] = {
              segments: originalJson[key].segments.map((segment, index) => ({
                ...segment,
                sequence: index + 1 // assuming sequence should be the index + 1
              })),
              questions: originalJson[key].questions.map((question, index) => ({
                ...question,
                sequence: index + 1 // assuming sequence should be the index + 1
              }))
            };
          }

          console.log(transformedJson); // Log the new JSON structure to verify
          await bulkContentUpload({ content: transformedJson }); // Trigger the mutation to upload
        } catch (error) {
          console.error('Error parsing or transforming JSON:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className='flex items-center justify-center h-full bg-gray-100'>
      <Card className='w-full max-w-md p-6 bg-white rounded-lg shadow-md'>
        <h1 className='mb-4 text-2xl font-bold text-center'>
          Bulk Question Upload
        </h1>
        <CourseDropdown onCourseSelected={handleCourseSelected} />
        <ModuleDropdown
          courseId={selectedCourseId}
          onModuleSelected={handleModuleSelected}
        />
        <SectionDropdown
          courseId={selectedCourseId}
          moduleId={selectedModuleId}
          onSectionSelected={handleSectionSelected}
        />
        <Input
          type='file'
          accept='.json'
          onChange={handleFileSelect}
          className='mb-4'
        />
        <button
          className='w-full bg-black text-white rounded-sm p-2'
          onClick={handleUpload}
          disabled={isLoading || !file}
        >
          {isLoading ? 'Uploading...' : 'Upload'}
        </button>
      </Card>
    </div>
  )
}

export default BlukQuestionUpload
