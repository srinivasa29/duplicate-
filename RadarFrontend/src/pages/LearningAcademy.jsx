import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookMarked, PlayCircle, Award, ChevronRight, ChevronLeft, CheckCircle, Circle, Zap, Clock, BarChart2, ArrowLeft, X, User } from 'lucide-react';
import { fetchCourses, saveProgress, submitQuiz } from '../api/learningApi';

// ── Helpers ─────────────────────────────────────────────────────────────────
const ICON_MAP = { BookMarked, PlayCircle, Award, BookOpen };
const COLOR_MAP = {
  blue:    { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30',   badge: 'bg-blue-500/20 text-blue-300',   bar: 'bg-blue-400' },
  purple:  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', bar: 'bg-purple-400' },
  emerald: { bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/30',badge: 'bg-emerald-500/20 text-emerald-300',bar: 'bg-emerald-400'},
};
const LIGHT_COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-600' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-600'},
};

const parseBold = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
};

const renderContent = (text = '') => {
  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="ml-5 space-y-1 list-disc">
          {listBuffer}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    if (!line.trim()) {
      flushList(i);
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith('- ')) {
      const bulletText = line.slice(2); // strip leading "- "
      listBuffer.push(
        <li key={i} className="leading-relaxed">
          {parseBold(bulletText)}
        </li>
      );
    } else {
      flushList(i);
      elements.push(
        <p key={i} className="leading-relaxed">
          {parseBold(line)}
        </p>
      );
    }
  });

  flushList('end');
  return elements;
};

const LOCAL_KEY = (id, mode = '') => {
  const prefix = mode ? `${mode}_` : '';
  return `radar_academy_progress_${prefix}${id}`;
};

const loadLocalProgress = (courseId, mode = '') => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY(courseId, mode)) || '{}'); }
  catch { return {}; }
};

const saveLocalProgress = (courseId, data, mode = '') => {
  localStorage.setItem(LOCAL_KEY(courseId, mode), JSON.stringify(data));
};

// ── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({ course, isTrader, onClick, progress }) {
  const cm = isTrader ? COLOR_MAP[course.color] : LIGHT_COLOR_MAP[course.color];
  const Icon = ICON_MAP[course.icon] || BookOpen;
  const completed = Object.values(progress?.chapters || {}).filter(Boolean).length;
  const total = course.chapters?.length || 0;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-2xl border cursor-pointer group transition-all duration-200 ${
        isTrader
          ? `bg-white/5 border-white/10 hover:border-[${course.color === 'blue' ? '#00f3ff' : '#a855f7'}]/40 hover:bg-white/10`
          : `bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300`
      }`}
    >
      <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${cm.bg} ${cm.text}`}>
        <Icon size={24} />
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cm.badge}`}>
          {course.difficulty}
        </span>
        <span className={`text-[10px] font-bold flex items-center gap-1 ${isTrader ? 'text-slate-400' : 'text-slate-500'}`}>
          <Clock size={10} /> {course.duration}
        </span>
      </div>
      <h3 className={`font-black text-base mb-1 group-hover:underline ${isTrader ? 'text-white uppercase tracking-wide' : 'text-slate-800'}`}>
        {course.title}
      </h3>
      <p className={`text-sm mb-4 leading-snug ${isTrader ? 'text-slate-400' : 'text-slate-500'}`}>
        {course.description}
      </p>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className={`h-1.5 w-full rounded-full ${isTrader ? 'bg-white/10' : 'bg-slate-100'}`}>
          <div
            className={`h-1.5 rounded-full transition-all ${cm.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={`text-[10px] font-bold ${isTrader ? 'text-slate-500' : 'text-slate-400'}`}>
          {pct > 0 ? `${pct}% complete · ${completed}/${total} chapters` : `${total} chapters · ${course.quiz?.length || 0} quiz questions`}
        </div>
      </div>
    </div>
  );
}

