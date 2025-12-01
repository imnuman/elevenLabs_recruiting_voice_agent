const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Call routes (to be implemented)
router.post('/calls/start', (req, res) => {
  res.json({ message: 'Start calling queue - not implemented yet' });
});

router.post('/calls/stop', (req, res) => {
  res.json({ message: 'Stop calling queue - not implemented yet' });
});

router.get('/calls/status', (req, res) => {
  res.json({ message: 'Get queue status - not implemented yet' });
});

router.get('/calls/:id', (req, res) => {
  res.json({ message: `Get call ${req.params.id} - not implemented yet` });
});

// Sheets routes (to be implemented)
router.post('/sheets/sync', (req, res) => {
  res.json({ message: 'Sync with Google Sheet - not implemented yet' });
});

// Dashboard routes (to be implemented)
router.get('/dashboard/stats', (req, res) => {
  res.json({ message: 'Get dashboard stats - not implemented yet' });
});

module.exports = router;
