import {LexoRank} from 'lexorank';

/**
 * Calculates the order for a new entity (Module, Section, or Item)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateNewOrder<T extends Record<string, any>>(
  sortedEntities: T[],
  idField: keyof T,
  afterId?: string,
  beforeId?: string,
): string {
  if (sortedEntities.length === 0) {
    return LexoRank.middle().toString();
  }

  if (!sortedEntities.every(entity => entity.order)) {
    throw new Error("Some entities are missing the 'order' field.");
  }

  if (!afterId && !beforeId) {
    // console.log('Adding in the end');
    return LexoRank.parse(sortedEntities[sortedEntities.length - 1].order)
      .genNext()
      .toString();
  }

  if (afterId) {
    // console.log('Adding after', afterId);
    const afterIndex = sortedEntities.findIndex(m => m[idField] === afterId);
    if (afterIndex === sortedEntities.length - 1) {
      return LexoRank.parse(sortedEntities[afterIndex].order)
        .genNext()
        .toString();
    }
    // console.log(sortedEntities);
    // console.log('After order', sortedEntities[afterIndex].order);
    // console.log('After +1 order', sortedEntities[afterIndex + 1].order);
    return LexoRank.parse(sortedEntities[afterIndex].order)
      .between(LexoRank.parse(sortedEntities[afterIndex + 1].order))
      .toString();
  }

  if (beforeId) {
    // console.log('Adding before', beforeId);
    const beforeIndex = sortedEntities.findIndex(m => m[idField] === beforeId);
    if (beforeIndex === 0) {
      return LexoRank.parse(sortedEntities[beforeIndex].order)
        .genPrev()
        .toString();
    }

    // console.log('Before -1 order', sortedEntities[beforeIndex - 1].order);
    // console.log('Before order', sortedEntities[beforeIndex].order);

    return LexoRank.parse(sortedEntities[beforeIndex - 1].order)
      .between(LexoRank.parse(sortedEntities[beforeIndex].order))
      .toString();
  }

  return LexoRank.middle().toString();
}
