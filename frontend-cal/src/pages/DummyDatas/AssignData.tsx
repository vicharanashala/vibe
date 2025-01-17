const AssignData: {
  id: number
  title: string
  module: string
  status: 'Pending' | 'In Progress' | 'Completed'
  grade: string
}[] = [
  {
    id: 1,
    title: 'Math Assignment',
    module: 'Algebra',
    status: 'Pending',
    grade: 'A',
  },
  {
    id: 2,
    title: 'Science Project',
    module: 'Physics',
    status: 'In Progress',
    grade: 'B',
  },
  {
    id: 3,
    title: 'History Essay',
    module: 'World History',
    status: 'Completed',
    grade: 'A+',
  },
  {
    id: 4,
    title: 'English Literature',
    module: 'Literature',
    status: 'Pending',
    grade: 'B+',
  },
  {
    id: 5,
    title: 'Computer Science Assignment',
    module: 'Programming',
    status: 'In Progress',
    grade: 'A',
  },
  {
    id: 6,
    title: 'Chemistry Lab Report',
    module: 'Chemistry',
    status: 'Completed',
    grade: 'A-',
  },
  {
    id: 7,
    title: 'Geography Presentation',
    module: 'Geography',
    status: 'Pending',
    grade: 'B-',
  },
  {
    id: 8,
    title: 'Art Project',
    module: 'Art',
    status: 'In Progress',
    grade: 'A+',
  },
]
export default AssignData
