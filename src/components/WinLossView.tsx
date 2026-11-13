import React, { useState, useMemo } from 'react';
import { BetHistoryRecord, getDateTimeMetadata, normalizeRealBetRecords, formatSequentialRoundId } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Building2,
  ShieldCheck,
  Search,
  RotateCcw,
  Hash,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';

interface WinLossViewProps {
  records: BetHistoryRecord[];
  currentDate?: string;
  onBackToGame: () => void;
}

export const WinLossView: React.FC<WinLossViewProps> = ({
  records,
  currentDate,
  onBackToGame,
}) => {
  const liveMeta = getDateTimeMetadata();
  const activeTodayDate = currentDate || liveMeta.date;

  // Normalize & strictly filter to ONLY actual wagers (excludes any demo/test activity)
  const actualRecords = useMemo(() => normalizeRealBetRecords(records), [records]);

  // Date filter states (Year / Month / Day)
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [customYearInput, setCustomYearInput] = useState<string>(String(liveMeta.year));
  const [customMonthInput, setCustomMonthInput] = useState<string>(String(liveMeta.month).padStart(2, '0'));
  const [customDayInput, setCustomDayInput] = useState<string>(String(liveMeta.day).padStart(2, '0'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');

  // Available years, months, days from actual records + current live date + custom added dates
  const [addedDates, setAddedDates] = useState<string[]>([activeTodayDate]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([liveMeta.year, liveMeta.year - 1, liveMeta.year + 1]);
    actualRecords.forEach((r) => {
      if (r.year) yearsSet.add(r.year);
    });
    addedDates.forEach((d) => {
      const y = parseInt(d.split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [actualRecords, addedDates, liveMeta.year]);

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    const yNum = parseInt(customYearInput, 10);
    const mNum = parseInt(customMonthInput, 10);
    const dNum = parseInt(customDayInput, 10);
    if (!isNaN(yNum) && yNum >= 2020 && yNum <= 2100) {
      setSelectedYear(String(yNum));
    }
    if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
      setSelectedMonth(String(mNum));
    } else {
      setSelectedMonth('all');
    }
    if (!isNaN(dNum) && dNum >= 1 && dNum <= 31) {
      setSelectedDay(String(dNum));
    } else {
      setSelectedDay('all');
    }
    if (!isNaN(yNum) && !isNaN(mNum) && !isNaN(dNum)) {
      const formatted = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      setAddedDates((prev) => (prev.includes(formatted) ? prev : [formatted, ...prev]));
    }
  };

  const handleSelectToday = () => {
    const [y, m, d] = activeTodayDate.split('-');
    setSelectedYear(String(parseInt(y, 10)));
    setSelectedMonth(String(parseInt(m, 10)));
    setSelectedDay(String(parseInt(d, 10)));
    setCustomYearInput(y);
    setCustomMonthInput(m);
    setCustomDayInput(d);
  };

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedDay('all');
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Filtered records based on Year / Month / Day, Ticket ID / Round search, and Status
  const filteredRecords = useMemo(() => {
    return actualRecords.filter((rec) => {
      if (selectedYear !== 'all' && rec.year !== parseInt(selectedYear, 10)) {
        return false;
      }
      if (selectedMonth !== 'all' && rec.month !== parseInt(selectedMonth, 10)) {
        return false;
      }
      if (selectedDay !== 'all' && rec.day !== parseInt(selectedDay, 10)) {
        return false;
      }
      if (statusFilter !== 'all' && rec.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchTicket = (rec.ticketId || '').toLowerCase().includes(q);
        const matchRound = (rec.roundId || '').toLowerCase().includes(q);
        const matchDate = (rec.date || '').toLowerCase().includes(q);
        if (!matchTicket && !matchRound && !matchDate) return false;
      }
      return true;
    });
  }, [actualRecords, selectedYear, selectedMonth, selectedDay, statusFilter, searchQuery]);

  const formatKHR = (amount: number) => `${amount.toLocaleString()}៛`;

  // Player & Platform Owner Summary Calculations (Strictly from actual wagers)
  const summary = useMemo(() => {
    const totalStake = filteredRecords.reduce((acc, r) => acc + r.totalStake, 0);
    const settledRecords = filteredRecords.filter((r) => r.status !== 'pending');
    const pendingRecords = filteredRecords.filter((r) => r.status === 'pending');

    const settledStake = settledRecords.reduce((acc, r) => acc + r.totalStake, 0);
    const totalPayout = settledRecords.reduce((acc, r) => acc + r.totalPayout, 0);
    const pendingStake = pendingRecords.reduce((acc, r) => acc + r.totalStake, 0);

    // Player net outcome: Payout - Stake (on settled bets, or all bets)
    const playerNetProfit = totalPayout - settledStake;

    // Platform Owner (House) net outcome: Actual Stake Collected - Player Payouts
    const ownerNetProfit = settledStake - totalPayout;
    const ownerMarginPercent =
      settledStake > 0 ? ((ownerNetProfit / settledStake) * 100).toFixed(1) : '0.0';

    const wonCount = settledRecords.filter((r) => r.status === 'won').length;
    const lostCount = settledRecords.filter((r) => r.status === 'lost').length;
    const winRate =
      settledRecords.length > 0 ? ((wonCount / settledRecords.length) * 100).toFixed(1) : '0.0';

    return {
      totalTickets: filteredRecords.length,
      settledCount: settledRecords.length,
      pendingCount: pendingRecords.length,
      totalStake,
      settledStake,
      pendingStake,
      totalPayout,
      playerNetProfit,
      ownerNetProfit,
      ownerMarginPercent,
      wonCount,
      lostCount,
      winRate,
    };
  }, [filteredRecords]);

  // Daily breakdown grouped by Date (Year-Month-Day) for the Platform Owner & Player
  const dailyBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        date: string;
        year: number;
        month: number;
        day: number;
        ticketCount: number;
        firstTicketId: string;
        lastTicketId: string;
        totalStake: number;
        settledStake: number;
        totalPayout: number;
        ownerNet: number;
        playerNet: number;
      }
    > = {};

    actualRecords.forEach((rec) => {
      const d = rec.date || activeTodayDate;
      if (!map[d]) {
        map[d] = {
          date: d,
          year: rec.year,
          month: rec.month,
          day: rec.day,
          ticketCount: 0,
          firstTicketId: rec.ticketId,
          lastTicketId: rec.ticketId,
          totalStake: 0,
          settledStake: 0,
          totalPayout: 0,
          ownerNet: 0,
          playerNet: 0,
        };
      }
      const entry = map[d];
      entry.ticketCount += 1;
      if (rec.ticketId < entry.firstTicketId) entry.firstTicketId = rec.ticketId;
      if (rec.ticketId > entry.lastTicketId) entry.lastTicketId = rec.ticketId;
      entry.totalStake += rec.totalStake;
      if (rec.status !== 'pending') {
        entry.settledStake += rec.totalStake;
        entry.totalPayout += rec.totalPayout;
        entry.ownerNet += rec.totalStake - rec.totalPayout;
        entry.playerNet += rec.totalPayout - rec.totalStake;
      }
    });

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [actualRecords, activeTodayDate]);

  const activeDateFilterLabel = useMemo(() => {
    if (selectedYear === 'all' && selectedMonth === 'all' && selectedDay === 'all') {
      return 'គ្រប់កាលបរិច្ឆេទទាំងអស់ (All Recent & Past Dates)';
    }
    const y = selectedYear === 'all' ? 'YYYY' : selectedYear;
    const m = selectedMonth === 'all' ? 'MM' : String(selectedMonth).padStart(2, '0');
    const d = selectedDay === 'all' ? 'DD' : String(selectedDay).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  return (
    <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-slate-800">
              របាយការណ៍សង្ខេប ឈ្នះ-ចាញ់ (Win/Loss & Owner Summary Report)
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              ទិន្នន័យភ្នាល់ជាក់ស្តែង 100% (Actual Wagers Only)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>គណនី: <strong className="text-slate-700">AADPDPP004</strong></span>
            <span>|</span>
            <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
              <Calendar className="w-3.5 h-3.5" />
              កាលបរិច្ឆេទប្រចាំថ្ងៃ (Live Daily Date): {activeTodayDate}
            </span>
            <span>|</span>
            <span>លេខសម្គាល់ភ្នាល់ចាប់ផ្តើមពី <strong className="text-indigo-700">#0001</strong> ជារៀងរាល់ថ្ងៃ</span>
          </p>
        </div>
        <button
          onClick={onBackToGame}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors self-start sm:self-auto"
        >
          ត្រឡប់ទៅការភ្នាល់ (Return to Game)
        </button>
      </div>

      {/* Date Filter & Add/Query Year / Month / Day Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-extrabold text-slate-800">
              ត្រួតពិនិត្យរបាយការណ៍ថ្មីៗ និងអតីតកាល តាម ឆ្នាំ / ខែ / ថ្ងៃ (Review Recent & Past Reports by Year / Month / Day)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
            >
              ថ្ងៃនេះ ({activeTodayDate})
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              បង្ហាញទាំងអស់ (All Dates)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-end">
          {/* Select Dropdowns for Year / Month / Day */}
          <div className="xl:col-span-5 grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ឆ្នាំ (Year)
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="all">គ្រប់ឆ្នាំ (All Years)</option>
                {availableYears.map((y) => (
                  <option key={y} value={String(y)}>
                    ឆ្នាំ {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ខែ (Month)
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="all">គ្រប់ខែ (All Months)</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    ខែ {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ថ្ងៃ (Day)
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="all">គ្រប់ថ្ងៃ (All Days)</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    ថ្ងៃទី {String(d).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Direct Input to Add/Query Specific Year / Month / Day */}
          <form onSubmit={handleApplyCustomDate} className="xl:col-span-4 flex items-end gap-1.5">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                បញ្ចូល ឆ្នាំ / ខែ / ថ្ងៃ (Enter Year / Month / Day)
              </label>
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  placeholder="YYYY"
                  value={customYearInput}
                  onChange={(e) => setCustomYearInput(e.target.value)}
                  className="px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="MM"
                  value={customMonthInput}
                  onChange={(e) => setCustomMonthInput(e.target.value)}
                  className="px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800"
                />
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="DD"
                  value={customDayInput}
                  onChange={(e) => setCustomDayInput(e.target.value)}
                  className="px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs whitespace-nowrap"
            >
              ស្វែងរកកាលបរិច្ឆេទ
            </button>
          </form>

          {/* Search by Ticket ID (0001+) or Round ID */}
          <div className="xl:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              ស្វែងរកតាម លេខសម្គាល់ភ្នាល់ (ID: 0001) ឬលេខជុំ (#0001+)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ឧ. 0001, 0002, #0001..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PLATFORM OWNER WIN/LOSS SUMMARY REPORT */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-xl p-4 text-white shadow-md border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-amber-300 tracking-wide">
                របាយការណ៍សង្ខេប ឈ្នះ-ចាញ់ សម្រាប់ម្ចាស់វេទិកា (Platform Owner Win/Loss Summary)
              </h3>
              <p className="text-[11px] text-slate-300">
                គណនាចេញពីការភ្នាល់ជាក់ស្តែងសុទ្ធសាធ (មិនរាប់បញ្ចូលគណនីសាកល្បង ឬ Demo ឡើយ) • កាលបរិច្ឆេទកំពុងមើល: <strong className="text-white">{activeDateFilterLabel}</strong>
              </p>
            </div>
          </div>
          <div className="text-xs font-bold bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-600 self-start sm:self-auto">
            ចំនួនសំបុត្រភ្នាល់សរុប: <span className="text-amber-300 font-black">{summary.totalTickets}</span> សំបុត្រ
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Total Actual Wagers Received by Platform */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
            <div className="text-[11px] text-slate-300 font-medium">
              ចំណូលភ្នាល់ជាក់ស្តែងសរុប (Actual Wager Turnover)
            </div>
            <div className="text-lg font-black text-white mt-1">
              {formatKHR(summary.settledStake)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              ទូទាត់រួច: {summary.settledCount} សំបុត្រ {summary.pendingCount > 0 ? `(រង់ចាំ: ${formatKHR(summary.pendingStake)})` : ''}
            </div>
          </div>

          {/* 2. Total Payouts Paid by Owner to Winning Players */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
            <div className="text-[11px] text-slate-300 font-medium">
              ទឹកប្រាក់ទូទាត់ឱ្យអ្នកឈ្នះសរុប (Player Payouts)
            </div>
            <div className="text-lg font-black text-amber-300 mt-1">
              {formatKHR(summary.totalPayout)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              សំបុត្រឈ្នះ: {summary.wonCount} | សំបុត្រចាញ់: {summary.lostCount}
            </div>
          </div>

          {/* 3. Platform Owner Net Win / Loss */}
          <div
            className={`rounded-lg p-3 border ${
              summary.ownerNetProfit >= 0
                ? 'bg-emerald-950/70 border-emerald-500/40'
                : 'bg-rose-950/70 border-rose-500/40'
            }`}
          >
            <div className="text-[11px] text-slate-200 font-bold">
              លទ្ធផល ឈ្នះ/ចាញ់ ម្ចាស់វេទិកា (Owner Net Win/Loss)
            </div>
            <div
              className={`text-lg font-black mt-1 flex items-center gap-1.5 ${
                summary.ownerNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.ownerNetProfit >= 0 ? (
                <TrendingUp className="w-4 h-4 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 shrink-0" />
              )}
              <span>
                {summary.ownerNetProfit >= 0
                  ? `+${formatKHR(summary.ownerNetProfit)}`
                  : `-${formatKHR(Math.abs(summary.ownerNetProfit))}`}
              </span>
            </div>
            <div className="text-[10px] text-slate-300 mt-1">
              {summary.ownerNetProfit >= 0
                ? 'ម្ចាស់វេទិកា ចំណេញ (House Profit)'
                : 'ម្ចាស់វេទិកា ខាត (House Loss)'}
            </div>
          </div>

          {/* 4. Owner Hold / Margin Percentage */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3">
            <div className="text-[11px] text-slate-300 font-medium">
              អត្រាចំណេញម្ចាស់វេទិកា (Owner Hold Margin)
            </div>
            <div
              className={`text-lg font-black mt-1 ${
                Number(summary.ownerMarginPercent) >= 0 ? 'text-cyan-300' : 'text-rose-400'
              }`}
            >
              {summary.ownerMarginPercent}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              អត្រាអ្នកលេងឈ្នះ: {summary.winRate}%
            </div>
          </div>
        </div>
      </div>

      {/* PLAYER KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-black text-lg flex items-center justify-center">
            ៛
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">ទឹកប្រាក់ភ្នាល់សរុប (Player Stake)</div>
            <div className="text-base font-bold text-slate-800">{formatKHR(summary.totalStake)}</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-emerald-50 text-emerald-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">ទឹកប្រាក់ឈ្នះសរុប (Player Payout)</div>
            <div className="text-base font-bold text-emerald-600">{formatKHR(summary.totalPayout)}</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div
            className={`p-2.5 rounded-full ${
              summary.playerNetProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {summary.playerNetProfit >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">អ្នកលេង ចំណេញ/ខាត (Player P/L)</div>
            <div
              className={`text-base font-bold ${
                summary.playerNetProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {summary.playerNetProfit >= 0
                ? `+${formatKHR(summary.playerNetProfit)}`
                : `-${formatKHR(Math.abs(summary.playerNetProfit))}`}
            </div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-purple-50 text-purple-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">អត្រាឈ្នះ (Player Win Rate)</div>
            <div className="text-base font-bold text-purple-700">{summary.winRate}%</div>
          </div>
        </div>
      </div>

      {/* DAILY BREAKDOWN TABLE BY YEAR-MONTH-DAY */}
      {dailyBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-800">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>របាយការណ៍សង្ខេបប្រចាំថ្ងៃ តាម ឆ្នាំ-ខែ-ថ្ងៃ (Daily Summary Report by Year / Month / Day)</span>
            </div>
            <span className="text-[11px] text-slate-500">
              ចុចលើកាលបរិច្ឆេទណាមួយដើម្បីមើលលម្អិត
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2 px-3">កាលបរិច្ឆេទ (Year-Month-Day)</th>
                  <th className="py-2 px-3">លេខសម្គាល់ភ្នាល់ (Bet IDs)</th>
                  <th className="py-2 px-3 text-center">ចំនួនភ្នាល់ (Tickets)</th>
                  <th className="py-2 px-3 text-right">ទឹកប្រាក់ភ្នាល់ជាក់ស្តែង (Actual Stake)</th>
                  <th className="py-2 px-3 text-right">ទឹកប្រាក់ទូទាត់ឱ្យអ្នកលេង (Payout)</th>
                  <th className="py-2 px-3 text-right">អ្នកលេង ឈ្នះ/ចាញ់ (Player P/L)</th>
                  <th className="py-2 px-3 text-right">ម្ចាស់វេទិកា ឈ្នះ/ចាញ់ (Owner Win/Loss)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyBreakdown.map((dayRow) => {
                  const isSelected =
                    selectedYear === String(dayRow.year) &&
                    selectedMonth === String(dayRow.month) &&
                    selectedDay === String(dayRow.day);

                  return (
                    <tr
                      key={dayRow.date}
                      onClick={() => {
                        setSelectedYear(String(dayRow.year));
                        setSelectedMonth(String(dayRow.month));
                        setSelectedDay(String(dayRow.day));
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 px-3 font-bold text-blue-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{dayRow.date}</span>
                        {dayRow.date === activeTodayDate && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded font-bold">
                            ថ្ងៃនេះ
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-indigo-700 font-bold">
                        #{dayRow.firstTicketId} — #{dayRow.lastTicketId}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700">
                        {dayRow.ticketCount}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800">
                        {formatKHR(dayRow.totalStake)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">
                        {formatKHR(dayRow.totalPayout)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          dayRow.playerNet >= 0 ? 'text-green-600' : 'text-rose-600'
                        }`}
                      >
                        {dayRow.playerNet >= 0
                          ? `+${formatKHR(dayRow.playerNet)}`
                          : `-${formatKHR(Math.abs(dayRow.playerNet))}`}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-extrabold ${
                          dayRow.ownerNet >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {dayRow.ownerNet >= 0
                          ? `+${formatKHR(dayRow.ownerNet)}`
                          : `-${formatKHR(Math.abs(dayRow.ownerNet))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED ACTUAL BETTING HISTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <span>ប្រវត្តិការភ្នាល់ជាក់ស្តែងលម្អិត (Actual Betting History — ID #0001+)</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-extrabold">
              {filteredRecords.length} សំបុត្រ
            </span>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 text-xs">
            {[
              { id: 'all', label: 'ទាំងអស់ (All)' },
              { id: 'won', label: 'ឈ្នះ (Won)' },
              { id: 'lost', label: 'ចាញ់ (Lost)' },
              { id: 'pending', label: 'រង់ចាំ (Pending)' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id as any)}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                  statusFilter === st.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">លេខសម្គាល់ (Bet ID)</th>
                <th className="py-2.5 px-3">កាលបរិច្ឆេទ (Year-Month-Day)</th>
                <th className="py-2.5 px-3">ម៉ោង (Time)</th>
                <th className="py-2.5 px-3">លេខជុំ (Round)</th>
                <th className="py-2.5 px-3">លទ្ធផលចេញ (Drawn)</th>
                <th className="py-2.5 px-3">ជម្រើសភ្នាល់ (Placed Bets)</th>
                <th className="py-2.5 px-3 text-right">ទឹកប្រាក់ភ្នាល់ (Stake)</th>
                <th className="py-2.5 px-3 text-right">ទឹកប្រាក់ទូទាត់ (Payout)</th>
                <th className="py-2.5 px-3 text-right">អ្នកលេង (Player P/L)</th>
                <th className="py-2.5 px-3 text-right">ម្ចាស់វេទិកា (Owner W/L)</th>
                <th className="py-2.5 px-3 text-center">ស្ថានភាព (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 italic">
                    មិនមានទិន្នន័យភ្នាល់ជាក់ស្តែងសម្រាប់កាលបរិច្ឆេទ ({activeDateFilterLabel}) នេះនៅឡើយទេ
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const playerProfit = rec.totalPayout - rec.totalStake;
                  const ownerProfit = rec.totalStake - rec.totalPayout;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      {/* Sequential 4-Digit Bet ID starting at 0001 */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-black text-xs">
                          <Hash className="w-3 h-3" />
                          {rec.ticketId}
                        </span>
                      </td>

                      {/* Date: Year-Month-Day */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {rec.date}
                      </td>

                      {/* Time: HH:mm:ss */}
                      <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {rec.time}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        #{formatSequentialRoundId(rec.roundId, 1)}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {rec.resultNumber
                          ? `លេខ ${rec.resultNumber}`
                          : rec.status === 'pending'
                          ? 'រង់ចាំចេញ...'
                          : '-'}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {rec.bets.map((b, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                b.won
                                  ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                                  : rec.status === 'pending'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {b.label}: {formatKHR(b.amount)} (x{b.odds})
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {formatKHR(rec.totalStake)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {rec.status === 'pending' ? '-' : formatKHR(rec.totalPayout)}
                      </td>

                      {/* Player Win/Loss */}
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          rec.status === 'pending'
                            ? 'text-amber-600'
                            : playerProfit > 0
                            ? 'text-green-600'
                            : playerProfit < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {rec.status === 'pending'
                          ? 'រង់ចាំ'
                          : playerProfit > 0
                          ? `+${formatKHR(playerProfit)}`
                          : playerProfit < 0
                          ? `-${formatKHR(Math.abs(playerProfit))}`
                          : '0៛'}
                      </td>

                      {/* Platform Owner Win/Loss */}
                      <td
                        className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                          rec.status === 'pending'
                            ? 'text-amber-600'
                            : ownerProfit > 0
                            ? 'text-emerald-700'
                            : ownerProfit < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {rec.status === 'pending'
                          ? 'រង់ចាំ'
                          : ownerProfit > 0
                          ? `+${formatKHR(ownerProfit)}`
                          : ownerProfit < 0
                          ? `-${formatKHR(Math.abs(ownerProfit))}`
                          : '0៛'}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'won'
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : rec.status === 'lost'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold tracking-wide'
                              : 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse'
                          }`}
                        >
                          {rec.status === 'won'
                            ? 'ឈ្នះ (Won)'
                            : rec.status === 'lost'
                            ? 'Lost'
                            : 'កំពុងរង់ចាំ (Pending)'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
