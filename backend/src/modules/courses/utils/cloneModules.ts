import { ClientSession, ObjectId } from 'mongodb';
import { NotFoundError, BadRequestError } from 'routing-controllers';
import { Item, Module, Section } from '../classes/index.js';
import { IItemRepository, IQuestionBankRef } from '#root/shared/index.js';
import { QuestionBankRepository, QuestionRepository } from '#root/modules/quizzes/repositories/index.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';

export const cloneModules = async (
  existingModules: Module[],
  newVersionId: string,
  itemRepo: IItemRepository,
  questionBankRepo: QuestionBankRepository,
  questionRepo: QuestionRepository,
  newCourseId: string,
  session?: ClientSession,
): Promise<Module[]> => {
  if (!Array.isArray(existingModules)) {
    throw new BadRequestError('existingModules must be an array');
  }

  const questionBankMap = new Map<string, string>();

  const cloneQuestionBank = async (oldBankId: string) => {
    if (questionBankMap.has(oldBankId)) {
      return questionBankMap.get(oldBankId)!;
    }

    const originalBank = await questionBankRepo.getById(oldBankId, session);
    if (!originalBank) {
      throw new Error(`Question bank ${oldBankId} not found`);
    }

    const newBank = new QuestionBank({
      ...originalBank,
      _id: undefined,
      courseId: newCourseId,
      courseVersionId: newVersionId,
      questions: [],
    });

    const newBankId = await questionBankRepo.create(newBank, session);

    const newQuestionIds = await Promise.all(
      (originalBank.questions || []).map(async qId => {
        const q = await questionRepo.duplicate(qId.toString(), session);
        return q?._id?.toString();
      }),
    );

    await questionBankRepo.update(
      newBankId,
      { questions: newQuestionIds.filter(Boolean) },
      session,
    );

    questionBankMap.set(oldBankId, newBankId);
    return newBankId;
  };

  const newModules: Module[] = [];

  for (const module of existingModules) {
    const newModuleId = new ObjectId().toString();

    // 🔹 Clone sections in parallel
    const newSections = await Promise.all(
      module.sections.map(async section => {
        if (!section.itemsGroupId) {
          throw new BadRequestError('Missing itemsGroupId');
        }

        const oldItemGroup = await itemRepo.readItemsGroup(
          section.itemsGroupId.toString(),
          session,
        );
        if (!oldItemGroup) {
          throw new NotFoundError('ItemGroup not found');
        }

        // 🔹 Parallel item reads
        const fullItems = await Promise.all(
          oldItemGroup.items.map(i =>
            itemRepo.readItemById(i._id.toString()),
          ),
        );

        // 🔹 Clone items
        const clonedItems = await Promise.all(
          fullItems.map(async item => {
            if (!item) return null;
            const cloned = { ...item, _id: undefined };

            if (
              cloned.type === 'QUIZ' &&
              cloned.details?.questionBankRefs?.length
            ) {
              const newRefs = await Promise.all(
                cloned.details.questionBankRefs.map(async ref => ({
                  ...ref,
                  bankId: await cloneQuestionBank(ref.bankId.toString()),
                })),
              );
              cloned.details = {
                ...cloned.details,
                questionBankRefs: newRefs,
              };
            }

            return cloned;
          }),
        );

        const createdItems = await itemRepo.createItems(
          clonedItems.filter(Boolean),
          session,
        );

        const newItemGroup = await itemRepo.createItemsGroup(
          {
            sectionId: new ObjectId().toString(),
            items: oldItemGroup.items.map((itemRef, idx) => ({
              ...itemRef,
              _id: new ObjectId(createdItems[idx]._id.toString()),
            })),
          },
          session,
        );

        return {
          ...section,
          sectionId: new ObjectId().toString(),
          itemsGroupId: new ObjectId(newItemGroup._id.toString()),
        };
      }),
    );

    newModules.push({
      ...module,
      moduleId: newModuleId,
      sections: newSections,
    });
  }

  return newModules;
};

