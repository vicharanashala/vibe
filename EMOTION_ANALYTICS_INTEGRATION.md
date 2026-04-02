# Emotion Analytics Integration Guide

## Overview
This guide shows where to integrate the three emotion analytics components into the ViBe teacher dashboard.

---

## 1. ✅ COURSE-LEVEL ANALYTICS - COMPLETED

**File**: `frontend/src/app/pages/teacher/course-enrollments.tsx`

**Status**: ✅ Already integrated

**Location**: Added after the enrollment stats section, before the search bar.

```tsx
{/* Emotion Analytics Dashboard */}
<Card className="border-0 shadow-sm">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <span>😊 Learner Emotion Analytics</span>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <EmotionAnalyticsDashboard 
      courseId={COURSE_ID} 
      courseVersionId={VERSION_ID} 
    />
  </CardContent>
</Card>
```

---

## 2. 📋 ITEM-LEVEL ANALYTICS - NEEDS INTEGRATION

### Import Statement
Add to top of `frontend/src/app/pages/teacher/teacher-course-page.tsx`:

```tsx
import { ItemEmotionStats } from "./components/ItemEmotionStats";
```

### Integration Location
Find the section where items are displayed in the item list/table. Look for where item details are shown.

In the item row/card rendering, add:

```tsx
<div className="mt-2">
  <ItemEmotionStats 
    itemId={item._id} 
    itemName={item.name} 
  />
</div>
```

**Example context**: In the item list table, after the item name column, add a new column for emotion stats:

```tsx
<TableCell>
  <ItemEmotionStats 
    itemId={item._id} 
    itemName={item.name} 
  />
</TableCell>
```

---

## 3. 👤 STUDENT-LEVEL ANALYTICS - NEEDS INTEGRATION

### Option A: In Student Progress Modal/Panel

Add to a student detail view modal:

```tsx
import { StudentEmotionJourney } from "./components/StudentEmotionJourney";

// Inside student detail modal:
<Tabs defaultValue="progress">
  <TabsList>
    <TabsTrigger value="progress">Progress</TabsTrigger>
    <TabsTrigger value="emotions">😊 Emotions</TabsTrigger>
  </TabsList>
  
  <TabsContent value="emotions">
    <StudentEmotionJourney 
      courseId={courseId}
      courseVersionId={courseVersionId}
      studentName={studentName}
    />
  </TabsContent>
</Tabs>
```

### Option B: In Student Row Expansion

```tsx
import { StudentEmotionJourney } from "./components/StudentEmotionJourney";

// In course-enrollments.tsx, add to student row details:
{expandedStudentId === student.id && (
  <div className="p-4 bg-accent/5 rounded-lg">
    <StudentEmotionJourney 
      courseId={COURSE_ID}
      courseVersionId={VERSION_ID}
      studentName={student.name}
    />
  </div>
)}
```

### Option C: New "Student Insights" Page

Create new page at:
`frontend/src/app/pages/teacher/student-emotion-insights.tsx`

```tsx
import { StudentEmotionJourney } from "./components/StudentEmotionJourney";

export default function StudentEmotionInsights() {
  const { courseId, versionId, studentId } = useRoute().params;
  
  return (
    <div className="p-6">
      <h1>Emotion Insights - {studentName}</h1>
      <StudentEmotionJourney 
        courseId={courseId}
        courseVersionId={versionId}
        studentName={studentName}
      />
    </div>
  );
}
```

---

## API Endpoints Available

### Course-Level Report
```
GET /emotions/report/:courseId/:courseVersionId
Response: {
  success: true,
  data: {
    total: number,
    distribution: { very_sad, sad, neutral, happy, very_happy },
    percentages: { very_sad, sad, neutral, happy, very_happy },
    averageSentiment: number (-2 to 2)
  }
}
```

### Item-Level Stats
```
GET /emotions/stats/:itemId
Response: {
  success: true,
  data: [
    { emotion: "very_sad", count: 2, percentage: 10 },
    { emotion: "sad", count: 3, percentage: 15 },
    // ... etc
  ]
}
```

### Student Emotion History
```
GET /emotions/history/:courseId/:courseVersionId
Headers: Authorization required
Response: {
  success: true,
  data: [
    {
      _id: "...",
      itemId: "...",
      emotion: "happy",
      timestamp: "2026-03-28T...",
      createdAt: "2026-03-28T..."
    },
    // ... more emotions
  ]
}
```

---

## Database Queries

The backend emotion module provides these methods via `EmotionService`:

```typescript
// Submit emotion
submitEmotion(payload: {
  studentId: string;
  courseId: string;
  courseVersionId: string;
  itemId: string;
  emotion: EmotionType;
  cohortId?: string;
})

// Get item stats
getItemEmotionStats(itemId: string)

// Get student history
getStudentEmotionHistory(studentId, courseId, courseVersionId, limit)

// Get course report
getEmotionReport(courseId, courseVersionId)
```

---

## Features Leverage

### For Teachers:

1. **Identify Problematic Content**
   - Items with mostly negative emotions need review
   - Use EmotionAnalyticsDashboard to see which items struggle

2. **Support Struggling Students**
   - StudentEmotionJourney shows when a student is frustrated
   - Alert students with declining sentiment to reach out

3. **Course Improvement**
   - Track sentiment over time
   - A/B test content changes by comparing emotion scores

---

## UI Components Reference

### EmotionAnalyticsDashboard
- Shows: pie chart, bar chart, sentiment overview, detailed breakdown
- Includes: alerts for concerning sentiment levels
- Data refresh: automatic via React Query

### ItemEmotionStats
- Shows: emotion emoji badges with counts
- Includes: sentiment score and trend
- Size: compact (fits in table cells)

### StudentEmotionJourney
- Shows: 4 stat cards, scatter plot chart, emotion history table
- Includes: trend analysis, moving averages
- Size: full-width dashboard (300px+ width recommended)

---

## Styling Notes

All components use:
- Shadcn UI components (Card, Badge, Button, etc.)
- Recharts for visualizations
- Tailwind CSS for styling
- Consistent emotion colors:
  - Very Sad: 🔴 #ef4444
  - Sad: 🟠 #f97316
  - Neutral: 🟡 #eab308
  - Happy: 🟢 #84cc16
  - Very Happy: 💚 #22c55e

---

## Next Steps

1. ✅ Course-level dashboard - DONE
2. ▶️ Add ItemEmotionStats column to teacher-course-page item list
3. ▶️ Add StudentEmotionJourney tab/modal to student details
4. ▶️ Test emotion submission from student course-page
5. ▶️ Add navigation links between student list and student insights
6. ▶️ Consider adding emotion-based alerts for instructors
