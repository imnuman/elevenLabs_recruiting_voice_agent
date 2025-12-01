import { useState, useEffect } from 'react';
import StatsCards from './components/StatsCards';
import QueueControls from './components/QueueControls';
import ActiveCalls from './components/ActiveCalls';
import CallHistory from './components/CallHistory';

function App() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/calls/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/calls/history');
      const data = await res.json();
      setHistory(data.calls || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchStatus(), fetchHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    await fetch('/api/calls/start', { method: 'POST' });
    fetchAll();
  };

  const handleStop = async () => {
    await fetch('/api/calls/stop', { method: 'POST' });
    fetchAll();
  };

  const handlePause = async () => {
    await fetch('/api/calls/pause', { method: 'POST' });
    fetchAll();
  };

  const handleResume = async () => {
    await fetch('/api/calls/resume', { method: 'POST' });
    fetchAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Recruiting Voice Agent
          </h1>
          <p className="text-sm text-gray-500">Dashboard</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <StatsCards status={status} historyCount={history.length} />

        <QueueControls
          status={status}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
        />

        <ActiveCalls calls={status?.activeCallDetails || []} />

        <CallHistory calls={history} />
      </main>
    </div>
  );
}

export default App;
