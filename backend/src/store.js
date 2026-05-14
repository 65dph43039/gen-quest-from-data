const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { questions: [], attempts: [], lastQuestionId: 0, lastAttemptId: 0 };
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
  readDb,
  writeDb,
};
