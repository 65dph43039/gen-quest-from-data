const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvQuestions, scoreAttempt } = require('../src/quizService');

test('parseCsvQuestions parses valid csv rows and skips invalid rows', () => {
  const csv = [
    'id,question,option_a,option_b,option_c,option_d,option_e,correct_option,topic,difficulty',
    '1,Cau hoi 1,A1,B1,C1,D1,,A,Toan,1',
    '2,Cau hoi 2,A2,B2,C2,D2,E2,*E,Van,2',
    '3,Cau hoi 3,A3,B3,C3,D3,,E,Su,1',
  ].join('\n');

  const parsed = parseCsvQuestions(csv, 0);

  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.skipped, 1);
  assert.equal(parsed.questions[0].id, 1);
  assert.equal(parsed.questions[0].setName, 'Toan');
  assert.equal(parsed.questions[1].correctOption, 'E');
  assert.equal(parsed.questions[1].options.E, 'E2');
});

test('scoreAttempt returns expected score details', () => {
  const questions = [
    {
      id: 1,
      question: 'Q1',
      options: { A: 'A1', B: 'B1', C: 'C1', D: 'D1' },
      correctOption: 'B',
      explanation: '',
    },
    {
      id: 2,
      question: 'Q2',
      options: { A: 'A2', B: 'B2', C: 'C2', D: 'D2' },
      correctOption: 'A',
      explanation: '',
    },
  ];

  const result = scoreAttempt(questions, [
    { questionId: 1, selectedOption: 'B' },
    { questionId: 2, selectedOption: 'D' },
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.correctCount, 1);
  assert.equal(result.percentage, 50);
  assert.equal(result.details[0].isCorrect, true);
  assert.equal(result.details[1].isCorrect, false);
  assert.equal(result.details[0].options[1].key, 'B');
});
