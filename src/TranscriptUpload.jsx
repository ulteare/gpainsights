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

  const handleEditSemester = (index, field, value) => {
    const updated = { ...parsedData };
    updated.chart_data[index][field] = value;

    // Recalculate all cumulative GPAs based on term GPAs and credit units
    updated.chart_data = updated.chart_data.map((semester, semIndex) => {
      // Get all semesters up to and including this one
      const semestersUpToThis = updated.chart_data.slice(0, semIndex + 1);

      // Calculate cumulative GPA using term GPAs weighted by credit-bearing units
      let totalWeightedGPA = 0;
      let totalUnits = 0;

      semestersUpToThis.forEach(sem => {
        // Count only credit-bearing (graded) courses
        const creditUnits = sem.courses.reduce((sum, course) => {
          if (course.graded && course.grade_points !== null) {
            return sum + course.units_earned;
          }
          return sum;
        }, 0);

        if (creditUnits > 0) {
          totalWeightedGPA += sem.term_gpa * creditUnits;
          totalUnits += creditUnits;
        }
      });

      const cumulativeGPA = totalUnits > 0 ? totalWeightedGPA / totalUnits : 0;

      return {
        ...semester,
        cumulative_gpa: parseFloat(cumulativeGPA.toFixed(2)),
      };
    });

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
                        <input
                          type="number"
                          step="0.01"
                          value={semester.term_gpa}
                          onChange={(e) => handleEditSemester(index, 'term_gpa', parseFloat(e.target.value))}
                          className={styles.gpaInput}
                        />
                      </div>
                    )}
                    <div className={styles.gpaItem}>
                      <label>Cumulative GPA</label>
                      <span className={styles.gpaValue}>{semester.cumulative_gpa}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.courseCount}>
                  {semester.courses.length} courses
                </div>
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
