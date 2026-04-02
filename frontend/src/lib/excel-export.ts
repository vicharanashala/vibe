import * as XLSX from 'xlsx';

export interface StudentContactData {
  name: string;
  email: string;
}

interface QuestionScore {
  questionId: string;
  score: number;
}

interface QuizScore {
  moduleId: string;
  sectionId: string;
  quizId: string;
  quizName: string;
  questionCount?: number;
  quizMaxScore?: number;
  maxScore: number;
  attempts: number;
  moduleName?: string;
  sectionName?: string;
  questionScores: QuestionScore[];
}

export interface StudentData {
  studentId: string;
  name: string;
  email: string;
  cohortName:string;
  totalCourseScore: number;
  totalCourseMaxScore: number;
  quizScores: QuizScore[];
}

interface TransformedData {
  'S.No.': number | string;
  'Name': string;
  'Email': string;
  'Total Course Score': number | string;
  [key: string]: string | number;
}

interface QuizColumn {
  moduleName: string;
  sectionName: string;
  quizName: string;
  moduleId: string;
  sectionId: string;
  quizId: string;
  maxQuestions: number;
  quizMaxScore?: number;
}

export interface ExcelExportOptions {
  includeAttempts: boolean;
  includeQuestionScores: boolean;
}

export function transformDataForExcel(
  data: StudentData[],
  options: ExcelExportOptions = {
    includeAttempts: true,
    includeQuestionScores: true,
  },
): TransformedData[] {
  if (!data?.length) return [];
  
  // First pass: collect all unique module-section-quiz combinations and find max questions per quiz
  const quizColumns = new Map<string, QuizColumn>();
  
  // Collect all unique quizzes and find maximum questions per quiz
  data.forEach(student => {
    if (!student.quizScores?.length) return;
    
    student.quizScores.forEach(quiz => {
      const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
      const questionCount = Math.max(
        Number(quiz.questionCount) || 0,
        quiz.questionScores?.length || 0,
      );
      
      if (!quizColumns.has(key)) {
        quizColumns.set(key, {
          moduleName: quiz.moduleName || `Module_${quiz.moduleId?.substring(0, 4) || 'X'}`,
          sectionName: quiz.sectionName || `Section_${quiz.sectionId?.substring(0, 4) || 'X'}`,
          quizName: quiz.quizName || `Quiz_${quiz.quizId?.substring(0, 4) || 'X'}`,
          moduleId: quiz.moduleId || '',
          sectionId: quiz.sectionId || '',
          quizId: quiz.quizId || '',
          maxQuestions: questionCount,
          quizMaxScore: Number(quiz.quizMaxScore) || 0,
        });
      } else {
        // Update max questions if this quiz has more questions
        const existing = quizColumns.get(key)!;
        existing.maxQuestions = Math.max(existing.maxQuestions, questionCount);
        existing.quizMaxScore = Math.max(
          Number(existing.quizMaxScore) || 0,
          Number(quiz.quizMaxScore) || 0,
        );
      }
    });
  });

  // Maintain original order of quizzes as they appear in the data
  const orderedQuizzes: QuizColumn[] = [];
  const seenQuizzes = new Set<string>();
  
  for (const student of data) {
    if (!student.quizScores?.length) continue;
    
    for (const quiz of student.quizScores) {
      const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
      if (!seenQuizzes.has(key)) {
        const quizData = quizColumns.get(key);
        if (quizData) {
          orderedQuizzes.push(quizData);
          seenQuizzes.add(key);
        }
      }
    }
  }

  // Get total course max score from backend data (first student has the same value as all students)
  const totalCourseMaxScore = data.length > 0 ? data[0].totalCourseMaxScore : 0;

  // Create the header rows
  const results: TransformedData[] = [];
  const headerRow1: TransformedData = { 
    'S.No.': 'S.No.', 
    'Name': 'Name', 
    'Email': 'Email',
    'Total Course Score': `Total Course Score (x/${totalCourseMaxScore})`
  };  // Module headers
  const headerRow2: TransformedData = { 
    'S.No.': '', 
    'Name': '', 
    'Email': '',
    'Total Course Score': ''
  };  // Section headers
  const headerRow3: TransformedData = { 
    'S.No.': '', 
    'Name': '', 
    'Email': '',
    'Total Course Score': ''
  };  // Quiz headers
  const headerRow4: TransformedData = { 
    'S.No.': '', 
    'Name': '', 
    'Email': '',
    'Total Course Score': 'Score'
  };  // Question/Score/Attempts headers
  
  // Track merges for Excel
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  
  let currentCol = 4; // Start after S.No., Name, Email, TotalScore
  let currentModuleId = '';
  let currentSectionId = '';
  let moduleStartCol = 4;
  let sectionStartCol = 4;
  let moduleNumber = 0;
  let sectionNumber = 0;
  let quizNumber = 0;
  
  // Process each quiz and build headers with hierarchy
  orderedQuizzes.forEach((quiz, quizIndex) => {
    const quizStartCol = currentCol;
    const questionsCount = Math.max(quiz.maxQuestions, 0);
    const questionColumns = options.includeQuestionScores ? questionsCount : 0;
    const scoreColumns = 1;
    const attemptsColumns = options.includeAttempts ? 1 : 0;
    const totalColumnsForQuiz = questionColumns + scoreColumns + attemptsColumns;
    
    // Track module changes
    if (currentModuleId !== quiz.moduleId) {
      if (currentModuleId !== '') {
        // Add merge for previous module
        merges.push({
          s: { r: 0, c: moduleStartCol },
          e: { r: 0, c: currentCol - 1 }
        });
      }
      currentModuleId = quiz.moduleId;
      moduleStartCol = currentCol;
      moduleNumber++;
      sectionNumber = 0;
    }
    
    // Track section changes
    if (currentSectionId !== quiz.sectionId) {
      if (currentSectionId !== '') {
        // Add merge for previous section
        merges.push({
          s: { r: 1, c: sectionStartCol },
          e: { r: 1, c: currentCol - 1 }
        });
      }
      currentSectionId = quiz.sectionId;
      sectionStartCol = currentCol;
      sectionNumber++;
      quizNumber = 0;
    }
    
    quizNumber++;
    
    // Set headers for each level
    const moduleName = `Module ${moduleNumber}`;
    const sectionName = `Section ${sectionNumber}`;
    const quizName =
      `Quiz ${quizNumber}: ${quiz.quizName} (Num of questions:-${questionsCount})`.trim();
    const scoreLabel = quiz.quizMaxScore && quiz.quizMaxScore > 0
      ? `Score [x/${quiz.quizMaxScore}]`
      : 'Score';
    
    // Fill module header (spans all columns for this quiz)
    for (let i = 0; i < totalColumnsForQuiz; i++) {
      headerRow1[`col_${currentCol + i}`] = moduleName;
    }
    
    // Fill section header (spans all columns for this quiz)
    for (let i = 0; i < totalColumnsForQuiz; i++) {
      headerRow2[`col_${currentCol + i}`] = sectionName;
    }
    
    // Fill quiz header (spans all columns for this quiz)
    for (let i = 0; i < totalColumnsForQuiz; i++) {
      if (i === 0) {
        headerRow3[`col_${currentCol + i}`] = quizName;
      } else {
        headerRow3[`col_${currentCol + i}`] = '';
      }
    }
    
    // Add merge for quiz header
    if (totalColumnsForQuiz > 1) {
      merges.push({
        s: { r: 2, c: currentCol },
        e: { r: 2, c: currentCol + totalColumnsForQuiz - 1 }
      });
    }
    
    // Fill question headers (q1, q2, q3, etc.) and then Score/Attempts
    for (let i = 0; i < questionColumns; i++) {
      headerRow4[`col_${currentCol + i}`] = `q${i + 1}`;
    }
    
    const scoreColIndex = currentCol + questionColumns;
    headerRow4[`col_${scoreColIndex}`] = scoreLabel;

    if (options.includeAttempts) {
      headerRow4[`col_${scoreColIndex + 1}`] = 'Total attempts';
    }
    
    currentCol += totalColumnsForQuiz;
  });
  
  // Add final merges for the last module and section
  if (currentModuleId && moduleStartCol < currentCol) {
    merges.push({
      s: { r: 0, c: moduleStartCol },
      e: { r: 0, c: currentCol - 1 }
    });
  }
  if (currentSectionId && sectionStartCol < currentCol) {
    merges.push({
      s: { r: 1, c: sectionStartCol },
      e: { r: 1, c: currentCol - 1 }
    });
  }
  
  // Add all header rows to results
  results.push(headerRow1, headerRow2, headerRow3, headerRow4);
  
  // Add student data rows
  data.forEach((student, rowIndex) => {
    const rowData: TransformedData = {
      'S.No.': rowIndex + 1,
      'Name': student.name + (student.cohortName ? ` (${student.cohortName})` : ''),
      'Email': student.email || '',
      'Total Course Score': student.totalCourseScore || 0
    };
    
    // Initialize all columns with default values
    let colIndex = 4; // Start after S.No., Name, Email, TotalScore
    orderedQuizzes.forEach(quiz => {
      const questionsCount = Math.max(quiz.maxQuestions, 0);
      const questionColumns = options.includeQuestionScores ? questionsCount : 0;
      const totalColumnsForQuiz = questionColumns + 1 + (options.includeAttempts ? 1 : 0);
      
      // Initialize question columns with 0
      for (let i = 0; i < questionColumns; i++) {
        rowData[`col_${colIndex + i}`] = 0;
      }
      
      const scoreColIndex = colIndex + questionColumns;
      rowData[`col_${scoreColIndex}`] = 0;

      if (options.includeAttempts) {
        rowData[`col_${scoreColIndex + 1}`] = 0;
      }
      
      colIndex += totalColumnsForQuiz;
    });
    
    // Fill in actual data
    if (student.quizScores?.length) {
      let currentColIndex = 4; // Start after S.No., Name, Email, TotalScore
      
      orderedQuizzes.forEach(quizColumn => {
        const studentQuiz = student.quizScores.find(sq => 
          sq.moduleId === quizColumn.moduleId && 
          sq.sectionId === quizColumn.sectionId && 
          sq.quizId === quizColumn.quizId
        );
        
        const questionsCount = Math.max(quizColumn.maxQuestions, 0);
        const questionColumns = options.includeQuestionScores ? questionsCount : 0;
        const scoreColIndex = currentColIndex + questionColumns;
        
        if (studentQuiz) {
          // Fill question scores
          if (options.includeQuestionScores && studentQuiz.questionScores?.length) {
            studentQuiz.questionScores.forEach((questionScore, questionIndex) => {
              if (questionIndex < questionColumns) {
                rowData[`col_${currentColIndex + questionIndex}`] = questionScore.score || 0;
              }
            });
          }
          
          // Fill overall score and attempts
          rowData[`col_${scoreColIndex}`] = studentQuiz.maxScore || 0;
          if (options.includeAttempts) {
            rowData[`col_${scoreColIndex + 1}`] = studentQuiz.attempts || 0;
          }
        }
        
        currentColIndex += questionColumns + 1 + (options.includeAttempts ? 1 : 0);
      });
    }
    
    results.push(rowData);
  });
  
  return results;
}

