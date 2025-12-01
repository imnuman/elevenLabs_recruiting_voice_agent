function StatsCards({ status, historyCount }) {
  const stats = [
    {
      label: 'Queue Size',
      value: status?.queueSize || 0,
      color: 'bg-blue-500',
    },
    {
      label: 'Active Calls',
      value: status?.activeCalls || 0,
      color: 'bg-green-500',
    },
    {
      label: 'Completed Today',
      value: historyCount,
      color: 'bg-purple-500',
    },
    {
      label: 'Status',
      value: status?.isRunning ? (status?.isPaused ? 'Paused' : 'Running') : 'Stopped',
      color: status?.isRunning ? (status?.isPaused ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className={`${stat.color} rounded-full w-3 h-3 mr-3`}></div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
