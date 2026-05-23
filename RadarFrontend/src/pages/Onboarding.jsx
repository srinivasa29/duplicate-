import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Target,
    Award,
    X,
    HelpCircle,
    BarChart3,
    TrendingUp,
    Zap,
    ChevronRight,
    CheckCircle,
    ArrowLeft,
    ArrowRight,
    Info,
    Activity,
    Shield,
    PieChart,
    Cpu
} from 'lucide-react';
import './Onboarding.css';

const TERMS = {
    "RSI": "A 'market speedometer' that tracks if a stock is being bought too quickly (overpriced) or sold too aggressively (underbought).",
    "MACD": "A tool used to spot the 'momentum' of a stock—helping you see if its current price trend is gaining or losing steam."
};

const QuizTooltip = ({ term, explanation, onClose }) => (
    <div className="definition-tooltip" onClick={onClose}>
        <div className="tooltip-inner" onClick={e => e.stopPropagation()}>
            <strong>{term}</strong>
            <p>{explanation}</p>
            <button onClick={onClose}>Got it</button>
        </div>
    </div>
);

const HighlightedText = ({ text, onTermClick, disable = false }) => {
    if (disable) return <span>{text}</span>;

    const termList = Object.keys(TERMS).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${termList.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part, i) => {
                const isMatch = termList.find(t => t.toLowerCase() === part.toLowerCase());
                if (isMatch) {
                    return (
                        <span 
                            key={i} 
                            className="define-term" 
                            onClick={() => onTermClick(isMatch)}
                        >
                            {part}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
};

const questions = [
    { id: 1, text: "When you buy a stock, what is your primary goal?", options: [{ label: "Capture short-term price movements", type: 'A' }, { label: "Hold for long-term growth and value", type: 'B' }] },
    { id: 2, text: "How long do you typically plan to hold a stock?", weight: 3, options: [{ label: "Minutes to weeks", type: 'A' }, { label: "Months to years", type: 'B' }] },
    { id: 3, text: "What matters more to you while making a decision?", weight: 3, options: [{ label: "Charts, patterns, and technical indicators", type: 'A' }, { label: "Company fundamentals and financial health", type: 'B' }] },
    { id: 4, text: "How do you react to sudden market volatility?", options: [{ label: "Look for opportunities to enter/exit quickly", type: 'A' }, { label: "Stay calm and stick to long-term strategy", type: 'B' }] },
    { id: 5, text: "How often do you check stock prices?", options: [{ label: "Multiple times a day", type: 'A' }, { label: "Occasionally (weekly/monthly)", type: 'B' }] },
    { id: 6, text: "What type of returns do you prefer?", options: [{ label: "Frequent small profits", type: 'A' }, { label: "Gradual long-term wealth accumulation", type: 'B' }] },
    { id: 7, text: "How do you usually manage risk?", options: [{ label: "Use stop-loss and quick exits", type: 'A' }, { label: "Diversify portfolio and stay invested", type: 'B' }] },
    { id: 8, text: "What excites you more?", options: [{ label: "Timing the market perfectly", type: 'A' }, { label: "Seeing a company grow over time", type: 'B' }] },
    { id: 9, text: "How do you respond if a stock drops 15%?", options: [{ label: "Exit quickly to limit loss", type: 'A' }, { label: "Analyze and possibly hold or buy more", type: 'B' }] },
    { id: 10, text: "What kind of analysis do you rely on more?", weight: 3, options: [{ label: "Technical analysis (charts, RSI, MACD, etc.)", type: 'A' }, { label: "Fundamental analysis (earnings, business model)", type: 'B' }] },
    { id: 11, text: "How do you prefer to build wealth?", options: [{ label: "Active buying and selling", type: 'A' }, { label: "Long-term compounding", type: 'B' }] },
    { id: 12, text: "Which statement sounds more like you?", options: [{ label: "\"I want to beat the market regularly.\"", type: 'A' }, { label: "\"I want to grow with the market over time.\"", type: 'B' }] }
];

const Onboarding = () => {
    const [step, setStep] = useState('intro');
    const [currentIdx, setCurrentIdx] = useState(0);
    const [responses, setResponses] = useState(Array(questions.length).fill(null));
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [activeInsight, setActiveInsight] = useState(null); // 'investor' | 'trader' | null
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        if (activeInsight) {
            const timer = setTimeout(() => setActiveInsight(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [activeInsight]);

    const startQuiz = () => { setStep('questionnaire'); };

    const selectOption = (choice) => {
        const newResponses = [...responses];
        newResponses[currentIdx] = newResponses[currentIdx] === choice ? null : choice;
        setResponses(newResponses);
    };

    const handleNext = () => {
        if (responses[currentIdx] === null) return;

        if (currentIdx < questions.length - 1) {
            setCurrentIdx(currentIdx + 1);
        } else {
            performAnalysis(responses);
        }
    };

    const performAnalysis = (answers) => {
        setStep('analysis');
        
        setTimeout(() => {
            let traderScore = 0;
            let investorScore = 0;

            answers.forEach((ans, i) => {
                const weight = questions[i]?.weight || 2;
                if (ans === 'A') traderScore += weight;
                else if (ans === 'B') investorScore += weight;
            });

            const diagnostics = [];
            if (answers[0] === 'A') diagnostics.push("Preferences for short-term price captures.");
            if (answers[2] === 'A') diagnostics.push("Focuses on tech-driven indicators.");
            if (answers[3] === 'A') diagnostics.push("Thrives on market volatility.");
            if (answers[6] === 'A') diagnostics.push("Risk management via stop-losses.");
            if (answers[4] === 'B') diagnostics.push("Low-frequency monitoring focused on value.");
            if (answers[11] === 'B') diagnostics.push("Aims for market-matching stability.");

            const total = traderScore + investorScore || 1;
            const investorPercent = Math.round((investorScore / total) * 100);
            const traderPercent = Math.round((traderScore / total) * 100);

            const speedScore = answers.filter((r, i) => [0, 1, 3, 10].includes(i) && r === 'A').length * 25;
            const riskScore = answers.filter((r, i) => [6, 7, 8, 9].includes(i) && r === 'A').length * 25;
            const patienceScore = answers.filter((r, i) => [1, 4, 5, 11].includes(i) && r === 'B').length * 25;
            const volatilityScore = answers.filter((r, i) => [3, 9].includes(i) && r === 'A').length * 50;
            const disciplineScore = Math.min(100, answers.filter((r, i) => [6, 7, 11].includes(i)).length * 33);

            const gap = Math.abs(investorScore - traderScore);
            const confidence = gap > 6 ? "High" : gap > 3 ? "Medium" : "Developing";

            const whyBullets = [];
            if (answers[0] === 'A') whyBullets.push("You preferred short-term decision making in buy scenarios.");
            if (answers[3] === 'A') whyBullets.push("You showed high comfort with market volatility.");
            if (answers[4] === 'A') whyBullets.push("You favor frequent monitoring over passive holding.");
            if (answers[6] === 'A') whyBullets.push("You prioritize tight risk controls (Stop-losses).");
            if (answers[1] === 'B') whyBullets.push("You show a commitment to multi-year compound growth.");

            let hybridLine = "";
            if (traderScore > investorScore) {
                hybridLine = investorScore > 2 ? `You are strongly trader-oriented but show investor tendencies in stable market conditions.` : `Your profile is purely built for active market navigation.`;
            } else {
                hybridLine = traderScore > 2 ? `You are fundamentally an investor but possess the agility to capitalize on short-term market spikes.` : `You are a pure long-term architect of wealth.`;
            }

            const dominant = traderPercent >= 50 ? 'TRADER' : 'INVESTOR';
            const personaLabel = dominant === 'INVESTOR' ? (investorPercent > 80 ? 'The Architect' : 'The Sentinel') : (traderPercent > 80 ? 'The Predator' : 'The Tactician');
            const personaBlurb = dominant === 'INVESTOR' 
                ? "You prioritize capital preservation, fundamental growth, and long-term compounding."
                : "You thrive on market volatility, quick execution, and momentum-based opportunities.";

            const dnaPayload = {
                investorPercent,
                traderPercent,
                dominant,
                personaName: personaLabel,
                personaDescription: personaBlurb,
                traits: dominant === 'TRADER' ? ['Technical', 'Agile', 'Risk-Savvy'] : ['Fundamental', 'Patient', 'Diversified'],
                diagnostics,
                metrics: {
                    speed: speedScore,
                    risk: riskScore,
                    patience: patienceScore,
                    volatility: volatilityScore,
                    discipline: disciplineScore
                },
                confidence,
                whyBullets: whyBullets.slice(0, 3),
                hybridLine,
                completedAt: new Date().toISOString()
            };

            setAnalysis(dnaPayload);
            setStep('result');
            localStorage.setItem('hasCompletedAssessment', 'true');
            localStorage.setItem('investorDNA', JSON.stringify(dnaPayload));

            api.post('/user/dna', dnaPayload)
                .then((response) => {
                    const savedDNA = response.data?.data;
                    if (savedDNA) {
                        localStorage.setItem('investorDNA', JSON.stringify(savedDNA));
                    }
                })
                .catch((error) => {
                    console.error('Failed to save assessment to account:', error);
                });
        }, 1500);
    };

    const chooseMode = (mode) => {
        localStorage.setItem('mode', mode.toUpperCase());
        window.location.href = '/dashboard';
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-gradient" />

            {step === 'intro' && (
                <div className="onboarding-card intro-card fade-in">
                    <div className="intro-header flex justify-center">
                        <img src="/radar-orbit-logo.png" alt="RADAR" className="logo-intro" />
                    </div>
                    <div className="intro-content">
                        <h1 className="intro-title">Understand Your Market Style</h1>
                        <p className="intro-subtitle">
                            We'll analyze your decision-making style to personalize your experience across investing and trading.
                        </p>
                        <div className="intro-benefits">
                            <div className="benefit-item">
                                <div className="benefit-icon investor-icon"><BarChart3 size={20} /></div>
                                <span className="benefit-text">Personalized insights (Investor vs Trader)</span>
                            </div>
                            <div className="benefit-item">
                                <div className="benefit-icon target-icon"><TrendingUp size={20} /></div>
                                <span className="benefit-text">Better recommendations inside RADAR</span>
                            </div>
                            <div className="benefit-item">
                                <div className="benefit-icon trader-icon"><Zap size={20} /></div>
                                <span className="benefit-text">Smarter dashboard experience</span>
                            </div>
                        </div>
                        <button className="btn-start" onClick={startQuiz}>
                            Start Assessment <ChevronRight size={18} />
                        </button>
                        <p className="intro-meta">Takes ~2 minutes • Research-based Analysis</p>
                    </div>
                </div>
            )}

            {step === 'questionnaire' && (
                <div className="onboarding-card quiz-card fade-in">
                    <div className="quiz-header">
                        <div className="header-top flex justify-between items-center mb-8 relative">
                            <img src="/radar-orbit-logo.png" alt="RADAR" className="logo-radar-small" />
                            <div className="flex items-center gap-2">
                                <button 
                                    className="help-btn text-slate-300 hover:text-blue-500 transition-colors" 
                                    onClick={() => setShowHelp(!showHelp)}
                                >
                                    <HelpCircle size={20} />
                                </button>
                            </div>
                            
                            {showHelp && (
                                <div className="absolute top-10 right-0 w-[240px] bg-slate-900 text-white p-4 rounded-xl shadow-2xl z-50 text-xs leading-relaxed border border-white/10 fade-in">
                                    <p className="font-bold mb-2 text-blue-400 uppercase tracking-tighter">What is this for?</p>
                                    This assessment maps your market behavior and execution style. Your answers help RADAR personalize your entire experience—optimizing your dashboard for your unique psychological edge.
                                    <button className="mt-3 block text-[10px] uppercase font-black text-slate-400 hover:text-white" onClick={() => setShowHelp(false)}>Got it</button>
                                </div>
                            )}
                        </div>
                        <h2 className="quiz-title">Market Identity Calibration</h2>
                        <p className="quiz-subtitle">Map your market style to unlock a personalized experience.</p>
                        <div className="progress-section">
                            <div className="progress-step">Question {currentIdx + 1} of {questions.length}</div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="quiz-content">
                        <div className="question-card">
                            <h3 className="question-text">
                                <HighlightedText text={questions[currentIdx].text} onTermClick={setActiveTooltip} disable={currentIdx !== 9} />
                            </h3>
                            <div className="options-grid">
                                {questions[currentIdx].options.map((opt, i) => (
                                    <button 
                                        key={opt.type} 
                                        className={`option-card ${responses[currentIdx] === opt.type ? 'active' : ''}`}
                                        onClick={() => selectOption(opt.type)}
                                    >
                                        <div className="option-marker">{opt.type}</div>
                                        <div className="option-label">
                                            <HighlightedText text={opt.label} onTermClick={setActiveTooltip} disable={currentIdx !== 9} />
                                        </div>
                                        {responses[currentIdx] === opt.type && (
                                            <div className="ml-auto text-blue-600">
                                                <CheckCircle size={20} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="quiz-footer">
                        <button className="btn-back" onClick={() => currentIdx > 0 ? setCurrentIdx(currentIdx - 1) : setStep('intro')}>Back</button>
                        <button 
                            className="btn-next" 
                            disabled={responses[currentIdx] === null}
                            onClick={handleNext}
                        >
                            {currentIdx === questions.length - 1 ? 'See Results' : 'Next'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'analysis' && (
                <div className="onboarding-card loading-card fade-in">
                    <div className="loader-wrap">
                        <div className="spinner" />
                        <p>Analyzing behavior patterns...</p>
                    </div>
                </div>
            )}

            {step === 'result' && analysis && (
                <div className="onboarding-card calibration-page fade-in">
                    <div className="calibration-layout">
                        {}
                        <div className="calibration-sidebar">
                            <div className="sidebar-top">
                                <div className="persona-glyph">
                                    <Zap size={32} className="text-orange-500 fill-orange-500" />
                                </div>
                                <h2 className="persona-title">{analysis.personaName}</h2>
                                <div className="persona-tags">
                                    {analysis.traits.map((t, i) => (
                                        <span key={i} className="persona-tag">{t}</span>
                                    ))}
                                </div>
                                <p className="persona-blurb">
                                    {analysis.personaDescription}
                                </p>
                                
                                <div className="mt-8 pt-8 border-t border-white/10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block">Psychological Profile</span>
                                    <p className="text-xs text-white/60 leading-relaxed italic mb-6">"{analysis.hybridLine}"</p>

                                    <h4 className="diagnostics-title !text-white/40 !mb-4">BEHAVIOR BREAKDOWN</h4>
                                    <div className="calibration-stats mb-8">
                                        {[
                                            { label: "Decision Speed", val: analysis.metrics.speed },
                                            { label: "Risk Appetite", val: analysis.metrics.risk },
                                            { label: "Patience Level", val: analysis.metrics.patience },
                                            { label: "Volatility Comfort", val: analysis.metrics.volatility },
                                            { label: "Discipline", val: analysis.metrics.discipline }
                                        ].map((m, i) => (
                                            <div key={i} className="stat-row !mb-5">
                                                <div className="stat-label-wrap">
                                                    <span className="stat-label text-[12px]">{m.label}</span>
                                                    <span className="stat-val text-[12px]">{m.val}%</span>
                                                </div>
                                                <div className="stat-bar h-2 bg-white/5 border border-white/5">
                                                    <div className="stat-fill bg-blue-400/80" style={{ width: `${m.val}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="diagnostics-title !text-white/40 !mb-4">RECOMMENDED FOR YOU</h4>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {(analysis.dominant === 'TRADER' ? ['Technical Analysis', 'Risk Management'] : ['DCF Valuation', 'Portolio Theory']).map(n => 
                                                <span key={n} className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-white/60 border border-white/10">{n}</span>
                                            )}
                                        </div>
                                        <button className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors">Start Academy Path →</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {}
                        <div className="calibration-content">
                            <div className="calibration-header mb-6">
                                <h1 className="cal-title">Profile Calibration</h1>
                                <p className="cal-subtitle">A precise map of your behavioral market edge.</p>
                            </div>

                            <div className="calibration-stats">
                                <div 
                                    className={`stat-row clickable ${activeInsight === 'investor' ? 'highlight' : ''}`}
                                    onClick={() => setActiveInsight('investor')}
                                >
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Long-term Investor</span>
                                        <span className="stat-val">{analysis.investorPercent}%</span>
                                    </div>
                                    <div className="stat-bar"><div className="stat-fill blue" style={{ width: `${analysis.investorPercent}%` }} /></div>
                                </div>
                                <div 
                                    className={`stat-row clickable ${activeInsight === 'trader' ? 'highlight' : ''}`}
                                    onClick={() => setActiveInsight('trader')}
                                >
                                    <div className="stat-label-wrap">
                                        <span className="stat-label">Active Trader</span>
                                        <span className="stat-val">{analysis.traderPercent}%</span>
                                    </div>
                                    <div className="stat-bar"><div className="stat-fill purple" style={{ width: `${analysis.traderPercent}%` }} /></div>
                                </div>
                            </div>

                            <div className="diagnostics-box relative overflow-hidden mb-6">
                                <div className={`diagnostics-inner transition-opacity duration-300 ${activeInsight ? 'opacity-0' : 'opacity-100'}`}>
                                    {!activeInsight && (
                                        <>
                                            <h4 className="diagnostics-title">WHY THIS RESULT?</h4>
                                            <div className="diagnostics-list mb-6">
                                                {analysis.whyBullets.map((d, i) => (
                                                    <div key={i} className="diagnostic-card">{d}</div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h4 className="diagnostics-title">WHERE YOU PERFORM BEST</h4>
                                                    <div className="space-y-1.5 px-1">
                                                        {analysis.dominant === 'TRADER' ? (
                                                            <>
                                                                <div className="text-[11px] font-bold text-slate-600">• High volatility markets</div>
                                                                <div className="text-[11px] font-bold text-slate-600">• Breakout conditions</div>
                                                                <div className="text-[11px] font-bold text-slate-600">• Momentum-driven trends</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-[11px] font-bold text-slate-600">• Value-driven cycles</div>
                                                                <div className="text-[11px] font-bold text-slate-600">• Compound growth steady-stats</div>
                                                                <div className="text-[11px] font-bold text-slate-600">• Reversion to mean</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="diagnostics-title">WATCH OUT FOR</h4>
                                                    <div className="space-y-1.5 px-1">
                                                        {analysis.dominant === 'TRADER' ? (
                                                            <>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Overtrading in sideways markets</div>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Entering trades emotionally</div>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Ignoring long-term signals</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Analysis paralysis</div>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Missing quick opportunity windows</div>
                                                                <div className="text-[11px] font-bold text-slate-400 opacity-80">• Underestimating volatility impact</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {activeInsight && (
                                    <div className="insights-panel fade-in">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="insights-heading">Why this score?</h4>
                                            <button className="text-xs font-bold text-blue-500" onClick={() => setActiveInsight(null)}>Back to results</button>
                                        </div>
                                        <div className="insights-list">
                                            {activeInsight === 'investor' ? (
                                                <>
                                                    <div className="insight-item"><Shield size={16} className="text-blue-500 mr-3" /> Patience: Focus on long holding periods (months/years).</div>
                                                    <div className="insight-item"><PieChart size={16} className="text-blue-500 mr-3" /> Fundamental Focus: High conviction in business models.</div>
                                                    <div className="insight-item"><Activity size={16} className="text-blue-500 mr-3" /> Low Frequency: Market noise is ignored for long-term growth.</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="insight-item"><Zap size={16} className="text-orange-500 mr-3" /> Speed: Preference for quick execution (minutes/days).</div>
                                                    <div className="insight-item"><Activity size={16} className="text-orange-500 mr-3" /> Momentum: Focus on price action and technical indicators.</div>
                                                    <div className="insight-item"><Cpu size={16} className="text-orange-500 mr-3" /> Volatility Edge: Thrive on sudden market fluctuations.</div>
                                                </>
                                            )}
                                        </div>
                                        <div className="insight-timer-bar-wrap">
                                            <div className="insight-timer-fill" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="result-actions-grid pt-4 border-t border-slate-100 mt-auto">
                                <button className="btn-activate mb-3" onClick={() => chooseMode(analysis.dominant)}>
                                    Enter {analysis.dominant.charAt(0) + analysis.dominant.slice(1).toLowerCase()} Mode (Recommended for you) →
                                </button>
                                <div className="flex gap-3">
                                    <button 
                                        className="btn-secondary flex-1" 
                                        onClick={() => chooseMode(analysis.dominant === 'INVESTOR' ? 'TRADER' : 'INVESTOR')}
                                    >
                                        {analysis.dominant === 'INVESTOR' ? 'Trader Mode' : 'Investor Mode'}
                                    </button>
                                    <button 
                                        className="btn-outline flex-1" 
                                        onClick={() => { setStep('questionnaire'); setCurrentIdx(0); setResponses(Array(questions.length).fill(null)); }}
                                    >
                                        Recalibrate
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTooltip && (
                <QuizTooltip 
                    term={activeTooltip} 
                    explanation={TERMS[activeTooltip]} 
                    onClose={() => setActiveTooltip(null)} 
                />
            )}
        </div>
    );
};

export default Onboarding;
