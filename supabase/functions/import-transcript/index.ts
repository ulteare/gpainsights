import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with the user's token for auth verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the user's JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { transcriptData } = await req.json()

    if (!transcriptData || !transcriptData.chart_data || !transcriptData.cumulative) {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      semesters: [],
      courses: [],
      cumulative: null,
    }

    // Process each semester in the chart data
    for (let i = 0; i < transcriptData.chart_data.length; i++) {
      const semester = transcriptData.chart_data[i]

      // 1. Insert semester
      const { data: semesterData, error: semError } = await supabaseAdmin
        .from('semesters')
        .insert({
          user_id: user.id,
          semester_code: semester.sem,
          semester_label: semester.label,
          gpa: semester.term_gpa,
          note: semester.note || '',
          sequence_order: i + 1,
        })
        .select()
        .single()

      if (semError) {
        console.error('Error inserting semester:', semError)
        throw semError
      }

      results.semesters.push(semesterData)

      // Find matching semester in full data for details
      const fullSemester = transcriptData.semesters.find(
        (s: any) => s.label === semester.sem
      )

      // 2. Insert semester_details
      if (fullSemester) {
        const { error: detailsError } = await supabaseAdmin
          .from('semester_details')
          .insert({
            semester_id: semesterData.id,
            user_id: user.id,
            academic_year: fullSemester.academic_year,
            term: fullSemester.term,
            type: fullSemester.type,
          })

        if (detailsError) {
          console.error('Error inserting semester details:', detailsError)
          throw detailsError
        }
      }

      // 3. Insert courses for this semester
      const coursesToInsert = semester.courses.map((course: any) => ({
        semester_id: semesterData.id,
        user_id: user.id,
        name: course.name,
        units_taken: course.units_taken,
        units_earned: course.units_earned,
        grade: course.grade,
        grade_points: course.grade_points,
        in_progress: course.in_progress,
        graded: course.graded,
      }))

      if (coursesToInsert.length > 0) {
        const { data: coursesData, error: courseError } = await supabaseAdmin
          .from('courses')
          .insert(coursesToInsert)
          .select()

        if (courseError) {
          console.error('Error inserting courses:', courseError)
          throw courseError
        }

        results.courses.push(...coursesData)
      }
    }

    // 4. Upsert cumulative stats
    const { data: cumulativeData, error: cumError } = await supabaseAdmin
      .from('cumulative_stats')
      .upsert(
        {
          user_id: user.id,
          units_exempted: transcriptData.cumulative.units_exempted || 0,
          units_transferred: transcriptData.cumulative.units_transferred || 0,
          units_earned: transcriptData.cumulative.units_earned,
          cumulative_gpa: transcriptData.cumulative.gpa,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (cumError) {
      console.error('Error upserting cumulative stats:', cumError)
      throw cumError
    }

    results.cumulative = cumulativeData

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcript data imported successfully',
        data: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in import-transcript function:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to import transcript data',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
