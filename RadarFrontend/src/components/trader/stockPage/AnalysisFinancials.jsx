import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../api/api';

const FALLBACK = [
    { year: 'FY20', revenue: 0, income: 0, eps: 0 },
    { year: 'FY21', revenue: 0, income: 0, eps: 0 },
    { year: 'FY22', revenue: 0, income: 0, eps: 0 },
    { year: 'FY23', revenue: 0, income: 0, eps: 0 },
];

export default function AnalysisFinancials({ symbol }) {
    const [data, setData] = useState(FALLBACK);
    const [summary, setSummary] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!symbol) { setIsLoading(false); return; }
        let active = true;
        setIsLoading(true);
        api.get(`/stocks/${encodeURIComponent(symbol)}/fundamentals`)
            .then(res => {
                if (!active) return;
                const d = res.data?.data ?? res.data;
                if (d?.revenue?.length) {
                    setData(d.revenue.map((r, i) => ({
                        year: r.year || `FY${20 + i}`,
                        revenue: Number(r.value ?? r.revenue ?? 0),
                        income: Number(d.profit?.[i]?.value ?? d.profit?.[i]?.income ?? 0),
                        eps: Number(d.eps?.[i]?.value ?? d.eps?.[i]?.eps ?? 0),
                    })));
                }
                if (d?.summary) setSummary(d.summary);
                setError(null);
            })
            .catch(err => {
                if (!active) return;
                console.warn('AnalysisFinancials fetch failed:', err.message);
                setError('Financial data unavailable.');
            })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [symbol]);

    return (
        <div className="flex flex-col gap-12">
            {isLoading && (
                <div className="text-xs text-slate-500 animate-pulse px-1">Loading financials for {symbol}...</div>
            )}
            {error && !isLoading && (
                <div className="text-xs text-amber-500/70 px-1">{error}</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue & Net Income */}
                <div className="rs-card-minimal">
                    <h3 className="rs-label-sm uppercase mb-6 tracking-widest">Revenue &amp; Net Income (₹B)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e39" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#787b86' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#787b86' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1b1e2e', border: '1px solid #2a2e39', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Bar dataKey="revenue" fill="#2962ff" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="income" fill="#089981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* EPS Growth */}
                <div className="rs-card-minimal">
                    <h3 className="rs-label-sm uppercase mb-6 tracking-widest">EPS Growth (₹)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e39" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#787b86' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#787b86' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1b1e2e', border: '1px solid #2a2e39', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Bar dataKey="eps" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Income Statement Summary */}
            <section>
                <h3 className="rs-label-sm uppercase mb-6 tracking-widest">Income Statement Summary</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="py-4 rs-label-sm">Metric (₹B)</th>
                                <th className="py-4 rs-label-sm text-right">{data[data.length - 1]?.year || 'Latest'}</th>
                                <th className="py-4 rs-label-sm text-right">{data[data.length - 2]?.year || 'Prior'}</th>
                                <th className="py-4 rs-label-sm text-right">Growth (%)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] font-medium text-slate-300">
                            {summary.length > 0 ? (
                                summary.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className="py-4">{row.label}</td>
                                        <td className="py-4 text-right">{row.current ?? '—'}</td>
                                        <td className="py-4 text-right">{row.prior ?? '—'}</td>
                                        <td className={`py-4 text-right ${Number(row.growth) >= 0 ? 'rs-up' : 'rs-down'}`}>
                                            {row.growth != null ? `${Number(row.growth) >= 0 ? '+' : ''}${row.growth}%` : '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                ['Total Revenue', 'Operating Expense', 'Net Income'].map((label, i) => {
                                    const latest = data[data.length - 1];
                                    const prior = data[data.length - 2];
                                    const key = i === 0 ? 'revenue' : i === 1 ? 'revenue' : 'income';
                                    const curr = latest?.[key] ?? 0;
                                    const prev = prior?.[key] ?? 0;
                                    const growth = prev ? (((curr - prev) / prev) * 100).toFixed(1) : null;
                                    return (
                                        <tr key={label} className="border-b border-slate-800/50">
                                            <td className="py-4">{label}</td>
                                            <td className="py-4 text-right">{curr || '—'}</td>
                                            <td className="py-4 text-right">{prev || '—'}</td>
                                            <td className={`py-4 text-right ${growth >= 0 ? 'rs-up' : 'rs-down'}`}>
                                                {growth != null ? `${growth >= 0 ? '+' : ''}${growth}%` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
