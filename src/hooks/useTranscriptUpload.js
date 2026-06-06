import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useTranscriptUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadTranscript = async (file) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file');
      return { success: false, error: 'Invalid file type' };
    }

    try {
      setUploading(true);
      setError(null);

      // Read the PDF file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      // Call Python backend to parse the PDF
      // For now, we'll use a client-side approach by calling the Python script
      // In production, you'd want to run this on a server

      // Since we can't run Python directly in the browser,
      // we need to send the file to a backend API endpoint
      // For this implementation, we'll assume the user has already run
      // the Python script locally and will paste the JSON output

      // Alternative: Use a file reader to get the file content
      // and send it to your backend for processing

      return {
        success: false,
        error: 'Please use the Python script to parse your transcript first',
        message: 'Run: python backend/parse_transcript.py <your-transcript.pdf> > output.json'
      };

    } catch (err) {
      console.error('Error uploading transcript:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  const importTranscriptData = async (transcriptData) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setUploading(true);
      setError(null);

      // Call the API endpoint to import the transcript data
      const response = await fetch('/api/parse-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptData,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import transcript data');
      }

      return { success: true, data: result.data };

    } catch (err) {
      console.error('Error importing transcript data:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadTranscript,
    importTranscriptData,
    uploading,
    error,
  };
};
