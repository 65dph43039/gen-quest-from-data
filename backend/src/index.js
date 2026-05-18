const express = require('express');
const cors = require('cors');
const { readDb, writeDb } = require('./store');
const { parseCsvQuestions, buildQuiz, scoreAttempt } = require('./quizService');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/questions', (req, res) => {
  const db = readDb();
  const topic = req.query.topic;
  const difficulty = req.query.difficulty;
  const setName = req.query.setName;

  let questions = [...db.questions];

  if (topic) {
    questions = questions.filter((question) => question.topic === topic);
  }
  if (difficulty) {
    questions = questions.filter((question) => String(question.difficulty) === String(difficulty));
  }
  if (setName) {
    questions = questions.filter((question) => question.setName === setName);
  }

  questions.sort((a, b) => a.id - b.id);

  res.json({ questions });
});

app.get('/api/sets', (req, res) => {
  const db = readDb();
  const grouped = db.questions.reduce((acc, question) => {
    const name = question.setName || question.topic || 'General';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const sets = Object.entries(grouped)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ sets });
});

app.post('/api/questions/import-csv', (req, res) => {
  const { csvText } = req.body || {};
  if (!csvText || typeof csvText !== 'string') {
    return res.status(400).json({ error: 'csvText is required' });
  }

  try {
    const db = readDb();
    const parsed = parseCsvQuestions(csvText, db.lastQuestionId);

    const questionsById = new Map(db.questions.map((question) => [question.id, question]));
    for (const question of parsed.questions) {
      questionsById.set(question.id, question);
    }

    db.questions = Array.from(questionsById.values());
    db.lastQuestionId = parsed.nextQuestionId;
    writeDb(db);

    return res.json({
      imported: parsed.questions.length,
      skipped: parsed.skipped,
      totalQuestions: db.questions.length,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.put('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid question id' });
  }

  const db = readDb();
  const index = db.questions.findIndex((question) => question.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const payload = req.body || {};
  const current = db.questions[index];

  const updated = {
    ...current,
    question: payload.question ?? current.question,
    options: OPTION_KEYS.reduce((options, key) => {
      const incoming = payload[`option_${key.toLowerCase()}`];
      const value = incoming !== undefined ? String(incoming).trim() : current.options[key];
      if (value) {
        options[key] = value;
      }
      return options;
    }, {}),
    correctOption: String(payload.correct_option || current.correctOption).replace(/\*/g, '').toUpperCase(),
    explanation: payload.explanation ?? current.explanation,
    topic: payload.topic ?? current.topic,
    difficulty: payload.difficulty ?? current.difficulty,
    setName: payload.set_name ?? current.setName,
  };

  if (
    !OPTION_KEYS.includes(updated.correctOption)
    || !updated.options[updated.correctOption]
    || Object.keys(updated.options).length < 2
  ) {
    return res.status(400).json({ error: 'Question data is invalid' });
  }

  db.questions[index] = updated;
  writeDb(db);

  return res.json({ question: updated });
});

app.delete('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid question id' });
  }

  const db = readDb();
  const initialLength = db.questions.length;
  db.questions = db.questions.filter((question) => question.id !== id);

  if (db.questions.length === initialLength) {
    return res.status(404).json({ error: 'Question not found' });
  }

  writeDb(db);
  return res.status(204).send();
});

app.post('/api/quiz', (req, res) => {
  const { setName, questionCount } = req.body || {};
  const db = readDb();

  let sourceQuestions = db.questions;
  if (setName) {
    sourceQuestions = sourceQuestions.filter((question) => question.setName === setName);
  }

  if (!sourceQuestions.length) {
    return res.status(400).json({ error: 'No questions found for selected set' });
  }

  const questions = buildQuiz(sourceQuestions, questionCount);

  return res.json({
    questions,
    totalAvailable: sourceQuestions.length,
  });
});

app.post('/api/attempts', (req, res) => {
  const { userId, setName, questionIds, answers } = req.body || {};
  const db = readDb();

  const normalizedIds = Array.isArray(questionIds)
    ? questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
    : [];

  const quizQuestions = db.questions.filter((question) => normalizedIds.includes(question.id));
  if (!quizQuestions.length) {
    return res.status(400).json({ error: 'No submitted question ids were found' });
  }

  const scoring = scoreAttempt(quizQuestions, answers);

  db.lastAttemptId += 1;
  const attempt = {
    id: db.lastAttemptId,
    userId: userId || 'guest',
    setName: setName || 'General',
    score: scoring.percentage,
    correctCount: scoring.correctCount,
    total: scoring.total,
    createdAt: new Date().toISOString(),
    details: scoring.details,
  };

  db.attempts.push(attempt);
  writeDb(db);

  return res.json({ attempt });
});

app.get('/api/attempts', (req, res) => {
  const db = readDb();
  const userId = req.query.userId;

  let attempts = [...db.attempts];
  if (userId) {
    attempts = attempts.filter((attempt) => attempt.userId === userId);
  }

  attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ attempts });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Quiz backend running at http://localhost:${PORT}`);
});
