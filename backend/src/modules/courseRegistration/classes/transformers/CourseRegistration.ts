export interface CourseDetailsDTO {
  courseId: string;
  versionId: string;
  version: string;
  description: string;
  modules: {
    id: string;
    name: string;
    description: string;
    itemsCount: number;
  }[];
  totalItems: number;
  createdAt: Date;
  updatedAt: Date;
  instructors?: { id: string; name: string }[]; // If you want instructors later
}


