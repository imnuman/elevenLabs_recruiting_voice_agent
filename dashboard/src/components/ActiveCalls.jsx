function ActiveCalls({ calls }) {
  if (calls.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Calls</h2>
        <p className="text-gray-500 text-center py-4">No active calls</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Active Calls ({calls.length})
      </h2>
      <div className="space-y-3">
        {calls.map((call) => (
          <div
            key={call.callSid}
            className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
          >
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">{call.candidateName}</p>
                <p className="text-sm text-gray-500">
                  Started: {new Date(call.startedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
              {call.status || 'In Progress'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActiveCalls;
