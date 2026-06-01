import React, { useState } from 'react';
import styles from './SchoolSelector.module.css';

const SchoolSelector = ({ onSelect }) => {
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schools = [
    { id: 'SMU', name: 'Singapore Management University', scale: '4.0' },
    { id: 'NUS', name: 'National University of Singapore', scale: '5.0' },
    { id: 'NTU', name: 'Nanyang Technological University', scale: '5.0' },
  ];

  const handleSubmit = async () => {
    if (!selectedSchool) return;

    setIsSubmitting(true);
    try {
      await onSelect(selectedSchool);
    } catch (error) {
      console.error('Error selecting school:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Welcome to GPA Insights!</h2>
          <p>Select your school to get started</p>
        </div>

        <div className={styles.schoolList}>
          {schools.map((school) => (
            <button
              key={school.id}
              onClick={() => setSelectedSchool(school.id)}
              className={`${styles.schoolOption} ${
                selectedSchool === school.id ? styles.selected : ''
              }`}
            >
              <div className={styles.schoolName}>{school.name}</div>
              <div className={styles.schoolScale}>{school.scale} GPA Scale</div>
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selectedSchool || isSubmitting}
          className={styles.continueButton}
        >
          {isSubmitting ? 'Setting up...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default SchoolSelector;
