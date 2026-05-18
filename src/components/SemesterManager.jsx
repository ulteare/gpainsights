import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import SemesterForm from './SemesterForm';
import styles from './SemesterManager.module.css';

const SemesterManager = ({ semesters, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddNew = () => {
    setEditingSemester(null);
    setShowForm(true);
  };

  const handleEdit = (semester) => {
    setEditingSemester(semester);
    setShowForm(true);
  };

  const handleSave = async (formData) => {
    try {
      setLoading(true);
      setError(null);

      if (editingSemester) {
        // Update existing semester
        const { error: updateError } = await supabase
          .from('semesters')
          .update({
            semester_code: formData.semester_code,
            semester_label: formData.semester_label,
            gpa: formData.gpa,
            note: formData.note,
            is_special: formData.is_special,
          })
          .eq('id', editingSemester.id);

        if (updateError) throw updateError;
      } else {
        // Add new semester - determine sequence_order
        const nextSequence = semesters.length > 0
          ? Math.max(...semesters.map(s => s.sequence_order || 0)) + 1
          : 1;

        const { error: insertError } = await supabase
          .from('semesters')
          .insert({
            user_id: user.id,
            semester_code: formData.semester_code,
            semester_label: formData.semester_label,
            gpa: formData.gpa,
            note: formData.note,
            is_special: formData.is_special,
            sequence_order: nextSequence,
          });

        if (insertError) throw insertError;
      }

      setShowForm(false);
      setEditingSemester(null);
      onUpdate(); // Refresh the data
    } catch (err) {
      console.error('Error saving semester:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (semesterId) => {
    if (!confirm('Are you sure you want to delete this semester?')) return;

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('semesters')
        .delete()
        .eq('id', semesterId);

      if (deleteError) throw deleteError;

      onUpdate(); // Refresh the data
    } catch (err) {
      console.error('Error deleting semester:', err);
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

          {!showForm ? (
            <>
              <div className={styles.semesterList}>
                {semesters.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No semesters added yet. Click "Add Semester" to get started!</p>
                  </div>
                ) : (
                  semesters.map((semester) => (
                    <div key={semester.id} className={styles.semesterItem}>
                      <div className={styles.semesterInfo}>
                        <div className={styles.semesterLabel}>
                          {semester.semester_label}
                          {semester.is_special && (
                            <span className={styles.specialBadge}>Exchange/Internship</span>
                          )}
                        </div>
                        <div className={styles.semesterDetails}>
                          <span className={styles.code}>{semester.semester_code}</span>
                          <span className={styles.gpa}>GPA: {semester.gpa.toFixed(2)}</span>
                          {semester.note && <span className={styles.note}>{semester.note}</span>}
                        </div>
                      </div>
                      <div className={styles.semesterActions}>
                        <button
                          onClick={() => handleEdit(semester)}
                          className={styles.editButton}
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(semester.id)}
                          className={styles.deleteButton}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.modalActions}>
                <button onClick={handleAddNew} className={styles.addButton} disabled={loading}>
                  + Add Semester
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className={styles.formTitle}>
                {editingSemester ? 'Edit Semester' : 'Add New Semester'}
              </h3>
              <SemesterForm
                semester={editingSemester}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingSemester(null);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SemesterManager;
