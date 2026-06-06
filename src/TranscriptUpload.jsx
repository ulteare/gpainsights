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
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setParseStatus('Parsing PDF...');

      // Parse the PDF
      const transcriptData = await parseTranscript(selectedFile);

      setParseStatus('Importing data...');

      // Import to database
      const result = await importTranscriptData(transcriptData);

      if (result.success) {
        setParseStatus('Success!');
        // Refresh semesters data
        await refetch();
        setSelectedFile(null);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Error processing transcript:', err);
      setParseStatus('');
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Import Transcript</h2>

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
          onClick={handleImport}
          disabled={uploading}
        >
          {uploading ? parseStatus : 'Import Transcript'}
        </button>
      )}

      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}
    </div>
  );
};
