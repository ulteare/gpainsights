import React from 'react';
import { Chart as ChartJS } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
} from 'chart.js';
import { useUserSettings } from '../hooks/useUserSettings';
import styles from './GradeDistribution.module.css';

// Register the BarElement
ChartJS.register(BarElement);

/**
 * Grade Distribution Chart Component
 * Shows frequency distribution of grades with both bars and connecting line
 */
export const GradeDistribution = ({ isMobile = false }) => {
  const { settings } = useUserSettings();

  // Define grade order (F to A+, reversed so A+ is on the right)
  const gradeOrder = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

  // Calculate grade distribution from transcript_json
  const calculateGradeDistribution = () => {
    const distribution = {};
    gradeOrder.forEach(grade => distribution[grade] = 0);

    // Get chart_data from transcript_json in user_settings
    const chartData = settings?.transcript_json?.chart_data;

    if (!chartData || !Array.isArray(chartData)) {
      return gradeOrder.map(() => 0);
    }

    chartData.forEach(semester => {
      semester.courses?.forEach(course => {
        if (course.graded && gradeOrder.includes(course.grade)) {
          distribution[course.grade]++;
        }
      });
    });

    return gradeOrder.map(grade => distribution[grade]);
  };

  const frequencies = calculateGradeDistribution();
  const maxFrequency = Math.max(...frequencies, 1);

  // Calculate total modules for percentage
  const totalModules = frequencies.reduce((sum, count) => sum + count, 0);

  // Don't render if no data
  if (!settings?.transcript_json?.chart_data) {
    return null;
  }

  // Find the range of grades that actually exist
  const getGradeRange = () => {
    let lowestIndex = -1;
    let highestIndex = -1;

    frequencies.forEach((count, index) => {
      if (count > 0) {
        if (lowestIndex === -1) lowestIndex = index;
        highestIndex = index;
      }
    });

    // If no grades found, return empty arrays
    if (lowestIndex === -1) {
      return { labels: gradeOrder, data: frequencies };
    }

    // Expand range by 2 grades on each side
    const startIndex = Math.max(0, lowestIndex - 2);
    const endIndex = Math.min(gradeOrder.length - 1, highestIndex + 2);

    const rangeLabels = gradeOrder.slice(startIndex, endIndex + 1);
    const rangeData = frequencies.slice(startIndex, endIndex + 1);

    return { labels: rangeLabels, data: rangeData };
  };

  const { labels: displayLabels, data: displayData } = getGradeRange();

  const chartData = {
    labels: displayLabels,
    datasets: [
      {
        type: 'bar',
        label: 'Frequency',
        data: displayData,
        backgroundColor: 'rgba(140, 110, 75, 0.5)',
        borderColor: 'rgba(140, 110, 75, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        type: 'line',
        label: 'Trend',
        data: displayData,
        borderColor: '#6B4E2A',
        borderWidth: 2.5,
        pointBackgroundColor: '#6B4E2A',
        pointBorderColor: '#6B4E2A',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: false,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#2C2417',
        titleColor: '#FAF8F5',
        bodyColor: '#FAF8F5',
        borderColor: '#8C6E4B',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (context) => `Grade: ${context[0].label}`,
          label: (context) => {
            const count = context.parsed.y;
            const percentage = totalModules > 0 ? ((count / totalModules) * 100).toFixed(1) : 0;
            return `Count: ${count} (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(200, 170, 136, 0.15)',
          drawTicks: false,
        },
        border: {
          color: '#E0D6C8',
          width: 1,
        },
        ticks: {
          color: '#8C7B68',
          font: {
            family: "'Jost', sans-serif",
            size: isMobile ? 10 : 12,
            weight: 500,
          },
          padding: 8,
        },
        title: {
          display: true,
          text: 'Grade',
          color: '#8C7B68',
          font: {
            family: "'Jost', sans-serif",
            size: isMobile ? 11 : 12,
            weight: 400,
          },
          padding: { top: 8 },
        },
      },
      y: {
        beginAtZero: true,
        max: Math.ceil(maxFrequency * 1.1),
        grid: {
          color: 'rgba(200, 170, 136, 0.18)',
          drawTicks: false,
        },
        border: {
          color: '#E0D6C8',
          width: 1,
          dash: [4, 4],
        },
        ticks: {
          display: !isMobile,
          color: '#8C7B68',
          font: {
            family: "'Jost', sans-serif",
            size: 12,
          },
          padding: 10,
          stepSize: 1,
          callback: (value) => Number.isInteger(value) ? value : null,
        },
        title: {
          display: !isMobile,
          text: 'Frequency',
          color: '#8C7B68',
          font: {
            family: "'Jost', sans-serif",
            size: 12,
            weight: 400,
          },
          padding: { bottom: 8 },
        },
      },
    },
    layout: {
      padding: isMobile
        ? { top: 16, right: 8, bottom: 8, left: 8 }
        : { top: 16, right: 8, bottom: 8, left: 8 },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Grade Distribution</h3>
        <p className={styles.subtitle}>Frequency of grades across all semesters</p>
      </div>
      <div className={styles.chartWrapper}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};
