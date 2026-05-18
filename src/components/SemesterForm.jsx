import React, { useState } from 'react';
import styles from './SemesterForm.module.css';

const SemesterForm = ({ semester, onSave, onCancel }) => {
  const [formData, setFormData] = useState(
    semester || {
      semester_code: '',
      semester_label: '',
      gpa: '',
      note: '',
      is_special: false,
    }
  );

  const [errors, setErrors] = useState({});

  // Auto-generate semester label from semester code
  const generateLabel = (code) => {
    if (!code) return '';
    const parts = code.split('.');
    if (parts.length === 2) {
      return `Y${parts[0]} S${parts[1]}`;
    }
    return code;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'semester_code') {
      setFormData({
        ...formData,
        semester_code: value,
        semester_label: generateLabel(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value,
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.semester_code) {
      newErrors.semester_code = 'Semester code is required';
    }

    if (!formData.gpa) {
      newErrors.gpa = 'GPA is required';
    } else {
      const gpaNum = parseFloat(formData.gpa);
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
        newErrors.gpa = 'GPA must be between 0.0 and 4.0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...formData,
        gpa: parseFloat(formData.gpa),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formGroup}>
        <label htmlFor="semester_code" className={styles.label}>
          Semester Code <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="semester_code"
          name="semester_code"
          value={formData.semester_code}
          onChange={handleChange}
          placeholder="e.g., 1.1, 2.2"
          className={styles.input}
        />
        {errors.semester_code && <span className={styles.error}>{errors.semester_code}</span>}
        <span className={styles.hint}>Format: Year.Semester (e.g., 1.1 for Year 1 Semester 1)</span>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="semester_label" className={styles.label}>
          Semester Label
        </label>
        <input
          type="text"
          id="semester_label"
          name="semester_label"
          value={formData.semester_label}
          readOnly
          placeholder="Auto-generated from code"
          className={`${styles.input} ${styles.readOnly}`}
        />
        <span className={styles.hint}>Auto-generated from semester code</span>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="gpa" className={styles.label}>
          Cumulative GPA <span className={styles.required}>*</span>
        </label>
        <input
          type="number"
          id="gpa"
          name="gpa"
          value={formData.gpa}
          onChange={handleChange}
          placeholder="Enter your GPA"
          step="0.01"
          min="0"
          max="4"
          className={styles.input}
        />
        {errors.gpa && <span className={styles.error}>{errors.gpa}</span>}
        <span className={styles.hint}>Your cumulative GPA at the end of this semester</span>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="note" className={styles.label}>
          Note (Optional)
        </label>
        <input
          type="text"
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          placeholder="e.g., Exchange / Internship"
          className={styles.input}
        />
        <span className={styles.hint}>Add notes like "Exchange" or "Internship"</span>
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="is_special"
            checked={formData.is_special}
            onChange={handleChange}
            className={styles.checkbox}
          />
          <span>Mark as Exchange/Internship semester</span>
        </label>
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          Cancel
        </button>
        <button type="submit" className={styles.saveButton}>
          {semester ? 'Update Semester' : 'Add Semester'}
        </button>
      </div>
    </form>
  );
};

export default SemesterForm;
