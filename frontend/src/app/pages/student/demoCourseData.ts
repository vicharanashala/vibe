export const DEMO_COURSE_ID = "demo-machine-learning-preview";
export const DEMO_COURSE_VERSION_ID = "demo-machine-learning-version";

export const DEMO_COURSE = {
  id: DEMO_COURSE_ID,
  versionId: DEMO_COURSE_VERSION_ID,
  name: "Machine Learning",
  modules: [
    {
      id: "m1",
      name: "Module 1: Supervised Learning",
      sections: [
        {
          id: "m1s1",
          name: "Section 1: Regression",
          items: [
            { id: "m1s1-v1", type: "video", name: "Regression Introduction", videoId: "aircAruvnKk" },
            { id: "m1s1-q1", type: "quiz", name: "Quiz: Regression Intro" },
            { id: "m1s1-v2", type: "video", name: "Regression Examples", videoId: "vH_v6Y9U2A8" },
            { id: "m1s1-q2", type: "quiz", name: "Quiz: Regression Examples" },
          ],
        },
        {
          id: "m1s2",
          name: "Section 2: Classification",
          items: [
            { id: "m1s2-v1", type: "video", name: "Classification Introduction", videoId: "_kX76i9J4Lg" },
            { id: "m1s2-q1", type: "quiz", name: "Quiz: Classification Intro" },
            { id: "m1s2-v2", type: "video", name: "Classification Applications", videoId: "r5V8h4V4f4A" },
            { id: "m1s2-q2", type: "quiz", name: "Quiz: Classification Apps" },
          ],
        },
      ],
    },
    {
      id: "m2",
      name: "Module 2: Unsupervised Learning",
      sections: [
        {
          id: "m2s1",
          name: "Section 1: Clustering",
          items: [
            { id: "m2s1-v1", type: "video", name: "Clustering Introduction", videoId: "i_LwzRVP7bg" },
            { id: "m2s1-q1", type: "quiz", name: "Quiz: Clustering Intro" },
            { id: "m2s1-v2", type: "video", name: "Clustering Examples", videoId: "8_p8Y76_2sA" },
            { id: "m2s1-q2", type: "quiz", name: "Quiz: Clustering Examples" },
          ],
        },
        {
          id: "m2s2",
          name: "Section 2: Dimensionality Reduction",
          items: [
            { id: "m2s2-v1", type: "video", name: "PCA Introduction", videoId: "FgakZw6K1QQ" },
            { id: "m2s2-q1", type: "quiz", name: "Quiz: PCA Intro" },
            { id: "m2s2-v2", type: "video", name: "PCA Applications", videoId: "kw9R0nDbaHE" },
            { id: "m2s2-q2", type: "quiz", name: "Quiz: PCA Apps" },
          ],
        },
      ],
    },
  ],
} as const;

export const ALL_ITEMS = DEMO_COURSE.modules.flatMap((module) => module.sections.flatMap((section) => section.items));

