import { Authorized, Body, HttpError, JsonController, Param, Post, Put } from "routing-controllers";
import { Inject, Service } from "typedi";
import { IBaseItem } from "../dtos/DTOCoursePayload";
import { ItemService } from "../services/ItemService";

@JsonController("/courses")
@Service()
export class ItemController {
  constructor(
    @Inject("ItemService") private readonly itemService: ItemService
  ) {}

  @Authorized(["admin"])
  @Post("courses/:courseId/versions/:versionId/modules/:moduleId/sections/:sectionId/items")
  async createItems(
    @Param("sectionId") sectionId: string,
    @Param("moduleId") moduleId: string,
    @Param("versionId") versionId: string,
    @Param("courseId") courseId: string,
    @Body() items: (IBaseItem & { itemDetails: any })[]
  ) {
    try {
      const createdItems = await Promise.all(
        items.map((item, index) => {
          console.log(`${index + 1}. Creation Started for `, item);
          const value = this.itemService.createItem(courseId,versionId, moduleId, sectionId, item)
          if(value) {
            console.log(`${index + 1}. Creation Completed for `, item);
          }
          return value;
        })
      );
      return createdItems;
    } catch (error) {
      throw new HttpError(500, error.message || "Failed to create items");
    }
  }

  @Authorized(["admin"])
  @Put("/:sectionId/items/:itemId/move")
  async moveItem(
    @Param("sectionId") sectionId: string,
    @Param("itemId") itemId: string,
    @Body() body: { afterItemId?: string; beforeItemId?: string }
  ) {
    try {
      const updatedSection = await this.itemService.moveItem(
        sectionId,
        itemId,
        body.afterItemId,
        body.beforeItemId
      );
      return updatedSection;
    } catch (error) {
      throw new HttpError(500, error.message || "Failed to move item");
    }
  }
}