export function generateExcel(
  data: StudentData[],
  filename: string = 'quiz_scores.xlsx',
  options: ExcelExportOptions = {
    includeAttempts: true,
    includeQuestionScores: true,
  },
): void {
  try {
    const transformedData = transformDataForExcel(data, options);
    if (!transformedData.length) {
      console.warn('No data to export');
      return;
    }

    // Convert to array of arrays for better control
    const aoa: any[][] = [];
    
    transformedData.forEach(row => {
      const rowArray = [row['S.No.'], row['Name'], row['Email'], row['Total Course Score']];
      
      // Add all the columns in order
      const keys = Object.keys(row).filter(key => key.startsWith('col_'));
      keys.sort((a, b) => {
        const numA = parseInt(a.split('_')[1]);
        const numB = parseInt(b.split('_')[1]);
        return numA - numB;
      });
      
      keys.forEach(key => {
        rowArray.push(row[key]);
      });
      
      aoa.push(rowArray);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    
    // Calculate merges based on the quiz structure
    const merges = [];
    let currentCol = 4; // Start after S.No., Name, Email, TotalScore
    let currentModuleId = '';
    let currentSectionId = '';
    let moduleStartCol = 4;
    let sectionStartCol = 4;
    
    // Get quiz columns info for merging
    if (data.length > 0) {
      const quizColumns = new Map<string, QuizColumn>();
      
      // Build quiz columns map
      data.forEach(student => {
        if (!student.quizScores?.length) return;
        
        student.quizScores.forEach(quiz => {
          const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
          const questionCount = Math.max(
            Number(quiz.questionCount) || 0,
            quiz.questionScores?.length || 0,
          );
          
          if (!quizColumns.has(key)) {
            quizColumns.set(key, {
              moduleName: quiz.moduleName || '',
              sectionName: quiz.sectionName || '',
              quizName: quiz.quizName || '',
              moduleId: quiz.moduleId || '',
              sectionId: quiz.sectionId || '',
              quizId: quiz.quizId || '',
              maxQuestions: questionCount,
              quizMaxScore: Number(quiz.quizMaxScore) || 0,
            });
          } else {
            const existing = quizColumns.get(key)!;
            existing.maxQuestions = Math.max(existing.maxQuestions, questionCount);
            existing.quizMaxScore = Math.max(
              Number(existing.quizMaxScore) || 0,
              Number(quiz.quizMaxScore) || 0,
            );
          }
        });
      });
      
      // Build ordered quizzes
      const orderedQuizzes: QuizColumn[] = [];
      const seenQuizzes = new Set<string>();
      
      for (const student of data) {
        if (!student.quizScores?.length) continue;
        
        for (const quiz of student.quizScores) {
          const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
          if (!seenQuizzes.has(key)) {
            const quizData = quizColumns.get(key);
            if (quizData) {
              orderedQuizzes.push(quizData);
              seenQuizzes.add(key);
            }
          }
        }
      }
      
      // Create merges
      orderedQuizzes.forEach(quiz => {
        const questionsCount = Math.max(quiz.maxQuestions, 0);
        const questionColumns = options.includeQuestionScores ? questionsCount : 0;
        const totalColumnsForQuiz = questionColumns + 1 + (options.includeAttempts ? 1 : 0);
        
        // Module merge
        if (quiz.moduleId !== currentModuleId) {
          if (currentModuleId) {
            merges.push({
              s: { r: 0, c: moduleStartCol },
              e: { r: 0, c: currentCol - 1 }
            });
          }
          currentModuleId = quiz.moduleId;
          moduleStartCol = currentCol;
        }
        
        // Section merge
        if (quiz.sectionId !== currentSectionId) {
          if (currentSectionId) {
            merges.push({
              s: { r: 1, c: sectionStartCol },
              e: { r: 1, c: currentCol - 1 }
            });
          }
          currentSectionId = quiz.sectionId;
          sectionStartCol = currentCol;
        }
        
        // Quiz merge (spans all columns for this quiz)
        if (totalColumnsForQuiz > 1) {
          merges.push({
            s: { r: 2, c: currentCol },
            e: { r: 2, c: currentCol + totalColumnsForQuiz - 1 }
          });
        }
        
        currentCol += totalColumnsForQuiz;
      });
      
      // Final merges
      if (currentModuleId && moduleStartCol < currentCol) {
        merges.push({
          s: { r: 0, c: moduleStartCol },
          e: { r: 0, c: currentCol - 1 }
        });
      }
      if (currentSectionId && sectionStartCol < currentCol) {
        merges.push({
          s: { r: 1, c: sectionStartCol },
          e: { r: 1, c: currentCol - 1 }
        });
      }
    }

    // Apply merges
    ws['!merges'] = merges;
    
    // Set column widths
    const totalCols = aoa[0]?.length || 4;
    ws['!cols'] = [
      { wch: 5 },  // S.No.
      { wch: 18 }, // Name
      { wch: 30 }, // Email
      { wch: 25 }, // Total Course Score 
      ...Array(totalCols - 4).fill({ wch: 10 }) // Question/Score/Attempts columns
    ];

    // Add worksheet to workbook and save
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz Scores');
    XLSX.writeFile(wb, filename);
    
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw error;
  }
}

export function generateStudentContactsExcel(
  data: StudentContactData[],
  filename: string = 'student_contacts.xlsx'
): void {
  const rows = data
    .map((student, index) => [index + 1, student.name || 'Unknown User', student.email || ''])
    .filter(([, name, email]) => Boolean(name) || Boolean(email));

  if (!rows.length) {
    console.warn('No student contact data to export');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['S.No.', 'Name', 'Email'],
    ...rows,
  ]);

  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 32 },
    { wch: 36 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, filename);
}