
import React, { useState, useCallback } from 'react';
import { summarizeChangelogDifferences, isGeminiClientInitialized } from '../services/geminiService';
import { ChangelogAnalysis } from '../types';
import Button from './ui/Button';
import GlassCard from './ui/GlassCard';
import { ZapIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';

interface ChangelogAnalyzerProps {
  currentChangelog: string;
  previousChangelog?: string;
}

const ChangelogAnalyzer: React.FC<ChangelogAnalyzerProps> = ({ currentChangelog, previousChangelog }) => {
  const { getSetting } = useSettings();
  const geminiEnabled = getSetting('geminiEnabled', true); // Get setting, default to true if not found

  const [analysis, setAnalysis] = useState<ChangelogAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setAnalysis(null);
    const result = await summarizeChangelogDifferences(currentChangelog, previousChangelog);
    setAnalysis(result);
    setIsLoading(false);
  }, [currentChangelog, previousChangelog]);

  if (!geminiEnabled) {
    return (
      <GlassCard className="mt-6">
        <p className="text-sm text-slate-400">
          AI Changelog Analysis feature is currently disabled by the administrator.
        </p>
      </GlassCard>
    );
  }

  if (!isGeminiClientInitialized()) {
    return (
      <GlassCard className="mt-6">
        <p className="text-sm text-amber-400">
          Gemini API client is not available. Changelog analysis feature is disabled. Please ensure the API key (API_KEY) is correctly configured in the environment variables.
        </p>
      </GlassCard>
    );
  }
  
  return (
    <GlassCard className="mt-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-sky-300">AI Changelog Analysis</h4>
        <Button onClick={handleAnalyze} disabled={isLoading} variant="secondary" size="sm" leftIcon={!isLoading ? <ZapIcon className="w-4 h-4"/> : null}>
          {isLoading ? 'Analyzing...' : (previousChangelog ? 'Compare with Previous' : 'Summarize')}
        </Button>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div>
          <p className="ml-3 text-slate-300">Gemini is thinking...</p>
        </div>
      )}

      {analysis && (
        <div className="mt-2 text-sm">
          {analysis.summary && (
            <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap p-3 bg-slate-800/50 rounded-md border border-slate-700">
              {analysis.summary}
            </div>
          )}
          {analysis.error && (
            <p className="text-red-400 bg-red-900/30 p-3 rounded-md border border-red-700">{analysis.error}</p>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default ChangelogAnalyzer;
