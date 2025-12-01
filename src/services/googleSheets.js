const { google } = require('googleapis');
const config = require('../config');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.sheetId = config.googleSheets.sheetId;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.googleSheets.serviceAccountEmail,
        private_key: config.googleSheets.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.initialized = true;
  }

  /**
   * Get all candidates from the sheet
   * Expected columns: Name, Phone, Role, Notes, Status, Outcome, Callback, LastCalled, Attempts
   */
  async getCandidates(sheetName = 'Sheet1') {
    await this.initialize();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row, map to objects
    const headers = ['name', 'phone', 'role', 'notes', 'status', 'outcome', 'callback', 'lastCalled', 'attempts'];

    return rows.slice(1).map((row, index) => {
      const candidate = { rowIndex: index + 2 }; // +2 for header and 0-index
      headers.forEach((header, i) => {
        candidate[header] = row[i] || '';
      });
      candidate.attempts = parseInt(candidate.attempts) || 0;
      return candidate;
    });
  }

  /**
   * Get candidates that are pending (not yet called or need retry)
   */
  async getPendingCandidates(sheetName = 'Sheet1') {
    const candidates = await this.getCandidates(sheetName);
    return candidates.filter(c =>
      c.status === '' ||
      c.status === 'Pending' ||
      c.status === 'No Answer'
    );
  }

  /**
   * Update a candidate's status after a call
   */
  async updateCandidateStatus(rowIndex, updates, sheetName = 'Sheet1') {
    await this.initialize();

    const { status, outcome, callback, lastCalled, attempts } = updates;

    // Update columns E through I (Status, Outcome, Callback, LastCalled, Attempts)
    const values = [[
      status || '',
      outcome || '',
      callback || '',
      lastCalled || new Date().toISOString(),
      attempts || 1
    ]];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!E${rowIndex}:I${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return { success: true, rowIndex, updates };
  }

  /**
   * Add a candidate to the Do Not Call list (update status)
   */
  async markDoNotCall(rowIndex, sheetName = 'Sheet1') {
    return this.updateCandidateStatus(rowIndex, {
      status: 'Do Not Call',
      outcome: 'Opted Out',
      lastCalled: new Date().toISOString(),
    }, sheetName);
  }

  /**
   * Get sheet metadata (for validation)
   */
  async getSheetInfo() {
    await this.initialize();

    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.sheetId,
    });

    return {
      title: response.data.properties.title,
      sheets: response.data.sheets.map(s => s.properties.title),
    };
  }
}

module.exports = new GoogleSheetsService();
