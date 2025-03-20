import { Inject, Service } from "typedi";
import { IBaseItem, ItemType } from "../dtos/DTOCoursePayload";
import { calculateNewOrder } from "../utils/calculateNewOrder";
import { ICourseRepository } from "shared/database";
import { ICourseVersion, ISection } from "shared/interfaces/IUser";
import { updateLastEntityStatus } from "../utils/updateLastEntityStatus";
import { IItemRepository } from "shared/database/interfaces/IItemRepository";

@Service()
export class ItemService {
  constructor(
    @Inject("ICourseRepository")
    private readonly courseRepository: ICourseRepository,
    @Inject("IItemRepository") private readonly itemRepository: IItemRepository
  ) {}

  /**
   * Creates a new item, storing its details in respective collection first.
   */
  async createItem(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    itemPayload: IBaseItem & {
      itemDetails: any;
      afterItemId?: string;
      beforeItemId?: string;
    }
  ): Promise<ICourseVersion | null> {
    const { type, itemDetails, afterItemId, beforeItemId, ...itemData } =
      itemPayload;

    // Step 1: Store `itemDetails` in respective collection
    let detailsId: string;
    switch (type) {
      case ItemType.VIDEO:
        detailsId = await this.itemRepository.createVideoDetails(itemDetails);
        console.log("Creation Success detailsId", detailsId);
        break;
      case ItemType.QUIZ:
        detailsId = await this.itemRepository.createQuizDetails(itemDetails);
        console.log("Creation Success detailsId", detailsId);
        break;
      case ItemType.BLOG:
        detailsId = await this.itemRepository.createBlogDetails(itemDetails);
        console.log("Creation Success detailsId", detailsId);
        break;
      default:
        throw new Error("Invalid item type");
    }

  
    // Step 2:  Get the version
    const version = await this.courseRepository.readVersion(versionId);
    if (!version) throw new Error("The Version was not found");

    // Step 3: Get the module
    const module = version.modules.find((m) => m.moduleId === moduleId);
    if (!module) throw new Error("The Module was not found");

    // Step 4: Get the section
    const section = module.sections.find((s) => s.sectionId === sectionId);
    if (!section) throw new Error("The Section was not found");

    // Step 5: Compute `order`
    let order: string;
    if (section.itemIds) {
      order = calculateNewOrder(section.itemIds, "itemId");
      console.log("Order", order);
    }

    // Step 6: Store the item
    const item = await this.itemRepository.createItem({
      ...itemData,
      type,
      itemDetailsId: detailsId,
      sectionId,
      order,
    });
    if (!item) throw new Error("Item creation failed");

    // Step 7: Update Section’s `itemIds`
    section.itemIds.push({ itemId: item.id, order, isLast: false });
    console.log("Creation Success item", item);

    // Step 8: Update the last entity status
    section.itemIds = updateLastEntityStatus(section.itemIds, "itemId");

    const latestSection = {...section, updatedAt: new Date(), itemIds: section.itemIds};

    // Step 9: Update the module
    const updatedModule = {
      ...module,
      sections: module.sections.map((s) =>
        s.sectionId === sectionId ? latestSection : s
      ),
    };
    console.log("ITEMSERVICE UPDATED MODULE", updatedModule.sections[0].itemIds);

    // Step 10: Update the version
    const updatedVersion = {
      ...version,
      modules: version.modules.map((m) =>
        m.moduleId === moduleId ? updatedModule : m
      ),
    };
    console.log("ITEMSERVICE UPDATED VERSION", updatedVersion);

    // Step 11: Update the version
    return await this.courseRepository.updateVersion(versionId, updatedVersion);



  }

  async moveItem(
    sectionId: string,
    itemId: string,
    afterItemId?: string,
    beforeItemId?: string
  ): Promise<ISection | null> {
    const section = await this.courseRepository.readSection(sectionId);
    if (!section) throw new Error("Section not found");

    const sortedItems = section.itemIds.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
    const movingItem = sortedItems.find((i) => i.itemId === itemId);
    if (!movingItem) throw new Error("Item not found");

    movingItem.order = calculateNewOrder(
      sortedItems,
      "itemId",
      afterItemId,
      beforeItemId
    );
    section.itemIds = updateLastEntityStatus(
      sortedItems,
      "itemId",
      movingItem,
      afterItemId
    );
    await this.courseRepository.updateSection(sectionId, section);

    return section;
  }
}
