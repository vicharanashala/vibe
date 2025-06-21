export const OTLSchema = {
  type: 'object',
  properties: {
    question: {
      type: 'object',
      properties: {
        text: {type: 'string'},
        type: {type: 'string', enum: ['ORDER_THE_LOTS']},
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
        ordering: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lotItem: {
                type: 'object',
                properties: {
                  text: {type: 'string'},
                  explaination: {type: 'string'},
                },
                required: ['text', 'explaination'],
              },
              order: {type: 'number'},
            },
            required: ['lotItem', 'order'],
          },
        },
      },
      required: ['ordering'],
    },
  },
  required: ['question', 'solution'],
};
