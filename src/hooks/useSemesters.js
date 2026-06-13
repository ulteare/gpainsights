import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export const useSemesters = () => {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setSemesters([]);
      setLoading(false);
      return;
    }

    fetchSemesters();
  }, [user]);

  const fetchSemesters = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('semesters')
        .select(`
          *,
          courses (
            grade_points,
            units_earned,
            graded
          )
        `)
        .eq('user_id', user.id)
        .order('sequence_order', { ascending: true });

      if (fetchError) throw fetchError;

      // Calculate term GPA for each semester
      const transformedData = data.map(semester => {
        let termGpa = null;

        if (semester.courses && semester.courses.length > 0) {
          const gradedCourses = semester.courses.filter(c => c.graded && c.grade_points !== null);

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

        console.log(`Semester ${semester.semester_label}:`, {
          courses: semester.courses?.length || 0,
          termGpa,
        });

        return {
          ...semester, // Keep all original fields for manager
          sem: semester.semester_code,
          label: semester.semester_label,
          gpa: semester.gpa,
          note: semester.note || '',
          term_gpa: termGpa,
        };
      });

      setSemesters(transformedData);
    } catch (err) {
      console.error('Error fetching semesters:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { semesters, loading, error, refetch: fetchSemesters };
};
