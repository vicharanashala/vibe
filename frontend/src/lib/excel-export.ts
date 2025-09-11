import * as XLSX from 'xlsx';

interface QuizScore {
  moduleId: string;
  sectionId: string;
  quizId: string;
  quizName: string;
  maxScore: number;
  attempts: number;
  moduleName?: string;
  sectionName?: string;
}

export interface StudentData {
  studentId: string;
  name: string;
  email: string;
  quizScores: QuizScore[];
}

interface TransformedData {
  'S.No.': number | string;
  'Name': string;
  'Email': string;
  [key: string]: string | number;
}

interface QuizColumn {
  moduleName: string;
  sectionName: string;
  quizName: string;
  moduleId: string;
  sectionId: string;
  quizId: string;
}

export function transformDataForExcel(data: StudentData[]): TransformedData[] {
  if (!data?.length) return [];
  
  // First pass: collect all unique module-section-quiz combinations with their names
  const quizColumns = new Map<string, QuizColumn>();
  const moduleOrder = new Map<string, number>();
  const sectionOrder = new Map<string, number>();
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  
  // Collect all unique quizzes and track order of modules/sections
  data.forEach(student => {
    if (!student.quizScores?.length) return;
    
    student.quizScores.forEach(quiz => {
      const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
      
      // Track module order by first occurrence
      if (!moduleOrder.has(quiz.moduleId)) {
        moduleOrder.set(quiz.moduleId, moduleOrder.size);
      }
      
      // Track section order by first occurrence
      if (!sectionOrder.has(quiz.sectionId)) {
        sectionOrder.set(quiz.sectionId, sectionOrder.size);
      }
      
      // Store quiz column data
      if (!quizColumns.has(key)) {
        quizColumns.set(key, {
          moduleName: quiz.moduleName || `Module_${quiz.moduleId?.substring(0, 4) || 'X'}`,
          sectionName: quiz.sectionName || `Section_${quiz.sectionId?.substring(0, 4) || 'X'}`,
          quizName: quiz.quizName || `Quiz_${quiz.quizId?.substring(0, 4) || 'X'}`,
          moduleId: quiz.moduleId || '',
          sectionId: quiz.sectionId || '',
          quizId: quiz.quizId || ''
        });
      }
    });
  });

  // Maintain original order of quizzes as they appear in the data
  const orderedQuizzes: QuizColumn[] = [];
  const seenQuizzes = new Set<string>();
  
  // Process quizzes in the order they first appear in the data
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

  // Create the header rows
  const results: TransformedData[] = [];
  const headerRow1: TransformedData = { 'S.No.': 'S.No.', 'Name': 'Name', 'Email': 'Email' };  // Quiz names
  const headerRow2: TransformedData = { 'S.No.': '', 'Name': '', 'Email': '' };  // Score/Attempts
  const headerRow3: TransformedData = { 'S.No.': '', 'Name': '', 'Email': '' };  // Score/Attempts
  const headerRow4: TransformedData = { 'S.No.': '', 'Name': '', 'Email': '' };  // Score/Attempts
  
  // Track column positions for each quiz
  const quizColumnMap = new Map<string, number>();
  let currentCol = 0;
  
  // Track current module, section, and quiz for grouping and numbering
  let currentModuleId = '';
  let currentSectionId = '';
  let currentQuizId = '';
  let moduleStartCol = 0;
  let sectionStartCol = 0;
  let quizStartCol = 0;
  let moduleNumber = 0;
  let sectionNumber = 0;
  let quizNumber = 0;
  const quizNumbers = new Map<string, number>(); // Tracks quiz numbers per section
  
  // Track unique modules and sections with their names
  const moduleNames = new Map<string, string>();
  const sectionNames = new Map<string, string>();
  
  // Collect module and section names
  orderedQuizzes.forEach(quiz => {
    if (!moduleNames.has(quiz.moduleId)) {
      moduleNames.set(quiz.moduleId, quiz.moduleName);
    }
    if (!sectionNames.has(quiz.sectionId)) {
      sectionNames.set(quiz.sectionId, quiz.sectionName);
    }
  });
  
  // Process each quiz and build headers with hierarchy
  orderedQuizzes.forEach((quiz, index) => {
    let currentCol = index * 2; // Each quiz takes 2 columns (score and attempts)
    quizColumnMap.set(`${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`, currentCol);
    
    // Track module changes
    if (currentModuleId !== quiz.moduleId) {
      if (currentModuleId !== '') {
        // Merge previous module columns
        merges.push({ s: { r: 0, c: moduleStartCol + 3 }, e: { r: 0, c: currentCol + 3 - 1 } });
      }
      currentModuleId = quiz.moduleId;
      moduleStartCol = currentCol;
      moduleNumber++;
      sectionNumber = 0; // Reset section number for new module
    }
    
    // Track section changes
    if (currentSectionId !== quiz.sectionId) {
      if (currentSectionId !== '') {
        // Merge previous section columns
        merges.push({ s: { r: 1, c: sectionStartCol + 3 }, e: { r: 1, c: currentCol + 3 - 1 } });
      }
      currentSectionId = quiz.sectionId;
      sectionStartCol = currentCol;
      sectionNumber++;
      quizNumber = 0; // Reset quiz number for new section
    }
    
    // Track quiz changes
    const quizKey = `${quiz.sectionId}_${quiz.quizId}`;
    if (currentQuizId !== quizKey) {
      currentQuizId = quizKey;
      quizNumber++;
      quizStartCol = currentCol;
    }
    
    // Set headers for each level
    const moduleName = `Module ${moduleNumber}`;
    const sectionName = `Section ${sectionNumber}`;
    const quizName = `Quiz ${quizNumber}: ${quiz.quizName || ''}`.trim();
    
    // Module header (top level, spans all quizzes in module)
    headerRow1[`col_${currentCol}_score`] = moduleName;
    headerRow1[`col_${currentCol + 1}_score`] = moduleName;
    
    // Section header (second level, spans all quizzes in section)
    headerRow2[`col_${currentCol}_score`] = sectionName;
    headerRow2[`col_${currentCol + 1}_score`] = sectionName;
    
    // Quiz header (third level, spans both score and attempts)
    headerRow3[`col_${currentCol}_score`] = quizName;
    headerRow3[`col_${currentCol + 1}_score`] = "";
    
    // Score/Attempts (bottom level, individual columns)
    headerRow4[`col_${currentCol}_score`] = 'Score (in %)';
    headerRow4[`col_${currentCol + 1}_score`] = 'Total attempts';
    
    // Add merge for quiz header (span 2 columns for score and attempts)
    if (currentCol >= 0) {
      // Use currentCol directly since we're already tracking the correct position
      const startCol = currentCol + 3;  // +3 accounts for S.No, Name, Email columns
      merges.push({
        s: { r: 2, c: startCol },     // Row 3 (0-based) for quiz names
        e: { r: 2, c: startCol + 1 }  // Span 2 columns (score + attempts)
      });
    }
    
    // Check for module change
    if (currentModuleId !== quiz.moduleId) {
      if (currentModuleId !== '') {
        // Add merge for previous module (spanning all its columns)
        merges.push({
          s: { r: 0, c: moduleStartCol + 3 },
          e: { r: 0, c: currentCol + 3 - 1 }
        });
      }
      currentModuleId = quiz.moduleId;
      moduleStartCol = currentCol;
      moduleNumber++;
      
      // Reset section tracking on new module
      currentSectionId = '';
      sectionNumber = 0;
    }
    
    // Check for section change
    if (currentSectionId !== quiz.sectionId) {
      if (currentSectionId !== '') {
        // Add merge for previous section (spanning all its columns)
        merges.push({
          s: { r: 1, c: sectionStartCol + 3 },
          e: { r: 1, c: currentCol + 3 - 1 }
        });
      }
      currentSectionId = quiz.sectionId;
      sectionStartCol = currentCol;
      sectionNumber++;
      quizNumbers.clear(); // Reset quiz numbers for new section
    }
    
    // Add merge for quiz header (span 2 columns for score and attempts)
    merges.push({
      s: { r: 2, c: currentCol + 3 },
      e: { r: 2, c: currentCol + 4 }    // Span 2 columns (score + attempts)
    });
    
    currentCol += 2; // Move to next quiz (2 columns per quiz)
  });
  // Add final merges for the last module and section
  if (currentModuleId) {
    merges.push({
      s: { r: 0, c: moduleStartCol + 3 },
      e: { r: 0, c: currentCol + 3 - 1 }
    });
  }
  if (currentSectionId) {
    merges.push({
      s: { r: 1, c: sectionStartCol + 3 },
      e: { r: 1, c: currentCol + 3 - 1 }
    });
  }
  
  // Add final merges for the last module and section
  if (currentModuleId) {
    merges.push({
      s: { r: 0, c: moduleStartCol + 3 },
      e: { r: 0, c: currentCol + 3 - 1 }
    });
  }
  if (currentSectionId) {
    merges.push({
      s: { r: 1, c: sectionStartCol + 3 },
      e: { r: 1, c: currentCol + 3 - 1 }
    });
  }

  // Add all header rows to results
  results.push(headerRow1, headerRow2, headerRow3, headerRow4);
  
  // Add student data rows
  data.forEach((student, rowIndex) => {
    const rowData: TransformedData = {
      'S.No.': rowIndex + 1,
      'Name': student.name || 'Unknown',
      'Email': student.email || ''
    };
    
    // Initialize all quiz columns with empty values
    orderedQuizzes.forEach((_, index) => {
      const scoreKey = `col_${index * 2}_score`;
      const attemptsKey = `col_${index * 2 + 1}_score`;
      rowData[scoreKey] = '';
      rowData[attemptsKey] = '';
    });
    
    // Fill in actual scores and attempts
    if (student.quizScores?.length) {
      student.quizScores.forEach(quiz => {
        const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
        const colIndex = quizColumnMap.get(key);
        
        if (colIndex !== undefined) {
          const scoreKey = `col_${colIndex}_score`;
          const attemptsKey = `col_${colIndex + 1}_score`;
          rowData[scoreKey] = quiz.maxScore ?? '';
          rowData[attemptsKey] = quiz.attempts ?? '';
        }
      });
    }
    
    results.push(rowData);
  });
  
  return results;
}

