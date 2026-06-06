import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use the bundled worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Grade mappings
const GRADE_POINTS = {
  'A+': 4.3, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'F': 0.0,
};

const NON_GRADED = new Set(['P', 'IP', 'I', 'W', '-', '']);

// Extract text from PDF
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Build text preserving line breaks based on Y position
    let lastY = null;
    const lines = [];
    let currentLine = '';

    for (const item of textContent.items) {
      const y = item.transform[5];

      // New line if Y position changed significantly
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += (currentLine && item.str ? ' ' : '') + item.str;
      }

      lastY = y;
    }

    // Add last line
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    fullText += lines.join('\n') + '\n';
  }

  return fullText;
}

// Clean text by removing boilerplate
function cleanText(rawText) {
  const boilerplate = new Set([
    'singapore management university',
    'course description',
    'units grade points',
    'taken/earned per unit',
    'grade',
    'page 1 of 2',
    'page 2 of 2',
    'continued',
    'end of transcript',
  ]);

  const lines = rawText.split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (boilerplate.has(line.toLowerCase())) return false;
      if (/^(Name:|Date of Enrolment:|Date of Birth:)/.test(line)) return false;
      return true;
    });

  return lines;
}

// Parse enrollment year from header
function parseEnrolmentYear(lines) {
  for (const line of lines.slice(0, 10)) {
    const match = line.match(/Date of Enrolment:\s*\d{1,2} \w+ (\d{4})/);
    if (match) return parseInt(match[1]);
  }
  return 2022; // fallback
}

// Parse term header like '2022-23 Term 1'
function parseTermHeader(line) {
  const match = line.match(/^(\d{4}-\d{2}) Term (\d+[A-Z]?)$/);
  if (match) {
    return { academicYear: match[1], term: match[2] };
  }
  return null;
}

// Parse course line
function parseCourseLine(line) {
  const match = line.match(/^(.+?)\s+([\d.]+)\s*\/\s*([\d.]+)\s+([A-Z][+\-]?|IP|I|P|W|-)\s+([\d.]+|-)\s*$/);

  if (!match) return null;

  const name = match[1].trim();
  const unitsTaken = parseFloat(match[2]);
  const unitsEarned = parseFloat(match[3]);
  const grade = match[4].trim();
  const gradePointsRaw = match[5].trim();
  const gradePoints = gradePointsRaw !== '-' ? parseFloat(gradePointsRaw) : null;

  return {
    name,
    units_taken: unitsTaken,
    units_earned: unitsEarned,
    grade,
    grade_points: gradePoints,
    in_progress: grade === 'IP',
    graded: !NON_GRADED.has(grade),
  };
}

