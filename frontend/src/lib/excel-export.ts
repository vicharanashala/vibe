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
    headerRow4[`col_${currentCol}_score`] = 'Score';
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
  console.log('Generating Excel for data:', data);
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

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // S.No.
      { wch: 15 }, // Name
      { wch: 30 }  // Email
    ];
    
    // Add widths for score and attempts columns
    const numQuizCols = aoa[0].length - 3;
    for (let i = 0; i < numQuizCols; i++) {
      colWidths.push({ wch: 12 });
    }
    
    ws['!cols'] = colWidths;
    
    // Create merge ranges for headers
    const merges: any[] = [];
    
    if (aoa.length >= 3) {
      // Rebuild structure using moduleId and sectionId for proper grouping
      const quizColumns = new Map<string, QuizColumn>();
      const moduleOrder = new Map<string, number>();
      const sectionOrder = new Map<string, number>();
      let moduleCounter = 0;
      let sectionCounter = 0;
      
      data.forEach(student => {
        if (!student.quizScores?.length) return;
        
        student.quizScores.forEach(quiz => {
          const key = `${quiz.moduleId}_${quiz.sectionId}_${quiz.quizId}`;
          if (!quizColumns.has(key)) {
            const moduleKey = quiz.moduleId;
            const sectionKey = quiz.sectionId;
            
            if (!moduleOrder.has(moduleKey)) {
              moduleOrder.set(moduleKey, moduleCounter++);
            }
            
            if (!sectionOrder.has(sectionKey)) {
              sectionOrder.set(sectionKey, sectionCounter++);
            }
            
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
      
      // Group by moduleId and sectionId
      const moduleStructure: { [moduleId: string]: { [sectionId: string]: QuizColumn[] } } = {};
      
      quizColumns.forEach(col => {
        const moduleKey = col.moduleId;
        const sectionKey = col.sectionId;
        
        if (!moduleStructure[moduleKey]) {
          moduleStructure[moduleKey] = {};
        }
        
        if (!moduleStructure[moduleKey][sectionKey]) {
          moduleStructure[moduleKey][sectionKey] = [];
        }
        
        moduleStructure[moduleKey][sectionKey].push(col);
      });
      
      const sortedModuleIds = Object.keys(moduleStructure).sort((a, b) => {
        return (moduleOrder.get(a) || 0) - (moduleOrder.get(b) || 0);
      });
      
      let currentCol = 3; // Start after S.No, Name, Email
      
      // Calculate merges for modules and sections
      sortedModuleIds.forEach(moduleId => {
        const sections = moduleStructure[moduleId];
        const sectionIds = Object.keys(sections).sort((a, b) => {
          return (sectionOrder.get(a) || 0) - (sectionOrder.get(b) || 0);
        });
        
        let moduleColSpan = 0;
        const moduleStartCol = currentCol;
        
        sectionIds.forEach(sectionId => {
          const quizzes = sections[sectionId];
          const sectionColSpan = quizzes.length * 2;
          const sectionStartCol = currentCol;
          
          // Add section merge if it spans multiple columns
          if (sectionColSpan > 1) {
            merges.push({
              s: { r: 1, c: sectionStartCol },
              e: { r: 1, c: sectionStartCol + sectionColSpan - 1 }
            });
          }
          
          moduleColSpan += sectionColSpan;
          currentCol += sectionColSpan;
        });
        
        // Add module merge if it spans multiple columns
        if (moduleColSpan > 1) {
          merges.push({
            s: { r: 0, c: moduleStartCol },
            e: { r: 0, c: moduleStartCol + moduleColSpan - 1 }
          });
        }
      });
    }
    
    // Get the worksheet range
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Apply header styles with different formatting for each row
    for (let r = 0; r <= 3 && r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's', s: {} };
        }
        
        // Initialize style object if it doesn't exist
        ws[cellRef].s = ws[cellRef].s || {};
        
        // Apply different styles based on row
        if (r === 0) {
          // Module row - Dark blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '2F5597' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else if (r === 1) {
          // Section row - Medium blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '3B78D8' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else if (r === 2) {
          // Quiz row - Light grey with black text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: '000000' } },
            fill: { fgColor: { rgb: 'F2F2F2' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else {
          // Score/Attempts row - Light blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        }
      }
    }
    
    // Apply data cell styling
    for (let r = 4; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's', s: {} };
        }
        ws[cellRef].s = ws[cellRef].s || {};
        Object.assign(ws[cellRef].s, {
          border: {
            top: { style: 'thin', color: { rgb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
            left: { style: 'thin', color: { rgb: 'D9D9D9' } },
            right: { style: 'thin', color: { rgb: 'D9D9D9' } }
          },
          alignment: { horizontal: 'center', vertical: 'center' }
        });
      }
    }
    
    // Apply the merges after all styles are set
    ws['!merges'] = merges;
    
    // Apply styles to all header rows
    for (let r = 0; r <= 3 && r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's', s: {} };
        }
        
        // Initialize style object if it doesn't exist
        ws[cellRef].s = ws[cellRef].s || {};
        
        // Apply different styles based on row
        if (r === 0) {
          // Module row - Dark blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '2F5597' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else if (r === 1) {
          // Section row - Medium blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '3B78D8' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else if (r === 2) {
          // Quiz row - Light grey with black text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: '000000' } },
            fill: { fgColor: { rgb: 'F2F2F2' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        } else {
          // Score/Attempts row - Light blue with white text
          Object.assign(ws[cellRef].s, {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          });
        }
      }
    }
    
    // Add data styling
    const dataStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };
    
    for (let r = 3; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }
        ws[cellRef].s = dataStyle;
      }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz Scores');
    XLSX.writeFile(wb, filename);
    
    console.log(`Excel file "${filename}" generated successfully`);
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw error;
  }
}