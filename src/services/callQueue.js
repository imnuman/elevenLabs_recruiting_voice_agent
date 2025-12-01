const EventEmitter = require('events');
const config = require('../config');
const googleSheets = require('./googleSheets');
const twilioService = require('./twilio');

class CallQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeCalls = new Map();
    this.completedCalls = [];
    this.isRunning = false;
    this.isPaused = false;
    this.concurrentCalls = 1; // Number of simultaneous calls
    this.callDelay = 5000; // Delay between calls in ms
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * Load candidates from Google Sheets and populate queue
   */
  async loadCandidates(sheetName = 'Sheet1') {
    const candidates = await googleSheets.getPendingCandidates(sheetName);

    // Filter by max retry attempts
    this.queue = candidates.filter(c =>
      c.attempts < config.compliance.maxRetryAttempts
    );

    this.emit('queueLoaded', { count: this.queue.length });
    return this.queue.length;
  }

  /**
   * Check if current time is within calling hours
   */
  isWithinCallingHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= config.compliance.callingHoursStart &&
           hour < config.compliance.callingHoursEnd;
  }

  /**
   * Start processing the queue
   */
  async start() {
    if (this.isRunning) {
      return { success: false, message: 'Queue is already running' };
    }

    this.isRunning = true;
    this.isPaused = false;
    this.emit('started');

    this.processQueue();

    return {
      success: true,
      message: 'Queue started',
      queueSize: this.queue.length,
    };
  }

  /**
   * Pause the queue (finish active calls but don't start new ones)
   */
  pause() {
    this.isPaused = true;
    this.emit('paused');
    return { success: true, message: 'Queue paused' };
  }

  /**
   * Resume the queue
   */
  resume() {
    if (!this.isRunning) {
      return { success: false, message: 'Queue is not running' };
    }
    this.isPaused = false;
    this.emit('resumed');
    this.processQueue();
    return { success: true, message: 'Queue resumed' };
  }

  /**
   * Stop the queue completely
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.emit('stopped');
    return {
      success: true,
      message: 'Queue stopped',
      remainingInQueue: this.queue.length,
      activeCalls: this.activeCalls.size,
    };
  }

  /**
   * Process the queue
   */
  async processQueue() {
    while (this.isRunning && !this.isPaused) {
      // Check calling hours
      if (!this.isWithinCallingHours()) {
        console.log('Outside calling hours, waiting...');
        this.emit('outsideCallingHours');
        await this.sleep(60000); // Check again in 1 minute
        continue;
      }

      // Check if we can make more calls
      if (this.activeCalls.size >= this.concurrentCalls) {
        await this.sleep(1000);
        continue;
      }

      // Get next candidate
      const candidate = this.queue.shift();
      if (!candidate) {
        console.log('Queue empty');
        this.isRunning = false;
        this.emit('queueEmpty');
        break;
      }

      // Make the call
      try {
        await this.makeCall(candidate);
      } catch (error) {
        console.error(`Error calling ${candidate.name}:`, error.message);
        this.emit('callError', { candidate, error: error.message });
      }

      // Delay before next call
      await this.sleep(this.callDelay);
    }
  }

  /**
   * Make a call to a candidate
   */
  async makeCall(candidate) {
    if (!candidate.phone) {
      console.log(`Skipping ${candidate.name}: no phone number`);
      return;
    }

    console.log(`Calling ${candidate.name} at ${candidate.phone}`);

    const webhookUrl = `${this.baseUrl}/api/webhooks/twilio/voice`;
    const statusCallbackUrl = `${this.baseUrl}/api/webhooks/twilio/status`;
    const amdCallbackUrl = `${this.baseUrl}/api/webhooks/twilio/amd`;

    const call = await twilioService.makeCall(candidate.phone, webhookUrl, {
      statusCallbackUrl,
      detectVoicemail: true,
      asyncAmd: true,
      amdCallbackUrl,
    });

    // Store call data
    const callData = {
      ...call,
      candidate,
      rowIndex: candidate.rowIndex,
      attempts: candidate.attempts + 1,
      startedAt: new Date().toISOString(),
      outcome: null,
      transcript: [],
    };

    this.activeCalls.set(call.callSid, callData);
    this.emit('callStarted', callData);

    return callData;
  }

  /**
   * Handle call status update from Twilio webhook
   */
  async handleCallStatus(callSid, status, details = {}) {
    const callData = this.activeCalls.get(callSid);
    if (!callData) return;

    callData.status = status;
    callData.updatedAt = new Date().toISOString();

    if (details.duration) callData.duration = details.duration;
    if (details.answeredBy) callData.answeredBy = details.answeredBy;

    // Handle completed calls
    const finalStatuses = ['completed', 'busy', 'no-answer', 'canceled', 'failed'];
    if (finalStatuses.includes(status)) {
      callData.endedAt = new Date().toISOString();

      // Determine outcome
      const outcome = this.determineOutcome(callData);
      callData.outcome = outcome;

      // Update Google Sheet
      await this.updateSheetWithOutcome(callData);

      // Move to completed
      this.activeCalls.delete(callSid);
      this.completedCalls.push(callData);

      this.emit('callCompleted', callData);

      // Handle retry for no-answer
      if (outcome.shouldRetry && callData.attempts < config.compliance.maxRetryAttempts) {
        this.queue.push(callData.candidate);
        this.emit('callScheduledForRetry', callData);
      }
    }

    this.emit('callStatusUpdated', callData);
  }

  /**
   * Determine call outcome
   */
  determineOutcome(callData) {
    const { status, answeredBy, duration } = callData;

    if (status === 'no-answer' || status === 'busy') {
      return { status: 'No Answer', shouldRetry: true };
    }

    if (status === 'failed' || status === 'canceled') {
      return { status: 'Failed', shouldRetry: true };
    }

    if (answeredBy && answeredBy.includes('machine')) {
      return { status: 'Voicemail', shouldRetry: true };
    }

    if (status === 'completed') {
      // Parse transcript to determine interest (simplified)
      const interestLevel = this.analyzeTranscript(callData.transcript);
      return {
        status: 'Completed',
        interestLevel,
        shouldRetry: false,
      };
    }

    return { status: 'Unknown', shouldRetry: false };
  }

  /**
   * Analyze transcript to determine interest level
   * This is a simplified version - could be enhanced with NLP
   */
  analyzeTranscript(transcript) {
    if (!transcript || transcript.length === 0) {
      return 'Unknown';
    }

    const text = transcript.map(t => t.text.toLowerCase()).join(' ');

    // Check for positive signals
    const positiveKeywords = ['interested', 'yes', 'sure', 'sounds good', 'tell me more', 'schedule', 'available'];
    const negativeKeywords = ['not interested', 'no thanks', 'remove me', 'don\'t call', 'busy', 'wrong number'];
    const callbackKeywords = ['call back', 'callback', 'later', 'another time', 'busy right now'];

    for (const keyword of negativeKeywords) {
      if (text.includes(keyword)) return 'Not Interested';
    }

    for (const keyword of callbackKeywords) {
      if (text.includes(keyword)) return 'Callback Requested';
    }

    for (const keyword of positiveKeywords) {
      if (text.includes(keyword)) return 'Interested';
    }

    return 'Completed';
  }

  /**
   * Update Google Sheet with call outcome
   */
  async updateSheetWithOutcome(callData) {
    const { rowIndex, outcome, attempts, endedAt } = callData;

    try {
      await googleSheets.updateCandidateStatus(rowIndex, {
        status: outcome.status,
        outcome: outcome.interestLevel || outcome.status,
        lastCalled: endedAt,
        attempts,
      });
    } catch (error) {
      console.error('Error updating sheet:', error.message);
    }
  }

  /**
   * Store transcript for a call
   */
  addTranscript(callSid, role, text) {
    const callData = this.activeCalls.get(callSid);
    if (callData) {
      callData.transcript.push({
        role,
        text,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      queueSize: this.queue.length,
      activeCalls: this.activeCalls.size,
      completedCalls: this.completedCalls.length,
      activeCallDetails: Array.from(this.activeCalls.values()).map(c => ({
        callSid: c.callSid,
        candidateName: c.candidate.name,
        status: c.status,
        startedAt: c.startedAt,
      })),
      isWithinCallingHours: this.isWithinCallingHours(),
      callingHours: {
        start: config.compliance.callingHoursStart,
        end: config.compliance.callingHoursEnd,
      },
    };
  }

  /**
   * Get call by SID
   */
  getCall(callSid) {
    return this.activeCalls.get(callSid) ||
           this.completedCalls.find(c => c.callSid === callSid);
  }

  /**
   * Get all completed calls
   */
  getCompletedCalls() {
    return this.completedCalls;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new CallQueue();
