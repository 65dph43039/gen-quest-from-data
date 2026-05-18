const STORAGE_KEY = 'quiz-db-v1';
const REQUIRED_HEADERS = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'];

function createEmptyDb() {
  return {
    questions: [],
    attempts: [],
    lastQuestionId: 0,
    lastAttemptId: 0,
  };
}

function readDb() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyDb();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      lastQuestionId: Number(parsed.lastQuestionId) || 0,
      lastAttemptId: Number(parsed.lastAttemptId) || 0,
    };
  } catch {
    return createEmptyDb();
  }
}

function writeDb(db) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(csvText) {
  const normalizedText = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter((line) => line.trim());

  if (!lines.length) {
    throw new Error('CSV rỗng');
  }

  const rawHeaders = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const valid = REQUIRED_HEADERS.every((header) => rawHeaders.includes(header));

  if (!valid) {
    throw new Error(`CSV is missing required headers: ${REQUIRED_HEADERS.join(', ')}`);
  }

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return rawHeaders.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
}

function parseCsvQuestions(csvText, currentLastQuestionId) {
  const rows = parseCsv(csvText);

  const questions = [];
  let nextQuestionId = currentLastQuestionId;
  let skipped = 0;

  for (const row of rows) {
    const correctOption = String(row.correct_option || '').toUpperCase();
    const options = {
      A: row.option_a,
      B: row.option_b,
      C: row.option_c,
      D: row.option_d,
    };

    if (!row.question || !['A', 'B', 'C', 'D'].includes(correctOption) || !Object.values(options).every(Boolean)) {
      skipped += 1;
      continue;
    }

    const numericId = Number(row.id);
    const id = Number.isInteger(numericId) && numericId > 0 ? numericId : nextQuestionId + 1;
    nextQuestionId = Math.max(nextQuestionId, id);

    questions.push({
      id,
      question: row.question,
      options,
      correctOption,
      explanation: row.explanation || '',
      topic: row.topic || 'General',
      difficulty: row.difficulty || '1',
      setName: row.set_name || row.topic || 'General',
    });
  }

  return {
    questions,
    skipped,
    nextQuestionId,
  };
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuiz(questions, questionCount) {
  const count = Math.min(Math.max(1, Number(questionCount) || 1), questions.length);
  const selected = shuffleArray(questions).slice(0, count);

  return selected.map((question) => ({
    id: question.id,
    question: question.question,
    options: shuffleArray(Object.entries(question.options).map(([key, text]) => ({ key, text }))),
    topic: question.topic,
    difficulty: question.difficulty,
    setName: question.setName,
  }));
}

function scoreAttempt(questions, answers = []) {
  const answerByQuestion = new Map(
    answers
      .filter((answer) => Number.isInteger(Number(answer.questionId)))
      .map((answer) => [Number(answer.questionId), String(answer.selectedOption || '').toUpperCase()]),
  );

  const details = questions.map((question) => {
    const selectedOption = answerByQuestion.get(question.id) || null;
    const isCorrect = selectedOption === question.correctOption;

    return {
      questionId: question.id,
      question: question.question,
      selectedOption,
      correctOption: question.correctOption,
      explanation: question.explanation,
      isCorrect,
    };
  });

  const correctCount = details.filter((item) => item.isCorrect).length;
  const total = questions.length;
  const percentage = total ? Math.round((correctCount / total) * 100) : 0;

  return {
    total,
    correctCount,
    percentage,
    details,
  };
}

export const localApi = {
  async getQuestions(filters = {}) {
    const db = readDb();
    let questions = [...db.questions];

    if (filters.topic) {
      questions = questions.filter((question) => question.topic === filters.topic);
    }
    if (filters.difficulty) {
      questions = questions.filter((question) => String(question.difficulty) === String(filters.difficulty));
    }
    if (filters.setName) {
      questions = questions.filter((question) => question.setName === filters.setName);
    }

    questions.sort((a, b) => a.id - b.id);
    return { questions };
  },

  async importCsv(csvText) {
    const db = readDb();
    const parsed = parseCsvQuestions(csvText, db.lastQuestionId);

    const questionsById = new Map(db.questions.map((question) => [question.id, question]));
    for (const question of parsed.questions) {
      questionsById.set(question.id, question);
    }

    db.questions = Array.from(questionsById.values());
    db.lastQuestionId = parsed.nextQuestionId;
    writeDb(db);

    return {
      imported: parsed.questions.length,
      skipped: parsed.skipped,
      totalQuestions: db.questions.length,
    };
  },

  async updateQuestion(id, payload = {}) {
    const normalizedId = Number(id);
    if (!Number.isInteger(normalizedId)) {
      throw new Error('Invalid question id');
    }

    const db = readDb();
    const index = db.questions.findIndex((question) => question.id === normalizedId);
    if (index === -1) {
      throw new Error('Question not found');
    }

    const current = db.questions[index];
    const updated = {
      ...current,
      question: payload.question ?? current.question,
      options: {
        A: payload.option_a ?? current.options.A,
        B: payload.option_b ?? current.options.B,
        C: payload.option_c ?? current.options.C,
        D: payload.option_d ?? current.options.D,
      },
      correctOption: String(payload.correct_option || current.correctOption).toUpperCase(),
      explanation: payload.explanation ?? current.explanation,
      topic: payload.topic ?? current.topic,
      difficulty: payload.difficulty ?? current.difficulty,
      setName: payload.set_name ?? current.setName,
    };

    if (!['A', 'B', 'C', 'D'].includes(updated.correctOption) || !Object.values(updated.options).every(Boolean)) {
      throw new Error('Question data is invalid');
    }

    db.questions[index] = updated;
    writeDb(db);
    return { question: updated };
  },

  async deleteQuestion(id) {
    const normalizedId = Number(id);
    if (!Number.isInteger(normalizedId)) {
      throw new Error('Invalid question id');
    }

    const db = readDb();
    const initialLength = db.questions.length;
    db.questions = db.questions.filter((question) => question.id !== normalizedId);

    if (db.questions.length === initialLength) {
      throw new Error('Question not found');
    }

    writeDb(db);
    return null;
  },

  async resetDatabase() {
    const db = createEmptyDb();
    writeDb(db);
    return {
      ok: true,
      totalQuestions: 0,
      totalAttempts: 0,
    };
  },

  async getSets() {
    const db = readDb();
    const grouped = db.questions.reduce((acc, question) => {
      const name = question.setName || question.topic || 'General';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const sets = Object.entries(grouped)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { sets };
  },

  async createQuiz(payload = {}) {
    const db = readDb();
    const setName = payload.setName;
    const questionCount = payload.questionCount;

    let sourceQuestions = db.questions;
    if (setName) {
      sourceQuestions = sourceQuestions.filter((question) => question.setName === setName);
    }

    if (!sourceQuestions.length) {
      throw new Error('No questions found for selected set');
    }

    return {
      questions: buildQuiz(sourceQuestions, questionCount),
      totalAvailable: sourceQuestions.length,
    };
  },

  async submitAttempt(payload = {}) {
    const { userId, setName, questionIds, answers } = payload;
    const db = readDb();

    const normalizedIds = Array.isArray(questionIds)
      ? questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];

    const quizQuestions = db.questions.filter((question) => normalizedIds.includes(question.id));
    if (!quizQuestions.length) {
      throw new Error('No submitted question ids were found');
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
    return { attempt };
  },

  async getAttempts(userId) {
    const db = readDb();
    let attempts = [...db.attempts];

    if (userId) {
      attempts = attempts.filter((attempt) => attempt.userId === userId);
    }

    attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { attempts };
  },
};
