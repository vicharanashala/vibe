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

// ─── Mixed question types for AI-generated quizzes ──────────────────────────
export type DemoQuestionType = 'MCQ' | 'MULTI_SELECT' | 'DRAG_DROP' | 'DROPDOWN';

export interface DemoQuestion {
  id: string;
  type: DemoQuestionType;
  question: string;
  points: number;
  options?: string[];
  correct?: number;
  correctMany?: number[];
  items?: string[];
  sentence?: string;
  dropdownOptions?: Record<string, string[]>;
  correctDropdown?: Record<string, string>;
}

export const MIXED_QUIZ_DATA: Record<string, DemoQuestion[]> = {
  'm1s1-q1': [
    {
      id: 'm1s1-q1-a', type: 'MCQ',
      question: 'What is the primary goal of regression analysis?',
      options: ['Group similar data points', 'Predict a continuous output variable', 'Classify data into categories', 'Reduce dimensionality'],
      correct: 1, points: 10,
    },
    {
      id: 'm1s1-q1-b', type: 'MULTI_SELECT',
      question: 'Which of the following are examples of regression problems? (Select all that apply)',
      options: ['Predicting house prices', 'Spam detection', 'Forecasting stock prices', 'Classifying flower species'],
      correctMany: [0, 2], points: 10,
    },
    {
      id: 'm1s1-q1-c', type: 'DRAG_DROP',
      question: 'Arrange the steps of building a linear regression model in the correct order:',
      items: ['Collect and preprocess data', 'Split into train/test sets', 'Fit the model', 'Evaluate on test set', 'Deploy the model'],
      points: 10,
    },
  ],
  'm1s1-q2': [
    {
      id: 'm1s1-q2-a', type: 'DROPDOWN',
      question: 'Complete the sentence:',
      sentence: 'In linear regression, the {{line}} is fitted to minimise the {{error}} between predicted and actual values.',
      dropdownOptions: {
        line: ['best-fit line', 'decision boundary', 'cluster centroid'],
        error: ['sum of squared residuals', 'cross-entropy loss', 'Gini impurity'],
      },
      correctDropdown: { line: 'best-fit line', error: 'sum of squared residuals' },
      points: 10,
    },
    {
      id: 'm1s1-q2-b', type: 'MCQ',
      question: 'Ridge and Lasso regression are used primarily to:',
      options: ['Increase model complexity', 'Prevent overfitting via regularisation', 'Convert regression to classification', 'Speed up training'],
      correct: 1, points: 10,
    },
    {
      id: 'm1s1-q2-c', type: 'MULTI_SELECT',
      question: 'Which metrics are commonly used to evaluate regression models? (Select all that apply)',
      options: ['Mean Absolute Error (MAE)', 'Accuracy', 'Root Mean Squared Error (RMSE)', 'R\u00b2 Score'],
      correctMany: [0, 2, 3], points: 10,
    },
  ],
  'm1s2-q1': [
    {
      id: 'm1s2-q1-a', type: 'MCQ',
      question: 'What is the main objective of classification?',
      options: ['Predict a continuous value', 'Assign data points to predefined categories', 'Discover hidden patterns', 'Reduce feature count'],
      correct: 1, points: 10,
    },
    {
      id: 'm1s2-q1-b', type: 'DRAG_DROP',
      question: 'Arrange these classification algorithms from simplest to most complex (drag to reorder):',
      items: ['Logistic Regression', 'Decision Tree', 'Random Forest', 'Neural Network'],
      points: 10,
    },
    {
      id: 'm1s2-q1-c', type: 'DROPDOWN',
      question: 'Complete the sentence:',
      sentence: 'A {{type}} classification problem has exactly two output classes, while a {{multi}} problem has three or more.',
      dropdownOptions: {
        type: ['binary', 'multi-class', 'regression'],
        multi: ['multi-class', 'binary', 'clustering'],
      },
      correctDropdown: { type: 'binary', multi: 'multi-class' },
      points: 10,
    },
  ],
  'm1s2-q2': [
    {
      id: 'm1s2-q2-a', type: 'MULTI_SELECT',
      question: 'Which of the following are real-world classification applications? (Select all that apply)',
      options: ['Spam email detection', 'House price prediction', 'Medical diagnosis', 'Customer churn prediction'],
      correctMany: [0, 2, 3], points: 10,
    },
    {
      id: 'm1s2-q2-b', type: 'MCQ',
      question: 'Which algorithm is commonly used for spam detection?',
      options: ['K-Means', 'Linear Regression', 'Naive Bayes / SVM', 'PCA'],
      correct: 2, points: 10,
    },
    {
      id: 'm1s2-q2-c', type: 'DRAG_DROP',
      question: 'Arrange the steps of a classification pipeline in order:',
      items: ['Data collection', 'Feature engineering', 'Model training', 'Threshold tuning', 'Production deployment'],
      points: 10,
    },
  ],
  'm2s1-q1': [
    {
      id: 'm2s1-q1-a', type: 'MCQ',
      question: 'What is the primary goal of clustering?',
      options: ['Predict a target variable', 'Group similar data points without prior labels', 'Classify into known categories', 'Reduce features'],
      correct: 1, points: 10,
    },
    {
      id: 'm2s1-q1-b', type: 'DROPDOWN',
      question: 'Complete the sentence:',
      sentence: 'Clustering is a form of {{learning}} learning because the training data has {{labels}}.',
      dropdownOptions: {
        learning: ['unsupervised', 'supervised', 'reinforcement'],
        labels: ['no labels', 'class labels', 'reward signals'],
      },
      correctDropdown: { learning: 'unsupervised', labels: 'no labels' },
      points: 10,
    },
    {
      id: 'm2s1-q1-c', type: 'MULTI_SELECT',
      question: 'Which of the following are clustering algorithms? (Select all that apply)',
      options: ['K-Means', 'DBSCAN', 'Logistic Regression', 'Hierarchical Clustering'],
      correctMany: [0, 1, 3], points: 10,
    },
  ],
  'm2s1-q2': [
    {
      id: 'm2s1-q2-a', type: 'DRAG_DROP',
      question: 'Arrange the K-Means algorithm steps in the correct order:',
      items: ['Initialise K centroids randomly', 'Assign each point to nearest centroid', 'Recompute centroids', 'Check for convergence', 'Output final clusters'],
      points: 10,
    },
    {
      id: 'm2s1-q2-b', type: 'MCQ',
      question: 'What is a "centroid" in K-Means clustering?',
      options: ['An outlier data point', 'The centre of a cluster', 'A boundary between clusters', 'A point in multiple clusters'],
      correct: 1, points: 10,
    },
    {
      id: 'm2s1-q2-c', type: 'MULTI_SELECT',
      question: 'Which are valid applications of clustering? (Select all that apply)',
      options: ['Customer segmentation', 'Image compression', 'Predicting house prices', 'Anomaly detection'],
      correctMany: [0, 1, 3], points: 10,
    },
  ],
  'm2s2-q1': [
    {
      id: 'm2s2-q1-a', type: 'MCQ',
      question: 'What does PCA stand for?',
      options: ['Principal Component Analysis', 'Primary Classification Algorithm', 'Pattern Correlation Algorithm', 'Predictive Component Association'],
      correct: 0, points: 10,
    },
    {
      id: 'm2s2-q1-b', type: 'DROPDOWN',
      question: 'Complete the sentence:',
      sentence: 'PCA reduces {{dim}} while retaining as much {{var}} as possible by projecting data onto {{comp}}.',
      dropdownOptions: {
        dim: ['dimensionality', 'sample size', 'label count'],
        var: ['variance', 'bias', 'noise'],
        comp: ['principal components', 'cluster centroids', 'decision boundaries'],
      },
      correctDropdown: { dim: 'dimensionality', var: 'variance', comp: 'principal components' },
      points: 10,
    },
    {
      id: 'm2s2-q1-c', type: 'MULTI_SELECT',
      question: 'Which statements about PCA are correct? (Select all that apply)',
      options: ['PCA is an unsupervised technique', 'PCA always improves model accuracy', 'PCA can speed up training', 'Principal components are uncorrelated'],
      correctMany: [0, 2, 3], points: 10,
    },
  ],
  'm2s2-q2': [
    {
      id: 'm2s2-q2-a', type: 'DRAG_DROP',
      question: 'Arrange the PCA workflow steps in the correct order:',
      items: ['Standardise the data', 'Compute covariance matrix', 'Calculate eigenvectors & eigenvalues', 'Select top K components', 'Project data onto new axes'],
      points: 10,
    },
    {
      id: 'm2s2-q2-b', type: 'MCQ',
      question: 'What is a benefit of applying PCA before training a model?',
      options: ['Always improves accuracy', 'Can speed up training and reduce overfitting', 'Makes the model more complex', 'Converts features to categorical'],
      correct: 1, points: 10,
    },
    {
      id: 'm2s2-q2-c', type: 'MULTI_SELECT',
      question: 'Which are real-world applications of PCA? (Select all that apply)',
      options: ['Face recognition', 'Image compression', 'Spam detection', 'Noise reduction in signals'],
      correctMany: [0, 1, 3], points: 10,
    },
  ],
};

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
