const express = require('express');
const router = express.Router();
const sheetsController = require('../controllers/sheetsController');
const callsController = require('../controllers/callsController');
const dashboardController = require('../controllers/dashboardController');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Call routes
router.post('/calls/start', callsController.startQueue);
router.post('/calls/stop', callsController.stopQueue);
router.post('/calls/pause', callsController.pauseQueue);
router.post('/calls/resume', callsController.resumeQueue);
router.get('/calls/status', callsController.getQueueStatus);
router.get('/calls/history', callsController.getCompletedCalls);
router.get('/calls/:id', callsController.getCallDetails);
router.post('/calls/test', callsController.makeTestCall);

// Twilio webhooks
router.post('/webhooks/twilio/voice', callsController.twilioVoiceWebhook);
router.post('/webhooks/twilio/status', callsController.twilioStatusWebhook);
router.post('/webhooks/twilio/amd', callsController.twilioAmdWebhook);

// Sheets routes
router.post('/sheets/sync', sheetsController.syncSheet);
router.get('/sheets/candidates', sheetsController.getCandidates);
router.get('/sheets/candidates/pending', sheetsController.getPendingCandidates);
router.put('/sheets/candidates/:rowIndex', sheetsController.updateCandidate);
router.post('/sheets/candidates/:rowIndex/dnc', sheetsController.markDoNotCall);

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/sync-status', dashboardController.getSyncStatus);

module.exports = router;
