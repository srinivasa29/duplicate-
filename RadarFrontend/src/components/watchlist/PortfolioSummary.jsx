import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, PieChart, Activity, Shield } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const PortfolioSummary = ({ stocks }) => {
  const stats = useMemo(() => {
    const rows = Array.isArray(stocks) ? stocks : [];
    const totalValue = rows.reduce((sum, stock) => sum + Number(stock.price || 0), 0);
    const totalChange = rows.reduce((sum, stock) => sum + Number(stock.change || 0), 0);
    const totalPercent = rows.length
      ? rows.reduce((sum, stock) => sum + Number(stock.percent || 0), 0) / rows.length
      : 0;

    const emptyStock = { symbol: '-', change: 0, percent: 0 };
    const gainer = rows.length
      ? rows.reduce((prev, current) => prev.change > current.change ? prev : current)
      : emptyStock;
    const loser = rows.length
      ? rows.reduce((prev, current) => prev.change < current.change ? prev : current)
      : emptyStock;

    const sectors = [
      { name: 'Banking', value: 25, color: '#3b82f6' },
      { name: 'IT', value: 20, color: '#8b5cf6' },
      { name: 'Energy', value: 15, color: '#ec4899' },
      { name: 'Auto', value: 18, color: '#f59e0b' },
      { name: 'Other', value: 22, color: '#06b6d4' },
    ];

    return { totalValue, totalChange, totalPercent, gainer, loser, sectors };
  }, [stocks]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="rounded-[28px] border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(6,12,22,0.96),rgba(10,20,36,0.92))] backdrop-blur-xl p-4 md:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
    >
      <div className="max-w-[1920px] mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-200/70">Portfolio overview</p>
            <h2 className="text-lg md:text-xl font-black tracking-tight text-white">Market state at a glance</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            <span className="px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 inline-flex items-center gap-1.5">
              <Activity size={13} />
              Live summary
            </span>
            <span className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-200 inline-flex items-center gap-1.5">
              <Shield size={13} />
              Frontend snapshot
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-cyan-400/10 bg-[#07111f] p-4 hover:border-cyan-300/30 transition-all"
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Portfolio value</p>
            <div className="space-y-2">
              <p className="text-3xl font-black text-white">₹{stats.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                <TrendingUp size={16} />
                Frontend snapshot
              </div>
            </div>
          </motion.div>

          {}
          <motion.div
            variants={itemVariants}
            className={`rounded-xl border backdrop-blur p-4 transition-all ${
              stats.totalChange > 0
                ? 'border-emerald-500/25 bg-emerald-500/8 hover:border-emerald-500/45'
                : 'border-rose-500/25 bg-rose-500/8 hover:border-rose-500/45'
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Daily P&amp;L</p>
            <div className="space-y-1">
              <p className={`text-3xl font-black ${stats.totalChange > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {stats.totalChange > 0 ? '+' : ''}₹{Math.abs(stats.totalChange).toFixed(2)}
              </p>
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${stats.totalPercent > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {stats.totalPercent > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {stats.totalPercent > 0 ? '+' : ''}{stats.totalPercent.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 backdrop-blur p-4 hover:border-emerald-500/40 transition-all"
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Top gainer</p>
            <div className="space-y-1">
              <p className="text-xl font-black text-white">{stats.gainer.symbol}</p>
              <div className="flex items-center gap-1 text-sm font-semibold text-emerald-200">
                <TrendingUp size={14} />
                +{stats.gainer.percent.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/8 backdrop-blur p-4 hover:border-rose-500/40 transition-all"
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Top loser</p>
            <div className="space-y-1">
              <p className="text-xl font-black text-white">{stats.loser.symbol}</p>
              <div className="flex items-center gap-1 text-sm font-semibold text-rose-200">
                <TrendingDown size={14} />
                {stats.loser.percent.toFixed(2)}%
              </div>
            </div>
          </motion.div>

          {}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-slate-700/40 bg-[#07111f] backdrop-blur p-4 hover:border-violet-400/25 transition-all"
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
              <PieChart size={14} />
              Sector Mix
            </p>
            <div className="h-24 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={stats.sectors}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={40}
                    paddingAngle={1}
                    dataKey="value"
                  >
                    {stats.sectors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default PortfolioSummary;
