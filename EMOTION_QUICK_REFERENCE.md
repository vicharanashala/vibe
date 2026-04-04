# 😊 Emotion Tracking - Quick Reference

## Component Props

### EmotionSelector
```tsx
<EmotionSelector
  itemId={string}                    // Required: current item ID
  onEmotionSelect={(emotion) => {}} // Required: submission handler
  disabled={boolean}                 // Optional: disable interaction
  selectedEmotion={EmotionType | null} // Optional: show selected
/>
```

### EmotionAnalyticsDashboard
```tsx
<EmotionAnalyticsDashboard
  courseId={string}           // Required
  courseVersionId={string}    // Required
/>
```

### ItemEmotionStats
```tsx
<ItemEmotionStats
  itemId={string}      // Required
  itemName={string}    // Required: for display
/>
```

### StudentEmotionJourney
```tsx
<StudentEmotionJourney
  courseId={string}           // Required
  courseVersionId={string}    // Required
  studentName={string}        // Optional: for display
/>
```

---

## Custom Hooks

### useSubmitEmotion()
```tsx
const { mutateAsync: submitEmotionAsync } = useSubmitEmotion();

await submitEmotionAsync({
  courseId: string,
  courseVersionId: string,
  itemId: string,
  emotion: "happy" | "sad" | "neutral" | "very_happy" | "very_sad",
  cohortId?: string
});
```

### useEmotionStats(itemId)
```tsx
const { data: stats, isLoading, error } = useEmotionStats(itemId);
// data.data = [{ emotion, count, percentage }, ...]
```

### useEmotionHistory(courseId, courseVersionId)
```tsx
const { data: history, isLoading } = useEmotionHistory(courseId, versionId);
// data.data = [{ emotion, itemId, timestamp }, ...]
```

### useCourseEmotionReport(courseId, courseVersionId)
```tsx
const { data: report, isLoading } = useCourseEmotionReport(courseId, versionId);
// data.data = {
//   total: number,
//   distribution: { very_sad, sad, neutral, happy, very_happy },
//   percentages: { very_sad, sad, neutral, happy, very_happy },
//   averageSentiment: number
// }
```

---

## Emotion Types

```typescript
type EmotionType = 
  | "very_sad"    // 😢 -2 points
  | "sad"         // 😟 -1 point
  | "neutral"     // 🤔  0 points
  | "happy"       // 😊  +1 point
  | "very_happy"  // 🤩  +2 points
```

---

## API Endpoints

### Submit Emotion
```
POST /emotions/submit
Authorization: Bearer <token>
Body: {
  courseId: string,
  courseVersionId: string,
  itemId: string,
  emotion: EmotionType,
  cohortId?: string
}
Response: { success: true, data: EmotionSubmission }
```

### Get Item Stats
```
GET /emotions/stats/:itemId
Response: {
  success: true,
  data: [
    { emotion: "happy", count: 5, percentage: 25 },
    ...
  ]
}
```

### Get Student History
```
GET /emotions/history/:courseId/:courseVersionId
Authorization: Bearer <token>
Response: {
  success: true,
  data: [EmotionSubmission, ...]
}
```

### Get Course Report
```
GET /emotions/report/:courseId/:courseVersionId
Response: {
  success: true,
  data: {
    total: 100,
    distribution: {...},
    percentages: {...},
    averageSentiment: 0.75
  }
}
```

---

## Emotion Colors

| Emotion | Emoji | Hex | RGB |
|---------|-------|-----|-----|
| Very Sad | 😢 | #ef4444 | rgb(239, 68, 68) |
| Sad | 😟 | #f97316 | rgb(249, 115, 22) |
| Neutral | 🤔 | #eab308 | rgb(234, 179, 8) |
| Happy | 😊 | #84cc16 | rgb(132, 204, 22) |
| Very Happy | 🤩 | #22c55e | rgb(34, 197, 94) |

---

## Common Code Patterns