export function generateExcel(data: StudentData[], filename: string = 'quiz_scores.xlsx'): void {

  try {
    const transformedData = transformDataForExcel(data);
    if (!transformedData.length) {
      console.warn('No data to export');
      return;
    }

    // Convert to array of arrays for better control
    const aoa: any[][] = [];
    
    transformedData.forEach(row => {
      const rowArray = [row['S.No.'], row['Name'], row['Email']];
      
      // Add all the quiz score columns in order
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
    
    // Set up merge ranges
    const merges = [];
    let currentModuleStart = 3; // Start after S.No., Name, Email
    let currentSectionStart = 3;
    let currentModuleId = '';
    let currentSectionId = '';

    // Process quizzes to create merge ranges
    if (data.length > 0 && data[0].quizScores) {
      data[0].quizScores.forEach((quiz, index) => {
        const quizStartCol = 3 + (index * 2); // Each quiz takes 2 columns
        
        // Module merge
        if (quiz.moduleId !== currentModuleId) {
          if (currentModuleId) {
            merges.push({
              s: { r: 0, c: currentModuleStart },
              e: { r: 0, c: quizStartCol - 1 }
            });
          }
          currentModuleId = quiz.moduleId;
          currentModuleStart = quizStartCol;
        }
        
        // Section merge
        if (quiz.sectionId !== currentSectionId) {
          if (currentSectionId) {
            merges.push({
              s: { r: 1, c: currentSectionStart },
              e: { r: 1, c: quizStartCol - 1 }
            });
          }
          currentSectionId = quiz.sectionId;
          currentSectionStart = quizStartCol;
        }
        
        // Quiz merge (spans 2 columns)
        merges.push({
          s: { r: 2, c: quizStartCol },
          e: { r: 2, c: quizStartCol + 1 }
        });
      });

      // Add final merges for the last module and section
      if (currentModuleId) {
        merges.push({
          s: { r: 0, c: currentModuleStart },
          e: { r: 0, c: 3 + (data[0].quizScores.length * 2) - 1 }
        });
      }
      if (currentSectionId) {
        merges.push({
          s: { r: 1, c: currentSectionStart },
          e: { r: 1, c: 3 + (data[0].quizScores.length * 2) - 1 }
        });
      }
    }

    // Apply merges
    ws['!merges'] = merges;
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // S.No.
      { wch: 18 }, // Name
      { wch: 30 }, // Email
      ...Array((data[0]?.quizScores?.length || 0) * 2).fill({ wch: 12 }) // Quiz columns
    ];

    // Apply merges
    ws['!merges'] = merges;

    // Add worksheet to workbook and save
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz Scores');
    XLSX.writeFile(wb, filename);
    
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw error;
  }
}