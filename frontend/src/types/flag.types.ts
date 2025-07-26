export interface flagInfo {
    courseId: string;
    versionId: string | null;
    moduleId: string | null;
    sectionId: string | null;
    itemId: string | null;
    watchItemId: string | null;
}

export interface FlagState {
    currentCourseFlag: flagInfo | null;
    setCurrentCourseFlag: (courseInfo: flagInfo) => void;
    setWatchItemId: (watchItemId: string) => void;
    clearCurrentCourseFlag: () => void;
}

