export interface IUser {
    _id: String;
    email: String;
    firstName: String;
    lastName: String;
    roles: String[];
}

export interface ICourse {
    _id: String;
    name: String;
    description: String;
    instructors: String[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ICourseVersion {
    _id: String;
    courseId: String;
    version: String;
    description: String;
    modules: IModule[]
    createdAt: Date;
    updatedAt: Date;
}

export interface IModule {
    _id: String;
    name: String;
    description: String;
    sections: ISection[];
    isLast: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISection {
    _id: String;
    name: String;
    description: String;
    itemIds: String[];
    isLast: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IItem {
    _id: String;
    name: String;
    description: String;
    isLast: boolean;
    createdAt: Date;
    type: 'VIDEO' | 'QUIZ' | 'BLOG';
    itemId: String;
}

export interface IVideoItem{
    _id: String;
    url: String;
    name: String;
    description: String;
    startTime: Number;
    endTime: Number;
    points: Number;
}

export interface IQuizItem {
    _id: String;
    questionVisibilityLimit: Number;
    questionIds: String[];
}

export interface IBlogItem {
    _id: String;
    title: String;
    content: String;
    points: Number;
}

interface IQuestion{
    _id: String;
    questionText: String;
    questionType: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES';
    parameterized: boolean;
    parameters?: IQuestionParameter[];
    hintText: String;
    timeLimit: Number;
    points: Number;
    metaDetails: IQuestionMetaDetails;
    createdAt: Date;
    updatedAt: Date;
}

export interface IQuestionParameter {
    name: String;
    value: String[] | Number[];
}   

export interface IQuestionMetaDetails {
    _id: String;
    creatorId: String;
    isStudentGenerated: boolean; 
    isAIGenerated: boolean;
}

export interface IQuestionOptionsLot {
    _id: String;
    lotItems: IQuesionOptionsLotItem[];
}

export interface IQuesionOptionsLotItem {
    _id: String;
    itemText: String;
}

export interface ISOLQuestionSolution {
    lotItemId: String;
}

export interface ISMLQuesionSolution {
    lotItemIds: String[];
}

export interface IMTLQuestionSolution {
    matchings: IMTLQuestionMatching[];
}

export interface IMTLQuestionMatching {
    lotItemId: String[];
    explaination: String;
}

export interface IOTLQuestionSolution {
    orderings: IOTLQuestionOrdering[];
}

export interface IOTLQuestionOrdering {
    lotItemId: String;
    order: Number;
}

export interface INATQuestionSolution {
    decimalPrecision: Number;
    upperLimit: Number;
    lowerLimit: Number;
    value: Number;
}

export interface IDESQuestionSolution {
    solutionText: String;
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
    _id: String;
    quizItemId: String;
    studentId: String;
    questionsLength: Number;
    graadingStatus: 'PENDING' | 'GRADED';
    submitted: boolean;
    questions: (IQuizSOLQuestionResponse | IQuizSMLQuestionResponse | IQuizMTLQuestionResponse | IQuizOTLQuestionResponse | IQuizNATQuestionResponse | IQuizDESQuestionResponse)[];
    createdAt: Date;
    updatedAt: Date;
}

interface IQuizResponseItem {
    questionId: String;
    parameters: IQuestionParameter[];
    points: Number;
    timeTaken: Number;
}

export interface IQuizSOLQuestionResponse extends IQuizResponseItem {
    itemId: String;
}

export interface IQuizSMLQuestionResponse extends IQuizResponseItem {
    itemIds: String;
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
    responseText: String;
}

