const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');
const routes = require('./routes');
const MediaStreamHandler = require('./services/mediaStreamHandler');

const app = express();
const server = http.createServer(app);

// WebSocket server for Twilio media streams
const wss = new WebSocket.Server({ server, path: '/api/media-stream' });

wss.on('connection', (ws, req) => {
  console.log('New Twilio media stream connection');

  // Extract candidate context from query params if available
  const url = new URL(req.url, `http://${req.headers.host}`);
  const candidateContext = {
    candidateName: url.searchParams.get('candidateName') || 'Candidate',
    companyName: process.env.COMPANY_NAME || 'Our Company',
    agentName: process.env.AGENT_NAME || 'Sarah',
  };

  // Create media stream handler
  const handler = new MediaStreamHandler(ws, candidateContext);
  handler.initialize();

  ws.on('close', () => {
    console.log('Twilio media stream disconnected');
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ElevenLabs Recruiting Voice Agent',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      calls: '/api/calls/*',
      sheets: '/api/sheets/*',
      dashboard: '/api/dashboard/*',
      mediaStream: '/api/media-stream (WebSocket)',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
  console.log(`WebSocket: ws://localhost:${config.port}/api/media-stream`);
});

module.exports = { app, server };
