"use client";

/**
 * Root error boundary for the Next.js App Router.
 *
 * Rendered automatically when an unhandled error is thrown anywhere in the
 * component tree beneath the root layout. Without this file, unhandled errors
 * produce a blank white screen in production with no recovery path.
 *
 * The raw error message is intentionally NOT shown to the user — it may
 * contain internal stack traces or sensitive data. Errors are logged to the
 * console for server-side observability tools to capture.
 */

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  // Log for server-side observability / future Sentry integration
  console.error("[GlobalError boundary]", error);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-3">Something went wrong</h1>
        <p className="text-[#a0a0a0] mb-6">
          An unexpected error occurred. Please try again, or contact support if
          the problem persists.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-[#a32020] hover:bg-[#8a1b1b] text-white rounded-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
