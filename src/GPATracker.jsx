import React, { useRef, useEffect } from 'react';
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
  const { semesters: data, loading, error } = useSemesters();

  // If loading or error, show appropriate state
  if (loading) {
    return (
      <div className={styles.wrap}>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#8C7B68' }}>
          Loading your GPA data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#C33' }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.wrap}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#2C2417', marginBottom: '1rem' }}>
            No Semester Data Yet
          </h2>
          <p style={{ fontFamily: "'Jost', sans-serif", color: '#8C7B68' }}>
            Add your first semester to start tracking your GPA progress!
          </p>
        </div>
      </div>
    );
  }

  // Determine which semesters are special (exchange/internship)
  const exchangeSems = new Set(
    data.filter(d => d.note && d.note.toLowerCase().includes('exchange') || d.note.toLowerCase().includes('internship'))
      .map(d => d.sem)
  );

  // Calculate dynamic y-axis range
  const gpas = data.map(d => d.gpa);
  const minGpa = Math.min(...gpas);
  const maxGpa = Math.max(...gpas);

  // Calculate y-axis min/max with 0.1 padding, but respect 0.0-4.0 bounds
  const yMin = Math.max(0.0, Math.floor((minGpa - 0.1) * 10) / 10);
  const yMax = Math.min(4.0, Math.ceil((maxGpa + 0.1) * 10) / 10);

  // Calculate stats for display
  const startingGpa = data[0].gpa;
  const currentGpa = data[data.length - 1].gpa;
  const growth = currentGpa - startingGpa;
  const startingLabel = data[0].label;
  const currentLabel = data[data.length - 1].label;

  // Calculate time span
  const startYear = parseInt(data[0].sem.split('.')[0]);
  const endYear = parseInt(data[data.length - 1].sem.split('.')[0]);
  const yearSpan = endYear - startYear + 1;

  const bands = [
    { label: 'Peak 🏔️', min: 3.90, max: 4.00, fill: 'rgba(62,35,10,0.38)', labelColor: '#FAF8F5', fontWeight: 500 },
    { label: 'Summa Cum Laude 🥇', min: 3.80, max: 3.90, fill: 'rgba(95,58,18,0.28)', labelColor: '#FAF8F5', fontWeight: 500 },
    { label: "Dean's List 📖", min: 3.70, max: 3.80, fill: 'rgba(140,90,35,0.20)', labelColor: 'rgba(140,100,50,1)', fontWeight: 500 },
    { label: 'Magna Cum Laude 🥈', min: 3.60, max: 3.70, fill: 'rgba(180,130,65,0.14)', labelColor: 'rgba(120,85,40,1)', fontWeight: 500 },
    { label: 'Cum Laude 🥉', min: 3.40, max: 3.60, fill: 'rgba(210,170,105,0.09)', labelColor: 'rgba(100,70,35,1)', fontWeight: 500 },
    { label: 'High Merit', min: 3.20, max: 3.40, fill: 'rgba(225,195,145,0.06)', labelColor: 'rgba(90,60,30,1)', fontWeight: 500 },
    { label: 'Merit', min: 3.00, max: 3.20, fill: 'rgba(235,215,175,0.04)', labelColor: 'rgba(80,50,25,1)', fontWeight: 500 },
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
        const midY = yTop + bandH / 2 + 3.5;
        ctx.font = `${band.fontWeight} 10px 'Jost', sans-serif`;
        ctx.fillStyle = band.labelColor;
        ctx.textAlign = 'right';
        ctx.fillText(band.label.toUpperCase(), right - 6, midY);
      });
      ctx.restore();
    }
  };

  const chartData = {
    labels: data.map(d => d.sem),
    datasets: [{
      label: 'Cumulative GPA',
      data: data.map(d => d.gpa),
      fill: false,
      borderColor: '#6B4E2A',
      borderWidth: 2.5,
      tension: 0,
      pointBackgroundColor: data.map(d => exchangeSems.has(d.sem) ? '#ebe7e2' : '#6B4E2A'),
      pointBorderColor: data.map(d => exchangeSems.has(d.sem) ? '#6B4E2A' : '#6B4E2A'),
      pointBorderWidth: data.map(d => exchangeSems.has(d.sem) ? 2.5 : 0),
      pointRadius: 7,
      pointHoverRadius: 9,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external(context) {
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
          const d = data[idx];
          const gpa = d.gpa;
          const band = bands.find(b => gpa >= b.min && gpa < b.max) || (gpa >= 3.9 ? bands[0] : null);
          el.innerHTML = `
            <div class="${styles.tooltipSem}">${d.label}${d.note ? ' · ' + d.note : ''}</div>
            <div class="${styles.tooltipGpa}">${gpa.toFixed(2)}</div>
            ${band ? `<div class="${styles.tooltipBand}">${band.label}</div>` : ''}
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
        ticks: { color: '#8C7B68', font: { family: "'Jost', sans-serif", size: 12 }, padding: 8 },
        offset: true,
        title: {
          display: true,
          text: 'Semester',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12, weight: 400 },
          padding: { top: 8 }
        }
      },
      y: {
        min: yMin,
        max: yMax,
        grid: { color: 'rgba(200,170,136,0.18)', drawTicks: false },
        border: { color: '#E0D6C8', width: 1, dash: [4, 4] },
        ticks: {
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12 },
          padding: 10,
          stepSize: 0.1,
          callback: v => v.toFixed(1)
        },
        title: {
          display: true,
          text: 'GPA',
          color: '#8C7B68',
          font: { family: "'Jost', sans-serif", size: 12, weight: 400 },
          padding: { bottom: 8 }
        }
      }
    },
    layout: { padding: { top: 16, right: 8, bottom: 8, left: 8 } }
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.srOnly}>Cumulative GPA over semesters with grade band highlights.</h2>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Academic Progress</h1>
          <p>Cumulative GPA · All Semesters</p>
        </div>
        <span className={styles.badge}>Out of 4.0</span>
      </div>
      <div className={styles.statsRow}>
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
          <div className={styles.value}>{growth >= 0 ? '+' : ''}{growth.toFixed(2)}</div>
          <div className={styles.sub}>Over {yearSpan} {yearSpan === 1 ? 'year' : 'years'}</div>
        </div>
      </div>
      <div className={styles.chartCanvasWrap}>
        <Line
          ref={chartRef}
          data={chartData}
          options={options}
          plugins={[bandPlugin]}
          aria-label="Line chart of cumulative GPA from 3.62 to 3.94 across 8 semesters with coloured grade band regions"
        />
      </div>
      <div className={styles.legendRow}>
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
  );
};

export default GPATracker;
