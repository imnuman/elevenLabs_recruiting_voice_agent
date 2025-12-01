# ElevenLabs Recruiting Voice Agent
## Project Plan & Technical Specification

---

## Overview

An AI-powered voice agent that automates recruiting outreach calls. The system reads candidate data from Google Sheets, initiates calls via Twilio, conducts natural conversations using ElevenLabs Conversational AI, and logs outcomes back to your spreadsheet in real-time.

---

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Google Sheets  │────▶│   Backend API   │────▶│     Twilio      │
│  (Candidates)   │     │   (Node.js)     │     │  (Voice Calls)  │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │                       ▼
                        ┌────────▼────────┐     ┌─────────────────┐
                        │    Database     │     │   ElevenLabs    │
                        │  (Call Logs)    │◀────│ Conversational  │
                        └─────────────────┘     │       AI        │
                                                └─────────────────┘
```

---

## Core Components

### 1. Google Sheets Integration
- Read candidate data (name, phone, role, notes)
- Real-time status updates after each call
- Support for multiple sheets/campaigns
- Automatic queue management

### 2. Twilio Voice Integration
- Outbound call initiation
- Voicemail detection
- Call recording (optional)
- Retry logic for no-answers
- Compliance features (opt-out handling, calling hours)

### 3. ElevenLabs Conversational AI
- Natural voice conversations
- Context-aware responses using candidate data
- Customizable conversation flows
- Multiple voice options
- Real-time transcription

### 4. Outcome Tracking
- Call status: completed, no answer, voicemail, declined
- Candidate response: interested, not interested, callback requested
- Call duration and timestamp
- Transcript storage

---

## Conversation Flow (Recruiting Use Case)

```
START
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ "Hi, this is [Agent Name] calling from [Company].       │
│  Am I speaking with [Candidate Name]?"                  │
└─────────────────────────────────────────────────────────┘
  │
  ├─── Wrong person ──▶ Apologize & End Call
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ "I'm reaching out about the [Job Title] position.       │
│  Do you have a quick moment to chat?"                   │
└─────────────────────────────────────────────────────────┘
  │
  ├─── No / Bad time ──▶ Schedule Callback ──▶ Log & End
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Screening Questions:                                    │
│ • Current availability                                  │
│ • Relevant experience                                   │
│ • Interest level                                        │
│ • Salary expectations (optional)                        │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ "Great! I'd like to schedule a follow-up call with      │
│  our team. What times work best for you?"               │
└─────────────────────────────────────────────────────────┘
  │
  ▼
Log outcome ──▶ Update Google Sheet ──▶ END
```

---

## Technical Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend | Node.js + Express | API orchestration |
| Voice AI | ElevenLabs Conversational AI | Natural conversations |
| Telephony | Twilio Voice API | Outbound calls |
| Data Source | Google Sheets API | Candidate management |
| Database | Firebase/Supabase | Call logs & transcripts |
| Dashboard | React + Tailwind | Monitoring interface |

---

## Google Sheet Structure

| Column | Description | Example |
|--------|-------------|---------|
| A: Name | Candidate full name | John Smith |
| B: Phone | Phone number (E.164 format) | +14155551234 |
| C: Role | Position applied for | Senior Developer |
| D: Notes | Additional context | 5 years experience |
| E: Status | Call status | Pending / Completed |
| F: Outcome | Call result | Interested / Not Interested |
| G: Callback | Requested callback time | 2024-01-15 2:00 PM |
| H: Last Called | Timestamp of last attempt | 2024-01-14 10:30 AM |
| I: Attempts | Number of call attempts | 2 |

---

## Development Timeline

### Week 1: Core Integration
- [ ] Set up ElevenLabs Conversational AI agent
- [ ] Configure Twilio account and phone number
- [ ] Build Google Sheets API connection
- [ ] Create basic call orchestration flow
- [ ] Test end-to-end with single call

### Week 2: Conversation & Logic
- [ ] Design recruiting conversation prompts
- [ ] Implement response handling (interested, callback, decline)
- [ ] Add voicemail detection and handling
- [ ] Build retry logic for no-answers
- [ ] Create outcome logging to Google Sheets

### Week 3: Polish & Dashboard
- [ ] Build monitoring dashboard
- [ ] Add call queue management
- [ ] Implement compliance features
- [ ] Testing and bug fixes
- [ ] Documentation and handoff

---

## Features by Priority

### Must Have (MVP)
- ✅ Read candidates from Google Sheets
- ✅ Make outbound calls via Twilio
- ✅ AI conversation using ElevenLabs
- ✅ Log call outcomes back to sheet
- ✅ Basic error handling

### Should Have
- 📞 Voicemail detection
- 🔄 Automatic retry for no-answers
- 📊 Simple status dashboard
- ⏰ Calling hours configuration
- 📝 Call transcripts

### Nice to Have
- 📅 Calendar integration for scheduling
- 🔀 A/B testing different scripts
- 📈 Analytics and reporting
- 🔗 CRM integration (HubSpot, Salesforce)
- 👤 Human handoff option

---

## Compliance Considerations

- **Consent**: Ensure candidates have opted in to receive calls
- **Calling Hours**: Respect time zones and business hours (8 AM - 9 PM local)
- **Opt-Out**: Immediate opt-out handling ("Please don't call me again")
- **Recording Disclosure**: Announce if calls are being recorded
- **Do Not Call**: Maintain internal DNC list
- **Data Privacy**: Secure handling of candidate information

---

## API Endpoints (Proposed)

```
POST   /api/calls/start          Start calling queue
POST   /api/calls/stop           Pause calling queue
GET    /api/calls/status         Get current queue status
GET    /api/calls/:id            Get specific call details
POST   /api/sheets/sync          Sync with Google Sheet
GET    /api/dashboard/stats      Get summary statistics
```

---

## Monitoring Dashboard

### Key Metrics
- Calls in queue
- Calls completed today
- Success rate (interested / total)
- Average call duration
- Callbacks scheduled

### Call Status View
| Candidate | Phone | Status | Outcome | Duration | Time |
|-----------|-------|--------|---------|----------|------|
| John Smith | +1415... | Completed | Interested | 2:34 | 10:30 AM |
| Jane Doe | +1628... | No Answer | Retry #2 | 0:00 | 10:45 AM |
| Bob Wilson | +1510... | Completed | Not Interested | 1:12 | 11:00 AM |

---

## Deliverables

1. **Working voice agent** - Makes calls and conducts conversations
2. **Google Sheets integration** - Reads candidates, writes outcomes
3. **Monitoring dashboard** - Track calls in real-time
4. **Documentation** - Setup guide and conversation customization
5. **Source code** - Clean, commented, ready for handoff

---

## Questions for Kickoff

1. What's the typical conversation flow you want? (screening questions, etc.)
2. How many calls per day/hour do you anticipate?
3. Do you need call recordings stored?
4. Any specific CRM or ATS integration needed?
5. Preferred voice style for the agent? (professional, friendly, etc.)
6. Do candidates expect these calls, or is this cold outreach?

---

## Next Steps

1. **Discovery call** - Align on requirements and conversation flow
2. **Account setup** - ElevenLabs, Twilio, Google Cloud credentials
3. **MVP build** - Core integration (Week 1)
4. **Testing** - Pilot with 10-20 test calls
5. **Iterate** - Refine based on results
6. **Scale** - Full deployment

---

*Ready to start building. Let's connect to discuss your specific requirements.*
