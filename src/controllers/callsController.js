const twilioService = require('../services/twilio');
const googleSheets = require('../services/googleSheets');
const config = require('../config');

// In-memory call state (replace with database in production)
const callState = {
  queue: [],
  activeCalls: new Map(),
  isRunning: false,
};

/**
 * Start the calling queue
 */
async function startQueue(req, res, next) {
  try {
    if (callState.isRunning) {
      return res.json({ success: false, message: 'Queue is already running' });
    }

    // Load pending candidates
    const candidates = await googleSheets.getPendingCandidates();
    callState.queue = candidates.filter(c =>
      c.attempts < config.compliance.maxRetryAttempts
    );
    callState.isRunning = true;

    res.json({
      success: true,
      message: 'Calling queue started',
      queueSize: callState.queue.length,
    });

    // Start processing queue in background
    processQueue();
  } catch (error) {
    next(error);
  }
}

/**
 * Stop the calling queue
 */
async function stopQueue(req, res, next) {
  try {
    callState.isRunning = false;
    res.json({
      success: true,
      message: 'Calling queue stopped',
      remainingInQueue: callState.queue.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get queue status
 */
async function getQueueStatus(req, res, next) {
  try {
    res.json({
      isRunning: callState.isRunning,
      queueSize: callState.queue.length,
      activeCalls: callState.activeCalls.size,
      activeCallDetails: Array.from(callState.activeCalls.values()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific call details
 */
async function getCallDetails(req, res, next) {
  try {
    const { id } = req.params;

    // Check in-memory first
    if (callState.activeCalls.has(id)) {
      return res.json(callState.activeCalls.get(id));
    }

    // Fetch from Twilio
    const call = await twilioService.getCall(id);
    res.json(call);
  } catch (error) {
    next(error);
  }
}

/**
 * Make a single test call
 */
async function makeTestCall(req, res, next) {
  try {
    const { phoneNumber, candidateName } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    const baseUrl = req.body.baseUrl || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/webhooks/twilio/voice`;
    const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;

    const call = await twilioService.makeCall(phoneNumber, webhookUrl, {
      statusCallbackUrl,
      detectVoicemail: true,
    });

    callState.activeCalls.set(call.callSid, {
      ...call,
      candidateName: candidateName || 'Test',
      startedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      call,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Twilio voice webhook - returns TwiML
 */
async function twilioVoiceWebhook(req, res) {
  const { CallSid, AnsweredBy } = req.body;

  // Check if voicemail
  if (AnsweredBy && AnsweredBy.includes('machine')) {
    const voicemailMessage = 'Hello, this is a call regarding a job opportunity. Please call us back at your convenience. Thank you.';
    res.type('text/xml');
    return res.send(twilioService.generateVoicemailTwiML(voicemailMessage));
  }

  // Connect to ElevenLabs WebSocket
  const callData = callState.activeCalls.get(CallSid) || {};
  const wsUrl = `wss://${req.get('host')}/api/media-stream`;

  res.type('text/xml');
  res.send(twilioService.generateStreamTwiML(wsUrl, callData.candidateName || 'Candidate'));
}

/**
 * Twilio status callback webhook
 */
async function twilioStatusWebhook(req, res) {
  const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;

  const callData = callState.activeCalls.get(CallSid);
  if (callData) {
    callData.status = CallStatus;
    callData.duration = CallDuration;
    callData.answeredBy = AnsweredBy;
    callData.updatedAt = new Date().toISOString();

    // If call completed, move to history
    if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(CallStatus)) {
      callData.endedAt = new Date().toISOString();

      // Update Google Sheet if we have row info
      if (callData.rowIndex) {
        const status = CallStatus === 'completed' ? 'Completed' : 'No Answer';
        await googleSheets.updateCandidateStatus(callData.rowIndex, {
          status,
          lastCalled: callData.endedAt,
          attempts: (callData.attempts || 0) + 1,
        });
      }
    }
  }

  res.sendStatus(200);
}

/**
 * Twilio AMD (answering machine detection) callback
 */
async function twilioAmdWebhook(req, res) {
  const { CallSid, AnsweredBy, MachineDetectionDuration } = req.body;

  const callData = callState.activeCalls.get(CallSid);
  if (callData) {
    callData.answeredBy = AnsweredBy;
    callData.machineDetectionDuration = MachineDetectionDuration;
  }

  res.sendStatus(200);
}

/**
 * Process the call queue (runs in background)
 */
async function processQueue() {
  while (callState.isRunning && callState.queue.length > 0) {
    // Check calling hours
    const hour = new Date().getHours();
    if (hour < config.compliance.callingHoursStart || hour >= config.compliance.callingHoursEnd) {
      console.log('Outside calling hours, pausing queue');
      await sleep(60000); // Wait 1 minute and check again
      continue;
    }

    // Get next candidate
    const candidate = callState.queue.shift();
    if (!candidate || !candidate.phone) continue;

    try {
      console.log(`Calling ${candidate.name} at ${candidate.phone}`);

      // This would need the actual server URL in production
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const webhookUrl = `${baseUrl}/api/webhooks/twilio/voice`;
      const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;

      const call = await twilioService.makeCall(candidate.phone, webhookUrl, {
        statusCallbackUrl,
        detectVoicemail: true,
      });

      callState.activeCalls.set(call.callSid, {
        ...call,
        candidateName: candidate.name,
        rowIndex: candidate.rowIndex,
        attempts: candidate.attempts,
        startedAt: new Date().toISOString(),
      });

      // Wait before next call
      await sleep(5000);
    } catch (error) {
      console.error(`Error calling ${candidate.name}:`, error.message);
    }
  }

  if (callState.queue.length === 0) {
    callState.isRunning = false;
    console.log('Queue processing complete');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  startQueue,
  stopQueue,
  getQueueStatus,
  getCallDetails,
  makeTestCall,
  twilioVoiceWebhook,
  twilioStatusWebhook,
  twilioAmdWebhook,
};
