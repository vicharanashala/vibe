### Collections and Documents Structure

1. **Courses Collection**
   - **Document ID**: `courseID` (unique identifier for each course)
   - **Fields**:
     - `courseName`: String
     - `courseCode`: String
     - `instructorID`: String
     - `metadata`: Map (stores any additional information, such as description, category, etc.)
         - `description`: String
         - `tags`: Array of Strings (for categorization)
     - `statistics`: Map (contains data like enrollment count, etc.)
            - `enrollmentCount`: Number
     - `chapters`: Array of Maps (subcollection could also be used if chapters are large)
         - `chapterID`: String (unique identifier within the course)
         - `chapterName`: String
         - `videos`: Array of Maps
             - `source`: String (URL or reference to the component)
             - `assessmentIDs`: Array of Strings (references to assessments)
         - `assessments`: Array of Maps
             - `assessmentID`: String (unique identifier within the chapter)
             - `assessmentType`: String (e.g., quiz, assignment, etc.)
             - `assessmentFormat`: String
             - `assessmentData`: Dynamic
             - `assessmentRating`: Number
             - `assessmentScore`: Number
             - `assessmentTimeLimit`: Number (Optional)

2. **Students Collection**
   - **Document ID**: `studentID` (unique identifier for each student)
   - **Fields**:
     - `enrolledCourses`: Array of Maps
         - `courseID`: Reference to a document in the Courses collection
         - `enrollmentDate`: Timestamp
         - `progress`: Map (stores chapter-wise progress details or overall progress metrics)
           - `chapterAnalytics`: Array of Maps
             - `chapterID`: Reference to a subcollection in the Courses collection
             - `lastAccessed`: Timestamp (parent will be arranged in descending order of lastAccessed)
             - `assessmentAnalytics`: Array of Maps
                 - `assessmentID`: Reference to a subcollection in the Courses collection
                 - `isCompleted`: Boolean
                 - `score`: Number
                 - `assessmentData`: Dynamic
                 - `lastAccessed`: Timestamp (parent will be arranged in descending order of lastAccessed)
                 - `submissionDate`: Timestamp
                 - `initAccessDate`: Timestamp (Will be updated only once)
