export const NATSchema = {
  type: 'object',
  properties: {
    question: {
      type: 'object',
      properties: {
        text: {type: 'string'},
        type: {type: 'string', enum: ['NUMERIC_ANSWER_TYPE']},
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
        decimalPrecision: {type: 'number'},
        upperLimit: {type: 'number'},
        lowerLimit: {type: 'number'},
        value: {type: 'number'},
        expression: {type: 'string'},
      },
      required: ['decimalPrecision', 'upperLimit', 'lowerLimit'],
    },
  },
  required: ['question', 'solution'],
};
