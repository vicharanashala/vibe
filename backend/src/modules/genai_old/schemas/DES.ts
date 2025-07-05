export const DESSchema = {
  type: 'object',
  properties: {
    question: {
      type: 'object',
      properties: {
        text: {type: 'string'},
        type: {type: 'string', enum: ['DESCRIPTIVE']},
        isParameterized: {type: 'boolean'},
        parameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {type: 'string'},
              possibleValues: {type: 'array', items: {type: 'string'}},
              type: {type: 'string'},
            },
            required: ['name', 'possibleValues', 'type'],
          },
        },
        hint: {type: 'string'},
        timeLimitSeconds: {type: 'number'},
        points: {type: 'number'},
      },
      required: [
        'text',
        'type',
        'isParameterized',
        'timeLimitSeconds',
        'points',
      ],
    },
    solution: {
      type: 'object',
      properties: {
        solutionText: {type: 'string'},
      },
      required: ['solutionText'],
    },
  },
  required: ['question', 'solution'],
};
