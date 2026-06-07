import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcriptData, userId } = req.body;

    if (!transcriptData || !userId) {
      return res.status(400).json({ error: 'Missing transcript data or user ID' });
    }

    // Start a transaction-like operation
    const results = {
      semesters: [],
      courses: [],
      cumulative: null,
    };

    // 1. Insert semesters (only those included in chart)
    for (const semester of transcriptData.chart_data) {
      const { data: semesterData, error: semError } = await supabase
        .from('semesters')
        .insert({
          user_id: userId,
          semester_code: semester.sem,
          semester_label: semester.label,
          gpa: semester.term_gpa,
          note: semester.note || '',
          sequence_order: transcriptData.chart_data.indexOf(semester),
        })
        .select()
        .single();

      if (semError) {
        console.error('Error inserting semester:', semError);
        throw semError;
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
            user_id: userId,
            academic_year: fullSemester.academic_year,
            term: fullSemester.term,
            type: fullSemester.type,
          });

        if (detailsError) {
          console.error('Error inserting semester details:', detailsError);
          throw detailsError;
        }
      }

      // 3. Insert courses for this semester
      for (const course of semester.courses) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .insert({
            semester_id: semesterData.id,
            user_id: userId,
            name: course.name,
            units_taken: course.units_taken,
            units_earned: course.units_earned,
            grade: course.grade,
            grade_points: course.grade_points,
            in_progress: course.in_progress,
            graded: course.graded,
          })
          .select()
          .single();

        if (courseError) {
          console.error('Error inserting course:', courseError);
          throw courseError;
        }

        results.courses.push(courseData);
      }
    }

    // 4. Upsert cumulative stats
    const { data: cumulativeData, error: cumError } = await supabase
      .from('cumulative_stats')
      .upsert({
        user_id: userId,
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
      throw cumError;
    }

    results.cumulative = cumulativeData;

    return res.status(200).json({
      success: true,
      message: 'Transcript data imported successfully',
      data: results,
    });

  } catch (error) {
    console.error('Error importing transcript:', error);
    return res.status(500).json({
      error: 'Failed to import transcript data',
      details: error.message,
    });
  }
}
