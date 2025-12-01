const callQueue = require('../services/callQueue');
const googleSheets = require('../services/googleSheets');

/**
 * Get dashboard statistics
 */
async function getStats(req, res, next) {
  try {
    const queueStatus = callQueue.getStatus();
    const completedCalls = callQueue.getCompletedCalls();

    // Calculate stats from completed calls
    const stats = {
      queue: {
        isRunning: queueStatus.isRunning,
        isPaused: queueStatus.isPaused,
        size: queueStatus.queueSize,
        activeCalls: queueStatus.activeCalls,
        isWithinCallingHours: queueStatus.isWithinCallingHours,
        callingHours: queueStatus.callingHours,
      },
      today: calculateTodayStats(completedCalls),
      outcomes: calculateOutcomeStats(completedCalls),
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
}

/**
 * Calculate stats for today's calls
 */
function calculateTodayStats(calls) {
  const today = new Date().toDateString();
  const todayCalls = calls.filter(c =>
    c.endedAt && new Date(c.endedAt).toDateString() === today
  );

  const totalDuration = todayCalls.reduce((sum, c) => sum + (parseInt(c.duration) || 0), 0);
  const completedCalls = todayCalls.filter(c => c.status === 'completed');

  return {
    totalCalls: todayCalls.length,
    completedCalls: completedCalls.length,
    totalDuration,
    averageDuration: completedCalls.length > 0
      ? Math.round(totalDuration / completedCalls.length)
      : 0,
  };
}

/**
 * Calculate outcome statistics
 */
function calculateOutcomeStats(calls) {
  const outcomes = {
    interested: 0,
    notInterested: 0,
    callback: 0,
    voicemail: 0,
    noAnswer: 0,
    other: 0,
  };

  calls.forEach(call => {
    const outcome = call.outcome?.interestLevel || call.outcome?.status || 'other';
    switch (outcome.toLowerCase()) {
      case 'interested':
        outcomes.interested++;
        break;
      case 'not interested':
        outcomes.notInterested++;
        break;
      case 'callback requested':
        outcomes.callback++;
        break;
      case 'voicemail':
        outcomes.voicemail++;
        break;
      case 'no answer':
        outcomes.noAnswer++;
        break;
      default:
        outcomes.other++;
    }
  });

  const total = calls.length || 1;
  return {
    counts: outcomes,
    rates: {
      interested: Math.round((outcomes.interested / total) * 100),
      notInterested: Math.round((outcomes.notInterested / total) * 100),
      callback: Math.round((outcomes.callback / total) * 100),
      contactRate: Math.round(((outcomes.interested + outcomes.notInterested + outcomes.callback) / total) * 100),
    },
  };
}

/**
 * Get sheet sync status
 */
async function getSyncStatus(req, res, next) {
  try {
    const sheetInfo = await googleSheets.getSheetInfo();
    const candidates = await googleSheets.getCandidates();
    const pending = await googleSheets.getPendingCandidates();

    res.json({
      connected: true,
      sheet: sheetInfo,
      candidates: {
        total: candidates.length,
        pending: pending.length,
        completed: candidates.filter(c => c.status === 'Completed').length,
      },
    });
  } catch (error) {
    res.json({
      connected: false,
      error: error.message,
    });
  }
}

module.exports = {
  getStats,
  getSyncStatus,
};
