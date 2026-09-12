import React from 'react';
import { Button } from '../../../components/ui/Button';

interface GenerationErrorAlertProps {
  error: string | null;
  onRetry?: () => void;
  onUseSample?: (sampleUrl: string) => void;
  onDismiss?: () => void;
}

export const GenerationErrorAlert: React.FC<GenerationErrorAlertProps> = ({
  error,
  onRetry,
  onUseSample,
  onDismiss,
}) => {
  if (!error) return null;

  const errorLower = error.toLowerCase();
  const isTranscriptError =
    errorLower.includes('transcript') ||
    errorLower.includes('caption') ||
    errorLower.includes('subtitles');
  const isApiKeyError =
    errorLower.includes('gemini_api_key') ||
    errorLower.includes('gemini is not configured') ||
    errorLower.includes('api key');
  const isNetworkError =
    errorLower.includes('connect to the backend') ||
    errorLower.includes('network') ||
    errorLower.includes('timeout') ||
    errorLower.includes('connection');
  const isRateLimitError =
    errorLower.includes('rate limit') ||
    errorLower.includes('too many requests') ||
    errorLower.includes('429');

  const SAMPLE_VERIFIED_URL = 'https://www.youtube.com/watch?v=pWO3HyVG-xg';

  return (
    <div
      role="alert"
      className="p-5 rounded-2xl bg-amber-50/95 border border-red-200/90 shadow-sm text-stone-800 transition-all duration-200 animate-fadeIn"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          {/* Status Icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-100/90 text-red-600 flex items-center justify-center font-bold text-base border border-red-200">
            !
          </div>

          <div className="space-y-1.5 flex-1">
            <h4 className="font-serif font-semibold text-sm text-stone-900 tracking-tight">
              Unable to Generate Academic Notes
            </h4>
            <p className="text-xs text-red-700 font-mono bg-red-50/60 p-2 rounded border border-red-100/80 leading-relaxed">
              {error}
            </p>

            {/* Contextual guidance depending on the specific error */}
            {isTranscriptError && (
              <div className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <span>ℹ️</span> Transcript Not Available
                </p>
                <p className="text-stone-600 leading-normal">
                  YouTube did not provide captions for this video. Please ensure the video has closed captions (CC) or auto-generated subtitles enabled by the creator.
                </p>
              </div>
            )}

            {isApiKeyError && (
              <div className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <span>🔑</span> Gemini API Key Setup Required
                </p>
                <p className="text-stone-600 leading-normal">
                  Please set your <code className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> in <code className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[11px]">backend/.env</code> and restart the server.
                </p>
              </div>
            )}

            {isRateLimitError && (
              <div className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <span>⏳</span> Rate Limit Exceeded
                </p>
                <p className="text-stone-600 leading-normal">
                  You have made too many requests in a short period. Please wait 60 seconds before submitting again.
                </p>
              </div>
            )}

            {isNetworkError && (
              <div className="text-xs text-stone-600 bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <span>🔌</span> Backend Server Unreachable
                </p>
                <p className="text-stone-600 leading-normal">
                  Could not communicate with the note synthesis backend. Verify that the backend server is running on <code className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[11px]">http://localhost:5000</code>.
                </p>
              </div>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-stone-400 hover:text-stone-700 p-1 text-xs rounded transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Actionable buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-3 mt-3 border-t border-red-200/60">
        {onRetry && (
          <Button
            type="button"
            size="sm"
            onClick={onRetry}
            className="bg-amber-800 hover:bg-amber-900 text-white shadow-none text-xs"
          >
            Try Again
          </Button>
        )}
        {onUseSample && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUseSample(SAMPLE_VERIFIED_URL)}
            className="text-xs bg-white/80 border-stone-300 text-stone-700 hover:bg-white"
          >
            Try Verified Sample Video
          </Button>
        )}
      </div>
    </div>
  );
};
