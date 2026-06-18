import { useState } from 'react';
import styles from './SemesterEditor.module.css';

/**
 * Shared component for editing semesters and their courses
 * Used by both TranscriptUpload (for new data) and SemesterManager (for existing data)
 */
export const SemesterEditor = ({
  semestersData,
  onDataChange,
  onAddSemester,
  onDeleteSemester,
  onExportCSV,
  showStats = true,
  showTitle = true,
  fullWidthMobile = false
}) => {
  const [draggedSemesterIndex, setDraggedSemesterIndex] = useState(null);

  // Helper function to round to 2 decimal places (conventional rounding, not banker's rounding)
  const round2dp = (num) => {
    return Math.round(num * 100) / 100;
  };

  const calculateCumulativeStats = (chartData) => {
    let totalGradePoints = 0;
    let totalUnits = 0;

    chartData.forEach(sem => {
      sem.courses?.forEach(course => {
        if (course.graded && course.grade_points !== null) {
          totalGradePoints += course.grade_points * course.units_earned;
          totalUnits += course.units_earned;
        }
      });
    });

    const gpa = totalUnits > 0 ? totalGradePoints / totalUnits : 0;
    return { gpa, units_earned: totalUnits };
  };

  const recalculateGPAs = (chartData) => {
    let cumulativeGradePoints = 0;
    let cumulativeUnits = 0;
    let lastCumulativeGPA = 0;

    return chartData.map((semester, semIndex) => {
      // Calculate term GPA from courses (skip for exchange/internship semesters)
      let termGPA = 0;
      if (semester.note !== 'Exchange / Internship') {
        let termGradePoints = 0;
        let termUnits = 0;

        semester.courses?.forEach(course => {
          if (course.graded && course.grade_points !== null) {
            termGradePoints += course.grade_points * course.units_earned;
            termUnits += course.units_earned;
          }
        });

        termGPA = termUnits > 0 ? termGradePoints / termUnits : 0;
      }

      // Add this semester's courses to cumulative totals
      semester.courses?.forEach(course => {
        if (course.graded && course.grade_points !== null) {
          cumulativeGradePoints += course.grade_points * course.units_earned;
          cumulativeUnits += course.units_earned;
        }
      });

      // Calculate cumulative GPA (keep full precision)
      const cumulativeGPA = cumulativeUnits > 0
        ? cumulativeGradePoints / cumulativeUnits
        : lastCumulativeGPA;

      // Store this cumulative GPA for next iteration
      lastCumulativeGPA = cumulativeGPA;

      return {
        ...semester,
        term_gpa: termGPA,
        cumulative_gpa: cumulativeGPA,
      };
    });
  };

  const handleEditCourse = (semesterIndex, courseIndex, field, value) => {
    const updated = [...semestersData];
    updated[semesterIndex].courses[courseIndex][field] = value;

    // Recalculate grade_points if grade changed
    if (field === 'grade') {
      const gradePoints = {
        'A+': 4.3, 'A': 4.0, 'A-': 3.7,
        'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7,
        'D+': 1.3, 'D': 1.0, 'F': 0.0,
      };
      const course = updated[semesterIndex].courses[courseIndex];
      course.grade_points = gradePoints[value] ?? null;
      course.graded = !['P', 'IP', 'I', 'W', '-'].includes(value);
    }

    // Convert units to number
    if (field === 'units_earned') {
      updated[semesterIndex].courses[courseIndex][field] = parseFloat(value) || 0;
    }

    // Recalculate all GPAs
    const recalculated = recalculateGPAs(updated);
    onDataChange(recalculated);
  };

  const handleDeleteCourse = (semesterIndex, courseIndex) => {
    const updated = [...semestersData];
    updated[semesterIndex].courses.splice(courseIndex, 1);
    const recalculated = recalculateGPAs(updated);
    onDataChange(recalculated);
  };

  const handleAddCourse = (semesterIndex) => {
    const updated = [...semestersData];
    const newCourse = {
      name: 'New Course',
      units_taken: 1.0,
      units_earned: 1.0,
      grade: 'A',
      grade_points: 4.0,
      in_progress: false,
      graded: true,
    };
    updated[semesterIndex].courses = updated[semesterIndex].courses || [];
    updated[semesterIndex].courses.push(newCourse);
    const recalculated = recalculateGPAs(updated);
    onDataChange(recalculated);
  };

  const handleToggleExchange = (semesterIndex, isExchange) => {
    const updated = [...semestersData];
    updated[semesterIndex].note = isExchange ? 'Exchange / Internship' : '';
    const recalculated = recalculateGPAs(updated);
    onDataChange(recalculated);
  };

  const handleSemesterDragStart = (e, index) => {
    setDraggedSemesterIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSemesterDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSemesterDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedSemesterIndex === null || draggedSemesterIndex === dropIndex) {
      setDraggedSemesterIndex(null);
      return;
    }

    const updated = [...semestersData];
    const draggedItem = updated[draggedSemesterIndex];
    updated.splice(draggedSemesterIndex, 1);
    updated.splice(dropIndex, 0, draggedItem);
    const recalculated = recalculateGPAs(updated);
    onDataChange(recalculated);
    setDraggedSemesterIndex(null);
  };

  return (
    <div className={`${styles.container} ${fullWidthMobile ? styles.fullWidthMobile : ''}`}>
      {showStats && (
        <div className={styles.statsPreview}>
          <div className={styles.statItem}>
            <span>Cumulative GPA:</span>
            <strong>{round2dp(calculateCumulativeStats(semestersData).gpa).toFixed(2)}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Units Earned:</span>
            <strong>{calculateCumulativeStats(semestersData).units_earned}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Semesters:</span>
            <strong>{semestersData.length}</strong>
          </div>
        </div>
      )}

      <div className={styles.semestersPreview}>
        {(showTitle || onExportCSV) && (
          <div className={styles.semestersHeader}>
            {showTitle && <h4>Semesters</h4>}
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className={styles.exportButton}
                disabled={semestersData.length === 0}
              >
                Export to CSV
              </button>
            )}
          </div>
        )}
        {semestersData.map((semester, index) => (
          <div
            key={index}
            className={`${styles.semesterPreviewItem} ${draggedSemesterIndex === index ? styles.dragging : ''}`}
            draggable
            onDragStart={(e) => handleSemesterDragStart(e, index)}
            onDragOver={(e) => handleSemesterDragOver(e, index)}
            onDrop={(e) => handleSemesterDrop(e, index)}
          >
            <div className={styles.semesterHeader}>
              <div className={styles.semesterTitleRow}>
                <span className={styles.dragHandle}>☰</span>
                <span className={styles.semesterLabel}>
                  {semester.label || semester.semester_label}
                  {semester.note && (
                    <span className={styles.semesterNote}> ({semester.note})</span>
                  )}
                </span>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={semester.note === 'Exchange / Internship'}
                    onChange={(e) => handleToggleExchange(index, e.target.checked)}
                    className={styles.exchangeCheckbox}
                  />
                  <span>Exchange/Internship</span>
                </label>
                <button
                  onClick={() => onDeleteSemester(index)}
                  className={styles.deleteSemesterButton}
                  title="Delete semester"
                >
                  ×
                </button>
              </div>
              <div className={styles.gpaGroup}>
                {semester.note !== 'Exchange / Internship' && (
                  <div className={styles.gpaItem}>
                    <label>Term GPA</label>
                    <span className={styles.gpaValue}>
                      {round2dp(semester.term_gpa || semester.gpa || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className={styles.gpaItem}>
                  <label>Cumulative GPA</label>
                  <span className={styles.gpaValue}>
                    {round2dp(semester.cumulative_gpa || semester.gpa || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.coursesTable}>
              <table>
                <thead>
                  <tr>
                    <th>Course Name</th>
                    <th>Units</th>
                    <th>Grade</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(semester.courses || []).map((course, courseIndex) => (
                    <tr key={courseIndex}>
                      <td>
                        <input
                          type="text"
                          value={course.name}
                          onChange={(e) => handleEditCourse(index, courseIndex, 'name', e.target.value)}
                          className={styles.courseNameInput}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={course.units_earned}
                          onChange={(e) => handleEditCourse(index, courseIndex, 'units_earned', e.target.value)}
                          className={styles.unitsInput}
                        />
                      </td>
                      <td>
                        <select
                          value={course.grade}
                          onChange={(e) => handleEditCourse(index, courseIndex, 'grade', e.target.value)}
                          className={styles.gradeSelect}
                        >
                          <option value="A+">A+</option>
                          <option value="A">A</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B">B</option>
                          <option value="B-">B-</option>
                          <option value="C+">C+</option>
                          <option value="C">C</option>
                          <option value="C-">C-</option>
                          <option value="D+">D+</option>
                          <option value="D">D</option>
                          <option value="F">F</option>
                          <option value="P">P</option>
                          <option value="IP">IP</option>
                          <option value="I">I</option>
                          <option value="W">W</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteCourse(index, courseIndex)}
                          className={styles.deleteButton}
                          title="Delete course"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => handleAddCourse(index)}
                className={styles.addCourseButton}
              >
                + Add Course
              </button>
            </div>
          </div>
        ))}
        {onAddSemester && (
          <button
            onClick={onAddSemester}
            className={styles.addSemesterButton}
          >
            + Add Semester
          </button>
        )}
      </div>
    </div>
  );
};
