 /**
   * Updates the `isLast` status of entities to maintain proper ordering.
   */
export function updateLastEntityStatus<T extends { isLast: boolean, order:string }>(
    sortedEntities: T[],
    idField: keyof T,
    newEntity?: T,
    afterId?: string
  ): T[] {
    // Sort items based on order
    let finalSorted = sortedEntities.sort((a, b) => a.order.localeCompare(b.order));

    // for all items except last set isLast = false
    finalSorted.forEach((item, index, items) => {
      if (index != items.length-1){
        item.isLast = false;
      }
      else {
        item.isLast = true;
      }
    });

    return finalSorted;
  }