// Parse term total line
function parseTermTotal(line) {
  const match = line.match(/Term Grade Point Average\s*=\s*([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

// Calculate semester label
function semesterLabel(enrolmentYear, academicYearStr, termNum) {
  const startYear = parseInt(academicYearStr.split('-')[0]);
  const yearNum = startYear - enrolmentYear + 1;

  const termMatch = termNum.match(/(\d+)/);
  const termInt = termMatch ? parseInt(termMatch[1]) : 0;

  return `${yearNum}.${termInt}`;
}

// Parse cumulative stats
function parseCumulative(lines) {
  const cumulative = {};
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith('Cumulative Total')) {
      inSection = true;
      continue;
    }

    if (inSection) {
      let match = line.match(/Cumulative Grade Point Average\s*=\s*([\d.]+)/);
      if (match) cumulative.gpa = parseFloat(match[1]);

      match = line.match(/Course Units Earned\s*=\s*([\d.]+)/);
      if (match) cumulative.units_earned = parseFloat(match[1]);

      match = line.match(/Course Units Exempted\s*=\s*([\d.]+)/);
      if (match) cumulative.units_exempted = parseFloat(match[1]);

      match = line.match(/Course Units Accepted for Transfer\s*=\s*([\d.]+)/);
      if (match) cumulative.units_transferred = parseFloat(match[1]);

      if (line.startsWith('Grading System') || line.startsWith('Student Status')) {
        break;
      }
    }
  }

  return cumulative;
}

// Validate if PDF is an SMU transcript
function validateTranscript(rawText, semesters, cumulative) {
  const text = rawText.toLowerCase();

  // Check for SMU-specific markers
  const hasSMUHeader = text.includes('singapore management university');
  const hasTranscriptMarkers = text.includes('term') && text.includes('grade');

  // Check if we found actual data
  const hasValidSemesters = semesters.length > 0 && semesters.some(s => s.courses.length > 0);
  const hasValidCumulative = cumulative && cumulative.gpa !== undefined;

  if (!hasSMUHeader) {
    throw new Error('This does not appear to be an SMU transcript. Please upload your official SMU academic transcript.');
  }

  if (!hasTranscriptMarkers) {
    throw new Error('Unable to find transcript data in this PDF. Please ensure you uploaded an official SMU academic transcript.');
  }

  if (!hasValidSemesters && !hasValidCumulative) {
    throw new Error('No academic data found in this transcript. Please check that you uploaded the correct file.');
  }

  if (!hasValidSemesters) {
    throw new Error('No semester data found. Please ensure this is a valid SMU transcript with grades.');
  }
}

// Main parser function
export async function parseTranscript(file) {
  let rawText = '';
  let lines = [];
  let semesters = [];
  let cumulative = {};

  try {
    rawText = await extractTextFromPDF(file);
    lines = cleanText(rawText);

    const enrolYear = parseEnrolmentYear(lines);
    cumulative = parseCumulative(lines);

    let currentTerm = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for term header
      const termMatch = parseTermHeader(line);
      if (termMatch) {
        if (currentTerm) {
          semesters.push(currentTerm);
        }

        const label = semesterLabel(enrolYear, termMatch.academicYear, termMatch.term);

        currentTerm = {
          label,
          academic_year: termMatch.academicYear,
          term: termMatch.term,
          type: 'regular',
          term_gpa: null,
          courses: [],
        };
        continue;
      }

      if (currentTerm) {
        // Check for special term types
        if (line === 'Leave of Absence') {
          currentTerm.type = 'leave_of_absence';
          continue;
        }

        if (line.includes('International Student Exchange Programme') ||
            line.includes('Exchange Programme') ||
            line.includes('Internship')) {
          currentTerm.type = 'exchange';
          continue;
        }

        // Check for subtitle lines (starting with "- ")
        if (line.startsWith('- ') && currentTerm.courses.length > 0) {
          const subtitle = line.substring(2).trim();
          const lastCourse = currentTerm.courses[currentTerm.courses.length - 1];
          lastCourse.name += ` (${subtitle})`;
          continue;
        }

        // Check for term total
        if (line.startsWith('Term Total:')) {
          const gpa = parseTermTotal(line);
          if (gpa && gpa > 0) {
            currentTerm.term_gpa = gpa;
          }
          continue;
        }

        // Try to parse as course line
        const course = parseCourseLine(line);
        if (course) {
          currentTerm.courses.push(course);
          continue;
        }
      }

      // Stop at cumulative section
      if (line.startsWith('Cumulative Total') || line.startsWith('Grading System')) {
        break;
      }
    }

    // Add last term
    if (currentTerm) {
      semesters.push(currentTerm);
    }

    // Determine chart inclusion
    for (const sem of semesters) {
      const hasGradedCourses = sem.courses.some(c => c.graded);
      const isExchangeOrInternship = sem.type === 'exchange' || sem.type === 'leave_of_absence';

      // Include if: (has graded courses AND has term GPA) OR is exchange/internship/LOA
      sem.included_in_gpa_chart =
        isExchangeOrInternship ||
        (hasGradedCourses && sem.term_gpa !== null && sem.term_gpa > 0);
    }

    // Validate before returning
    validateTranscript(rawText, semesters, cumulative);

    // Generate chart data
    const chartData = semesters
      .filter(sem => sem.included_in_gpa_chart)
      .map(sem => {
        const note = (sem.type === 'exchange' || sem.type === 'leave_of_absence') ? 'Exchange / Internship' : '';
        const [year, term] = sem.label.split('.');
        return {
          sem: sem.label,
          label: `Y${year} S${term}`,
          term_gpa: sem.term_gpa,
          courses: sem.courses,
          note,
        };
      });

    return {
      semesters,
      cumulative,
      chart_data: chartData,
    };

  } catch (error) {
    console.error('Error parsing transcript:', error);
    console.log('Debug - Raw text preview:', rawText?.substring(0, 500));
    console.log('Debug - Lines count:', lines?.length);
    console.log('Debug - Semesters found:', semesters?.length);
    console.log('Debug - Cumulative data:', cumulative);
    throw new Error(`Failed to parse transcript: ${error.message}`);
  }
}
