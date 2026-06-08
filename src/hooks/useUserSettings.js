import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to get existing settings
      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "not found" error
        throw fetchError;
      }

      if (!data) {
        // Create default settings if none exist
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            school: 'SMU',
            grade_scale: 4.0,
            full_name: user.user_metadata?.full_name || null,
            email: user.email || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      } else {
        // Update name/email if they've changed
        if (data.full_name !== user.user_metadata?.full_name || data.email !== user.email) {
          const { data: updatedData, error: updateError } = await supabase
            .from('user_settings')
            .update({
              full_name: user.user_metadata?.full_name || data.full_name,
              email: user.email || data.email,
            })
            .eq('user_id', user.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating user info:', updateError);
            setSettings(data);
          } else {
            setSettings(updatedData);
          }
        } else {
          setSettings(data);
        }
      }
    } catch (err) {
      console.error('Error fetching user settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const updateSchool = async (newSchool) => {
    if (!user) return;

    try {
      setError(null);
      const gradeScale = newSchool === 'SMU' ? 4.0 : 5.0;

      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          school: newSchool,
          grade_scale: gradeScale,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      setSettings(data);
      return data;
    } catch (err) {
      console.error('Error updating school:', err);
      setError(err.message);
      throw err;
    }
  };

  const saveTranscriptJson = async (transcriptJson) => {
    if (!user) return;

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          transcript_json: transcriptJson,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      setSettings(data);
      return data;
    } catch (err) {
      console.error('Error saving transcript JSON:', err);
      setError(err.message);
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSchool,
    saveTranscriptJson,
    refetch: fetchSettings,
  };
};
