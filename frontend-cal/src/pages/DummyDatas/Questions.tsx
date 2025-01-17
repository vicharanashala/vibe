export const questions = [
  {
    count: 123,
    results: [
      {
        id: 1,
        options: [
          {
            id: 1,
            option_text: 'Option 1',
            question: 1,
          },
          {
            id: 2,
            option_text: 'Option 2',
            question: 1,
          },
          {
            id: 3,
            option_text: 'Option 3',
            question: 1,
          },
        ],
        text: 'Question 1 text',
        hint: 'Question 1 hint',
        type: 'MCQ',
        partial_marking: true,
        marks: 1,
        assessment: 1,
        answer: 1, // Assuming the answer is the option with id 1
      },
      {
        id: 2,
        options: [
          {
            id: 2,
            option_text: 'Option 1',
            question: 2,
          },
          {
            id: 3,
            option_text: 'Option 2',
            question: 2,
          },
          {
            id: 4,
            option_text: 'Option 3',
            question: 2,
          },
        ],
        text: 'What is the capital of France?',
        hint: "It's also known as the city of lights.",
        type: 'MCQ',
        partial_marking: false,
        marks: 1,
        assessment: 1,
        answer: 3, // Assuming the answer is the option with id 3
      },
      {
        id: 3,
        options: [
          {
            id: 5,
            option_text: 'Option 1',
            question: 3,
          },
          {
            id: 6,
            option_text: 'Option 2',
            question: 3,
          },
          {
            id: 7,
            option_text: 'Option 3',
            question: 3,
          },
        ],
        text: 'What is 2 + 2?',
        hint: "It's an even number.",
        type: 'MCQ',
        partial_marking: false,
        marks: 1,
        assessment: 1,
        answer: 6, // Assuming the answer is the option with id 6
      },
    ],
  },
]
