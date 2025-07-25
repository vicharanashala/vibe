export interface ReportAnomalyBody {
  courseId: string;
  courseVersionId: string;
  moduleId?: string;
  sectionId?: string;
  itemId?: string;
  anomalyType: string;
}

export interface ReportAnomalyResponse {
  // Define the structure of the response here
  _id: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  moduleId?: string;
  sectionId?: string;
  itemId?: string;
  anomalyType: string;
}
