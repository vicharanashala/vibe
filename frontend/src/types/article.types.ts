export interface ArticleProps {
    content: string;
    estimatedReadTimeInMinutes?: string;
    points?: string;
    tags?: string[];
    onNext?: () => void;
    isProgressUpdating?: boolean;
    isAlreadyWatched?: boolean;
    completedItemIdsRef: React.RefObject<Set<string>>;
}

export interface ArticleRef {
    stopItem: () => void;
}