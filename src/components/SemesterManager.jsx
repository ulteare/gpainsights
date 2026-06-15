import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { SemesterEditor } from './SemesterEditor';
import styles from './SemesterManager.module.css';

const SemesterManager = ({ semesters, onClose, onUpdate, inline = false, onUnsavedChanges }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semestersData, setSemestersData] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

          // Calculate term GPA from courses
          let termGpa = null;
          if (courses && courses.length > 0) {
            const gradedCourses = courses.filter(c => c.graded && c.grade_points !== null);

            if (gradedCourses.length > 0) {
              let totalGradePoints = 0;
              let totalUnits = 0;

              gradedCourses.forEach(course => {
                totalGradePoints += course.grade_points * course.units_earned;
                totalUnits += course.units_earned;
              });

              termGpa = totalUnits > 0 ? totalGradePoints / totalUnits : null;
            }
          }

          return {
            ...semester,
            label: semester.semester_label,
            courses: courses || [],
            term_gpa: termGpa,
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
    setHasUnsavedChanges(true);
    if (onUnsavedChanges) {
      onUnsavedChanges(true);
    }
  };

  const handleAddSemester = () => {
    const nextSequence = semestersData.length > 0
      ? Math.max(...semestersData.map((s, i) => s.sequence_order || i + 1)) + 1
      : 1;

    const newSemester = {
      id: `new_${Date.now()}`, // Temporary ID for new semesters
      semester_code: `${nextSequence}.1`,
      semester_label: `Y${Math.ceil(nextSequence / 2)} S${nextSequence % 2 === 1 ? '1' : '2'}`,
      label: `Y${Math.ceil(nextSequence / 2)} S${nextSequence % 2 === 1 ? '1' : '2'}`,
      gpa: 0,
      term_gpa: 0,
      cumulative_gpa: 0,
      note: '',
      sequence_order: nextSequence,
      courses: [],
      isNew: true, // Flag to identify new semesters
    };

    setSemestersData([...semestersData, newSemester]);
    setHasUnsavedChanges(true);
  };

  const handleDeleteSemester = (semesterIndex) => {
    if (!confirm('Are you sure you want to delete this semester and all its courses?')) return;

    const updated = [...semestersData];
    updated.splice(semesterIndex, 1);
    setSemestersData(updated);
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find deleted semesters (in original but not in current)
      const deletedSemesters = semesters.filter(
        original => !semestersData.find(s => s.id === original.id)
      );

      // Delete removed semesters
      for (const deleted of deletedSemesters) {
        const { error: deleteError } = await supabase
          .from('semesters')
          .delete()
          .eq('id', deleted.id);

        if (deleteError) throw deleteError;
      }

      // Update/Insert each semester and its courses
      for (let i = 0; i < semestersData.length; i++) {
        const semester = semestersData[i];
        const isNewSemester = semester.isNew || String(semester.id).startsWith('new_');

        let semesterId = semester.id;

        if (isNewSemester) {
          // Insert new semester
          const { data: newSemester, error: insertError } = await supabase
            .from('semesters')
            .insert({
              user_id: user.id,
              semester_code: semester.semester_code || semester.sem,
              semester_label: semester.semester_label || semester.label,
              gpa: semester.cumulative_gpa || semester.gpa,
              note: semester.note || '',
              sequence_order: i + 1,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          semesterId = newSemester.id;
        } else {
          // Update existing semester
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

          // Delete existing courses for this semester
          await supabase
            .from('courses')
            .delete()
            .eq('semester_id', semester.id);
        }

        // Insert courses
        if (semester.courses && semester.courses.length > 0) {
          const coursesToInsert = semester.courses.map(course => ({
            semester_id: semesterId,
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

      setHasUnsavedChanges(false);
      if (onUnsavedChanges) {
        onUnsavedChanges(false);
      }
      onUpdate(); // Refresh parent data
      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={inline ? styles.inlineContainer : styles.pageContainer}>
      {!inline && (
        <button onClick={handleClose} className={styles.backButton} title="Back to main page">
          ← Back
        </button>
      )}

      <div className={inline ? styles.inlineHeader : styles.pageHeader}>
        {!inline && <h1>Your Grades</h1>}
        <ul className={styles.description}>
          <li>Edit existing grades and semesters</li>
          <li>Add new semesters</li>
          <li>Predict your GPA — cumulative GPA auto-calculates as you make changes</li>
        </ul>
      </div>

      <div className={styles.pageContent}>
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
              showTitle={false}
              fullWidthMobile={true}
            />

            <div className={styles.pageActions}>
              <button
                onClick={handleClose}
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

export default SemesterManager;
