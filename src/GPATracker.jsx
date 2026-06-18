import React, { useRef, useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useSemesters } from './hooks/useSemesters';
import { useUserSettings } from './hooks/useUserSettings';
import SemesterManager from './components/SemesterManager';
import { TranscriptUpload } from './TranscriptUpload';
import { JsonUpload } from './JsonUpload';
import styles from './GPATracker.module.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const GPATracker = () => {
  const chartRef = useRef(null);
  const { semesters: data, loading, error, refetch } = useSemesters();
  const { settings } = useUserSettings();
  const [viewMode, setViewMode] = useState('visualization'); // 'visualization' or 'table'
  const [showUpload, setShowUpload] = useState(false);
  const [showJsonUpload, setShowJsonUpload] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTermGpa, setShowTermGpa] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [gradeModalData, setGradeModalData] = useState(null);
  const [showGradeDistCallout, setShowGradeDistCallout] = useState(true);
  const [semesterModalData, setSemesterModalData] = useState(null);
  const [showGpaChartCallout, setShowGpaChartCallout] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showViewSwitchConfirm, setShowViewSwitchConfirm] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState(null);

  // Helper function to round to 2 decimal places (conventional rounding, not banker's rounding)
  const round2dp = (num) => {
    return Math.round(num * 100) / 100;
  };

  // Check if browser is Chrome
  const isChrome = () => {
    const ua = navigator.userAgent;
    return ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('Arc');
  };
  const shouldShowWarning = !isChrome() && showBrowserWarning;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If loading or error, show appropriate state
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8C7B68' }}>
        Loading your GPA data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#C33' }}>
        Error loading data: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <>
        {shouldShowWarning && (
          <div className={styles.browserWarning}>
            <span>⚠️ For the best experience uploading transcripts, please use Google Chrome</span>
            <button
              onClick={() => setShowBrowserWarning(false)}
              className={styles.warningCloseButton}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Get insights in one step</h2>
          <button
            onClick={() => setShowUpload(true)}
            className={styles.ctaButton}
          >
            Upload Your Transcript
          </button>
          <p className={styles.emptyNote}>
            For SMU students only • Upload non-official transcript
          </p>

          <div className={styles.privacyNotice}>
            <p>By uploading your transcript, you acknowledge and consent that your academic data will be stored and processed solely for the purpose of visualizing your GPA progress. We are committed to protecting your personal data in accordance with Singapore's Personal Data Protection Act (PDPA).</p>
          </div>

          <div className={styles.instructionsGrid}>
            <div className={styles.instructionStep}>
              <p>1. Go to SMU Oasis and search for unofficial transcript</p>
              <img src="/assets/smu_instructions/oasis1.png" alt="SMU Oasis search" />
            </div>
            <div className={styles.instructionStep}>
              <p>2. Click 'run report'</p>
              <img src="/assets/smu_instructions/oasis2.png" alt="Run report button" />
            </div>
            <div className={styles.instructionStep}>
              <p>3. Your request will be queued. Wait 1-2 mins and your transcript will open automatically in a new tab.</p>
              <img src="/assets/smu_instructions/oasis3.png" alt="Queued page" />
            </div>
          </div>
        </div>
        {showUpload && (
          <div className={styles.overlay}>
            <div className={styles.uploadModal}>
              <button
                onClick={() => setShowUpload(false)}
                className={styles.closeButton}
                aria-label="Close"
              >
                ×
              </button>
              <TranscriptUpload
                onSuccess={() => {
                  setShowUpload(false);
                  refetch();
                }}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Get grade scale (4.3 for SMU, 5.0 for NUS/NTU)
  const gradeScale = settings?.grade_scale || 4.0;
  const isSMU = gradeScale === 4.0;
  const maxGradeScale = isSMU ? 4.3 : 5.0;

  // Helper function to cap GPA at grade scale
  const capGPA = (gpa) => Math.min(gpa, maxGradeScale);

  // Determine which semesters are special (exchange/internship)
  const exchangeSems = new Set(
    data.filter(d => d.note && d.note.toLowerCase().includes('exchange') || d.note.toLowerCase().includes('internship'))
      .map(d => d.sem)
  );

  // Calculate dynamic y-axis range with capped GPAs
  const cappedGpas = data.map(d => capGPA(d.gpa));

  // On mobile or when term GPA hidden, only consider cumulative GPA; otherwise consider both
  let minGpa, maxGpa;
  if (isMobile || !showTermGpa) {
    minGpa = Math.min(...cappedGpas);
    maxGpa = Math.max(...cappedGpas);
  } else {
    const cappedTermGpas = data.map(d => d.term_gpa ? capGPA(d.term_gpa) : null).filter(g => g !== null);
    const allGpas = [...cappedGpas, ...cappedTermGpas];
    minGpa = Math.min(...allGpas);
    maxGpa = Math.max(...allGpas);
  }

  // Calculate y-axis min/max with 0.1 padding
  const yMin = Math.max(0.0, Math.floor((minGpa - 0.1) * 10) / 10);

  // For SMU: cap at 4.0 unless there are values > 4.0, then round up to nearest 0.1
  let yMax;
  if (isSMU) {
    if (maxGpa > 4.0) {
      // User has grades above 4.0, round up to nearest 0.1 (no padding), cap at 4.3
      yMax = Math.min(maxGradeScale, Math.ceil(maxGpa * 10) / 10);
    } else {
      // Cap at 4.0, don't show padding above 4.0
      const calculatedMax = Math.ceil((maxGpa + 0.1) * 10) / 10;
      yMax = Math.min(4.0, calculatedMax);
    }
  } else {
    // For NUS/NTU, always use normal padding
    yMax = Math.min(maxGradeScale, Math.ceil((maxGpa + 0.1) * 10) / 10);
  }

  // Calculate stats for display with capped values
  const startingGpa = capGPA(data[0].gpa);
  const currentGpa = capGPA(data[data.length - 1].gpa);
  const absoluteGrowth = currentGpa - startingGpa;
  const percentageGrowth = (absoluteGrowth / startingGpa) * 100;
  const startingLabel = data[0].label;
  const currentLabel = data[data.length - 1].label;

  // Calculate time span
  const startYear = parseInt(data[0].sem.split('.')[0]);
  const endYear = parseInt(data[data.length - 1].sem.split('.')[0]);
  const yearSpan = endYear - startYear + 1;

  // Calculate grade distribution
  const gradeOrder = isSMU
    ? ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+']
    : ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S'];

  // Get all courses with letter grades from all semesters
  const allCourses = data.flatMap(sem => sem.courses || []);
  const gradedCourses = allCourses.filter(course =>
    course.grade && gradeOrder.includes(course.grade)
  );

  // Count frequency of each grade
  const gradeCounts = {};
  gradeOrder.forEach(grade => gradeCounts[grade] = 0);
  gradedCourses.forEach(course => {
    if (gradeCounts[course.grade] !== undefined) {
      gradeCounts[course.grade]++;
    }
  });

  // Find lowest grade and determine x-axis bounds (±2 grades, max at A+)
  const lowestGradeIndex = gradeOrder.findIndex(grade => gradeCounts[grade] > 0);
  const startIndex = Math.max(0, lowestGradeIndex - 2);
  const endIndex = gradeOrder.indexOf('A+');
  const displayGrades = gradeOrder.slice(startIndex, endIndex + 1);
  const displayCounts = displayGrades.map(grade => gradeCounts[grade]);

  // Define grade bands based on school
  const bands = isSMU ? [
    { label: 'Peak 🏔️', min: 3.90, max: 4.30, fill: 'rgba(62,35,10,0.38)', labelColor: '#FAF8F5', fontWeight: 500 },
    { label: 'Summa Cum Laude 🥇', min: 3.80, max: 3.90, fill: 'rgba(95,58,18,0.28)', labelColor: '#FAF8F5', fontWeight: 500 },
    { label: "Dean's List 📖", min: 3.70, max: 3.80, fill: 'rgba(140,90,35,0.20)', labelColor: 'rgba(140,100,50,1)', fontWeight: 500 },
    { label: 'Magna Cum Laude 🥈', min: 3.60, max: 3.70, fill: 'rgba(180,130,65,0.14)', labelColor: 'rgba(120,85,40,1)', fontWeight: 500 },
    { label: 'Cum Laude 🥉', min: 3.40, max: 3.60, fill: 'rgba(210,170,105,0.09)', labelColor: 'rgba(100,70,35,1)', fontWeight: 500 },
    { label: 'High Merit', min: 3.20, max: 3.40, fill: 'rgba(225,195,145,0.06)', labelColor: 'rgba(90,60,30,1)', fontWeight: 500 },
    { label: 'Merit', min: 3.00, max: 3.20, fill: 'rgba(235,215,175,0.04)', labelColor: 'rgba(80,50,25,1)', fontWeight: 500 },
  ] : [
    // NUS/NTU grade bands - using SMU's gradient starting from second highest
    { label: 'First Class 🥇', min: 4.50, max: 5.00, fill: 'rgba(95,58,18,0.28)', labelColor: '#FAF8F5', fontWeight: 500 },
    { label: 'Second Upper 🥈', min: 4.00, max: 4.50, fill: 'rgba(140,90,35,0.20)', labelColor: 'rgba(140,100,50,1)', fontWeight: 500 },
    { label: 'Second Lower 🥉', min: 3.50, max: 4.00, fill: 'rgba(180,130,65,0.14)', labelColor: 'rgba(120,85,40,1)', fontWeight: 500 },
    { label: 'Third Class', min: 3.20, max: 3.50, fill: 'rgba(210,170,105,0.09)', labelColor: 'rgba(100,70,35,1)', fontWeight: 500 },
  ];

  const bandPlugin = {
    id: 'bandPlugin',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;

      // Draw grade bands
      bands.forEach(band => {
        const bMin = Math.max(band.min, yMin);
        const bMax = Math.min(band.max, yMax);
        if (bMin >= yMax || bMax <= yMin) return;
        const yTop = y.getPixelForValue(bMax);
        const yBottom = y.getPixelForValue(bMin);
        ctx.save();
        ctx.fillStyle = band.fill;
        ctx.fillRect(left, yTop, right - left, yBottom - yTop);
        ctx.restore();
      });

      // Draw 4.0 ceiling line for SMU if there are grades above 4.0
      if (isSMU && yMax > 4.0) {
        const y4_0 = y.getPixelForValue(4.0);
        ctx.save();
        ctx.strokeStyle = '#b6d4f8'; // Light blue
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dotted line
        ctx.beginPath();
        ctx.moveTo(left, y4_0);
        ctx.lineTo(right, y4_0);
        ctx.stroke();
        ctx.restore();
      }
    },
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      ctx.save();

      bands.forEach(band => {
        const bMin = Math.max(band.min, yMin);
        const bMax = Math.min(band.max, yMax);
        if (bMin >= yMax || bMax <= yMin) return;
        const yTop = y.getPixelForValue(bMax);
        const yBottom = y.getPixelForValue(bMin);
        const bandH = yBottom - yTop;
        if (bandH < 10) return;
        // Position label at bottom of band with small padding
        const labelY = yBottom - 6;
        const labelX = isMobile ? right - 4 : right - 6;
        ctx.font = `${band.fontWeight} ${isMobile ? 9 : 10}px 'Jost', sans-serif`;
        ctx.fillStyle = band.labelColor;
        ctx.textAlign = 'right';
        ctx.fillText(band.label.toUpperCase(), labelX, labelY);
      });

      ctx.restore();
    }
  };

  const mobileLabelsPlugin = {
    id: 'mobileLabelsPlugin',
    afterDatasetsDraw(chart) {
      if (!isMobile) return;

      const { ctx, data: chartData, scales: { x, y } } = chart;
      // On mobile, Cumulative GPA is the only dataset (index 0)
      const dataset = chartData.datasets[0];

      ctx.save();
      ctx.font = '500 11px "Jost", sans-serif';
      ctx.fillStyle = '#2C2417';
      ctx.textAlign = 'center';

      dataset.data.forEach((value, index) => {
        if (value === null) return; // Skip null values

        const xPos = x.getPixelForValue(index);
        const yPos = y.getPixelForValue(value);

        // Show label below for high grades to avoid overflow
        // SMU: 3.96+, NUS/NTU: 4.91+
        const isHighGrade = (isSMU && value >= 3.96) || (!isSMU && value >= 4.91);
        const labelOffset = isHighGrade ? 16 : -12;

        ctx.fillText(round2dp(value).toFixed(2), xPos, yPos + labelOffset);
      });

      ctx.restore();
    }
  };

  const chartData = {
    labels: data.map(d => d.sem),
    datasets: [
      // Only show Term GPA line on desktop and when checkbox is checked
      ...(!isMobile && showTermGpa ? [{
        label: 'Term GPA',
        data: data.map(d => d.term_gpa ? capGPA(d.term_gpa) : null),
        fill: false,
        borderColor: 'rgba(107, 78, 42, 0.3)',
        borderWidth: 2,
        tension: 0,
        pointBackgroundColor: data.map(d => d.term_gpa ? 'rgba(107, 78, 42, 0.3)' : 'transparent'),
        pointBorderColor: data.map(d => d.term_gpa ? 'rgba(107, 78, 42, 0.3)' : 'transparent'),
        pointBorderWidth: 0,
        pointRadius: data.map(d => d.term_gpa ? 5 : 0),
        pointHoverRadius: data.map(d => d.term_gpa ? 7 : 0),
        spanGaps: false,
      }] : []),
      {
        label: 'Cumulative GPA',
        data: data.map(d => capGPA(d.gpa)),
        fill: false,
        borderColor: '#6B4E2A',
        borderWidth: 2.5,
        tension: 0,
        pointBackgroundColor: data.map(d => exchangeSems.has(d.sem) ? '#ebe7e2' : '#6B4E2A'),
        pointBorderColor: data.map(d => exchangeSems.has(d.sem) ? '#6B4E2A' : '#6B4E2A'),
        pointBorderWidth: data.map(d => exchangeSems.has(d.sem) ? 2.5 : 0),
        pointRadius: 7,
        pointHoverRadius: 9,
      }
    ]
  };

  const handleViewModeChange = (newMode) => {
    if (hasUnsavedChanges && viewMode === 'table') {
      setPendingViewMode(newMode);
      setShowViewSwitchConfirm(true);
    } else {
      setViewMode(newMode);
    }
  };

  const confirmViewSwitch = () => {
    setViewMode(pendingViewMode);
    setShowViewSwitchConfirm(false);
    setPendingViewMode(null);
    setHasUnsavedChanges(false);
  };

  const handleGpaChartClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const semester = data[index];
      setSemesterModalData(semester);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleGpaChartClick,
    onHover: (event, chartElement) => {
      event.native.target.style.cursor = chartElement.length > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: isMobile ? undefined : function(context) {
          let el = document.getElementById('custom-tooltip');
          if (!el) {
            el = document.createElement('div');
            el.id = 'custom-tooltip';
            el.className = styles.tooltipBox;
            el.style.display = 'none';
            document.querySelector(`.${styles.chartCanvasWrap}`).appendChild(el);
          }
          const model = context.tooltip;
          if (model.opacity === 0) {
            el.style.display = 'none';
            return;
          }
          const idx = model.dataPoints[0].dataIndex;
          const datasetIndex = model.dataPoints[0].datasetIndex;
          const d = data[idx];

          // Determine if this is Term GPA or Cumulative GPA based on dataset label
          const datasetLabel = context.chart.data.datasets[datasetIndex].label;

          if (datasetLabel === 'Term GPA') {
            // Hovering over Term GPA line - show only term GPA
            const termGpa = d.term_gpa ? capGPA(d.term_gpa) : null;
            if (termGpa) {
              el.innerHTML = `
                <div class="${styles.tooltipSem}">${d.label}</div>
                <div class="${styles.tooltipGpa}">Term: ${round2dp(termGpa).toFixed(2)}</div>
              `;
            }
          } else {
            // Hovering over Cumulative GPA line - show cumulative + term + band
            const gpa = capGPA(d.gpa);
            const band = bands.find(b => gpa >= b.min && gpa < b.max) || (gpa >= 3.9 ? bands[0] : null);
            el.innerHTML = `
              <div class="${styles.tooltipSem}">${d.label}${d.note ? ' · ' + d.note : ''}</div>
              <div class="${styles.tooltipGpa}">${round2dp(gpa).toFixed(2)}</div>
              ${d.term_gpa ? `<div class="${styles.tooltipTermGpa}">Term: ${round2dp(d.term_gpa).toFixed(2)}</div>` : ''}
              ${band ? `<div class="${styles.tooltipBand}">${band.label}</div>` : ''}
            `;
          }
          el.style.display = 'block';
          const canvasEl = context.chart.canvas;
          el.style.left = (canvasEl.offsetLeft + model.caretX - el.offsetWidth / 2) + 'px';
          el.style.top = (canvasEl.offsetTop + model.caretY - el.offsetHeight - 14) + 'px';
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(200,170,136,0.15)', drawTicks: false },
        border: { color: '#E0D6C8', width: 1 },
        ticks: { color: '#8C7B68', font: { family: "'Jost', sans-serif", size: isMobile ? 10 : 12 }, padding: 8 },
        offset: true,
        title: {
          display: true,
          text: 'Semester',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: isMobile ? 11 : 12, weight: 400 },
          padding: { top: 8 }
        }
      },
      y: {
        min: yMin,
        max: yMax,
        grid: { color: 'rgba(200,170,136,0.18)', drawTicks: false },
        border: { color: '#E0D6C8', width: 1, dash: [4, 4] },
        ticks: {
          display: !isMobile,
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12 },
          padding: 10,
          stepSize: 0.1,
          callback: v => v.toFixed(1)
        },
        title: {
          display: !isMobile,
          text: 'GPA',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12, weight: 400 },
          padding: { bottom: 8 }
        }
      }
    },
    layout: {
      padding: isMobile
        ? { top: 12, right: 8, bottom: 8, left: 8 }
        : { top: 16, right: 8, bottom: 8, left: 8 }
    }
  };

  // Grade Distribution Chart Data
  const maxCount = Math.max(...displayCounts);

  // Calculate grade distribution stats
  const totalCreditBearingCourses = gradedCourses.length;

  // Find all grades with the highest frequency (reverse to show highest grade first)
  const highestFreqGrades = gradeOrder.filter(grade => gradeCounts[grade] === maxCount).reverse();
  const highestFreqGradeDisplay = highestFreqGrades.join(', ');
  const highestFreqPercentage = totalCreditBearingCourses > 0 ? ((maxCount / totalCreditBearingCourses) * 100).toFixed(1) : '0.0';
  const uniqueGradesCount = Object.values(gradeCounts).filter(count => count > 0).length;

  const gradeDistributionData = {
    labels: displayGrades,
    datasets: [
      {
        type: 'bar',
        label: 'Number of Courses',
        data: displayCounts,
        backgroundColor: '#6B4E2A',
        borderColor: '#6B4E2A',
        borderWidth: 0,
      }
    ]
  };

  const handleBarClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const clickedGrade = displayGrades[index];

      // Get all courses with this grade
      const coursesWithGrade = allCourses
        .filter(course => course.grade === clickedGrade)
        .map(course => {
          // Find the semester this course belongs to
          const semester = data.find(sem =>
            sem.courses && sem.courses.some(c => c === course)
          );
          return {
            ...course,
            semester_label: semester?.label || '-'
          };
        });

      setGradeModalData({
        grade: clickedGrade,
        courses: coursesWithGrade
      });
    }
  };

  const gradeDistributionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleBarClick,
    onHover: (event, chartElement) => {
      event.native.target.style.cursor = chartElement.length > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: isMobile ? undefined : function(context) {
          let el = document.getElementById('grade-dist-tooltip');
          if (!el) {
            el = document.createElement('div');
            el.id = 'grade-dist-tooltip';
            el.className = styles.tooltipBox;
            el.style.display = 'none';
            document.querySelector(`.${styles.gradeDistChartWrap}`).appendChild(el);
          }
          const model = context.tooltip;
          if (model.opacity === 0) {
            el.style.display = 'none';
            return;
          }
          const idx = model.dataPoints[0].dataIndex;
          const grade = displayGrades[idx];
          const count = displayCounts[idx];
          const percentage = totalCreditBearingCourses > 0 ? ((count / totalCreditBearingCourses) * 100).toFixed(1) : '0.0';

          el.innerHTML = `
            <div class="${styles.tooltipSem}">Grade ${grade}</div>
            <div class="${styles.tooltipGpa}">${count} ${count === 1 ? 'course' : 'courses'}</div>
            <div class="${styles.tooltipTermGpa}">${percentage}% of total</div>
          `;
          el.style.display = 'block';
          const canvasEl = context.chart.canvas;
          el.style.left = (canvasEl.offsetLeft + model.caretX - el.offsetWidth / 2) + 'px';
          el.style.top = (canvasEl.offsetTop + model.caretY - el.offsetHeight - 14) + 'px';
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(200,170,136,0.15)', drawTicks: false },
        border: { color: '#E0D6C8', width: 1 },
        ticks: {
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: isMobile ? 10 : 12 },
          padding: 8
        },
        title: {
          display: true,
          text: 'Grade',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: isMobile ? 11 : 12, weight: 400 },
          padding: { top: 8 }
        }
      },
      y: {
        beginAtZero: true,
        max: maxCount + 1,
        grid: { color: 'rgba(200,170,136,0.18)', drawTicks: false },
        border: { color: '#E0D6C8', width: 1 },
        ticks: {
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: isMobile ? 10 : 12 },
          padding: 10,
          stepSize: 1,
          callback: v => Math.floor(v) === v ? v : ''
        },
        title: {
          display: !isMobile,
          text: 'Number of Courses',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12, weight: 400 },
          padding: { bottom: 8 }
        }
      }
    },
    layout: {
      padding: isMobile
        ? { top: 16, right: 8, bottom: 8, left: 8 }
        : { top: 16, right: 8, bottom: 8, left: 8 }
    }
  };

  return (
    <>
      <h2 className={styles.srOnly}>Cumulative GPA over semesters with grade band highlights.</h2>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Academic Progress</h1>
          <p>
            {viewMode === 'visualization' ? 'Cumulative GPA · All Semesters' : 'Your Grades · All Semesters'}
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.buttonGroup}>
            <div className={styles.viewToggle}>
              <button
                onClick={() => handleViewModeChange('visualization')}
                className={`${styles.toggleButton} ${viewMode === 'visualization' ? styles.toggleButtonActive : ''}`}
              >
                Visualization
              </button>
              <button
                onClick={() => handleViewModeChange('table')}
                className={`${styles.toggleButton} ${viewMode === 'table' ? styles.toggleButtonActive : ''}`}
              >
                Your Grades
              </button>
            </div>
            <div className={styles.uploadButtonWrapper}>
              <button
                onClick={() => setShowUpload(true)}
                className={styles.uploadButton}
              >
                Upload Transcript
              </button>
              {settings?.user_type === 'A' && (
                <button
                  onClick={() => setShowJsonUpload(true)}
                  className={styles.jsonUploadButton}
                  title="Admin: Upload JSON for troubleshooting"
                >
                  JSON
                </button>
              )}
              <div
                className={styles.infoIconWrapper}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <span className={styles.infoIcon}>ⓘ</span>
                {showTooltip && (
                  <div className={styles.tooltip}>
                    Uploading your academic transcript will override existing data.
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className={styles.badge}>
            Out of {settings?.grade_scale || 4.0}
          </span>
        </div>
      </div>

      {viewMode === 'visualization' ? (
        <>
          {showGpaChartCallout && (
            <div className={styles.gpaChartCallout}>
              <span>💡 Click on any point to view semester details</span>
              <button
                onClick={() => setShowGpaChartCallout(false)}
                className={styles.calloutCloseButton}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          <div className={styles.contentLayout}>
        <div className={styles.chartSection}>
          <div className={styles.chartCanvasWrap}>
            <Line
              ref={chartRef}
              key={`chart-${showTermGpa}`}
              data={chartData}
              options={options}
              plugins={[bandPlugin, mobileLabelsPlugin]}
              aria-label="Line chart of cumulative GPA from 3.62 to 3.94 across 8 semesters with coloured grade band regions"
            />
          </div>
          <div className={styles.legendRow}>
            {!isMobile && (
              <label className={styles.legendCheckbox}>
                <input
                  type="checkbox"
                  checked={showTermGpa}
                  onChange={(e) => setShowTermGpa(e.target.checked)}
                />
                <span>Show Term GPA</span>
              </label>
            )}
            {!isMobile && showTermGpa && (
              <>
                <span className={styles.legendItem}>
                  <span className={styles.legendLine}></span>
                  <span>Cumulative GPA</span>
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendLineFaint}></span>
                  <span>Term GPA</span>
                </span>
              </>
            )}
            <span className={styles.legendItem}>
              <span className={styles.legendDot}></span>
              <span>Regular semester</span>
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSpecialDot}></span>
              <span>Exchange / Internship</span>
            </span>
          </div>
        </div>
        <div className={styles.statsColumn}>
          <div className={styles.statCard}>
            <div className={styles.label}>Starting GPA</div>
            <div className={styles.value}>{round2dp(startingGpa).toFixed(2)}</div>
            <div className={styles.sub}>{startingLabel}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>Current GPA</div>
            <div className={styles.value}>{round2dp(currentGpa).toFixed(2)}</div>
            <div className={styles.sub}>{currentLabel}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>Growth</div>
            <div className={styles.value}>
              {percentageGrowth >= 0 ? '+' : ''}{percentageGrowth.toFixed(1)}%
              <span className={styles.absoluteGrowth}>
                ({absoluteGrowth >= 0 ? '+' : ''}{round2dp(absoluteGrowth).toFixed(2)})
              </span>
            </div>
            <div className={styles.sub}>Over {yearSpan} {yearSpan === 1 ? 'year' : 'years'}</div>
          </div>
        </div>
      </div>

      {/* Grade Distribution Section */}
      <div className={styles.gradeDistSection}>
        <div className={styles.gradeDistHeader}>
          <h2>Grade Distribution</h2>
          <p>Frequency of grades across all courses</p>
        </div>
        {showGradeDistCallout && (
          <div className={styles.gradeDistCallout}>
            <span>💡 Click on any bar to view courses with that grade</span>
            <button
              onClick={() => setShowGradeDistCallout(false)}
              className={styles.calloutCloseButton}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <div className={styles.contentLayout}>
          <div className={styles.chartSection}>
            <div className={styles.gradeDistChartWrap}>
              <Bar
                data={gradeDistributionData}
                options={gradeDistributionOptions}
                aria-label="Bar chart showing the distribution of letter grades across all courses"
              />
            </div>
          </div>
          <div className={styles.statsColumn}>
            <div className={styles.statCard}>
              <div className={styles.label}>Highest Frequency</div>
              <div className={styles.value}>{highestFreqGradeDisplay}</div>
              <div className={styles.sub}>{maxCount} {maxCount === 1 ? 'course' : 'courses'} · {highestFreqPercentage}%{highestFreqGrades.length > 1 ? ' each' : ''}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.label}>Total Courses</div>
              <div className={styles.value}>{totalCreditBearingCourses}</div>
              <div className={styles.sub}>Credit bearing</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.label}>Grade Diversity</div>
              <div className={styles.value}>{uniqueGradesCount}</div>
              <div className={styles.sub}>Unique grades</div>
            </div>
          </div>
        </div>
      </div>

          <div style={{ height: '8rem' }}></div>
        </>
      ) : (
        <div className={styles.tableViewContainer}>
          <SemesterManager
            semesters={data || []}
            onClose={null}
            onUpdate={refetch}
            inline={true}
            onUnsavedChanges={setHasUnsavedChanges}
          />
        </div>
      )}

      {showViewSwitchConfirm && (
        <div className={styles.overlay} onClick={() => setShowViewSwitchConfirm(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. Are you sure you want to leave without saving?</p>
            <div className={styles.confirmActions}>
              <button
                onClick={() => setShowViewSwitchConfirm(false)}
                className={styles.continueEditingButton}
              >
                Continue Editing
              </button>
              <button
                onClick={confirmViewSwitch}
                className={styles.leaveButton}
              >
                Leave without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {semesterModalData && (
        <div className={styles.overlay} onClick={() => setSemesterModalData(null)}>
          <div className={styles.semesterModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSemesterModalData(null)} className={styles.closeButton}>✕</button>
            <div className={styles.semesterModalHeader}>
              <h2>{semesterModalData.label}</h2>
              {semesterModalData.note ? (
                <p className={styles.semesterNote}>{semesterModalData.note}</p>
              ) : (
                <>
                  <div className={styles.gpaRow}>
                    <div className={styles.gpaItem}>
                      <span className={styles.gpaLabel}>Term GPA</span>
                      <span className={styles.gpaValue}>{semesterModalData.term_gpa ? round2dp(capGPA(semesterModalData.term_gpa)).toFixed(2) : 'N/A'}</span>
                    </div>
                    <div className={styles.gpaItem}>
                      <span className={styles.gpaLabel}>Cumulative GPA</span>
                      <span className={styles.gpaValue}>{round2dp(capGPA(semesterModalData.gpa)).toFixed(2)}</span>
                    </div>
                  </div>
                  {semesterModalData.courses && semesterModalData.courses.length > 0 && (
                    <div className={styles.semesterModalContent}>
                      <h3>Courses</h3>
                      {semesterModalData.courses.map((course, idx) => (
                        <div key={idx} className={styles.courseItem}>
                          <div className={styles.courseInfo}>
                            <div className={styles.courseName}>{course.name}</div>
                            <div className={styles.courseGrade}>{course.grade}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {gradeModalData && (
        <div className={styles.overlay} onClick={() => setGradeModalData(null)}>
          <div className={styles.gradeModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setGradeModalData(null)} className={styles.closeButton}>✕</button>
            <div className={styles.gradeModalHeader}>
              <h2>{gradeModalData.grade} Courses</h2>
              <p>{gradeModalData.courses.length} {gradeModalData.courses.length === 1 ? 'course' : 'courses'}</p>
            </div>
            <div className={styles.gradeModalContent}>
              {gradeModalData.courses.map((course, idx) => (
                <div key={idx} className={styles.courseItem}>
                  <div className={styles.courseInfo}>
                    <div className={styles.courseName}>{course.name}</div>
                    <div className={styles.courseSemester}>{course.semester_label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className={styles.overlay} onClick={() => setShowUpload(false)}>
          <div className={styles.uploadModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowUpload(false)} className={styles.closeButton}>✕</button>
            <TranscriptUpload
              onSuccess={() => {
                setShowUpload(false);
                refetch(); // Refresh chart data
              }}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        </div>
      )}

      {showJsonUpload && (
        <div className={styles.overlay} onClick={() => setShowJsonUpload(false)}>
          <div className={styles.uploadModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowJsonUpload(false)} className={styles.closeButton}>✕</button>
            <JsonUpload
              onSuccess={() => {
                setShowJsonUpload(false);
                refetch(); // Refresh chart data
              }}
              onCancel={() => setShowJsonUpload(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default GPATracker;
