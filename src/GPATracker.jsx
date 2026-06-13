import React, { useRef, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useSemesters } from './hooks/useSemesters';
import { useUserSettings } from './hooks/useUserSettings';
import SemesterManager from './components/SemesterManager';
import { TranscriptUpload } from './TranscriptUpload';
import styles from './GPATracker.module.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const GPATracker = () => {
  const chartRef = useRef(null);
  const { semesters: data, loading, error, refetch } = useSemesters();
  const { settings } = useUserSettings();
  const [showManager, setShowManager] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTermGpa, setShowTermGpa] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show SemesterManager as standalone page
  if (showManager) {
    return (
      <SemesterManager
        semesters={data || []}
        onClose={() => setShowManager(false)}
        onUpdate={refetch}
      />
    );
  }

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

        ctx.fillText(value.toFixed(2), xPos, yPos + labelOffset);
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

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
                <div class="${styles.tooltipGpa}">Term: ${termGpa.toFixed(2)}</div>
              `;
            }
          } else {
            // Hovering over Cumulative GPA line - show cumulative + term + band
            const gpa = capGPA(d.gpa);
            const band = bands.find(b => gpa >= b.min && gpa < b.max) || (gpa >= 3.9 ? bands[0] : null);
            el.innerHTML = `
              <div class="${styles.tooltipSem}">${d.label}${d.note ? ' · ' + d.note : ''}</div>
              <div class="${styles.tooltipGpa}">${gpa.toFixed(2)}</div>
              ${d.term_gpa ? `<div class="${styles.tooltipTermGpa}">Term: ${d.term_gpa.toFixed(2)}</div>` : ''}
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
        ? { top: 24, right: 8, bottom: 8, left: 8 }
        : { top: 16, right: 8, bottom: 8, left: 8 }
    }
  };

  return (
    <>
      <h2 className={styles.srOnly}>Cumulative GPA over semesters with grade band highlights.</h2>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Academic Progress</h1>
          <p>Cumulative GPA · All Semesters</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.buttonGroup}>
            <button
              onClick={() => setShowManager(true)}
              className={styles.settingsButton}
            >
              View / Edit / Predict Grades
            </button>
            <div className={styles.uploadButtonWrapper}>
              <button
                onClick={() => setShowUpload(true)}
                className={styles.uploadButton}
              >
                Upload Transcript
              </button>
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
            <div className={styles.value}>{startingGpa.toFixed(2)}</div>
            <div className={styles.sub}>{startingLabel}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>Current GPA</div>
            <div className={styles.value}>{currentGpa.toFixed(2)}</div>
            <div className={styles.sub}>{currentLabel}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.label}>Growth</div>
            <div className={styles.value}>
              {percentageGrowth >= 0 ? '+' : ''}{percentageGrowth.toFixed(1)}%
              <span className={styles.absoluteGrowth}>
                ({absoluteGrowth >= 0 ? '+' : ''}{absoluteGrowth.toFixed(2)})
              </span>
            </div>
            <div className={styles.sub}>Over {yearSpan} {yearSpan === 1 ? 'year' : 'years'}</div>
          </div>
        </div>
      </div>

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
    </>
  );
};

export default GPATracker;
