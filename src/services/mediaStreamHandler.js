const WebSocket = require('ws');
const elevenlabs = require('./elevenlabs');
const { twilioToElevenLabs, elevenLabsToTwilio } = require('../utils/audioConverter');

/**
 * Handle bidirectional audio streaming between Twilio and ElevenLabs
 */
class MediaStreamHandler {
  constructor(twilioWs, candidateContext = {}) {
    this.twilioWs = twilioWs;
    this.elevenLabsWs = null;
    this.candidateContext = candidateContext;
    this.streamSid = null;
    this.callSid = null;
    this.isConnected = false;
    this.transcript = [];
  }

  /**
   * Initialize the handler
   */
  async initialize() {
    // Create ElevenLabs connection
    this.elevenLabsWs = elevenlabs.createConversation(this.candidateContext);

    this.setupElevenLabsHandlers();
    this.setupTwilioHandlers();
  }

  /**
   * Set up ElevenLabs WebSocket event handlers
   */
  setupElevenLabsHandlers() {
    this.elevenLabsWs.on('open', () => {
      console.log('Connected to ElevenLabs');
      this.isConnected = true;

      // Send conversation config with candidate context
      elevenlabs.sendConversationConfig(this.elevenLabsWs, this.candidateContext);
    });

    this.elevenLabsWs.on('message', (data) => {
      const message = elevenlabs.parseMessage(data);
      if (!message) return;

      this.handleElevenLabsMessage(message);
    });

    this.elevenLabsWs.on('error', (error) => {
      console.error('ElevenLabs WebSocket error:', error.message);
    });

    this.elevenLabsWs.on('close', () => {
      console.log('ElevenLabs connection closed');
      this.isConnected = false;
    });
  }

  /**
   * Handle messages from ElevenLabs
   */
  handleElevenLabsMessage(message) {
    switch (message.type) {
      case 'audio':
        // Convert and send to Twilio
        this.sendAudioToTwilio(message.audio);
        break;

      case 'transcript':
        // Store transcript
        this.transcript.push({
          role: message.role, // 'agent' or 'user'
          text: message.text,
          timestamp: new Date().toISOString(),
        });
        console.log(`[${message.role}]: ${message.text}`);
        break;

      case 'interruption':
        // User interrupted the agent
        console.log('User interrupted');
        break;

      case 'conversation_initiation_metadata':
        console.log('Conversation initialized:', message.conversation_id);
        break;

      case 'error':
        console.error('ElevenLabs error:', message.message);
        break;

      case 'ping':
        // Respond to ping
        if (this.elevenLabsWs.readyState === WebSocket.OPEN) {
          this.elevenLabsWs.send(JSON.stringify({ type: 'pong' }));
        }
        break;
    }
  }

  /**
   * Set up Twilio WebSocket event handlers
   */
  setupTwilioHandlers() {
    this.twilioWs.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleTwilioMessage(message);
      } catch (e) {
        console.error('Error parsing Twilio message:', e.message);
      }
    });

    this.twilioWs.on('close', () => {
      console.log('Twilio connection closed');
      this.cleanup();
    });

    this.twilioWs.on('error', (error) => {
      console.error('Twilio WebSocket error:', error.message);
    });
  }

  /**
   * Handle messages from Twilio
   */
  handleTwilioMessage(message) {
    switch (message.event) {
      case 'connected':
        console.log('Twilio media stream connected');
        break;

      case 'start':
        this.streamSid = message.start.streamSid;
        this.callSid = message.start.callSid;
        console.log(`Stream started: ${this.streamSid}`);

        // Extract candidate name from custom parameters if present
        if (message.start.customParameters?.candidateName) {
          this.candidateContext.candidateName = message.start.customParameters.candidateName;
        }
        break;

      case 'media':
        // Convert Twilio audio and send to ElevenLabs
        this.sendAudioToElevenLabs(message.media.payload);
        break;

      case 'stop':
        console.log('Stream stopped');
        this.cleanup();
        break;
    }
  }

  /**
   * Send audio from Twilio to ElevenLabs
   * @param {string} base64Audio - Base64 encoded mulaw audio from Twilio
   */
  sendAudioToElevenLabs(base64Audio) {
    if (!this.isConnected || this.elevenLabsWs.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Decode base64 to buffer
      const mulawBuffer = Buffer.from(base64Audio, 'base64');

      // Convert mulaw 8kHz to PCM16 16kHz
      const pcmBuffer = twilioToElevenLabs(mulawBuffer);

      // Send to ElevenLabs as base64
      elevenlabs.sendAudio(this.elevenLabsWs, pcmBuffer.toString('base64'));
    } catch (e) {
      console.error('Error sending audio to ElevenLabs:', e.message);
    }
  }

  /**
   * Send audio from ElevenLabs to Twilio
   * @param {string} base64Audio - Base64 encoded PCM16 audio from ElevenLabs
   */
  sendAudioToTwilio(base64Audio) {
    if (this.twilioWs.readyState !== WebSocket.OPEN || !this.streamSid) {
      return;
    }

    try {
      // Decode base64 to buffer
      const pcmBuffer = Buffer.from(base64Audio, 'base64');

      // Convert PCM16 16kHz to mulaw 8kHz
      const mulawBuffer = elevenLabsToTwilio(pcmBuffer);

      // Send to Twilio
      const mediaMessage = {
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: mulawBuffer.toString('base64'),
        },
      };

      this.twilioWs.send(JSON.stringify(mediaMessage));
    } catch (e) {
      console.error('Error sending audio to Twilio:', e.message);
    }
  }

  /**
   * Clean up connections
   */
  cleanup() {
    if (this.elevenLabsWs) {
      elevenlabs.endConversation(this.elevenLabsWs);
      if (this.elevenLabsWs.readyState === WebSocket.OPEN) {
        this.elevenLabsWs.close();
      }
    }
    this.isConnected = false;
  }

  /**
   * Get conversation transcript
   */
  getTranscript() {
    return this.transcript;
  }
}

module.exports = MediaStreamHandler;
