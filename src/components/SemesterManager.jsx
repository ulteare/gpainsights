import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { SemesterEditor } from './SemesterEditor';
import styles from './SemesterManager.module.css';

const SemesterManager = ({ semesters, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semestersData, setSemestersData] = useState([]);

  // Fetch courses for all semesters on mount
  useEffect(() => {
    fetchSemestersWithCourses();
  }, [semesters]);

  const fetchSemestersWithCourses = async () => {
    try {
      setLoading(true);

      // Fetch courses for each semester
      const semestersWithCourses = await Promise.all(
        semesters.map(async (semester) => {
          const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select('*')
            .eq('semester_id', semester.id)
            .order('id', { ascending: true });

          if (coursesError) throw coursesError;

          return {
            ...semester,
            label: semester.semester_label,
            courses: courses || [],
            term_gpa: semester.gpa,
            cumulative_gpa: semester.gpa,
          };
        })
      );

      setSemestersData(semestersWithCourses);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (updatedSemesters) => {
    setSemestersData(updatedSemesters);
  };

  const handleAddSemester = async () => {
    try {
      setLoading(true);
      setError(null);

      const nextSequence = semesters.length > 0
        ? Math.max(...semesters.map(s => s.sequence_order || 0)) + 1
        : 1;

      const { data: newSemester, error: insertError } = await supabase
        .from('semesters')
        .insert({
          user_id: user.id,
          semester_code: `${nextSequence}.1`,
          semester_label: `Y${Math.ceil(nextSequence / 2)} S${nextSequence % 2 === 1 ? '1' : '2'}`,
          gpa: 0,
          note: '',
          sequence_order: nextSequence,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onUpdate(); // Refresh parent data
    } catch (err) {
      console.error('Error adding semester:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSemester = async (semesterIndex) => {
    if (!confirm('Are you sure you want to delete this semester and all its courses?')) return;

    try {
      setLoading(true);
      setError(null);

      const semester = semestersData[semesterIndex];
      const { error: deleteError } = await supabase
        .from('semesters')
        .delete()
        .eq('id', semester.id);

      if (deleteError) throw deleteError;

      onUpdate(); // Refresh parent data
    } catch (err) {
      console.error('Error deleting semester:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update each semester and its courses
      for (let i = 0; i < semestersData.length; i++) {
        const semester = semestersData[i];
        const originalSemester = semesters.find(s => s.id === semester.id);

        // Update semester if changed
        if (originalSemester) {
          const { error: updateError } = await supabase
            .from('semesters')
            .update({
              semester_code: semester.semester_code || semester.sem,
              semester_label: semester.semester_label || semester.label,
              gpa: semester.cumulative_gpa || semester.gpa,
              note: semester.note || '',
              sequence_order: i + 1, // Update order based on current position
            })
            .eq('id', semester.id);

          if (updateError) throw updateError;

          // Delete existing courses
          await supabase
            .from('courses')
            .delete()
            .eq('semester_id', semester.id);

          // Insert updated courses
          if (semester.courses && semester.courses.length > 0) {
            const coursesToInsert = semester.courses.map(course => ({
              semester_id: semester.id,
              user_id: user.id,
              name: course.name,
              units_taken: course.units_taken || course.units_earned,
              units_earned: course.units_earned,
              grade: course.grade,
              grade_points: course.grade_points,
              in_progress: course.in_progress || false,
              graded: course.graded,
            }));

            const { error: courseError } = await supabase
              .from('courses')
              .insert(coursesToInsert);

            if (courseError) throw courseError;
          }
        }
      }

      onUpdate(); // Refresh parent data
      onClose();
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Manage Semesters</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>

        <div className={styles.modalContent}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          {loading && semestersData.length === 0 ? (
            <div className={styles.loading}>Loading semesters...</div>
          ) : (
            <>
              <SemesterEditor
                semestersData={semestersData}
                onDataChange={handleDataChange}
                onAddSemester={handleAddSemester}
                onDeleteSemester={handleDeleteSemester}
                showStats={false}
              />

              <div className={styles.modalActions}>
                <button
                  onClick={onClose}
                  className={styles.cancelButton}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className={styles.saveButton}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SemesterManager;
