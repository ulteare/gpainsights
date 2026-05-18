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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.semester_code) {
      newErrors.semester_code = 'Semester code is required';
    }

    if (!formData.semester_label) {
      newErrors.semester_label = 'Semester label is required';
    }

    if (!formData.gpa) {
      newErrors.gpa = 'GPA is required';
    } else {
      const gpaNum = parseFloat(formData.gpa);
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 5) {
        newErrors.gpa = 'GPA must be between 0.0 and 5.0';
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
          Semester Label <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="semester_label"
          name="semester_label"
          value={formData.semester_label}
          onChange={handleChange}
          placeholder="e.g., Y1 S1, Y2 S2"
          className={styles.input}
        />
        {errors.semester_label && <span className={styles.error}>{errors.semester_label}</span>}
        <span className={styles.hint}>Display name (e.g., Y1 S1)</span>
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
          placeholder="e.g., 3.85"
          step="0.01"
          min="0"
          max="5"
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