### In Student Course Page
```tsx
const { mutateAsync: submitEmotionAsync } = useSubmitEmotion();

const handleEmotionSubmit = async (emotion: EmotionType) => {
  try {
    await submitEmotionAsync({
      courseId: COURSE_ID,
      courseVersionId: VERSION_ID,
      itemId: currentItem._id,
      emotion,
    });
    setSelectedEmotion(prev => ({ ...prev, [currentItem._id]: emotion }));
  } catch (error) {
    console.error("Error:", error);
  }
};

// In JSX:
<EmotionSelector
  itemId={currentItem._id}
  onEmotionSelect={handleEmotionSubmit}
  selectedEmotion={selectedEmotion[currentItem._id]}
/>
```

### In Teacher Dashboard
```tsx
const COURSE_ID = useCourseStore((s) => s.currentCourse?.courseId);
const VERSION_ID = useCourseStore((s) => s.currentCourse?.versionId);

// Course-level:
<EmotionAnalyticsDashboard courseId={COURSE_ID} courseVersionId={VERSION_ID} />

// Item-level in list:
items.map(item => (
  <ItemEmotionStats key={item._id} itemId={item._id} itemName={item.name} />
))

// Student-level:
<StudentEmotionJourney courseId={COURSE_ID} courseVersionId={VERSION_ID} />
```

---

## Sentiment Score Calculation

```typescript
// Sentiment scores
const emotionScores = {
  "very_sad": -2,
  "sad": -1,
  "neutral": 0,
  "happy": 1,
  "very_happy": 2
};

// Average calculation
average = sum(count_i * score_i) / total_count

// Interpretation
if (average >= 1.5) → "Excellent"
if (average >= 0.5) → "Good"
if (average >= -0.5) → "Neutral"
if (average >= -1.5) → "Concerning"
if (average < -1.5) → "Very Concerning"
```

---

## Database Queries

### Find emotions for an item
```javascript
db.collection("emotions").find({ itemId: ObjectId("...") })
```

### Get student's emotion journey
```javascript
db.collection("emotions")
  .find({ studentId, courseId, courseVersionId })
  .sort({ createdAt: -1 })
```

### Aggregate emotion stats
```javascript
db.collection("emotions").aggregate([
  { $match: { itemId } },
  { $group: { _id: "$emotion", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

---

## Common Issues & Solutions

### Stats showing "No emotion data yet"
- Reason: No emotions submitted for this item
- Solution: Submit emotions from student view first

### Dashboard not loading
- Check: Is courseId and courseVersionId valid?
- Check: Do you have COURSE_ID from course store?
- Solution: Ensure store is initialized

### Emoji not appearing
- Check: Font support on browser
- Fallback: Text labels still visible
- Solution: Try different browser

### Sentiment always zero
- Check: Emotions submitted with different timestamps
- Check: Minority of emotions (neutral may dominate)
- Solution: Review emotion distribution, not just average

---

## Testing Checklist

- [ ] Submit emotion from course page
- [ ] Emotion persists across page refreshes
- [ ] Course dashboard loads with charts
- [ ] Item stats show in teacher course page
- [ ] Student emotion journey displays correctly
- [ ] Sentiment score calculated properly
- [ ] Responsive design works on mobile
- [ ] Empty states display when no data
- [ ] Error handling works gracefully

---

## Files to Remember

| File | Purpose |
|------|---------|
| `use-emotion.ts` | React Query hooks |
| `emotion.types.ts` | TypeScript types |
| `EmotionSelector.tsx` | Learner UI |
| `EmotionAnalyticsDashboard.tsx` | Course analytics |
| `ItemEmotionStats.tsx` | Item-level view |
| `StudentEmotionJourney.tsx` | Student insights |
| `EmotionSchema.ts` | DB model |
| `EmotionService.ts` | Business logic |
| `EmotionController.ts` | API endpoints |

---

## Debug Commands

```bash
# Check emotion collection
db.emotions.countDocuments()

# See recent emotions
db.emotions.find().sort({ createdAt: -1 }).limit(10)

# Get stats for specific item
db.emotions.aggregate([
  { $match: { itemId: ObjectId("...") } },
  { $group: { _id: "$emotion", count: { $sum: 1 } } }
])

# Check student journey
db.emotions.find({ studentId: ObjectId("..."), courseId: ObjectId("...") })
```

---

**Last Updated**: 28 March 2026
**Status**: ✅ Implementation Complete
