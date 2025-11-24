import {ClientSession, ObjectId} from 'mongodb';
import {NotFoundError, BadRequestError} from 'routing-controllers';
import {Item, Module, Section} from '../classes/index.js';
import {IItemRepository, IQuestionBankRef} from '#root/shared/index.js';
import { QuestionBankRepository, QuestionRepository } from '#root/modules/quizzes/repositories/index.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';

export const cloneModules = async (
  existingModules: Module[],
  versionId: string,
  itemRepo: IItemRepository,
  questionBankRepo: QuestionBankRepository,
  questionRepo: QuestionRepository,
  newCourseId: string,
  session?: ClientSession,
): Promise<Module[]> => {
  //1 Validate inputs
  if (!Array.isArray(existingModules)) {
    throw new BadRequestError('existingModules must be an array of Module');
  }
  if (!versionId) {
    throw new BadRequestError('versionId is required');
  }

    // Map to track old question bank IDs to new ones
  const questionBankMap = new Map<string, string>();

  // Helper function to clone question bank references
  const cloneQuestionBankRefs = async (
    questionBankRefs: IQuestionBankRef[],
    session?: ClientSession,
  ): Promise<{newRefs: IQuestionBankRef[]; newBankIds: string[]}> => {
    const newRefs: IQuestionBankRef[] = [];
    const newBankIds: string[] = [];

    for (const ref of questionBankRefs) {
      // If we've already created a clone for this question bank, use the existing one
      if (questionBankMap.has(ref.bankId.toString())) {
        newRefs.push({
          ...ref,
          bankId: questionBankMap.get(ref.bankId.toString())!,
        });
        continue;
      }

      // Get the original question bank
      const originalBank = await questionBankRepo.getById(
        ref.bankId.toString(),
        session,
      );
      if (!originalBank) {
        throw new Error(`Question bank ${ref.bankId} not found`);
      }

      // Create new question bank with empty questions array
      const newBank = new QuestionBank({
        ...originalBank,
        _id: undefined,
        courseId: newCourseId,
        courseVersionId: versionId,
        questions: [], // Start with empty questions array
      });

      // Create the new question bank
      const newBankId = await questionBankRepo.create(newBank, session);
      questionBankMap.set(ref.bankId.toString(), newBankId);
      newBankIds.push(newBankId);

      // Clone all questions in this bank
      const newQuestionIds: string[] = [];
      for (const questionId of originalBank.questions || []) {
        const newQuestion = await questionRepo.duplicate(
          questionId.toString(),
          session,
        );
        if (newQuestion && newQuestion._id) {
          newQuestionIds.push(newQuestion._id.toString());
        }
      }

      // Update the new bank with the cloned questions
      if (newQuestionIds.length > 0) {
        await questionBankRepo.update(
          newBankId,
          {questions: newQuestionIds},
          session,
        );
      }

      // Add the new reference
      newRefs.push({
        ...ref,
        bankId: newBankId,
      });
    }

    return {newRefs, newBankIds};
  };



  //2 Prepare array for new modules
  const newModules: Module[] = [];

  //3 Iterate over each module
  for (const module of existingModules) {
    const newModuleId = new ObjectId().toString();
    const newSections: Section[] = [];

    //4 Iterate over each section inside the module
    for (const section of module.sections) {
      const newSectionId = new ObjectId().toString();

      //5 Read old item group for this section
      if (!section.itemsGroupId) {
        throw new BadRequestError(
          `Section ${section.sectionId} missing itemsGroupId`,
        );
      }
      const oldItemGroup = await itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );
      if (!oldItemGroup) throw new NotFoundError('ItemGroup not found');

      //6 Fetch full item documents for all items inside the item group
      const fullItems: Item[] = [];
      for (const itemRef of oldItemGroup.items) {
        const itemDoc = await itemRepo.readItem(
          versionId,
          itemRef._id.toString(),
        );
        if (!itemDoc) throw new NotFoundError(`Item ${itemRef._id} not found`);
        fullItems.push(itemDoc);
      }

      //7 Clone item docs with no _id and handle question bank references
      const clonedItems = await Promise.all(
        fullItems.map(async itemDoc => {
          const clonedItem = {...itemDoc, _id: undefined};

          // Handle quiz items with question bank references
          if (
            clonedItem.type === 'QUIZ' &&
            clonedItem.details?.questionBankRefs?.length
          ) {
            const {newRefs} = await cloneQuestionBankRefs(
              clonedItem.details.questionBankRefs,
              session,
            );
            clonedItem.details = {
              ...clonedItem.details,
              questionBankRefs: newRefs,
            };
          }

          return clonedItem;
        }),
      );

      //8 Create new items in their respective collections
      const createdItems = await itemRepo.createItems(clonedItems, session);

      //9 Build new item group items referencing newly created items
      const newItemGroupItems = oldItemGroup.items.map((itemRef, idx) => ({
        ...itemRef,
        _id: new ObjectId(createdItems[idx]._id.toString()),
      }));

      //10 Create new item group document for this section
      const newItemGroupData = {
        sectionId: newSectionId,
        items: newItemGroupItems,
      };
      const newItemGroup = await itemRepo.createItemsGroup(
        newItemGroupData,
        session,
      );

      //11 Push cloned section info with new sectionId and new itemGroupId
      newSections.push({
        ...section,
        sectionId: newSectionId,
        itemsGroupId: new ObjectId(newItemGroup._id.toString()),
      });
    }

    //12 Push cloned module info with new moduleId and cloned sections
    newModules.push({
      ...module,
      moduleId: newModuleId,
      sections: newSections,
    });
  }

  //13 Return cloned modules array
  return newModules;
};
