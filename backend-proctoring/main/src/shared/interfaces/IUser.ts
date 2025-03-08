export interface IUser {
    id?: string
    firebaseUID: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
}

export interface ICourse {
    id?: string;
    name: string;
    description: string;
    versions: string[];
    instructors: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ICourseVersion {
    _id: string;
    courseId: string;
    version: string;
    description: string;
    modules: IModule[]
    createdAt: Date;
    updatedAt: Date;
}

export interface IModule {
    _id: string;
    name: string;
    description: string;
    sections: ISection[];
    isLast: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISection {
    _id: string;
    name: string;
    description: string;
    itemIds: string[];
    isLast: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IItem {
    _id: string;
    name: string;
    description: string;
    isLast: boolean;
    createdAt: Date;
    type: 'VIDEO' | 'QUIZ' | 'BLOG';
    itemId: string;
}

export interface IVideoItem{
    _id: string;
    url: string;
    name: string;
    description: string;
    startTime: Number;
    endTime: Number;
    points: Number;
}

export interface IQuizItem {
    _id: string;
    questionVisibilityLimit: Number;
    questionIds: string[];
}

export interface IBlogItem {
    _id: string;
    title: string;
    content: string;
    points: Number;
}

interface IQuestion{
    _id: string;
    questionText: string;
    questionType: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES';
    parameterized: boolean;
    parameters?: IQuestionParameter[];
    hintText: string;
    timeLimit: Number;
    points: Number;
    metaDetails: IQuestionMetaDetails;
    createdAt: Date;
    updatedAt: Date;
}

export interface IQuestionParameter {
    name: string;
    value: string[] | Number[];
}   

export interface IQuestionMetaDetails {
    _id: string;
    creatorId: string;
    isStudentGenerated: boolean; 
    isAIGenerated: boolean;
}

export interface IQuestionOptionsLot {
    _id: string;
    lotItems: IQuesionOptionsLotItem[];
}

export interface IQuesionOptionsLotItem {
    _id: string;
    itemText: string;
}

export interface ISOLQuestionSolution {
    lotItemId: string;
}

export interface ISMLQuesionSolution {
    lotItemIds: string[];
}

export interface IMTLQuestionSolution {
    matchings: IMTLQuestionMatching[];
}

export interface IMTLQuestionMatching {
    lotItemId: string[];
    explaination: string;
}

export interface IOTLQuestionSolution {
    orderings: IOTLQuestionOrdering[];
}

export interface IOTLQuestionOrdering {
    lotItemId: string;
    order: Number;
}

export interface INATQuestionSolution {
    decimalPrecision: Number;
    upperLimit: Number;
    lowerLimit: Number;
    value: Number;
}

export interface IDESQuestionSolution {
    solutionText: string;
}

export interface ISOLQuestion extends IQuestion {
    questionType: 'SOL';
    lot: IQuestionOptionsLot;
    solution: ISOLQuestionSolution;
}

export interface ISMLQuestion extends IQuestion {
    questionType: 'SML';
    lots: IQuestionOptionsLot[];
    solution: ISMLQuesionSolution;
}

export interface IMTLQuestion extends IQuestion {
    questionType: 'MTL';
    solution: IMTLQuestionSolution;
}

export interface IOTLQuestion extends IQuestion {
    questionType: 'OTL';
    solution: IOTLQuestionSolution;
}

export interface INATQuestion extends IQuestion {
    questionType: 'NAT';
    solution: INATQuestionSolution;
}

export interface IDESQuestion extends IQuestion {
    questionType: 'DES';
    solution: IDESQuestionSolution;
}

export interface IQuizResponse{
    _id: string;
    quizItemId: string;
    studentId: string;
    questionsLength: Number;
    graadingStatus: 'PENDING' | 'GRADED';
    submitted: boolean;
    questions: (IQuizSOLQuestionResponse | IQuizSMLQuestionResponse | IQuizMTLQuestionResponse | IQuizOTLQuestionResponse | IQuizNATQuestionResponse | IQuizDESQuestionResponse)[];
    createdAt: Date;
    updatedAt: Date;
}

interface IQuizResponseItem {
    questionId: string;
    parameters: IQuestionParameter[];
    points: Number;
    timeTaken: Number;
}

export interface IQuizSOLQuestionResponse extends IQuizResponseItem {
    itemId: string;
}

export interface IQuizSMLQuestionResponse extends IQuizResponseItem {
    itemIds: string;
}

export interface IQuizMTLQuestionResponse extends IQuizResponseItem {
    matchings: Omit<IMTLQuestionMatching, 'explaination'>[];
}

export interface IQuizOTLQuestionResponse extends IQuizResponseItem {
    orderings: IOTLQuestionOrdering[];
}

export interface IQuizNATQuestionResponse extends IQuizResponseItem {
    value: Number;
}

export interface IQuizDESQuestionResponse extends IQuizResponseItem {
    responseText: string;
}

