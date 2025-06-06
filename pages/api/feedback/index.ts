
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { Feedback, AppVersion, AppSettings } from '../../../types';
import { SubmitFeedbackPayload } from '../../../apiTypes';
import { notifyNewFeedback } from '../../../services/notificationService'; 
import * as localDbService from '../../../services/localDbService';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route Feedback: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  if (req.method === 'POST') {
    try {
      const { buildId, user, comment } = req.body as SubmitFeedbackPayload;

      if (!buildId || !user || !comment) {
        return res.status(400).json({ error: 'Missing required fields: buildId, user, comment' });
      }

      let buildData: AppVersion | null = null;
      if (appSettings.useSupabase) {
        const { data, error } = await supabase.from('public.builds').select('*').eq('id', buildId).single();
        if (error) console.error(`Error fetching build ${buildId} for Supabase feedback notification:`, error);
        else buildData = data as AppVersion;
      } else {
        buildData = localDbService.getLocalBuildById(buildId);
        if(!buildData) console.error(`Build ${buildId} not found in local DB for feedback notification.`);
      }

      let createdFeedback: Feedback;
      if (appSettings.useSupabase) {
        const { data, error } = await supabase
          .from('feedbacks')
          .insert({ build_id: buildId, user_name: user, comment: comment })
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error("Supabase feedback insertion failed.");
        createdFeedback = { id: data.id, buildId: data.build_id, user: data.user_name, comment: data.comment, timestamp: data.created_at };
      } else {
        createdFeedback = localDbService.addLocalFeedback({ buildId, user, comment });
      }
      
      if (buildData && appSettings.feedbackEnabled) { 
        notifyNewFeedback(createdFeedback, buildData).catch(err => {
          console.error("Error sending new feedback notification:", err);
        });
      }

      res.status(201).json({ feedback: createdFeedback });
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback', details: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const { buildId } = req.query;
      if (!buildId || typeof buildId !== 'string') {
        return res.status(400).json({ error: 'buildId query parameter is required' });
      }

      let feedbacks: Feedback[];
      if (appSettings.useSupabase) {
        const { data, error } = await supabase
          .from('feedbacks')
          .select('id, build_id, user_name, comment, created_at')
          .eq('build_id', buildId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        feedbacks = (data || []).map(item => ({ id: item.id, buildId: item.build_id, user: item.user_name, comment: item.comment, timestamp: item.created_at }));
      } else {
        feedbacks = localDbService.getLocalFeedbacksForBuild(buildId);
      }

      res.status(200).json({ feedbacks });
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
