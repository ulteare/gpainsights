import { useState } from 'react';
import { useTranscriptUpload } from './hooks/useTranscriptUpload';
import { useUserSettings } from './hooks/useUserSettings';
import { SemesterEditor } from './components/SemesterEditor';
import styles from './TranscriptUpload.module.css';

export const JsonUpload = ({ onSuccess, onCancel }) => {
  const { importTranscriptData, uploading, error } = useTranscriptUpload();
  const { saveTranscriptJson } = useUserSettings();
  const [jsonText, setJsonText] = useState('');
  const [parseStatus, setParseStatus] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleParse = async () => {
    if (!jsonText.trim()) {
      alert('Please paste JSON text');
      return;
    }

    try {
      setParseStatus('Parsing JSON...');

      // Parse the JSON text
      const transcriptData = JSON.parse(jsonText);

      // Validate the structure
      if (!transcriptData.chart_data || !Array.isArray(transcriptData.chart_data)) {
        throw new Error('Invalid JSON structure. Expected chart_data array.');
      }

      // Save the parsed JSON to database immediately
      setParseStatus('Saving transcript data...');
      await saveTranscriptJson(transcriptData);

      setParsedData(transcriptData);
      setShowPreview(true);
      setParseStatus('');

    } catch (err) {
      console.error('Error processing JSON:', err);
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
        setJsonText('');
        setParsedData(null);
        setShowPreview(false);
        // Call onSuccess which will close modal and refetch in parent
        if (onSuccess) {
          onSuccess();
        }
      } else {
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
      setJsonText('');
      setParsedData(null);
      setShowPreview(false);
      setHasUnsavedChanges(false);
      if (onCancel) onCancel();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    setJsonText('');
    setParsedData(null);
    setShowPreview(false);
    setHasUnsavedChanges(false);
    if (onCancel) onCancel();
  };

  if (showPreview && parsedData) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Preview & Confirm Import</h3>

        <SemesterEditor
          semestersData={parsedData.chart_data}
          onDataChange={handleDataChange}
          onAddSemester={handleAddSemester}
          onDeleteSemester={handleDeleteSemester}
          showStats={true}
          showTitle={true}
        />

        <div className={styles.actions}>
          <button
            onClick={handleCancelClick}
            className={styles.cancelButton}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            className={styles.confirmButton}
            disabled={uploading}
          >
            {uploading ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>

        {showExitConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <h3>Unsaved Changes</h3>
              <p>You have unsaved changes. Are you sure you want to cancel?</p>
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
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Admin: Import JSON (Troubleshooting)</h3>
      <p className={styles.subtitle}>
        Paste JSON output from the transcript parser
      </p>

      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder='Paste JSON here (e.g., {"chart_data": [...], "cumulative": {...}})'
        className={styles.jsonTextarea}
        rows={12}
      />

      {parseStatus && (
        <div className={styles.status}>
          {parseStatus}
        </div>
      )}

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        <button
          onClick={handleCancelClick}
          className={styles.cancelButton}
        >
          Cancel
        </button>
        <button
          onClick={handleParse}
          className={styles.parseButton}
          disabled={!jsonText.trim() || uploading}
        >
          Load & Preview
        </button>
      </div>
    </div>
  );
};
