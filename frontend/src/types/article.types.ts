export interface ArticleProps {
    content: string;
    estimatedReadTimeInMinutes?: string;
    points?: string;
    tags?: string[];
    onNext?: () => void;
    isProgressUpdating?: boolean;
    title: string;
    description?: string;
}

export interface ArticleRef {
    stopItem: () => void;
}