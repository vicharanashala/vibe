export interface ArticleProps {
    content: string;
    estimatedReadTimeInMinutes?: string;
    points?: string;
    tags?: string[];
    onNext?: () => void;
    isProgressUpdating?: boolean;
    isAlreadyWatched: boolean;
}

export interface ArticleRef {
    stopItem: () => void;
}