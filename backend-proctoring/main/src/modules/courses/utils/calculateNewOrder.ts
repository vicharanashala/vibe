import { LexoRank } from "lexorank";

  /**
   * Calculates the order for a new entity (Module, Section, or Item)
   */
export  function calculateNewOrder<T extends Record<string, any>>(
    sortedEntities: T[],
    idField: keyof T,
    afterId?: string,
    beforeId?: string
  ): string {
    if (sortedEntities.length === 0) {
      return LexoRank.middle().toString();
    }

    if (!sortedEntities.every(entity => entity.order)) {
      throw new Error("Some entities are missing the 'order' field.");
    }
    
  
    if (!afterId && !beforeId) {
      return LexoRank.parse(sortedEntities[sortedEntities.length - 1].order).genNext().toString();
    }
  
    if (afterId) {
      const afterIndex = sortedEntities.findIndex((m) => m[idField] === afterId);
      if (afterIndex === sortedEntities.length - 1) {
        return LexoRank.parse(sortedEntities[afterIndex].order).genNext().toString();
      }
      return LexoRank.parse(sortedEntities[afterIndex].order)
        .between(LexoRank.parse(sortedEntities[afterIndex + 1].order))
        .toString();
    }
  
    if (beforeId) {
      const beforeIndex = sortedEntities.findIndex((m) => m[idField] === beforeId);
      if (beforeIndex === 0) {
        return LexoRank.parse(sortedEntities[beforeIndex].order).genPrev().toString();
      }
      return LexoRank.parse(sortedEntities[beforeIndex - 1].order)
        .between(LexoRank.parse(sortedEntities[beforeIndex].order))
        .toString();
    }
  
    return LexoRank.middle().toString();
  }
  
 