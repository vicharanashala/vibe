export const mockExam = {
  _id: 'demo',
  title: 'Demo',
  duration: 30,
  totalMarks: 10,
  passingMarks: 4,
  negativeMarking: true,
  instructions:
    'This is a demo exam running locally in the browser (no backend).\n\n' +
    '• Total questions: 5 (MCQ, MSQ, NAT)\n' +
    '• Duration: 30 minutes\n' +
    '• You may mark questions for review and revisit them.\n' +
    '• Use the on-screen calculator for numerical questions.',
}

export const mockQuestions = [
  {
    id: 'q1',
    _id: 'q1',
    type: 'MCQ',
    questionText: 'Which data structure uses LIFO order?',
    options: [
      { id: 'a', text: 'Queue' },
      { id: 'b', text: 'Stack' },
      { id: 'c', text: 'Linked List' },
      { id: 'd', text: 'Tree' },
    ],
    marks: 2,
    negativeMarks: 0.66,
  },
  {
    id: 'q2',
    _id: 'q2',
    type: 'MCQ',
    questionText: 'Worst-case time complexity of Quick Sort?',
    options: [
      { id: 'a', text: 'O(n log n)' },
      { id: 'b', text: 'O(n)' },
      { id: 'c', text: 'O(n^2)' },
      { id: 'd', text: 'O(log n)' },
    ],
    marks: 2,
    negativeMarks: 0.66,
  },
  {
    id: 'q3',
    _id: 'q3',
    type: 'MSQ',
    questionText: 'Which of the following are NP-Complete problems? (Select all that apply)',
    options: [
      { id: 'a', text: 'Travelling Salesman (decision)' },
      { id: 'b', text: 'Sorting an array' },
      { id: 'c', text: '3-SAT' },
      { id: 'd', text: 'Shortest path (Dijkstra)' },
    ],
    marks: 2,
    negativeMarks: 0,
  },
  {
    id: 'q4',
    _id: 'q4',
    type: 'NAT',
    questionText:
      'A binary tree has 15 nodes. What is the minimum possible height of the tree? (root at height 0)',
    marks: 2,
    negativeMarks: 0,
    natAnswerType: 'integer',
  },
  {
    id: 'q5',
    _id: 'q5',
    type: 'MCQ',
    questionText: 'In OSI model, which layer is responsible for routing?',
    options: [
      { id: 'a', text: 'Data Link' },
      { id: 'b', text: 'Network' },
      { id: 'c', text: 'Transport' },
      { id: 'd', text: 'Session' },
    ],
    marks: 2,
    negativeMarks: 0.66,
  },
]

export const mockAnswers = {
  q1: { correct: ['b'] },
  q2: { correct: ['c'] },
  q3: { correct: ['a', 'c'] },
  q4: { correct: '3' },
  q5: { correct: ['b'] },
}