// ── Quiz Component ───────────────────────────────────────────────────────────
function QuizSection({ quiz, courseId, isTrader, onFinish }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (Object.keys(answers).length < quiz.length) return;
    setSubmitting(true);
    const res = await submitQuiz(courseId, answers);
    setResult(res || {
      score: quiz.filter(q => answers[q.id] === q.answer).length / quiz.length * 100 | 0,
      correct: quiz.filter(q => answers[q.id] === q.answer).length,
      total: quiz.length,
      passed: (quiz.filter(q => answers[q.id] === q.answer).length / quiz.length) >= 0.7,
      results: quiz.map(q => ({ id: q.id, correct: answers[q.id] === q.answer, correctAnswer: q.answer, explanation: q.explanation })),
    });
    setSubmitting(false);
  };

  const reset = () => { setAnswers({}); setResult(null); };

  return (
    <div className="space-y-6">
      <div className={`flex items-center gap-2 ${isTrader ? 'text-white' : 'text-slate-800'}`}>
        <Zap size={18} className={isTrader ? 'text-[#00f3ff]' : 'text-blue-600'} />
        <h3 className="font-black text-lg">Knowledge Check</h3>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isTrader ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
          {quiz.length} questions
        </span>
      </div>

      {result ? (
        <div className={`rounded-2xl border p-6 text-center ${
          result.passed
            ? isTrader ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'
            : isTrader ? 'border-rose-500/40 bg-rose-500/10' : 'border-rose-200 bg-rose-50'
        }`}>
          <div className={`text-5xl font-black mb-2 ${result.passed ? (isTrader ? 'text-emerald-400' : 'text-emerald-600') : (isTrader ? 'text-rose-400' : 'text-rose-600')}`}>
            {result.score}%
          </div>
          <p className={`font-bold mb-1 ${isTrader ? 'text-white' : 'text-slate-800'}`}>
            {result.passed ? '🎉 Passed!' : '💪 Keep Practicing'} — {result.correct}/{result.total} correct
          </p>
          <p className={`text-sm mb-4 ${isTrader ? 'text-slate-400' : 'text-slate-500'}`}>
            {result.passed ? 'Great work! You understand the core concepts.' : 'Review the chapter and try again.'}
          </p>
          {/* Per-question explanations */}
          <div className="space-y-3 text-left mt-4">
            {result.results?.map((r, i) => (
              <div key={r.id} className={`p-3 rounded-xl border text-sm ${r.correct ? (isTrader ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50') : (isTrader ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-200 bg-rose-50/50')}`}>
                <div className={`font-black mb-1 flex items-center gap-2 ${r.correct ? (isTrader ? 'text-emerald-400' : 'text-emerald-700') : (isTrader ? 'text-rose-400' : 'text-rose-700')}`}>
                  {r.correct ? <CheckCircle size={14} /> : <X size={14} />} Q{i + 1}: {r.correct ? 'Correct' : 'Incorrect'}
                </div>
                <p className={isTrader ? 'text-slate-300' : 'text-slate-600'}>{quiz[i]?.explanation || r.explanation}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center mt-5 flex-wrap">
            {result.passed && onFinish && (
              <button
                onClick={onFinish}
                className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                  isTrader
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'
                }`}
              >
                ✅ Finish Course →
              </button>
            )}
            <button
              onClick={reset}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${isTrader ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {quiz.map((q, qi) => (
            <div key={q.id} className={`rounded-xl border p-4 ${isTrader ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
              <p className={`font-black text-sm mb-3 ${isTrader ? 'text-white' : 'text-slate-800'}`}>
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      answers[q.id] === oi
                        ? isTrader ? 'bg-[#00f3ff]/20 border border-[#00f3ff]/50 text-[#00f3ff]' : 'bg-blue-50 border border-blue-300 text-blue-700'
                        : isTrader ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${answers[q.id] === oi ? (isTrader ? 'border-[#00f3ff] bg-[#00f3ff]/30' : 'border-blue-500 bg-blue-100') : (isTrader ? 'border-white/30' : 'border-slate-300')}`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < quiz.length || submitting}
            className={`w-full py-3 rounded-xl font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isTrader ? 'bg-[#00f3ff] text-black hover:bg-[#00c6ff] shadow-[0_0_15px_rgba(0,243,255,0.3)]' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
          >
            {submitting ? 'Submitting…' : `Submit Answers (${Object.keys(answers).length}/${quiz.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Course Reader ────────────────────────────────────────────────────────────
function CourseReader({ course, isTrader, onBack, mode }) {
  const [chapterIdx, setChapterIdx] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [progress, setProgress] = useState(() => loadLocalProgress(course.id, mode));

  const chapter = course.chapters?.[chapterIdx];
  const totalChapters = course.chapters?.length || 0;

  const markDone = () => {
    const next = { ...progress, chapters: { ...progress.chapters, [chapter.id]: true } };
    setProgress(next);
    saveLocalProgress(course.id, next, mode);
    saveProgress(course.id, chapter.id, true);
  };

  const isDone = progress.chapters?.[chapter?.id];
  const allDone = totalChapters > 0 && totalChapters === Object.values(progress.chapters || {}).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className={`p-2 rounded-xl transition-all ${isTrader ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className={`font-black text-xl ${isTrader ? 'text-white' : 'text-slate-800'}`}>{course.title}</h2>
          <p className={`text-xs font-bold ${isTrader ? 'text-slate-400' : 'text-slate-500'}`}>
            {allDone ? '✅ Course Complete' : `Chapter ${chapterIdx + 1} of ${totalChapters}`}
          </p>
        </div>
        <button
          onClick={() => setShowQuiz(!showQuiz)}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            showQuiz
              ? isTrader ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
              : isTrader ? 'bg-[#00f3ff]/20 text-[#00f3ff] hover:bg-[#00f3ff]/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {showQuiz ? 'Read Chapter' : '📝 Take Quiz'}
        </button>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`w-52 shrink-0 space-y-1 ${isTrader ? '' : ''}`}>
          <div className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isTrader ? 'text-slate-500' : 'text-slate-400'}`}>
            Chapters
          </div>
          {course.chapters?.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => { setChapterIdx(i); setShowQuiz(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all ${
                i === chapterIdx
                  ? isTrader ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isTrader ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {progress.chapters?.[ch.id]
                ? <CheckCircle size={14} className={isTrader ? 'text-emerald-400 shrink-0' : 'text-emerald-500 shrink-0'} />
                : <Circle size={14} className="shrink-0 opacity-40" />
              }
              <span className="line-clamp-2 leading-snug">{ch.title}</span>
            </button>
          ))}
          {course.quiz?.length > 0 && (
            <button
              onClick={() => setShowQuiz(true)}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all mt-2 ${
                showQuiz
                  ? isTrader ? 'bg-[#00f3ff]/20 text-[#00f3ff]' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isTrader ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Zap size={14} className={isTrader ? 'text-amber-400 shrink-0' : 'text-amber-500 shrink-0'} />
              Quiz ({course.quiz.length} Qs)
            </button>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {showQuiz ? (
            <QuizSection quiz={course.quiz} courseId={course.id} isTrader={isTrader} onFinish={onBack} />
          ) : chapter ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className={`font-black text-2xl ${isTrader ? 'text-white' : 'text-slate-800'}`}>{chapter.title}</h3>
                {isDone && (
                  <span className={`shrink-0 text-[11px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${isTrader ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <CheckCircle size={12} /> Done
                  </span>
                )}
              </div>
              <div className={`prose max-w-none text-sm space-y-1 ${isTrader ? 'text-slate-300' : 'text-slate-600'}`}>
                {renderContent(chapter.content)}
              </div>
              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 border-t border-white/5">
                <button
                  onClick={() => { if (chapterIdx > 0) setChapterIdx(chapterIdx - 1); }}
                  disabled={chapterIdx === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${isTrader ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <div className="flex gap-2 items-center">
                  {!isDone && (
                    <button
                      onClick={markDone}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isTrader ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'}`}
                    >
                      ✓ Mark Complete
                    </button>
                  )}
                  {chapterIdx < totalChapters - 1 ? (
                    <button
                      onClick={() => { markDone(); setChapterIdx(chapterIdx + 1); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isTrader ? 'bg-[#00f3ff]/20 text-[#00f3ff] hover:bg-[#00f3ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { markDone(); setShowQuiz(true); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isTrader ? 'bg-[#00f3ff] text-black hover:bg-[#00c6ff]' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      Take Quiz <Zap size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function LearningAcademy() {
  const navigate = useNavigate();
  const isTrader = localStorage.getItem('mode') === 'TRADER';
  const mode     = isTrader ? 'trader' : 'investor';
  const audience = isTrader ? 'trader' : 'investor';
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState(null);
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCourses(audience).then(data => {
      if (!alive) return;
      setCourses(data);
      const pm = {};
      data.forEach(c => { pm[c.id] = loadLocalProgress(c.id, mode); });
      setProgressMap(pm);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Re-sync progress from localStorage whenever user returns to the course list
  useEffect(() => {
    if (!activeCourse && courses.length > 0) {
      const pm = {};
      courses.forEach(c => { pm[c.id] = loadLocalProgress(c.id, mode); });
      setProgressMap(pm);
    }
  }, [activeCourse, courses]);

  const overallPct = (() => {
    if (!courses.length) return 0;
    const total = courses.reduce((s, c) => s + (c.chapters?.length || 0), 0);
    const done  = courses.reduce((s, c) => s + Object.values(progressMap[c.id]?.chapters || {}).filter(Boolean).length, 0);
    return total ? Math.round((done / total) * 100) : 0;
  })();

  return (
    <div className={`p-8 w-full h-full min-h-[80vh] flex flex-col ${isTrader ? 'text-white' : 'text-slate-800'}`}>
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {activeCourse ? (
          <CourseReader
            course={activeCourse}
            isTrader={isTrader}
            mode={mode}
            onBack={() => setActiveCourse(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
                  <BookOpen className={isTrader ? 'text-[#00f3ff]' : 'text-blue-600'} size={36} />
                  Radar Academy
                </h1>
                <p className={isTrader ? 'text-slate-400' : 'text-slate-500 font-medium'}>
                  Master the markets with interactive courses designed for {isTrader ? 'active traders' : 'long-term investors'}.
                </p>
              </div>
              <div className="flex items-center gap-4">
                {overallPct > 0 && (
                  <div className="text-right">
                    <div className={`text-3xl font-black ${isTrader ? 'text-[#00f3ff]' : 'text-blue-600'}`}>{overallPct}%</div>
                    <div className={`text-xs font-bold ${isTrader ? 'text-slate-500' : 'text-slate-400'}`}>Overall Progress</div>
                    <div className={`mt-1 w-32 h-1.5 rounded-full ${isTrader ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div className={`h-1.5 rounded-full ${isTrader ? 'bg-[#00f3ff]' : 'bg-blue-500'}`} style={{ width: `${overallPct}%` }} />
                    </div>
                  </div>
                )}
                {!isTrader && (
                  <button
                    onClick={() => navigate('/investor/profile')}
                    className="px-4 py-3 rounded-xl bg-blue-50 text-blue-600 text-xs font-black border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-2"
                  >
                    <User size={14} /> Profile
                  </button>
                )}
              </div>
            </div>

            {/* Course grid */}
            {loading ? (
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8`}>
                {[1,2,3].map(i => (
                  <div key={i} className={`p-6 rounded-2xl border animate-pulse h-52 ${isTrader ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {courses.map(c => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    isTrader={isTrader}
                    progress={progressMap[c.id] || {}}
                    onClick={() => setActiveCourse(c)}
                  />
                ))}
              </div>
            )}

            {/* Stats bar */}
            {!loading && courses.length > 0 && (
              <div className={`grid grid-cols-3 gap-4 rounded-2xl border p-5 ${isTrader ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                {[
                  { icon: BookOpen, label: 'Courses', value: courses.length },
                  { icon: BarChart2, label: 'Chapters', value: courses.reduce((s,c) => s + (c.chapters?.length||0), 0) },
                  { icon: Zap,      label: 'Quiz Questions', value: courses.reduce((s,c) => s + (c.quiz?.length||0), 0) },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <stat.icon size={20} className={isTrader ? 'text-[#00f3ff]' : 'text-blue-600'} />
                    <div>
                      <div className={`text-xl font-black ${isTrader ? 'text-white' : 'text-slate-800'}`}>{stat.value}</div>
                      <div className={`text-[11px] font-bold ${isTrader ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
