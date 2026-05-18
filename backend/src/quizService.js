const Papa = require('papaparse');

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];
const REQUIRED_HEADERS = ['question', 'option_a', 'option_b', 'correct_option'];

function normalizeRow(row) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = typeof value === 'string' ? value.trim() : value;
    return acc;
  }, {});
}

function validateHeaders(headers) {
  return REQUIRED_HEADERS.every((header) => headers.includes(header));
}

function extractOptions(row) {
  return OPTION_KEYS.reduce((options, optionKey) => {
    const value = row[`option_${optionKey.toLowerCase()}`];
    if (value) {
      options[optionKey] = value;
    }
    return options;
  }, {});
}

function parseCsvQuestions(csvText, currentLastQuestionId) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const normalizedRows = parsed.data.map(normalizeRow);
  const headers = normalizedRows[0] ? Object.keys(normalizedRows[0]) : [];

  if (!validateHeaders(headers)) {
    throw new Error(`CSV is missing required headers: ${REQUIRED_HEADERS.join(', ')}`);
  }

  const questions = [];
  let nextQuestionId = currentLastQuestionId;
  let skipped = 0;

  for (const row of normalizedRows) {
    const correctOption = String(row.correct_option || '').replace(/\*/g, '').toUpperCase();
    const options = extractOptions(row);

    if (
      !row.question
      || !OPTION_KEYS.includes(correctOption)
      || !options[correctOption]
      || Object.keys(options).length < 2
    ) {
      skipped += 1;
      continue;
    }

    const numericId = Number(row.id);
    const id = Number.isInteger(numericId) && numericId > 0 ? numericId : ++nextQuestionId;
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

  return selected.map((question) => {
    const options = shuffleArray(
      Object.entries(question.options).map(([key, text]) => ({ key, text })),
    );

    return {
      id: question.id,
      question: question.question,
      options,
      topic: question.topic,
      difficulty: question.difficulty,
      setName: question.setName,
    };
  });
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
      options: Object.entries(question.options)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, text]) => ({ key, text })),
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

module.exports = {
  parseCsvQuestions,
  buildQuiz,
  scoreAttempt,
};
