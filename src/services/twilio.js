const twilio = require('twilio');
const config = require('../config');

class TwilioService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.client = twilio(
      config.twilio.accountSid,
      config.twilio.authToken
    );
    this.initialized = true;
  }

  /**
   * Make an outbound call
   * @param {string} to - Phone number to call (E.164 format)
   * @param {string} webhookUrl - URL for TwiML instructions
   * @param {object} options - Additional call options
   */
  async makeCall(to, webhookUrl, options = {}) {
    this.initialize();

    const callOptions = {
      to,
      from: config.twilio.phoneNumber,
      url: webhookUrl,
      statusCallback: options.statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: options.detectVoicemail ? 'DetectMessageEnd' : 'Enable',
      machineDetectionTimeout: 30,
      timeout: options.timeout || 30,
      record: options.record || false,
    };

    if (options.asyncAmd) {
      callOptions.asyncAmd = true;
      callOptions.asyncAmdStatusCallback = options.amdCallbackUrl;
      callOptions.asyncAmdStatusCallbackMethod = 'POST';
    }

    const call = await this.client.calls.create(callOptions);

    return {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      dateCreated: call.dateCreated,
    };
  }

  /**
   * Get call details
   */
  async getCall(callSid) {
    this.initialize();
    const call = await this.client.calls(callSid).fetch();

    return {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      answeredBy: call.answeredBy,
    };
  }

  /**
   * End an active call
   */
  async endCall(callSid) {
    this.initialize();
    const call = await this.client.calls(callSid).update({ status: 'completed' });
    return { callSid: call.sid, status: call.status };
  }

  /**
   * Get call recordings
   */
  async getRecordings(callSid) {
    this.initialize();
    const recordings = await this.client.recordings.list({ callSid });

    return recordings.map(r => ({
      recordingSid: r.sid,
      duration: r.duration,
      url: `https://api.twilio.com${r.uri.replace('.json', '.mp3')}`,
    }));
  }

  /**
   * Generate TwiML for connecting to ElevenLabs via WebSocket
   */
  generateStreamTwiML(websocketUrl, candidateName) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Initial greeting while connecting
    response.say({ voice: 'alice' }, 'Please hold while we connect you.');

    // Connect to WebSocket for bidirectional audio streaming
    const connect = response.connect();
    connect.stream({
      url: websocketUrl,
      name: 'elevenlabs-stream',
    }).parameter({ name: 'candidateName', value: candidateName });

    return response.toString();
  }

  /**
   * Generate TwiML for voicemail
   */
  generateVoicemailTwiML(message) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.pause({ length: 2 });
    response.say({ voice: 'alice' }, message);
    response.hangup();

    return response.toString();
  }

  /**
   * Generate TwiML to hang up
   */
  generateHangupTwiML() {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.hangup();
    return response.toString();
  }
}

module.exports = new TwilioService();
