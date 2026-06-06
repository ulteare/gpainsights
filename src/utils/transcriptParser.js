import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
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

// Main parser function
export async function parseTranscript(file) {
  try {
    const rawText = await extractTextFromPDF(file);
    const lines = cleanText(rawText);

    const enrolYear = parseEnrolmentYear(lines);
    const cumulative = parseCumulative(lines);

    const semesters = [];
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

        if (line.includes('International Student Exchange Programme')) {
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
      sem.included_in_gpa_chart = hasGradedCourses && sem.term_gpa !== null && sem.term_gpa > 0;
    }

    // Generate chart data
    const chartData = semesters
      .filter(sem => sem.included_in_gpa_chart)
      .map(sem => {
        const note = sem.type === 'exchange' ? 'Exchange / Internship' : '';
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
    throw new Error(`Failed to parse transcript: ${error.message}`);
  }
}
