import { IsArray, ArrayMinSize, IsMongoId, IsNotEmpty } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

export class QuestionBankIdParams {
    @JSONSchema({ description: 'Unique identifier for the question-bank entry', type: 'string' })
    @IsMongoId()
    @IsNotEmpty()
    questionId: string;
}

export class AddQuestionsFromBankBody {
    @JSONSchema({
        description:
            "Question-bank entry ids to copy into this exam. Only ids belonging " +
            "to the caller's own bank are copied — ids owned by another teacher " +
            '(or that do not exist) are silently skipped rather than erroring.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    questionIds: string[];
}
