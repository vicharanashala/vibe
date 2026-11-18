import { IsArray, ArrayMinSize, IsMongoId } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

// Despite `QuestionBankService.addToBank` also stamping a `bank-<uuid>`
// value onto the entry's `id` field, that field is never used for lookups —
// `QuestionBankRepository.findById`/`findByIds`/`delete` all key off Mongo's
// native `_id`. The id a client must send back here (what `entry._id` in the
// list response resolves to, once `_id` is normalized to a hex string by
// `ExamImageStorageService.normalizeId`) is that Mongo ObjectId, so these
// validate as `@IsMongoId()`.

export class QuestionBankIdParams {
    @JSONSchema({ description: 'Unique identifier for the question-bank entry', type: 'string' })
    @IsMongoId()
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
