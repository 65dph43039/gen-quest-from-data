import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import './App.css';

const EMPTY_DRAFT = {
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  option_e: '',
  correct_option: 'A',
  explanation: '',
  topic: 'General',
  difficulty: '1',
  set_name: 'General',
};

function AdminPage() {
  const [questions, setQuestions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  const topics = useMemo(
    () => [...new Set(questions.map((question) => question.topic).filter(Boolean))].sort(),
    [questions],
  );
  const difficulties = useMemo(
    () => [...new Set(questions.map((question) => String(question.difficulty)).filter(Boolean))].sort(),
    [questions],
  );

  async function loadQuestions() {
    const payload = await api.getQuestions();
    setQuestions(payload.questions);
  }

  useEffect(() => {
    let cancelled = false;

    api.getQuestions()
      .then((payload) => {
        if (!cancelled) {
          setQuestions(payload.questions);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredQuestions = questions.filter((question) => {
    if (topicFilter && question.topic !== topicFilter) {
      return false;
    }
    if (difficultyFilter && String(question.difficulty) !== difficultyFilter) {
      return false;
    }
    return true;
  });

  function getDraft(question) {
    return drafts[question.id] || {
      question: question.question,
      option_a: question.options.A,
      option_b: question.options.B,
      option_c: question.options.C,
      option_d: question.options.D,
      option_e: question.options.E || '',
      correct_option: question.correctOption,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: String(question.difficulty),
      set_name: question.setName,
    };
  }

  function updateDraft(questionId, field, value) {
    setDrafts((current) => ({
      ...current,
      [questionId]: {
        ...getDraft(questions.find((question) => question.id === questionId) || EMPTY_DRAFT),
        ...(current[questionId] || {}),
        [field]: value,
      },
    }));
  }

  async function saveQuestion(questionId) {
    try {
      const payload = drafts[questionId];
      await api.updateQuestion(questionId, payload);
      setStatus(`Đã cập nhật câu hỏi #${questionId}`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteQuestion(questionId) {
    if (!window.confirm(`Xóa câu hỏi #${questionId}?`)) {
      return;
    }

    try {
      await api.deleteQuestion(questionId);
      setStatus(`Đã xóa câu hỏi #${questionId}`);
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      setStatus('Vui lòng chọn file CSV.');
      return;
    }

    try {
      const csvText = await selectedFile.text();
      const result = await api.importCsv(csvText);
      setStatus(`Import thành công: ${result.imported} câu hỏi, bỏ qua ${result.skipped}.`);
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="page">
      <h2>Trang quản trị</h2>
      <p>Import CSV chuẩn, quản lý câu hỏi, phân loại theo chủ đề/độ khó.</p>

      <div className="panel upload-panel">
        <input type="file" accept=".csv,text/csv" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
        <button type="button" onClick={handleImport}>Import CSV</button>
      </div>

      <div className="panel filters">
        <label>
          Chủ đề
          <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
            <option value="">Tất cả</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>

        <label>
          Độ khó
          <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
            <option value="">Tất cả</option>
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>{difficulty}</option>
            ))}
          </select>
        </label>
      </div>

      {status && <p className="status">{status}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Câu hỏi</th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>D</th>
              <th>E</th>
              <th>Đáp án</th>
              <th>Chủ đề</th>
              <th>Độ khó</th>
              <th>Bộ đề</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.map((question) => {
              const draft = getDraft(question);
              return (
                <tr key={question.id}>
                  <td>{question.id}</td>
                  <td><textarea value={draft.question} onChange={(event) => updateDraft(question.id, 'question', event.target.value)} /></td>
                  <td><input value={draft.option_a} onChange={(event) => updateDraft(question.id, 'option_a', event.target.value)} /></td>
                  <td><input value={draft.option_b} onChange={(event) => updateDraft(question.id, 'option_b', event.target.value)} /></td>
                  <td><input value={draft.option_c} onChange={(event) => updateDraft(question.id, 'option_c', event.target.value)} /></td>
                  <td><input value={draft.option_d} onChange={(event) => updateDraft(question.id, 'option_d', event.target.value)} /></td>
                  <td><input value={draft.option_e} onChange={(event) => updateDraft(question.id, 'option_e', event.target.value)} /></td>
                  <td>
                    <select value={draft.correct_option} onChange={(event) => updateDraft(question.id, 'correct_option', event.target.value)}>
                      {['A', 'B', 'C', 'D', 'E'].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td><input value={draft.topic} onChange={(event) => updateDraft(question.id, 'topic', event.target.value)} /></td>
                  <td><input value={draft.difficulty} onChange={(event) => updateDraft(question.id, 'difficulty', event.target.value)} /></td>
                  <td><input value={draft.set_name} onChange={(event) => updateDraft(question.id, 'set_name', event.target.value)} /></td>
                  <td>
                    <button type="button" onClick={() => saveQuestion(question.id)}>Lưu</button>
                    <button type="button" className="danger" onClick={() => deleteQuestion(question.id)}>Xóa</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuizPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [userId, setUserId] = useState('guest');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.getSets()
      .then((payload) => {
        setSets(payload.sets);
        setSelectedSet((current) => current || payload.sets[0]?.name || '');
      })
      .catch((error) => setStatus(error.message));
  }, []);

  async function startQuiz() {
    try {
      const payload = await api.createQuiz({
        setName: selectedSet || undefined,
        questionCount,
      });
      setQuizQuestions(payload.questions);
      setAnswers({});
      setStatus(`Đã tạo đề: ${payload.questions.length} câu.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function selectAnswer(questionId, optionKey) {
    setAnswers((current) => ({ ...current, [questionId]: optionKey }));
  }

  async function submitQuiz() {
    if (!quizQuestions.length) {
      setStatus('Chưa có đề để nộp.');
      return;
    }

    try {
      const result = await api.submitAttempt({
        userId,
        setName: selectedSet,
        questionIds: quizQuestions.map((question) => question.id),
        answers: quizQuestions.map((question) => ({
          questionId: question.id,
          selectedOption: answers[question.id] || null,
        })),
      });

      navigate('/results', {
        state: {
          attempt: result.attempt,
          quizQuestions,
          answers,
        },
      });
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loadHistory() {
    try {
      const payload = await api.getAttempts(userId || 'guest');
      setHistory(payload.attempts);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="page">
      <h2>Trang làm bài</h2>
      <p>Chọn bộ đề, số câu hỏi, làm bài trắc nghiệm và nộp bài để chấm điểm.</p>

      <div className="panel quiz-config">
        <label>
          Người dùng
          <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="guest" />
        </label>
        <label>
          Bộ đề
          <select value={selectedSet} onChange={(event) => setSelectedSet(event.target.value)}>
            {sets.map((setItem) => (
              <option key={setItem.name} value={setItem.name}>{setItem.name} ({setItem.count})</option>
            ))}
          </select>
        </label>
        <label>
          Số lượng câu hỏi
          <input
            type="number"
            min="1"
            value={questionCount}
            onChange={(event) => setQuestionCount(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <button type="button" onClick={startQuiz}>Tạo đề</button>
        <button type="button" onClick={submitQuiz}>Nộp bài</button>
        <button type="button" onClick={loadHistory}>Xem lịch sử</button>
      </div>

      {status && <p className="status">{status}</p>}

      <ol className="quiz-list">
        {quizQuestions.map((question) => (
          <li key={question.id}>
            <p>{question.question}</p>
            <div className="meta">Chủ đề: {question.topic} • Độ khó: {question.difficulty}</div>
            <div className="options">
              {question.options.map((option) => (
                <label key={option.key} className="option-label">
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={answers[question.id] === option.key}
                    onChange={() => selectAnswer(question.id, option.key)}
                  />
                  {option.key}. {option.text}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <section className="history">
        <h3>Lịch sử làm bài</h3>
        <ul>
          {history.map((attempt) => (
            <li key={attempt.id}>
              #{attempt.id} • {attempt.userId} • {attempt.setName} • {attempt.score}% ({attempt.correctCount}/{attempt.total}) • {new Date(attempt.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function ResultPage() {
  const location = useLocation();
  const state = location.state;

  if (!state?.attempt) {
    return (
      <section className="page">
        <h2>Trang kết quả</h2>
        <p>Chưa có kết quả. Vui lòng làm bài trước.</p>
      </section>
    );
  }

  const { attempt } = state;
  const quizQuestionById = new Map(
    (state.quizQuestions || []).map((question) => [question.id, question]),
  );

  return (
    <section className="page">
      <h2>Trang kết quả</h2>
      <p>
        Điểm: <strong>{attempt.score}%</strong> ({attempt.correctCount}/{attempt.total} câu đúng)
      </p>

      <ol className="result-list">
        {attempt.details.map((detail) => (
          <li key={detail.questionId} className={detail.isCorrect ? 'correct' : 'wrong'}>
            <p>{detail.question}</p>
            <p>
              Bạn chọn: <strong>{detail.selectedOption || 'Chưa chọn'}</strong> • Đáp án đúng: <strong>{detail.correctOption}</strong>
            </p>
            <ul className="result-options">
              {(quizQuestionById.get(detail.questionId)?.options || detail.options || []).map((option) => {
                const classes = ['result-option'];
                if (option.key === detail.correctOption) {
                  classes.push('correct');
                } else if (option.key === detail.selectedOption && !detail.isCorrect) {
                  classes.push('wrong');
                }

                return (
                  <li key={option.key} className={classes.join(' ')}>
                    <strong>{option.key}.</strong> {option.text}
                  </li>
                );
              })}
            </ul>
            {detail.explanation && <p>Giải thích: {detail.explanation}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Navigation() {
  return (
    <header className="top-nav">
      <h1>Quiz Website Scaffold</h1>
      <nav>
        <Link to="/admin">Admin</Link>
        <Link to="/quiz">Làm bài</Link>
        <Link to="/results">Kết quả</Link>
      </nav>
    </header>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="layout">
        <Navigation />
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/results" element={<ResultPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
