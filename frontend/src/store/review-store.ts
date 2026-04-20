import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReviewItemType = "video" | "quiz";

export interface MarkedReviewItem {
  id: string;
  title: string;
  type: ReviewItemType;
  url: string;
}

interface ReviewStoreState {
  markedItems: MarkedReviewItem[];
  toggleMarkItem: (item: MarkedReviewItem) => void;
  isMarked: (id: string) => boolean;
}

export const useReviewStore = create<ReviewStoreState>()(
  persist(
    (set, get) => ({
      markedItems: [],
      toggleMarkItem: (item) => {
        set((state) => {
          const alreadyMarked = state.markedItems.some((marked) => marked.id === item.id);

          if (alreadyMarked) {
            return {
              markedItems: state.markedItems.filter((marked) => marked.id !== item.id),
            };
          }

          return {
            markedItems: [item, ...state.markedItems],
          };
        });
      },
      isMarked: (id) => get().markedItems.some((item) => item.id === id),
    }),
    {
      name: "review-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
