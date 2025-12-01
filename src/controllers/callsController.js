const twilioService = require('../services/twilio');
const callQueue = require('../services/callQueue');

/**
 * Start the calling queue
 */
async function startQueue(req, res, next) {
  try {
    const { sheetName } = req.body;

    // Load candidates from sheet
    const count = await callQueue.loadCandidates(sheetName);

    if (count === 0) {
      return res.json({
        success: false,
        message: 'No pending candidates found',
      });
    }

    // Start the queue
    const result = await callQueue.start();
    res.json({
      ...result,
      candidatesLoaded: count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Stop the calling queue
 */
async function stopQueue(req, res, next) {
  try {
    const result = callQueue.stop();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Pause the calling queue
 */
async function pauseQueue(req, res, next) {
  try {
    const result = callQueue.pause();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Resume the calling queue
 */
async function resumeQueue(req, res, next) {
  try {
    const result = callQueue.resume();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get queue status
 */
async function getQueueStatus(req, res, next) {
  try {
    const status = callQueue.getStatus();
    res.json(status);
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

    // Check in queue service first
    const callData = callQueue.getCall(id);
    if (callData) {
      return res.json(callData);
    }

    // Fetch from Twilio
    const call = await twilioService.getCall(id);
    res.json(call);
  } catch (error) {
    next(error);
  }
}

/**
 * Get completed calls history
 */
async function getCompletedCalls(req, res, next) {
  try {
    const calls = callQueue.getCompletedCalls();
    res.json({
      count: calls.length,
      calls,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Make a single test call
 */
async function makeTestCall(req, res, next) {
  try {
    const { phoneNumber, candidateName, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/webhooks/twilio/voice`;
    const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;

    const call = await twilioService.makeCall(phoneNumber, webhookUrl, {
      statusCallbackUrl,
      detectVoicemail: true,
    });

    // Add to active calls tracking
    const callData = {
      ...call,
      candidate: {
        name: candidateName || 'Test Candidate',
        phone: phoneNumber,
        role: role || 'Test Position',
      },
      startedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      call: callData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Twilio voice webhook - returns TwiML
 */
async function twilioVoiceWebhook(req, res) {
  const { CallSid, AnsweredBy, To } = req.body;

  // Check if voicemail
  if (AnsweredBy && AnsweredBy.includes('machine')) {
    const voicemailMessage = 'Hello, this is a call regarding a job opportunity. Please call us back at your convenience. Thank you.';
    res.type('text/xml');
    return res.send(twilioService.generateVoicemailTwiML(voicemailMessage));
  }

  // Get call data for candidate context
  const callData = callQueue.getCall(CallSid);
  const candidateName = callData?.candidate?.name || 'there';

  // Build WebSocket URL with candidate context
  const wsHost = req.get('host');
  const wsProtocol = req.protocol === 'https' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${wsHost}/api/media-stream?candidateName=${encodeURIComponent(candidateName)}`;

  res.type('text/xml');
  res.send(twilioService.generateStreamTwiML(wsUrl, candidateName));
}

/**
 * Twilio status callback webhook
 */
async function twilioStatusWebhook(req, res) {
  const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;

  // Update call queue with status
  await callQueue.handleCallStatus(CallSid, CallStatus, {
    duration: CallDuration,
    answeredBy: AnsweredBy,
  });

  res.sendStatus(200);
}

/**
 * Twilio AMD (answering machine detection) callback
 */
async function twilioAmdWebhook(req, res) {
  const { CallSid, AnsweredBy, MachineDetectionDuration } = req.body;

  // Update call with AMD result
  const callData = callQueue.getCall(CallSid);
  if (callData) {
    callData.answeredBy = AnsweredBy;
    callData.machineDetectionDuration = MachineDetectionDuration;
  }

  res.sendStatus(200);
}

module.exports = {
  startQueue,
  stopQueue,
  pauseQueue,
  resumeQueue,
  getQueueStatus,
  getCallDetails,
  getCompletedCalls,
  makeTestCall,
  twilioVoiceWebhook,
  twilioStatusWebhook,
  twilioAmdWebhook,
};
