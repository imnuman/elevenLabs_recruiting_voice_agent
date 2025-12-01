function QueueControls({ status, onStart, onStop, onPause, onResume }) {
  const isRunning = status?.isRunning;
  const isPaused = status?.isPaused;
  const isWithinHours = status?.isWithinCallingHours;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Queue Controls</h2>
          <p className="text-sm text-gray-500">
            Calling hours: {status?.callingHours?.start || 8}:00 - {status?.callingHours?.end || 21}:00
            {!isWithinHours && (
              <span className="ml-2 text-yellow-600">(Outside calling hours)</span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Start Queue
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  Pause
                </button>
              )}
              <button
                onClick={onStop}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default QueueControls;
