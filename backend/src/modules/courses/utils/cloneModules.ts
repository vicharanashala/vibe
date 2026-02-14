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

  const cloneQuestionBank = async (oldBankId: string): Promise<string> => {
    if (questionBankMap.has(oldBankId)) {
      return questionBankMap.get(oldBankId)!;
    }

    const originalBank = await questionBankRepo.getById(oldBankId, session);
    if (!originalBank) {
      throw new NotFoundError(`Question bank ${oldBankId} not found`);
    }

    const { _id, createdAt, updatedAt, ...bankData } = originalBank;

    const newBank = new QuestionBank({
      ...bankData,
      courseId: newCourseId,
      courseVersionId: newVersionId,
      questions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

        /** 🔑 CREATE sectionId ONCE */
        const newSectionId = new ObjectId().toString();

        /** Read original items */
        const originalItems = await Promise.all(
          oldItemGroup.items.map(ref =>
            itemRepo.readItemById(ref._id.toString(), session),
          ),
        );

        /** Clone items safely */
        const clonedItemPayloads: {
          oldItemId: string;
          payload: any;
        }[] = [];

        for (const item of originalItems) {
          if (!item) continue;

          const oldItemId = item._id.toString();
          const { _id, ...rest } = item;

          const cloned: any = {
            ...rest,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          if (
            cloned.type === 'QUIZ' &&
            cloned.details?.questionBankRefs?.length
          ) {
            cloned.details = {
              ...cloned.details,
              questionBankRefs: await Promise.all(
                cloned.details.questionBankRefs.map(async ref => ({
                  ...ref,
                  bankId: await cloneQuestionBank(ref.bankId.toString()),
                })),
              ),
            };
          }

          clonedItemPayloads.push({ oldItemId, payload: cloned });
        }

        if (!clonedItemPayloads.length) {
          throw new Error('No items cloned for section');
        }

        /** Insert items */
        const createdItems = await itemRepo.createItems(
          clonedItemPayloads.map(i => i.payload),
          session,
        );

        /** Build itemId map */
        const itemIdMap = new Map<string, string>();
        createdItems.forEach((created, idx) => {
          if (!created || !ObjectId.isValid(created._id.toString())) {
            throw new Error(`Invalid created item ID at index ${idx}: ${created?._id}`);
          }
          itemIdMap.set(
            clonedItemPayloads[idx].oldItemId,
            created._id.toString(),
          );
        });

        /** Create items group using SAME sectionId */
        const newItemGroup = await itemRepo.createItemsGroup(
          {
            sectionId: newSectionId,
            items: oldItemGroup.items.map(ref => {
              const newItemId = itemIdMap.get(ref._id.toString());
              if (!newItemId) {
                throw new Error(
                  `Missing cloned item for ${ref._id.toString()}`,
                );
              }

              return {
                ...ref,
                _id: new ObjectId(newItemId),
              };
            }),
          },
          session,
        );

        return {
          ...section,
          sectionId: newSectionId,
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


