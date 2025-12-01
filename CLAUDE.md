# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered voice agent that automates recruiting outreach calls. Reads candidate data from Google Sheets, initiates calls via Twilio, conducts conversations using ElevenLabs Conversational AI, and logs outcomes back to the spreadsheet.

## Architecture

```
Google Sheets (Candidates) → Backend API (Node.js/Express) → Twilio (Voice Calls)
                                      ↓                            ↓
                              Database (Call Logs) ←── ElevenLabs Conversational AI
```

### Core Components
- **Google Sheets Integration**: Read candidates, write call outcomes
- **Twilio Voice**: Outbound calls, voicemail detection, webhooks
- **ElevenLabs Conversational AI**: Real-time voice conversations via WebSocket
- **Call Orchestration**: Queue management, retry logic, compliance (calling hours, opt-out)
- **Dashboard**: React + Tailwind monitoring interface

## Tech Stack

- **Backend**: Node.js + Express
- **Voice AI**: ElevenLabs Conversational AI
- **Telephony**: Twilio Voice API
- **Data Source**: Google Sheets API
- **Database**: Firebase/Supabase
- **Frontend**: React + Tailwind

## Environment Variables

Required credentials (configure in `.env`):
- `ELEVENLABS_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `GOOGLE_SHEETS_CREDENTIALS` (service account JSON)
- `GOOGLE_SHEET_ID`
- Database credentials (Firebase/Supabase)

## API Endpoints

```
POST   /api/calls/start          Start calling queue
POST   /api/calls/stop           Pause calling queue
GET    /api/calls/status         Get current queue status
GET    /api/calls/:id            Get specific call details
POST   /api/sheets/sync          Sync with Google Sheet
GET    /api/dashboard/stats      Get summary statistics
```

## Google Sheet Structure

| Column | Purpose |
|--------|---------|
| A: Name | Candidate full name |
| B: Phone | Phone number (E.164 format) |
| C: Role | Position applied for |
| D: Notes | Additional context |
| E: Status | Call status (Pending/Completed) |
| F: Outcome | Result (Interested/Not Interested) |
| G: Callback | Requested callback time |
| H: Last Called | Timestamp of last attempt |
| I: Attempts | Number of call attempts |

## Compliance Requirements

- Calling hours: 8 AM - 9 PM local time
- Opt-out handling required
- Recording disclosure if calls are recorded
- Maintain internal Do Not Call list
