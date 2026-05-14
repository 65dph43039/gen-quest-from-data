const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvQuestions, scoreAttempt } = require('../src/quizService');

test('parseCsvQuestions parses valid csv rows and skips invalid rows', () => {
  const csv = [
    'id,question,option_a,option_b,option_c,option_d,correct_option,topic,difficulty',
    '1,Cau hoi 1,A1,B1,C1,D1,A,Toan,1',
    '2,Cau hoi 2,A2,B2,C2,D2,E,Van,2',
  ].join('\n');

  const parsed = parseCsvQuestions(csv, 0);

  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.skipped, 1);
  assert.equal(parsed.questions[0].id, 1);
  assert.equal(parsed.questions[0].setName, 'Toan');
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
});

test('parseCsvQuestions skips vague references, duplicate questions, and multi-topic rows', () => {
  const csv = [
    'id,question,option_a,option_b,option_c,option_d,correct_option,topic,difficulty',
    '1,Theo tài liệu câu 15 nội dung nào đúng?,A1,B1,C1,D1,A,MHXBP 2026,1',
    '2,Câu hỏi cụ thể về phân loại sách là gì?,A2,B2,C2,D2,B,Topic A,1',
    '3,Câu hỏi cụ thể về phân loại sách là gì?,A3,B3,C3,D3,C,Topic A,1',
    '4,Câu hỏi hợp lệ khác?,A4,B4,C4,D4,D,Topic A;Topic B,1',
    '5,Câu hỏi hợp lệ mới?,A5,B5,C5,D5,A,Topic B,1',
  ].join('\n');

  const parsed = parseCsvQuestions(csv, 10, [
    {
      id: 9,
      question: 'Câu hỏi đã tồn tại',
    },
  ]);

  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.skipped, 3);
  assert.equal(parsed.questions[0].question, 'Câu hỏi cụ thể về phân loại sách là gì?');
  assert.equal(parsed.questions[1].question, 'Câu hỏi hợp lệ mới?');
});
