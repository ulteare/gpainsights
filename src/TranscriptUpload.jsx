import { useState, useRef } from 'react';
import { useTranscriptUpload } from './hooks/useTranscriptUpload';
import { useUserSettings } from './hooks/useUserSettings';
import { parseTranscript } from './utils/transcriptParser';
import { SemesterEditor } from './components/SemesterEditor';
import styles from './TranscriptUpload.module.css';

export const TranscriptUpload = ({ onSuccess, onCancel }) => {
  const { importTranscriptData, uploading, error } = useTranscriptUpload();
  const { saveTranscriptJson } = useUserSettings();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseStatus, setParseStatus] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
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

      // Save the parsed JSON to database immediately
      setParseStatus('Saving transcript data...');
      await saveTranscriptJson(updatedData);

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

      console.log('Import result:', result);

      if (result.success) {
        setParseStatus('Success!');
        setSelectedFile(null);
        setParsedData(null);
        setShowPreview(false);
        console.log('Calling onSuccess callback');
        // Call onSuccess which will close modal and refetch in parent
        if (onSuccess) {
          onSuccess();
        } else {
          console.error('onSuccess callback is not defined');
        }
      } else {
        console.error('Import failed:', result.error);
        alert(`Import failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error importing transcript:', err);
      setParseStatus('');
      alert(`Error: ${err.message}`);
    }
  };

  const handleDataChange = (updatedSemesters) => {
    setParsedData({
      ...parsedData,
      chart_data: updatedSemesters,
    });
    setHasUnsavedChanges(true);
  };

  const handleAddSemester = () => {
    const lastSem = parsedData.chart_data[parsedData.chart_data.length - 1];
    const [year, term] = lastSem?.sem.split('.') || ['1', '1'];
    const nextTerm = parseInt(term) === 1 ? '2' : '1';
    const nextYear = nextTerm === '1' ? (parseInt(year) + 1).toString() : year;

    const newSemester = {
      sem: `${nextYear}.${nextTerm}`,
      label: `Y${nextYear} S${nextTerm}`,
      term_gpa: 0,
      cumulative_gpa: 0,
      courses: [],
      note: '',
    };

    handleDataChange([...parsedData.chart_data, newSemester]);
  };

  const handleDeleteSemester = (semesterIndex) => {
    const updated = [...parsedData.chart_data];
    updated.splice(semesterIndex, 1);
    handleDataChange(updated);
  };

  const handleCancelClick = () => {
    if (hasUnsavedChanges && showPreview) {
      setShowExitConfirm(true);
    } else {
      setShowPreview(false);
      setParsedData(null);
      setSelectedFile(null);
      setHasUnsavedChanges(false);
      if (onCancel) onCancel();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    setShowPreview(false);
    setParsedData(null);
    setSelectedFile(null);
    setHasUnsavedChanges(false);
    if (onCancel) onCancel();
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
          <h3>Review & Confirm Your Data</h3>
          <p className={styles.previewNote}>
            Review the imported data below. You can edit any values before confirming.
          </p>

          <SemesterEditor
            semestersData={parsedData.chart_data}
            onDataChange={handleDataChange}
            onAddSemester={handleAddSemester}
            onDeleteSemester={handleDeleteSemester}
            showStats={true}
          />

          <div className={styles.previewActions}>
            <button
              className={styles.cancelButton}
              onClick={handleCancelClick}
            >
              Cancel
            </button>
            <button
              className={styles.confirmButton}
              onClick={handleConfirmImport}
              disabled={uploading}
            >
              {uploading ? parseStatus : 'Confirm & Save'}
            </button>
          </div>

          <p className={styles.warningNote}>
            ⚠️ This will replace all existing semester data with the new transcript data.
          </p>
        </div>
      )}

      {showExitConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. Are you sure you want to leave?</p>
            <div className={styles.confirmActions}>
              <button
                onClick={() => setShowExitConfirm(false)}
                className={styles.continueEditingButton}
              >
                Continue Editing
              </button>
              <button
                onClick={handleConfirmExit}
                className={styles.leaveButton}
              >
                Leave without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
