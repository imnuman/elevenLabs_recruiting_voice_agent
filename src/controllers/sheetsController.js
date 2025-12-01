const googleSheets = require('../services/googleSheets');

/**
 * Get all candidates from the sheet
 */
async function getCandidates(req, res, next) {
  try {
    const sheetName = req.query.sheet || 'Sheet1';
    const candidates = await googleSheets.getCandidates(sheetName);

    res.json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pending candidates (ready to call)
 */
async function getPendingCandidates(req, res, next) {
  try {
    const sheetName = req.query.sheet || 'Sheet1';
    const candidates = await googleSheets.getPendingCandidates(sheetName);

    res.json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a candidate's status
 */
async function updateCandidate(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const { status, outcome, callback, attempts } = req.body;
    const sheetName = req.query.sheet || 'Sheet1';

    const result = await googleSheets.updateCandidateStatus(
      parseInt(rowIndex),
      { status, outcome, callback, attempts },
      sheetName
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Mark candidate as Do Not Call
 */
async function markDoNotCall(req, res, next) {
  try {
    const { rowIndex } = req.params;
    const sheetName = req.query.sheet || 'Sheet1';

    const result = await googleSheets.markDoNotCall(parseInt(rowIndex), sheetName);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Sync / validate sheet connection
 */
async function syncSheet(req, res, next) {
  try {
    const sheetInfo = await googleSheets.getSheetInfo();
    const candidates = await googleSheets.getCandidates();
    const pending = await googleSheets.getPendingCandidates();

    res.json({
      success: true,
      sheet: sheetInfo,
      stats: {
        totalCandidates: candidates.length,
        pendingCalls: pending.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCandidates,
  getPendingCandidates,
  updateCandidate,
  markDoNotCall,
  syncSheet,
};
