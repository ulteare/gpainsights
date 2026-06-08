import React from 'react';
import { useUserSettings } from '../hooks/useUserSettings';
import styles from '../GPATracker.module.css';

/**
 * Statistics cards for grade distribution
 */
export const GradeDistributionStats = () => {
  const { settings } = useUserSettings();

  // Don't render if no data
  if (!settings?.transcript_json?.chart_data) {
    return null;
  }

  const gradeOrder = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

  // Calculate grade distribution
  const calculateStats = () => {
    const distribution = {};
    gradeOrder.forEach(grade => distribution[grade] = 0);

    const chartData = settings?.transcript_json?.chart_data;

    chartData.forEach(semester => {
      semester.courses?.forEach(course => {
        if (course.graded && gradeOrder.includes(course.grade)) {
          distribution[course.grade]++;
        }
      });
    });

    const totalModules = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    // Find most frequent grade
    let mostFrequentGrade = null;
    let maxCount = 0;
    Object.entries(distribution).forEach(([grade, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentGrade = grade;
      }
    });

    // Calculate grade diversity (number of unique grades achieved)
    const uniqueGrades = Object.values(distribution).filter(count => count > 0).length;

    return {
      mostFrequentGrade,
      maxCount,
      totalModules,
      uniqueGrades,
      percentage: totalModules > 0 ? ((maxCount / totalModules) * 100).toFixed(1) : 0,
    };
  };

  const stats = calculateStats();

  return (
    <div className={styles.statsColumn}>
      <div className={styles.statCard}>
        <div className={styles.label}>Most Frequent</div>
        <div className={styles.value}>{stats.mostFrequentGrade || 'N/A'}</div>
        <div className={styles.sub}>
          {stats.maxCount} {stats.maxCount === 1 ? 'module' : 'modules'} ({stats.percentage}%)
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.label}>Grade Diversity</div>
        <div className={styles.value}>{stats.uniqueGrades}</div>
        <div className={styles.sub}>
          {stats.uniqueGrades} unique {stats.uniqueGrades === 1 ? 'grade' : 'grades'} achieved
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.label}>Total Modules</div>
        <div className={styles.value}>{stats.totalModules}</div>
        <div className={styles.sub}>Graded courses</div>
      </div>
    </div>
  );
};
