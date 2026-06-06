import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export const useTranscriptUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const importTranscriptData = async (transcriptData, options = {}) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setUploading(true);
      setError(null);

      const results = {
        semesters: [],
        courses: [],
        cumulative: null,
      };

      // If override is true, delete all existing data first
      if (options.override) {
        // Delete all semesters (cascades to semester_details and courses due to FK)
        const { error: deleteError } = await supabase
          .from('semesters')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting existing semesters:', deleteError);
          throw new Error(`Failed to clear existing data: ${deleteError.message}`);
        }

        // Delete cumulative stats
        await supabase
          .from('cumulative_stats')
          .delete()
          .eq('user_id', user.id);
      }

      // 1. Insert semesters (only those included in chart)
      for (const semester of transcriptData.chart_data) {
        const { data: semesterData, error: semError } = await supabase
          .from('semesters')
          .insert({
            user_id: user.id,
            semester_code: semester.sem,
            semester_label: semester.label,
            gpa: semester.cumulative_gpa, // Save cumulative GPA, not term GPA
            note: semester.note || '',
            sequence_order: transcriptData.chart_data.indexOf(semester) + 1,
          })
          .select()
          .single();

        if (semError) {
          console.error('Error inserting semester:', semError);
          throw new Error(`Failed to insert semester ${semester.label}: ${semError.message}`);
        }

        results.semesters.push(semesterData);

        // Find matching semester in full data to get academic_year and term
        const fullSemester = transcriptData.semesters.find(
          s => s.label === semester.sem
        );

        // 2. Insert semester_details
        if (fullSemester) {
          const { error: detailsError } = await supabase
            .from('semester_details')
            .insert({
              semester_id: semesterData.id,
              user_id: user.id,
              academic_year: fullSemester.academic_year,
              term: fullSemester.term,
              type: fullSemester.type,
            });

          if (detailsError) {
            console.error('Error inserting semester details:', detailsError);
            throw new Error(`Failed to insert details for ${semester.label}: ${detailsError.message}`);
          }
        }

        // 3. Insert courses for this semester (batch insert for better performance)
        if (semester.courses && semester.courses.length > 0) {
          const coursesToInsert = semester.courses.map(course => ({
            semester_id: semesterData.id,
            user_id: user.id,
            name: course.name,
            units_taken: course.units_taken,
            units_earned: course.units_earned,
            grade: course.grade,
            grade_points: course.grade_points,
            in_progress: course.in_progress,
            graded: course.graded,
          }));

          const { data: coursesData, error: courseError } = await supabase
            .from('courses')
            .insert(coursesToInsert)
            .select();

          if (courseError) {
            console.error('Error inserting courses:', courseError);
            throw new Error(`Failed to insert courses for ${semester.label}: ${courseError.message}`);
          }

          results.courses.push(...coursesData);
        }
      }

      // 4. Upsert cumulative stats
      const { data: cumulativeData, error: cumError } = await supabase
        .from('cumulative_stats')
        .upsert({
          user_id: user.id,
          units_exempted: transcriptData.cumulative.units_exempted || 0,
          units_transferred: transcriptData.cumulative.units_transferred || 0,
          units_earned: transcriptData.cumulative.units_earned,
          cumulative_gpa: transcriptData.cumulative.gpa,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (cumError) {
        console.error('Error upserting cumulative stats:', cumError);
        throw new Error(`Failed to save cumulative stats: ${cumError.message}`);
      }

      results.cumulative = cumulativeData;

      return { success: true, data: results };

    } catch (err) {
      console.error('Error importing transcript data:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  return {
    importTranscriptData,
    uploading,
    error,
  };
};
