import { useState, useRef } from 'react';
import { useTranscriptUpload } from './hooks/useTranscriptUpload';
import { useSemesters } from './hooks/useSemesters';
import { parseTranscript } from './utils/transcriptParser';
import styles from './TranscriptUpload.module.css';

export const TranscriptUpload = ({ onSuccess }) => {
  const { importTranscriptData, uploading, error } = useTranscriptUpload();
  const { refetch } = useSemesters();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseStatus, setParseStatus] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }
    setSelectedFile(file);
    setParseStatus('');
    setParsedData(null);
    setShowPreview(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleParse = async () => {
    if (!selectedFile) return;

    try {
      setParseStatus('Parsing PDF...');

      // Parse the PDF
      const transcriptData = await parseTranscript(selectedFile);

      // Calculate cumulative GPA for each semester
      const chartDataWithCumulative = transcriptData.chart_data.map((semester, index) => {
        // Get all semesters up to and including this one
        const semestersUpToThis = transcriptData.chart_data.slice(0, index + 1);

        // Calculate cumulative GPA
        let totalGradePoints = 0;
        let totalUnits = 0;

        semestersUpToThis.forEach(sem => {
          sem.courses.forEach(course => {
            if (course.graded && course.grade_points !== null) {
              totalGradePoints += course.grade_points * course.units_earned;
              totalUnits += course.units_earned;
            }
          });
        });

        const cumulativeGPA = totalUnits > 0 ? totalGradePoints / totalUnits : 0;

        return {
          ...semester,
          cumulative_gpa: parseFloat(cumulativeGPA.toFixed(2)),
        };
      });

      const updatedData = {
        ...transcriptData,
        chart_data: chartDataWithCumulative,
      };

      setParsedData(updatedData);
      setShowPreview(true);
      setParseStatus('');

    } catch (err) {
      console.error('Error processing transcript:', err);
      setParseStatus('');
      alert(`Error: ${err.message}`);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;

    try {
      setParseStatus('Importing data...');

      // Import to database (will override existing data)
      const result = await importTranscriptData(parsedData, { override: true });

      if (result.success) {
        setParseStatus('Success!');
        // Refresh semesters data
        await refetch();
        setSelectedFile(null);
        setParsedData(null);
        setShowPreview(false);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Error importing transcript:', err);
      setParseStatus('');
      alert(`Error: ${err.message}`);
    }
  };

  const recalculateGPAs = (chartData) => {
    return chartData.map((semester, semIndex) => {
      // Calculate term GPA from courses (skip for exchange/internship semesters)
      let termGPA = semester.term_gpa;
      if (semester.note !== 'Exchange / Internship') {
        let termGradePoints = 0;
        let termUnits = 0;

        semester.courses.forEach(course => {
          if (course.graded && course.grade_points !== null) {
            termGradePoints += course.grade_points * course.units_earned;
            termUnits += course.units_earned;
          }
        });

        termGPA = termUnits > 0 ? parseFloat((termGradePoints / termUnits).toFixed(2)) : 0;
      }

      // Calculate cumulative GPA from all semesters up to this one
      const semestersUpToThis = chartData.slice(0, semIndex + 1);
      let totalGradePoints = 0;
      let totalUnits = 0;

      semestersUpToThis.forEach(sem => {
        sem.courses.forEach(course => {
          if (course.graded && course.grade_points !== null) {
            totalGradePoints += course.grade_points * course.units_earned;
            totalUnits += course.units_earned;
          }
        });
      });

      const cumulativeGPA = totalUnits > 0 ? parseFloat((totalGradePoints / totalUnits).toFixed(2)) : 0;

      return {
        ...semester,
        term_gpa: termGPA,
        cumulative_gpa: cumulativeGPA,
      };
    });
  };

  const handleEditCourse = (semesterIndex, courseIndex, field, value) => {
    const updated = { ...parsedData };
    updated.chart_data[semesterIndex].courses[courseIndex][field] = value;

    // Recalculate grade_points if grade changed
    if (field === 'grade') {
      const gradePoints = {
        'A+': 4.3, 'A': 4.0, 'A-': 3.7,
        'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7,
        'D+': 1.3, 'D': 1.0, 'F': 0.0,
      };
      const course = updated.chart_data[semesterIndex].courses[courseIndex];
      course.grade_points = gradePoints[value] ?? null;
      course.graded = !['P', 'IP', 'I', 'W', '-'].includes(value);
    }

    // Recalculate all GPAs
    updated.chart_data = recalculateGPAs(updated.chart_data);
    setParsedData(updated);
  };

  return (
    <div className={styles.container}>
      <h2>Import Transcript</h2>

      {!showPreview ? (
        <>
          <div className={styles.instructions}>
            <p>Upload your unofficial SMU transcript PDF to automatically import your grades.</p>
          </div>

          <div
            className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleChange}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{selectedFile.name}</div>
                <div className={styles.fileSize}>
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </div>
              </div>
            ) : (
              <div className={styles.dropText}>
                <div className={styles.uploadIcon}>📄</div>
                <p>Drag and drop your transcript PDF here</p>
                <p className={styles.orText}>or click to browse</p>
              </div>
            )}
          </div>

          {selectedFile && (
            <button
              className={styles.importButton}
              onClick={handleParse}
              disabled={uploading}
            >
              {uploading ? parseStatus : 'Parse Transcript'}
            </button>
          )}

          {error && (
            <div className={styles.error}>
              Error: {error}
            </div>
          )}
        </>
      ) : (
        <div className={styles.previewSection}>
          <h3>Review Your Data</h3>
          <p className={styles.previewNote}>
            Review the imported data below. You can edit any values before confirming.
          </p>

          <div className={styles.statsPreview}>
            <div className={styles.statItem}>
              <span>Cumulative GPA:</span>
              <strong>{parsedData.cumulative.gpa}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Units Earned:</span>
              <strong>{parsedData.cumulative.units_earned}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Semesters:</span>
              <strong>{parsedData.chart_data.length}</strong>
            </div>
          </div>

          <div className={styles.semestersPreview}>
            <h4>Semesters</h4>
            {parsedData.chart_data.map((semester, index) => (
              <div key={index} className={styles.semesterPreviewItem}>
                <div className={styles.semesterHeader}>
                  <span className={styles.semesterLabel}>
                    {semester.label}
                    {semester.note && (
                      <span className={styles.semesterNote}> ({semester.note})</span>
                    )}
                  </span>
                  <div className={styles.gpaGroup}>
                    {semester.note !== 'Exchange / Internship' && (
                      <div className={styles.gpaItem}>
                        <label>Term GPA</label>
                        <span className={styles.gpaValue}>{semester.term_gpa}</span>
                      </div>
                    )}
                    <div className={styles.gpaItem}>
                      <label>Cumulative GPA</label>
                      <span className={styles.gpaValue}>{semester.cumulative_gpa}</span>
                    </div>
                  </div>
                </div>

                {semester.courses.length > 0 && (
                  <div className={styles.coursesTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>Course Name</th>
                          <th>Units</th>
                          <th>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semester.courses.map((course, courseIndex) => (
                          <tr key={courseIndex}>
                            <td>{course.name}</td>
                            <td>{course.units_earned}</td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.previewActions}>
            <button
              className={styles.cancelButton}
              onClick={() => {
                setShowPreview(false);
                setParsedData(null);
              }}
            >
              Cancel
            </button>
            <button
              className={styles.confirmButton}
              onClick={handleConfirmImport}
              disabled={uploading}
            >
              {uploading ? parseStatus : 'Confirm & Import'}
            </button>
          </div>

          <p className={styles.warningNote}>
            ⚠️ This will replace all existing semester data with the new transcript data.
          </p>
        </div>
      )}
    </div>
  );
};
