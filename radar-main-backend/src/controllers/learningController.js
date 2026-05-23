const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

// In-memory progress store (replace with DB model if you have a User.progress field)
const progressStore = {};

const DATA_PATH = path.join(__dirname, '../data/learningData.json');

const readCourses = async () => {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw);
};

// GET /api/learning  — all courses (optionally filtered by ?audience=trader|investor)
const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

const getLearnings = async (req, res) => {
    try {
        const courses = await readCourses();
        const audience = String(req.query.audience || '').toLowerCase();
        const filtered = audience
            ? courses.filter(c => {
                const a = String(c.audience || 'both').toLowerCase();
                return a === 'both' || a === audience;
              })
            : courses;

        // Sort Beginner → Intermediate → Advanced
        filtered.sort((a, b) => {
            const aOrder = DIFFICULTY_ORDER[String(a.difficulty || '').toLowerCase()] ?? 99;
            const bOrder = DIFFICULTY_ORDER[String(b.difficulty || '').toLowerCase()] ?? 99;
            return aOrder - bOrder;
        });

        res.json({ success: true, data: filtered });
    } catch (error) {
        logger.error('Failed to load learning data:', error);
        res.status(500).json({ success: false, error: 'Failed to load learning data' });
    }
};

// GET /api/learning/:id  — single course
const getCourse = async (req, res) => {
    try {
        const courses = await readCourses();
        const course = courses.find(c => c.id === req.params.id);
        if (!course) return res.status(404).json({ success: false, error: 'Course not found' });
        res.json({ success: true, data: course });
    } catch (error) {
        logger.error('Failed to load course:', error);
        res.status(500).json({ success: false, error: 'Failed to load course' });
    }
};

// GET /api/learning/progress/:userId
const getProgress = async (req, res) => {
    const userId = req.params.userId || req.user?.id || 'anonymous';
    const progress = progressStore[userId] || {};
    res.json({ success: true, data: progress });
};

// POST /api/learning/progress  — save chapter completion
// body: { courseId, chapterId, completed }
const saveProgress = async (req, res) => {
    try {
        const userId = req.user?.id || req.body.userId || 'anonymous';
        const { courseId, chapterId, completed } = req.body;
        if (!courseId || !chapterId) {
            return res.status(400).json({ success: false, error: 'courseId and chapterId are required' });
        }
        if (!progressStore[userId]) progressStore[userId] = {};
        if (!progressStore[userId][courseId]) progressStore[userId][courseId] = { chapters: {}, quizScores: {} };
        progressStore[userId][courseId].chapters[chapterId] = Boolean(completed);
        res.json({ success: true, data: progressStore[userId] });
    } catch (error) {
        logger.error('Failed to save progress:', error);
        res.status(500).json({ success: false, error: 'Failed to save progress' });
    }
};

// POST /api/learning/quiz  — submit quiz answers, get score
// body: { courseId, answers: { questionId: selectedIndex, ... } }
const submitQuiz = async (req, res) => {
    try {
        const { courseId, answers } = req.body;
        const userId = req.user?.id || req.body.userId || 'anonymous';
        if (!courseId || !answers) {
            return res.status(400).json({ success: false, error: 'courseId and answers are required' });
        }
        const courses = await readCourses();
        const course = courses.find(c => c.id === courseId);
        if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

        let correct = 0;
        const results = course.quiz.map(q => {
            const selected = answers[q.id];
            const isCorrect = selected === q.answer;
            if (isCorrect) correct++;
            return { id: q.id, correct: isCorrect, correctAnswer: q.answer, explanation: q.explanation };
        });

        const score = Math.round((correct / course.quiz.length) * 100);

        // Persist score
        if (!progressStore[userId]) progressStore[userId] = {};
        if (!progressStore[userId][courseId]) progressStore[userId][courseId] = { chapters: {}, quizScores: {} };
        progressStore[userId][courseId].quizScores = {
            score,
            correct,
            total: course.quiz.length,
            passed: score >= 70,
            submittedAt: new Date().toISOString(),
        };

        res.json({ success: true, data: { score, correct, total: course.quiz.length, passed: score >= 70, results } });
    } catch (error) {
        logger.error('Failed to submit quiz:', error);
        res.status(500).json({ success: false, error: 'Failed to submit quiz' });
    }
};

module.exports = { getLearnings, getCourse, getProgress, saveProgress, submitQuiz };
