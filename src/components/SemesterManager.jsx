import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import SemesterForm from './SemesterForm';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './SemesterManager.module.css';

// Sortable Item Component
const SortableItem = ({ semester, onEdit, onDelete, loading }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: semester.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.semesterItem}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M8 5h.01M8 10h.01M8 15h.01M12 5h.01M12 10h.01M12 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
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
          onClick={() => onEdit(semester)}
          className={styles.editButton}
          disabled={loading}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(semester.id)}
          className={styles.deleteButton}
          disabled={loading}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

const SemesterManager = ({ semesters, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localSemesters, setLocalSemesters] = useState(semesters);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local state when semesters prop changes
  React.useEffect(() => {
    setLocalSemesters(semesters);
  }, [semesters]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localSemesters.findIndex((s) => s.id === active.id);
    const newIndex = localSemesters.findIndex((s) => s.id === over.id);

    // Optimistically update UI
    const newOrder = arrayMove(localSemesters, oldIndex, newIndex);
    setLocalSemesters(newOrder);

    // Update sequence_order in database
    try {
      setLoading(true);
      setError(null);

      // First, set all sequences to negative temporary values to avoid constraint violations
      const tempUpdates = newOrder.map((semester, index) =>
        supabase
          .from('semesters')
          .update({ sequence_order: -(index + 1) })
          .eq('id', semester.id)
      );

      await Promise.all(tempUpdates);

      // Then update to final positive values
      const finalUpdates = newOrder.map((semester, index) =>
        supabase
          .from('semesters')
          .update({ sequence_order: index + 1 })
          .eq('id', semester.id)
      );

      await Promise.all(finalUpdates);

      onUpdate(); // Refresh parent data
    } catch (err) {
      console.error('Error updating order:', err);
      setError(err.message);
      // Revert on error
      setLocalSemesters(semesters);
    } finally {
      setLoading(false);
    }
  };

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
                {localSemesters.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No semesters added yet. Click "Add Semester" to get started!</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={localSemesters.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {localSemesters.map((semester) => (
                        <SortableItem
                          key={semester.id}
                          semester={semester}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          loading={loading}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
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
