const WebSocket = require('ws');
const config = require('../config');

class ElevenLabsService {
  constructor() {
    this.apiKey = config.elevenlabs.apiKey;
    this.agentId = config.elevenlabs.agentId;
  }

  /**
   * Get WebSocket URL for Conversational AI
   */
  getConversationWebSocketUrl() {
    return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;
  }

  /**
   * Create a new conversation session
   * Returns a WebSocket connection to ElevenLabs
   */
  createConversation(candidateContext = {}) {
    const wsUrl = this.getConversationWebSocketUrl();

    const ws = new WebSocket(wsUrl, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    // Store context for the conversation
    ws.candidateContext = candidateContext;

    return ws;
  }

  /**
   * Initialize conversation with context
   * Call this after WebSocket connects
   */
  sendConversationConfig(ws, candidateContext) {
    const initMessage = {
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: this.buildPrompt(candidateContext),
          },
          first_message: this.buildFirstMessage(candidateContext),
        },
      },
    };

    ws.send(JSON.stringify(initMessage));
  }

  /**
   * Build the agent prompt with candidate context
   */
  buildPrompt(context) {
    const { candidateName, role, notes, companyName, agentName } = context;

    return `You are ${agentName || 'Sarah'}, a friendly and professional recruiting assistant calling on behalf of ${companyName || 'our company'}.

You are calling ${candidateName || 'a candidate'} about the ${role || 'open position'}.

${notes ? `Additional context: ${notes}` : ''}

Your goals for this call:
1. Confirm you're speaking with the right person
2. Briefly introduce the opportunity
3. Gauge their interest level
4. If interested, ask a few quick screening questions:
   - Current availability / notice period
   - Relevant experience
   - Salary expectations (optional, handle sensitively)
5. If interested, schedule a follow-up call with the hiring team
6. If not interested, thank them politely and end the call

Guidelines:
- Be conversational, warm, and professional
- Keep responses concise (1-2 sentences when possible)
- Listen actively and respond naturally
- If they're busy, offer to call back at a better time
- If they ask to be removed from the list, acknowledge and end politely
- Never be pushy or aggressive
- If asked if you're an AI, be honest but emphasize you're here to help`;
  }

  /**
   * Build the first message for the agent
   */
  buildFirstMessage(context) {
    const { candidateName, companyName, agentName } = context;
    return `Hi, this is ${agentName || 'Sarah'} calling from ${companyName || 'the recruiting team'}. Am I speaking with ${candidateName || 'the right person'}?`;
  }

  /**
   * Send audio data to ElevenLabs
   * Audio should be base64-encoded PCM16 mono 16kHz
   */
  sendAudio(ws, audioBase64) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'audio',
        audio: audioBase64,
      }));
    }
  }

  /**
   * Send user interrupt signal
   */
  sendInterrupt(ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'interrupt',
      }));
    }
  }

  /**
   * End the conversation
   */
  endConversation(ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'end',
      }));
    }
  }

  /**
   * Parse ElevenLabs message
   */
  parseMessage(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
}

module.exports = new ElevenLabsService();