export const QUIZ_DATA: Record<string, { id: string; question: string; options: string[]; correct: number; points: number }[]> = {
  "m1s1-q1": [
    {
      id: "m1s1-q1-q1",
      question: "What is the primary goal of regression analysis?",
      options: ["To group similar data points", "To predict a continuous output variable", "To classify data into categories", "To reduce the dimensionality of data"],
      correct: 1,
      points: 10,
    },
    {
      id: "m1s1-q1-q2",
      question: "Which of the following is an example of a regression problem?",
      options: ["Predicting if an email is spam or not", "Predicting the price of a house based on its features", "Identifying different species of flowers", "Grouping customers by their purchasing behavior"],
      correct: 1,
      points: 10,
    },
    {
      id: "m1s1-q1-q3",
      question: "In simple linear regression, what does the \"slope\" represent?",
      options: ["The value of the dependent variable when the independent variable is zero", "The change in the dependent variable for a one-unit change in the independent variable", "The amount of error in the prediction", "The average value of the independent variable"],
      correct: 1,
      points: 10,
    },
  ],
  "m1s1-q2": [
    {
      id: "m1s1-q2-q1",
      question: "Which regression model is suitable for predicting a person's age?",
      options: ["Logistic Regression", "Linear Regression", "Decision Tree Classifier", "K-Means Clustering"],
      correct: 1,
      points: 10,
    },
    {
      id: "m1s1-q2-q2",
      question: "What is a common application of polynomial regression?",
      options: ["Predicting binary outcomes", "Modeling non-linear relationships between variables", "Clustering data points", "Reducing the number of features"],
      correct: 1,
      points: 10,
    },
    {
      id: "m1s1-q2-q3",
      question: "When would you use Ridge or Lasso regression?",
      options: ["When dealing with categorical data", "To prevent overfitting in linear models", "For unsupervised learning tasks", "To predict discrete values"],
      correct: 1,
      points: 10,
    },
  ],
  "m1s2-q1": [
    {
      id: "m1s2-q1-q1",
      question: "What is the main objective of classification?",
      options: ["To predict a continuous numerical value", "To assign data points to predefined categories or classes", "To discover hidden patterns in unlabeled data", "To reduce the number of features in a dataset"],
      correct: 1,
      points: 10,
    },
    {
      id: "m1s2-q1-q2",
      question: "Which of these is a binary classification problem?",
      options: ["Predicting house prices", "Identifying handwritten digits (0-9)", "Determining if a customer will churn or not", "Forecasting stock market trends"],
      correct: 2,
      points: 10,
    },
    {
      id: "m1s2-q1-q3",
      question: "What is a \"class label\" in classification?",
      options: ["A numerical feature of the data", "The predicted category for a data point", "A measure of model accuracy", "The input data itself"],
      correct: 1,
      points: 10,
    },
  ],
  "m1s2-q2": [
    {
      id: "m1s2-q2-q1",
      question: "Which algorithm is commonly used for spam detection?",
      options: ["K-Means", "Linear Regression", "Support Vector Machine (SVM)", "Principal Component Analysis (PCA)"],
      correct: 2,
      points: 10,
    },
    {
      id: "m1s2-q2-q2",
      question: "In medical diagnosis, classification models can be used to:",
      options: ["Predict patient recovery time", "Identify the optimal drug dosage", "Diagnose diseases based on symptoms", "Segment medical images"],
      correct: 2,
      points: 10,
    },
    {
      id: "m1s2-q2-q3",
      question: "What is a typical application of multi-class classification?",
      options: ["Predicting a single numerical value", "Categorizing news articles into topics", "Detecting anomalies in network traffic", "Forecasting weather patterns"],
      correct: 1,
      points: 10,
    },
  ],
  "m2s1-q1": [
    {
      id: "m2s1-q1-q1",
      question: "What is the primary goal of clustering?",
      options: ["To predict a target variable", "To group similar data points together without prior labels", "To classify data into known categories", "To reduce the number of features"],
      correct: 1,
      points: 10,
    },
    {
      id: "m2s1-q1-q2",
      question: "Clustering is a form of:",
      options: ["Supervised Learning", "Reinforcement Learning", "Unsupervised Learning", "Semi-supervised Learning"],
      correct: 2,
      points: 10,
    },
    {
      id: "m2s1-q1-q3",
      question: "What does \"unlabeled data\" mean in the context of clustering?",
      options: ["Data that is missing values", "Data that has not been assigned to any specific category or class", "Data that is too large to process", "Data that is irrelevant to the problem"],
      correct: 1,
      points: 10,
    },
  ],
  "m2s1-q2": [
    {
      id: "m2s1-q2-q1",
      question: "Which algorithm is commonly used for customer segmentation?",
      options: ["Linear Regression", "K-Means", "Support Vector Machine (SVM)", "Naive Bayes"],
      correct: 1,
      points: 10,
    },
    {
      id: "m2s1-q2-q2",
      question: "In image processing, clustering can be used for:",
      options: ["Object detection", "Image classification", "Image compression by color quantization", "Generating new images"],
      correct: 2,
      points: 10,
    },
    {
      id: "m2s1-q2-q3",
      question: "What is a \"centroid\" in K-Means clustering?",
      options: ["An outlier data point", "The center of a cluster", "A boundary between two clusters", "A data point that belongs to multiple clusters"],
      correct: 1,
      points: 10,
    },
  ],
  "m2s2-q1": [
    {
      id: "m2s2-q1-q1",
      question: "What does PCA stand for?",
      options: ["Principal Component Analysis", "Primary Classification Algorithm", "Pattern Correlation Algorithm", "Predictive Component Association"],
      correct: 0,
      points: 10,
    },
    {
      id: "m2s2-q1-q2",
      question: "What is the main purpose of PCA?",
      options: ["To increase the number of features", "To classify data into categories", "To reduce the dimensionality of a dataset while retaining most of its variance", "To predict a continuous target variable"],
      correct: 2,
      points: 10,
    },
    {
      id: "m2s2-q1-q3",
      question: "PCA is a technique used in:",
      options: ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Both Supervised and Unsupervised Learning"],
      correct: 1,
      points: 10,
    },
  ],
  "m2s2-q2": [
    {
      id: "m2s2-q2-q1",
      question: "In face recognition, PCA can be used for:",
      options: ["Generating new faces", "Detecting emotions", "Feature extraction and dimensionality reduction", "Image enhancement"],
      correct: 2,
      points: 10,
    },
    {
      id: "m2s2-q2-q2",
      question: "What is a benefit of using PCA before training a machine learning model?",
      options: ["It always improves model accuracy", "It can speed up training and reduce overfitting", "It makes the model more complex", "It converts all features to categorical data"],
      correct: 1,
      points: 10,
    },
    {
      id: "m2s2-q2-q3",
      question: "What are \"principal components\" in PCA?",
      options: ["The original features of the dataset", "New uncorrelated variables that capture the most variance in the data", "The output predictions of a model", "Randomly selected features"],
      correct: 1,
      points: 10,
    },
  ],
};

export const createDemoEnrollment = () => ({
  courseId: DEMO_COURSE_ID,
  courseVersionId: DEMO_COURSE_VERSION_ID,
  cohortId: null,
  cohortName: null,
  percentCompleted: 0,
  completedItems: 0,
  assignedTimeSlot: null,
  hasNewItemsAfterCompletion: false,
  contentCounts: {
    totalItems: ALL_ITEMS.length,
    videos: ALL_ITEMS.filter((item) => item.type === "video").length,
    quizzes: ALL_ITEMS.filter((item) => item.type === "quiz").length,
    articles: 0,
    projects: 0,
  },
  course: {
    name: DEMO_COURSE.name,
  },
  isDemo: true,
});
