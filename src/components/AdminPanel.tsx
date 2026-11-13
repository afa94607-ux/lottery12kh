import React, { useState, useMemo, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, updateFirestoreGameState, addFirestoreDrawResult } from '../lib/firebase';
import {
  Shield,
  Trophy,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  Play,
  RotateCcw,
  Search,
  Filter,
  Users,
  Wallet,
  Settings,
  Flame,
  Award,
} from 'lucide-react';
import {
  ANIMALS_DATA,
  DrawResult,
  BetCategory,
  BetHistoryRecord,
  TransactionRecord,
  TransactionType,
  TransactionStatus,
  LiveBetItem,
  PayoutOddsConfig,
  DEFAULT_PAYOUT_ODDS,
  getDateTimeMetadata,
  normalizeRealBetRecords,
  normalizeRoundIndex,
  formatSequentialRoundId,
} from '../types';
import { AnimalArtwork } from './AnimalIllustrations';
import { calculateRevealSequence } from './Side2BowlArena';
import { sound } from '../utils/sound';

interface AdminPanelProps {
  currentRoundIndex: number;
  currentRoundTime: string;
  countdown: number;
  isRevealing: boolean;
  history: DrawResult[];
  onAddManualResult: (result: DrawResult) => void;
  onDeleteResult: (roundId: string) => void;
  forcedWinningNumber: number | null;
  onSetForcedWinningNumber: (num: number | null) => void;
  onTriggerImmediateDraw: (targetNum?: number) => void;
  recentBets: BetHistoryRecord[];
  playerBalance: number;
  onUpdatePlayerBalance: (newBalance: number) => void;
  transactions: TransactionRecord[];
  onAddTransaction: (tx: Omit<TransactionRecord, 'id' | 'timestamp' | 'timeString'>) => void;
  onUpdateTransactionStatus: (id: string, status: TransactionStatus) => void;
  onReturnToGame: () => void;
  onOpenHowItWorks?: () => void;
  payoutOdds?: PayoutOddsConfig;
  onUpdatePayoutOdds?: (odds: PayoutOddsConfig) => void;
  roundDuration?: number;
  onUpdateRoundDuration?: (durationSec: number) => void;
  autoDrawEnabled?: boolean;
  onToggleAutoDraw?: (enabled: boolean) => void;
}

type AdminGameTab = 'lottery_12' | 'lottery_1_99';
type AdminSectionTab = 'result_control' | 'history' | 'live_bets' | 'transactions' | 'owner_report';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentRoundIndex,
  currentRoundTime,
  countdown,
  isRevealing,
  history,
  onAddManualResult,
  onDeleteResult,
  forcedWinningNumber,
  onSetForcedWinningNumber,
  onTriggerImmediateDraw,
  recentBets,
  playerBalance,
  onUpdatePlayerBalance,
  transactions,
  onAddTransaction,
  onUpdateTransactionStatus,
  onReturnToGame,
  onOpenHowItWorks,
  payoutOdds = DEFAULT_PAYOUT_ODDS,
  onUpdatePayoutOdds,
  roundDuration = 180,
  onUpdateRoundDuration,
  autoDrawEnabled = true,
  onToggleAutoDraw,
}) => {
  const liveMeta = getDateTimeMetadata();

  // Navigation tabs
  const [selectedGame, setSelectedGame] = useState<AdminGameTab>('lottery_12');
  const [activeSection, setActiveSection] = useState<AdminSectionTab>('result_control');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u));
    return () => unsub();
  }, []);

  // Strictly normalize actual player wagers (excludes any demo/test records)
  const actualBets = useMemo(() => normalizeRealBetRecords(recentBets), [recentBets]);

  const currentFormattedRoundId = formatSequentialRoundId(currentRoundIndex, 1);

  // Manual Result Form State (includes Year / Month / Day)
  const [manualRoundNumber, setManualRoundNumber] = useState<number>(() =>
    normalizeRoundIndex(currentRoundIndex, 1)
  );
  const [manualRoundDate, setManualRoundDate] = useState<string>(liveMeta.date);
  const [manualRoundTime, setManualRoundTime] = useState<string>(liveMeta.shortTime);
  const [manualSelectedAnimalNum, setManualSelectedAnimalNum] = useState<number>(1);
  const [resultSuccessMsg, setResultSuccessMsg] = useState<string | null>(null);

  // Centralized Firestore Settings State (Payout Odds & Drawing Schedule)
  const [editOdds, setEditOdds] = useState<PayoutOddsConfig>(payoutOdds);
  const [editDuration, setEditDuration] = useState<number>(roundDuration);

  useEffect(() => {
    setEditOdds(payoutOdds);
  }, [payoutOdds]);

  useEffect(() => {
    setEditDuration(roundDuration);
  }, [roundDuration]);

  // Manual Transaction Modal / Form State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [txType, setTxType] = useState<TransactionType>('deposit');
  const [txAmount, setTxAmount] = useState<string>('100000');
  const [txMethod, setTxMethod] = useState<'ABA Bank' | 'Wing' | 'ACLEDA' | 'TrueMoney' | 'Cash' | 'Manual'>('ABA Bank');
  const [txUserName, setTxUserName] = useState<string>('អតិថិជន Player #1');
  const [txUserPhone, setTxUserPhone] = useState<string>('012 888 999');
  const [txNote, setTxNote] = useState<string>('');

  // History Search & Filter State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyFilterColor, setHistoryFilterColor] = useState<string>('all');

  // Owner Report Year / Month / Day Filter State
  const [reportYear, setReportYear] = useState<string>('all');
  const [reportMonth, setReportMonth] = useState<string>('all');
  const [reportDay, setReportDay] = useState<string>('all');

  const availableReportYears = useMemo(() => {
    const years = new Set<number>([liveMeta.year, liveMeta.year - 1]);
    actualBets.forEach((b) => {
      if (b.year) years.add(b.year);
    });
    history.forEach((h) => {
      if (h.year) years.add(h.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [actualBets, history, liveMeta.year]);

  // Live incoming bet items strictly from actual wager records (with sequential ticketId 0001+ and Year/Month/Day)
  const allLiveBets: LiveBetItem[] = useMemo(() => {
    const items: LiveBetItem[] = [];
    actualBets.forEach((rec) => {
      rec.bets.forEach((b, bIdx) => {
        items.push({
          id: `${rec.id}-${bIdx}`,
          ticketId: rec.ticketId || '0001',
          roundId: rec.roundId,
          userName: rec.userId || 'AADPDPP004',
          date: rec.date || liveMeta.date,
          year: rec.year || liveMeta.year,
          month: rec.month || liveMeta.month,
          day: rec.day || liveMeta.day,
          time: rec.time,
          type: b.type,
          label: b.label,
          amount: b.amount,
          odds: b.odds,
          potentialPayout: Math.round(b.amount * b.odds),
          payout: b.payout || 0,
          status: rec.status,
          timestamp: rec.timestamp || Date.now(),
        });
      });
    });
    return items;
  }, [actualBets, liveMeta.date, liveMeta.year, liveMeta.month, liveMeta.day]);

  // Current round active bets
  const currentRoundBets = useMemo(() => {
    const curRoundId = formatSequentialRoundId(currentRoundIndex, 1);
    return allLiveBets.filter((b) => formatSequentialRoundId(b.roundId, 1) === curRoundId);
  }, [allLiveBets, currentRoundIndex]);

  // Live Risk & Liability Matrix for numbers 1..12
  const exposureMatrix = useMemo(() => {
    const matrix: Record<
      number,
      {
        totalStaked: number;
        payoutLiability: number;
        netHouseProfit: number;
      }
    > = {};

    const curRoundTotalTurnover = currentRoundBets.reduce((sum, b) => sum + b.amount, 0);

    for (let num = 1; num <= 12; num++) {
      const animal = ANIMALS_DATA[num];
      let payoutIfNumWins = 0;

      currentRoundBets.forEach((b) => {
        let isWon = false;
        if (b.type === `animal_${num}`) isWon = true;
        if (b.type === 'small' && animal.size === 'small') isWon = true;
        if (b.type === 'big' && animal.size === 'big') isWon = true;
        if (b.type === 'odd' && animal.parity === 'odd') isWon = true;
        if (b.type === 'even' && animal.parity === 'even') isWon = true;
        if (b.type === 'color_red' && animal.color === 'red') isWon = true;
        if (b.type === 'color_green' && animal.color === 'green') isWon = true;
        if (b.type === 'color_blue' && animal.color === 'blue') isWon = true;

        if (isWon) {
          payoutIfNumWins += Math.round(b.amount * b.odds);
        }
      });

      matrix[num] = {
        totalStaked: currentRoundBets
          .filter((b) => b.type === `animal_${num}`)
          .reduce((s, b) => s + b.amount, 0),
        payoutLiability: payoutIfNumWins,
        netHouseProfit: curRoundTotalTurnover - payoutIfNumWins,
      };
    }

    return matrix;
  }, [currentRoundBets]);

  // Find safest (most profitable) and highest risk numbers for house
  const { safestNumber, highestRiskNumber } = useMemo(() => {
    let bestNum = 1;
    let worstNum = 1;
    let maxProfit = -Infinity;
    let minProfit = Infinity;

    for (let num = 1; num <= 12; num++) {
      const prof = exposureMatrix[num]?.netHouseProfit ?? 0;
      if (prof > maxProfit) {
        maxProfit = prof;
        bestNum = num;
      }
      if (prof < minProfit) {
        minProfit = prof;
        worstNum = num;
      }
    }
    return { safestNumber: bestNum, highestRiskNumber: worstNum };
  }, [exposureMatrix]);

  // Filtered actual bets by Year / Month / Day for the Platform Owner Report
  const dateFilteredOwnerBets = useMemo(() => {
    return actualBets.filter((rec) => {
      if (reportYear !== 'all' && rec.year !== parseInt(reportYear, 10)) return false;
      if (reportMonth !== 'all' && rec.month !== parseInt(reportMonth, 10)) return false;
      if (reportDay !== 'all' && rec.day !== parseInt(reportDay, 10)) return false;
      return true;
    });
  }, [actualBets, reportYear, reportMonth, reportDay]);

  // Overall Financial Report metrics (100% Actual Wagers — Zero Demo/Test Simulation)
  const financialReport = useMemo(() => {
    let totalTurnover = 0;
    let settledTurnover = 0;
    let totalPayout = 0;

    dateFilteredOwnerBets.forEach((r) => {
      totalTurnover += r.totalStake;
      if (r.status !== 'pending') {
        settledTurnover += r.totalStake;
        totalPayout += r.totalPayout;
      }
    });

    const netHouseProfit = settledTurnover - totalPayout;
    const marginPercent = settledTurnover > 0 ? (netHouseProfit / settledTurnover) * 100 : 0;

    const totalDeposits = transactions
      .filter((t) => t.type === 'deposit' && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter((t) => t.type === 'withdrawal' && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTurnover,
      settledTurnover,
      totalPayout,
      netHouseProfit,
      marginPercent,
      totalDeposits,
      totalWithdrawals,
      netCashflow: totalDeposits - totalWithdrawals,
    };
  }, [dateFilteredOwnerBets, transactions]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchSearch =
        item.roundId.toLowerCase().includes(historySearch.toLowerCase()) ||
        (item.date || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        item.animal.includes(historySearch) ||
        item.number.toString().includes(historySearch);
      const matchColor =
        historyFilterColor === 'all' || item.color === historyFilterColor;
      return matchSearch && matchColor;
    });
  }, [history, historySearch, historyFilterColor]);

  // Handlers
  const handleSetForcedNumber = (num: number) => {
    sound.playChip();
    const nextVal = forcedWinningNumber === num ? null : num;
    const roundId = formatSequentialRoundId(currentRoundIndex, 1);
    onSetForcedWinningNumber(nextVal);
    setResultSuccessMsg(
      nextVal
        ? `✅ បានកំណត់លទ្ធផលជាមុនទៅក្នុង Firestore: លេខ ${nextVal} (${ANIMALS_DATA[nextVal]?.khmerName}) សម្រាប់ជុំ #${roundId} — គ្រប់ឧបករណ៍ទាំងអស់នឹងបង្ហាញលទ្ធផលនេះនៅពេលម៉ោងដល់ 0`
        : `✅ បានកំណត់ឡើងវិញទៅជារបៀបចាប់ចៃដន្យ (Deterministic Auto Draw) ក្នុង Firestore`
    );
    setTimeout(() => setResultSuccessMsg(null), 4000);
  };

  const handleForceDrawNow = (num?: number) => {
    sound.playButton();
    const target = num ?? forcedWinningNumber ?? manualSelectedAnimalNum;
    const roundId = formatSequentialRoundId(currentRoundIndex, 1);
    onSetForcedWinningNumber(target);

    if (countdown > 0) {
      setResultSuccessMsg(
        `⏳ បានចាក់សោលទ្ធផល លេខ ${target} (${ANIMALS_DATA[target]?.khmerName}) សម្រាប់ជុំ #${roundId} — គ្រប់ឧបករណ៍ទាំងអស់នឹងបង្ហាញលទ្ធផលនេះនៅពេលម៉ោងរាប់ថយក្រោយដល់ 0 (នៅសល់ ${countdown}s)`
      );
      setTimeout(() => setResultSuccessMsg(null), 4500);
      return;
    }

    onTriggerImmediateDraw(target);
    setResultSuccessMsg(
      `🚀 ម៉ោងរាប់ថយក្រោយដល់ 0 — បានចាប់ផ្តើមបង្ហាញលទ្ធផលសម្រាប់ជុំ #${roundId} (លេខ ${target} ${ANIMALS_DATA[target]?.khmerName})`
    );
    setTimeout(() => setResultSuccessMsg(null), 4000);
  };

  const handleSaveSettingsToFirestore = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playWin();
    const cleanOdds: PayoutOddsConfig = {
      smallBig: Math.max(1.01, Number(editOdds.smallBig) || DEFAULT_PAYOUT_ODDS.smallBig),
      oddEven: Math.max(1.01, Number(editOdds.oddEven) || DEFAULT_PAYOUT_ODDS.oddEven),
      color: Math.max(1.01, Number(editOdds.color) || DEFAULT_PAYOUT_ODDS.color),
      animal: Math.max(1.1, Number(editOdds.animal) || DEFAULT_PAYOUT_ODDS.animal),
    };
    const cleanDuration = Math.min(3600, Math.max(15, Math.floor(Number(editDuration) || 180)));

    onUpdatePayoutOdds?.(cleanOdds);
    onUpdateRoundDuration?.(cleanDuration);

    updateFirestoreGameState({
      roundId: formatSequentialRoundId(currentRoundIndex, 1),
      roundIndex: normalizeRoundIndex(currentRoundIndex, 1),
      payoutOdds: cleanOdds,
      roundDuration: cleanDuration,
      roundEndTime: Date.now() + cleanDuration * 1000,
      countdown: cleanDuration,
      autoDrawEnabled,
    });

    setResultSuccessMsg(
      `✅ បានរក្សាទុកការកំណត់ទៅកាន់ Firestore ដោយជោគជ័យ (ម៉ោងក្នុង១ជុំ: ${cleanDuration}s • អត្រាសង សត្វ: x${cleanOdds.animal}, ពណ៌: x${cleanOdds.color}, តូច/ធំ: x${cleanOdds.smallBig})`
    );
    setTimeout(() => setResultSuccessMsg(null), 4000);
  };

  const handleResetDefaultSettings = () => {
    sound.playButton();
    setEditOdds(DEFAULT_PAYOUT_ODDS);
    setEditDuration(180);
    onUpdatePayoutOdds?.(DEFAULT_PAYOUT_ODDS);
    onUpdateRoundDuration?.(180);
    onToggleAutoDraw?.(true);

    updateFirestoreGameState({
      roundId: formatSequentialRoundId(currentRoundIndex, 1),
      roundIndex: normalizeRoundIndex(currentRoundIndex, 1),
      payoutOdds: DEFAULT_PAYOUT_ODDS,
      roundDuration: 180,
      roundEndTime: Date.now() + 180 * 1000,
      countdown: 180,
      autoDrawEnabled: true,
    });

    setResultSuccessMsg('✅ បានកំណត់អត្រាសង និងម៉ោងចាប់ឆ្នោតទៅជាតម្លៃដើម (Default) នៅលើ Firestore');
    setTimeout(() => setResultSuccessMsg(null), 3500);
  };

  const handleCreateManualResult = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playWin();

    const animalData = ANIMALS_DATA[manualSelectedAnimalNum];
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(manualRoundDate) ? manualRoundDate : liveMeta.date;
    const [yStr, mStr, dStr] = cleanDate.split('-');
    const normIdx = Math.max(1, Math.floor(Number(manualRoundNumber) || 1));
    const seqId = formatSequentialRoundId(normIdx, 1);
    const activeRoundIdx = normalizeRoundIndex(currentRoundIndex, 1);

    // If the betting countdown has not yet finished (countdown > 0) and this is for the active/upcoming round,
    // lock in the winning result so it appears strictly once the countdown reaches 0 across all devices.
    if (countdown > 0 && normIdx >= activeRoundIdx) {
      onSetForcedWinningNumber(manualSelectedAnimalNum);
      setResultSuccessMsg(
        `⏳ ម៉ោងរាប់ថយក្រោយមិនទាន់ចប់ទេ (${countdown}s) — បានកំណត់លេខ ${manualSelectedAnimalNum} (${animalData.khmerName}) ដើម្បីបង្ហាញលើគ្រប់ឧបករណ៍នៅពេលម៉ោងដល់ 0`
      );
      setTimeout(() => setResultSuccessMsg(null), 4500);
      return;
    }

    const newResult: DrawResult = {
      roundId: seqId,
      roundIndex: normIdx,
      date: cleanDate,
      year: parseInt(yStr, 10) || liveMeta.year,
      month: parseInt(mStr, 10) || liveMeta.month,
      day: parseInt(dStr, 10) || liveMeta.day,
      time: manualRoundTime,
      number: manualSelectedAnimalNum,
      animal: animalData.khmerName,
      color: animalData.color,
      size: animalData.size,
      parity: animalData.parity,
      timestamp: Date.now(),
    };

    onAddManualResult(newResult);
    addFirestoreDrawResult(newResult);
    setResultSuccessMsg(`✅ បានបញ្ចូលលទ្ធផលជោគជ័យ: ជុំ #${newResult.roundId} (${cleanDate} ${manualRoundTime}) = លេខ ${newResult.number} (${newResult.animal})`);
    setTimeout(() => setResultSuccessMsg(null), 4000);
    setManualRoundNumber(normIdx + 1);
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    sound.playWin();
    onAddTransaction({
      userName: txUserName,
      userPhone: txUserPhone,
      type: txType,
      amount: amountNum,
      method: txMethod,
      status: 'approved',
      note: txNote || 'បង្កើតដោយផ្ទាល់ពី Admin',
    });

    if (txType === 'deposit') {
      onUpdatePlayerBalance(playerBalance + amountNum);
    } else if (txType === 'withdrawal') {
      onUpdatePlayerBalance(Math.max(0, playerBalance - amountNum));
    }

    setIsDepositModalOpen(false);
    setTxNote('');
  };

  const handleApproveTx = (tx: TransactionRecord) => {
    sound.playWin();
    onUpdateTransactionStatus(tx.id, 'approved');
    if (tx.type === 'deposit') {
      onUpdatePlayerBalance(playerBalance + tx.amount);
    } else if (tx.type === 'withdrawal') {
      onUpdatePlayerBalance(Math.max(0, playerBalance - tx.amount));
    }
  };

  const handleRejectTx = (tx: TransactionRecord) => {
    sound.playBlocked();
    onUpdateTransactionStatus(tx.id, 'rejected');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0f172a] text-slate-100 min-h-screen overflow-x-hidden font-['Kantumruy_Pro',sans-serif]">
      {/* 1. Admin Top Executive Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700/80 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnToGame}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-lg border border-slate-500/50 shadow-xs transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ត្រឡប់ទៅផ្ទាំងហ្គេម</span>
          </button>

          {onOpenHowItWorks && (
            <button
              onClick={onOpenHowItWorks}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs sm:text-sm font-black rounded-lg border border-amber-600 shadow-xs transition-all"
              title="របៀបបញ្ជាពីចម្ងាយតាម Cloudflare"
            >
              <span>📖</span>
              <span>របៀបបញ្ជាពីចម្ងាយ</span>
            </button>
          )}

          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-inner border border-purple-400/50">
              <Shield className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-yellow-400 flex items-center gap-1.5">
                <span>ផ្ទាំងគ្រប់គ្រងម្ចាស់ផ្ទះ</span>
                <span className="text-[10px] bg-purple-900/80 text-purple-300 border border-purple-400/50 px-1.5 py-0.2 rounded font-mono">
                  MASTER ADMIN
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-Time Sync សកម្ម • ផ្សាយផ្ទាល់ ២៤/៧</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Round Live Telemetry */}
        <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold">
          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>ជុំបច្ចុប្បន្ន:</span>
            <span className="font-mono text-yellow-300 font-bold">#{currentFormattedRoundId}</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1">
            <span className="text-slate-400">រាប់ថយក្រោយ:</span>
            <span className={`font-mono font-bold ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {countdown}s
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1 text-slate-300">
            <span>សមតុល្យអ្នកលេង:</span>
            <span className="font-mono text-emerald-400 font-bold">{playerBalance.toLocaleString()}៛</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />
          {firebaseUser ? (
            <div className="flex items-center gap-2 bg-purple-950/80 border border-purple-500/50 px-2.5 py-1 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-yellow-300 font-bold text-[11px] truncate max-w-[130px] sm:max-w-none">
                {firebaseUser.email}
              </span>
              <button
                onClick={() => signOutUser()}
                className="text-slate-400 hover:text-red-400 text-[10px] underline ml-1 cursor-pointer"
                title="ចាកចេញ (Sign Out)"
              >
                ចាកចេញ
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg shadow-sm border border-slate-300 active:scale-95 transition-all cursor-pointer"
              title="ចូលគណនី Admin ដោយ Google Sign-In"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>ចូល Admin (Google)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Game Mode Selector Tabs (Lottery 12 vs Lottery 1/99) */}
      <div className="bg-[#141e33] border-b border-slate-800 px-3 sm:px-6 pt-2 flex items-center gap-2">
        <button
          onClick={() => {
            sound.playButton();
            setSelectedGame('lottery_12');
          }}
          className={`px-4 py-2 rounded-t-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
            selectedGame === 'lottery_12'
              ? 'bg-[#1e293b] text-yellow-300 border-t-2 border-amber-400 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>ឆ្នោត 12 (Lottery 12)</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-400/30">
            គ្រប់គ្រងចម្បង
          </span>
        </button>

        <button
          onClick={() => {
            sound.playButton();
            setSelectedGame('lottery_1_99');
          }}
          className={`px-4 py-2 rounded-t-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
            selectedGame === 'lottery_1_99'
              ? 'bg-[#1e293b] text-yellow-300 border-t-2 border-amber-400 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Flame className="w-4 h-4 text-blue-400" />
          <span>ឆ្នោត 1/99 (Lottery 1/99)</span>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded-full">
            ៥ ប៉ុស្តិ៍ A-B-C-D-E
          </span>
        </button>
      </div>

      {/* If Lottery 1/99 is selected, show 1/99 management view */}
      {selectedGame === 'lottery_1_99' ? (
        <div className="p-4 sm:p-6 flex-1 flex flex-col items-center justify-center text-center">
          <div className="max-w-md p-6 bg-slate-800/90 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center gap-3">
            <Flame className="w-12 h-12 text-amber-400 animate-pulse" />
            <h3 className="text-lg font-bold text-yellow-300">ផ្ទាំងគ្រប់គ្រង ឆ្នោត 1/99 (៥ ប៉ុស្តិ៍ A-B-C-D-E)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              ប្រព័ន្ធឆ្នោត 1/99 កំពុងដំណើរការក្នុងរបៀបស្វ័យប្រវត្តិតាម ប៉ុស្តិ៍ A, B, C, D, E។ សម្រាប់កំណែបច្ចុប្បន្ន ផ្ទាំងគ្រប់គ្រងផ្តោតចម្បងលើ «ឆ្នោត 12» តាមការស្នើសុំ។
            </p>
            <button
              onClick={() => setSelectedGame('lottery_12')}
              className="mt-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-extrabold text-xs rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              ត្រឡប់ទៅគ្រប់គ្រង «ឆ្នោត 12»
            </button>
          </div>
        </div>
      ) : (
        /* Primary Focus: LOTTERY 12 MANAGEMENT */
        <div className="flex-1 flex flex-col">
          {/* 3. Sub-Navigation Tabs */}
          <div className="bg-[#1e293b]/90 border-b border-slate-800 px-3 sm:px-6 py-2 flex items-center overflow-x-auto gap-1 sm:gap-2 scrollbar-thin">
            <button
              onClick={() => {
                sound.playButton();
                setActiveSection('result_control');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeSection === 'result_control'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>កំណត់លទ្ធផល & ចាប់ឆ្នោត</span>
              {forcedWinningNumber && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              )}
            </button>

            <button
              onClick={() => {
                sound.playButton();
                setActiveSection('live_bets');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeSection === 'live_bets'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>តាមដានការភ្នាល់ផ្ទាល់ ({currentRoundBets.length})</span>
            </button>

            <button
              onClick={() => {
                sound.playButton();
                setActiveSection('history');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeSection === 'history'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ប្រវត្តិលទ្ធផល ({history.length})</span>
            </button>

            <button
              onClick={() => {
                sound.playButton();
                setActiveSection('transactions');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeSection === 'transactions'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>ដាក់/ដកប្រាក់</span>
              {transactions.some((t) => t.status === 'pending') && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => {
                sound.playButton();
                setActiveSection('owner_report');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeSection === 'owner_report'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>របាយការណ៍ឈ្នះ/ចាញ់ម្ចាស់</span>
            </button>
          </div>

          {/* 4. Section Body */}
          <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
            {/* ======================================================== */}
            {/* SUBSECTION 1: RESULT CONTROL & FORCED DRAW ENTRY */}
            {/* ======================================================== */}
            {activeSection === 'result_control' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Status banner */}
                {resultSuccessMsg && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{resultSuccessMsg}</span>
                  </div>
                )}

                {/* Section A: Live Control of Next Winning Number */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 p-4 sm:p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-yellow-300 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <span>កំណត់លទ្ធផលឈ្នះសម្រាប់ជុំបច្ចុប្បន្ន (#{currentFormattedRoundId})</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ជ្រើសរើសលេខណាមួយខាងក្រោមដើម្បីកំណត់ជាលទ្ធផលឈ្នះជាមុន ឬចុច «បង្ខំចាប់ឆ្នោតភ្លាមៗ»។
                      </p>
                    </div>

                    {/* Pre-set Status Badge */}
                    <div className="flex items-center gap-2">
                      {forcedWinningNumber ? (
                        <div className="px-3 py-1 bg-red-950/80 border border-red-500 text-red-300 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-pulse">
                          <span>⚠️ បានកំណត់លទ្ធផលជាមុន:</span>
                          <span className="text-yellow-300 font-extrabold text-sm">
                            លេខ {forcedWinningNumber} ({ANIMALS_DATA[forcedWinningNumber]?.khmerName})
                          </span>
                          <button
                            onClick={() => onSetForcedWinningNumber(null)}
                            className="ml-1 p-0.5 hover:bg-red-800 rounded text-white"
                            title="លុបការកំណត់ (Reset to Random)"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>របៀបចាប់ចៃដន្យ (Random Auto Draw)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 12 Animal Result Selection Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                      const animal = ANIMALS_DATA[num];
                      const isSelected = forcedWinningNumber === num;
                      const isSafest = safestNumber === num;
                      const isHighestRisk = highestRiskNumber === num;
                      const exposure = exposureMatrix[num];

                      return (
                        <div
                          key={num}
                          onClick={() => handleSetForcedNumber(num)}
                          className={`relative p-2 rounded-xl cursor-pointer border-2 transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center select-none ${
                            isSelected
                              ? 'bg-amber-500/20 border-yellow-400 ring-2 ring-yellow-400/80 shadow-lg shadow-yellow-500/20'
                              : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {/* Top Badges */}
                          <div className="w-full flex items-center justify-between text-[10px] font-bold mb-1">
                            <span className="px-1.5 py-0.2 rounded bg-black/60 text-yellow-300 font-mono">
                              #{num}
                            </span>
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                animal.color === 'red'
                                  ? 'bg-red-900/80 text-red-200'
                                  : animal.color === 'green'
                                  ? 'bg-emerald-900/80 text-emerald-200'
                                  : 'bg-blue-900/80 text-blue-200'
                              }`}
                            >
                              {animal.color === 'red' ? 'ក្រហម' : animal.color === 'green' ? 'បៃតង' : 'ខៀវ'}
                            </span>
                          </div>

                          {/* Full 4K uncropped animal artwork thumbnail */}
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-white shadow-xs p-0.5 relative my-1">
                            <AnimalArtwork number={num} className="w-full h-full object-fill rounded" />
                          </div>

                          {/* Animal Name & Attributes */}
                          <div className="text-center w-full">
                            <div className="text-xs font-extrabold text-white truncate">
                              {animal.khmerName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {animal.size === 'big' ? 'ធំ' : 'តូច'} • {animal.parity === 'odd' ? 'សេស' : 'គូ'}
                            </div>
                          </div>

                          {/* Financial Exposure indicator */}
                          <div className="mt-1.5 pt-1 border-t border-slate-700/60 w-full text-center">
                            <div className="text-[9px] text-slate-400">សងអ្នកលេង:</div>
                            <div className="text-[10px] font-mono font-bold text-amber-300">
                              {(exposure?.payoutLiability ?? 0).toLocaleString()}៛
                            </div>
                          </div>

                          {/* Status Flags */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-slate-900 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-pulse">
                              ✓ ជ្រើសរើស
                            </div>
                          )}
                          {isSafest && (
                            <div className="absolute -bottom-1 inset-x-1 bg-emerald-600/90 text-white text-[8px] font-bold rounded py-0.2 text-center">
                              ★ ចំណេញបំផុត
                            </div>
                          )}
                          {isHighestRisk && (
                            <div className="absolute -bottom-1 inset-x-1 bg-rose-600/90 text-white text-[8px] font-bold rounded py-0.2 text-center">
                              ⚠️ ហានិភ័យខ្ពស់
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Immediate Action Buttons */}
                  <div className="mt-6 pt-4 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-300 flex items-center gap-2">
                      <span className="font-bold text-yellow-300">ការបញ្ជាបន្ទាន់:</span>
                      <span>
                        {forcedWinningNumber
                          ? `នឹងចេញលេខ ${forcedWinningNumber} (${ANIMALS_DATA[forcedWinningNumber]?.khmerName})`
                          : 'មិនទាន់ជ្រើសរើស (នឹងចេញចៃដន្យ)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSetForcedWinningNumber(null)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all"
                      >
                        កំណត់ឡើងវិញ (ចៃដន្យ)
                      </button>

                      <button
                        onClick={() => handleForceDrawNow()}
                        disabled={isRevealing}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>បង្ខំចាប់ឆ្នោតភ្លាមៗ (Force Draw Now)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section B: Create Historical Result Record manually (with Year / Month / Day) */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 p-4 sm:p-6 shadow-xl">
                  <h3 className="text-sm sm:text-base font-bold text-yellow-300 mb-3 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>បញ្ចូលលទ្ធផលដោយផ្ទាល់ តាម ឆ្នាំ/ខែ/ថ្ងៃ (Manual Result Entry Form — Year / Month / Day)</span>
                  </h3>
                  <form onSubmit={handleCreateManualResult} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        លេខជុំ (Round #0001+)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={manualRoundNumber}
                        onChange={(e) => setManualRoundNumber(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-mono font-bold text-yellow-300 focus:outline-none focus:border-amber-400"
                        placeholder="ឧ. 0001"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        កាលបរិច្ឆេទ (Year-Month-Day)
                      </label>
                      <input
                        type="date"
                        value={manualRoundDate}
                        onChange={(e) => setManualRoundDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        ម៉ោងចាប់ឆ្នោត (Time)
                      </label>
                      <input
                        type="text"
                        value={manualRoundTime}
                        onChange={(e) => setManualRoundTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                        placeholder="16:30"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        លេខសត្វឈ្នះ (1–12)
                      </label>
                      <select
                        value={manualSelectedAnimalNum}
                        onChange={(e) => setManualSelectedAnimalNum(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-bold text-yellow-300 focus:outline-none focus:border-amber-400"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            #{n} {ANIMALS_DATA[n]?.khmerName} ({ANIMALS_DATA[n]?.animalEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-md transition-all active:scale-95"
                      >
                        + បញ្ចូលទៅក្នុងប្រវត្តិ
                      </button>
                    </div>
                  </form>
                </div>

                {/* Section C: Centralized Firestore Settings (Drawing Schedule & Payout Odds) */}
                <div className="bg-[#1e293b] rounded-2xl border border-amber-500/40 p-4 sm:p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-700">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-yellow-300 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-amber-400" />
                        <span>ការកំណត់កាលវិភាគចាប់ឆ្នោត & អត្រាសងរង្វាន់ (Centralized Firestore Settings)</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        រាល់ការផ្លាស់ប្តូរម៉ោងចាប់ឆ្នោត ឬ អត្រាសងរង្វាន់ នឹងត្រូវបានរក្សាទុកផ្ទាល់ទៅកាន់ Firebase Firestore និងធ្វើបច្ចុប្បន្នភាពភ្លាមៗលើគ្រប់ឧបករណ៍តាមរយៈ onSnapshot។
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetDefaultSettings}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>កំណត់តម្លៃដើម (Default)</span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveSettingsToFirestore} className="space-y-4">
                    {/* 1. Drawing Schedule Presets & Auto-Draw Toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-2">
                          ១. កាលវិភាគម៉ោងចាប់ឆ្នោតក្នុង ១ ជុំ (Drawing Schedule Duration)
                        </label>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {[
                            { sec: 60, label: '60s (១ នាទី)' },
                            { sec: 120, label: '120s (២ នាទី)' },
                            { sec: 180, label: '180s (៣ នាទី)' },
                            { sec: 300, label: '300s (៥ នាទី)' },
                          ].map((preset) => (
                            <button
                              key={preset.sec}
                              type="button"
                              onClick={() => setEditDuration(preset.sec)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                editDuration === preset.sec
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={15}
                            max={3600}
                            value={editDuration}
                            onChange={(e) => setEditDuration(parseInt(e.target.value, 10) || 180)}
                            className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs font-mono font-bold text-yellow-300 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-xs text-slate-400">វិនាទីក្នុង ១ ជុំ (Seconds per round)</span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-bold text-amber-300 mb-2">
                            ២. របៀបចាប់ឆ្នោតស្វ័យប្រវត្តិ (Server-Authoritative Auto Schedule)
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !autoDrawEnabled;
                                onToggleAutoDraw?.(next);
                                updateFirestoreGameState({ autoDrawEnabled: next });
                              }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                                autoDrawEnabled
                                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                                  : 'bg-rose-600/30 border-rose-400 text-rose-200'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  autoDrawEnabled ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                                }`}
                              />
                              <span>
                                {autoDrawEnabled
                                  ? 'បើកដំណើរការស្វ័យប្រវត្តិ (Auto-Draw ON)'
                                  : 'ផ្អាកការចាប់ស្វ័យប្រវត្តិ (Paused)'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 mt-2">
                          • ផ្លូវទិន្នន័យ Firestore: <code className="text-amber-300 font-mono">/game_state/current</code> &amp; <code className="text-amber-300 font-mono">/draw_history</code>
                        </div>
                      </div>
                    </div>

                    {/* 2. Payout Odds Configuration */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <label className="block text-[11px] font-bold text-sky-300 mb-1">
                          អត្រាសង តូច / ធំ (Small/Big)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="1.05"
                          max="50"
                          value={editOdds.smallBig}
                          onChange={(e) =>
                            setEditOdds((prev) => ({ ...prev, smallBig: parseFloat(e.target.value) || 1.95 }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <label className="block text-[11px] font-bold text-orange-300 mb-1">
                          អត្រាសង សេស / គូ (Odd/Even)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="1.05"
                          max="50"
                          value={editOdds.oddEven}
                          onChange={(e) =>
                            setEditOdds((prev) => ({ ...prev, oddEven: parseFloat(e.target.value) || 1.95 }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                          អត្រាសង ពណ៌ ក្រហម/បៃតង/ខៀវ
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="1.05"
                          max="50"
                          value={editOdds.color}
                          onChange={(e) =>
                            setEditOdds((prev) => ({ ...prev, color: parseFloat(e.target.value) || 2.95 }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                        <label className="block text-[11px] font-bold text-yellow-300 mb-1">
                          អត្រាសង សត្វទាំង ១២ (1–12)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="1.5"
                          max="100"
                          value={editOdds.animal}
                          onChange={(e) =>
                            setEditOdds((prev) => ({ ...prev, animal: parseFloat(e.target.value) || 11 }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs font-mono font-bold text-yellow-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>រក្សាទុកការកំណត់ទៅកាន់ Firestore (Sync All Devices)</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUBSECTION 2: LIVE BETS & EXPOSURE MONITOR */}
            {/* ======================================================== */}
            {activeSection === 'live_bets' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Exposure Risk Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-md">
                    <div className="text-xs text-slate-400 font-semibold">សរុបការភ្នាល់ជុំបច្ចុប្បន្ន</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-yellow-300 mt-1">
                      {currentRoundBets.reduce((a, b) => a + b.amount, 0).toLocaleString()}៛
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      ចំនួនសំបុត្រភ្នាល់: <span className="font-bold text-white">{currentRoundBets.length}</span>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] p-4 rounded-xl border border-emerald-500/40 shadow-md">
                    <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>ជម្រើសចំណេញបំផុតសម្រាប់ម្ចាស់</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                      លេខ {safestNumber} ({ANIMALS_DATA[safestNumber]?.khmerName})
                    </div>
                    <div className="text-[11px] text-emerald-400/80 mt-1">
                      ចំណេញសុទ្ធ: +{(exposureMatrix[safestNumber]?.netHouseProfit ?? 0).toLocaleString()}៛
                    </div>
                  </div>

                  <div className="bg-[#1e293b] p-4 rounded-xl border border-rose-500/40 shadow-md">
                    <div className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>ហានិភ័យខ្ពស់បំផុត (ខាតច្រើន)</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-300 mt-1">
                      លេខ {highestRiskNumber} ({ANIMALS_DATA[highestRiskNumber]?.khmerName})
                    </div>
                    <div className="text-[11px] text-rose-400/80 mt-1">
                      ខាត/ចំណេញ: {(exposureMatrix[highestRiskNumber]?.netHouseProfit ?? 0).toLocaleString()}៛
                    </div>
                  </div>
                </div>

                {/* Real-time incoming actual bets table */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 overflow-hidden shadow-xl">
                  <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-yellow-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>ចរន្តភ្នាល់ផ្ទាល់ជាក់ស្តែង (Live Actual Bet Feed — ID #0001+)</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      សរុប {allLiveBets.length} ភ្នាល់ជាក់ស្តែង
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">លេខសម្គាល់ (Bet ID)</th>
                          <th className="py-2.5 px-3">កាលបរិច្ឆេទ (Year-Month-Day)</th>
                          <th className="py-2.5 px-3">ម៉ោង (Time)</th>
                          <th className="py-2.5 px-3">លេខជុំ</th>
                          <th className="py-2.5 px-3">អ្នកលេង</th>
                          <th className="py-2.5 px-3">ប្រភេទភ្នាល់</th>
                          <th className="py-2.5 px-3 text-right">ទឹកប្រាក់ភ្នាល់</th>
                          <th className="py-2.5 px-3 text-center">អត្រាសង (Odds)</th>
                          <th className="py-2.5 px-3 text-right">សងសរុបបើឈ្នះ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {allLiveBets.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-slate-500 font-medium">
                              មិនទាន់មានការភ្នាល់ជាក់ស្តែងនៅឡើយទេ
                            </td>
                          </tr>
                        ) : (
                          allLiveBets.map((bet) => (
                            <tr key={bet.id} className="hover:bg-slate-800/60 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-black text-indigo-300">
                                #{bet.ticketId}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 font-mono">
                                {bet.date}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono">
                                {bet.time}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-yellow-400">
                                #{formatSequentialRoundId(bet.roundId, 1)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-200">
                                {bet.userName}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-yellow-300 font-bold">
                                  {bet.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                {bet.amount.toLocaleString()}៛
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-amber-300 font-bold">
                                x{bet.odds}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-300">
                                {bet.potentialPayout.toLocaleString()}៛
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUBSECTION 3: RESULT HISTORY MANAGEMENT */}
            {/* ======================================================== */}
            {activeSection === 'history' && (
              <div className="space-y-4 max-w-6xl mx-auto">
                {/* Search & Filter Bar */}
                <div className="bg-[#1e293b] p-3 sm:p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="ស្វែងរកតាមលេខជុំ (#0001), កាលបរិច្ឆេទ (YYYY-MM-DD) ឬឈ្មោះសត្វ..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">ពណ៌:</span>
                      <select
                        value={historyFilterColor}
                        onChange={(e) => setHistoryFilterColor(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                      >
                        <option value="all">ទាំងអស់</option>
                        <option value="red">ក្រហម (Red)</option>
                        <option value="green">បៃតង (Green)</option>
                        <option value="blue">ខៀវ (Blue)</option>
                      </select>
                    </div>
                  </div>

                  {/* History Table */}
                  <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">លេខជុំ</th>
                            <th className="py-2.5 px-3">កាលបរិច្ឆេទ (Year-Month-Day)</th>
                            <th className="py-2.5 px-3">ម៉ោងចេញ</th>
                            <th className="py-2.5 px-3 text-center">រូបសត្វឈ្នះ</th>
                            <th className="py-2.5 px-3">លេខ & ឈ្មោះសត្វ</th>
                            <th className="py-2.5 px-3 text-center">ពណ៌ (Color)</th>
                            <th className="py-2.5 px-3 text-center">តូច / ធំ</th>
                            <th className="py-2.5 px-3 text-center">សេស / គូ</th>
                            <th className="py-2.5 px-3 text-center">សកម្មភាព</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredHistory.map((item, idx) => (
                            <tr key={`${item.roundId}-${item.timestamp || idx}`} className="hover:bg-slate-800/60 transition-colors">
                              <td className="py-2 px-3 font-mono font-bold text-yellow-400">
                                #{formatSequentialRoundId(item.roundId ?? item.roundIndex, idx + 1)}
                              </td>
                            <td className="py-2 px-3 text-slate-300 font-mono">
                              {item.date || liveMeta.date}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono">
                              {item.time}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="w-8 h-8 rounded-md bg-white p-0.5 mx-auto shadow-xs">
                                <AnimalArtwork number={item.number} className="w-full h-full object-fill rounded" />
                              </div>
                            </td>
                            <td className="py-2 px-3 font-bold text-white">
                              លេខ {item.number} - {item.animal}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.color === 'red'
                                    ? 'bg-red-900/80 text-red-200 border border-red-500/50'
                                    : item.color === 'green'
                                    ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/50'
                                    : 'bg-blue-900/80 text-blue-200 border border-blue-500/50'
                                }`}
                              >
                                {item.color === 'red' ? 'ក្រហម' : item.color === 'green' ? 'បៃតង' : 'ខៀវ'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.size === 'big'
                                    ? 'bg-amber-900/80 text-amber-200 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {item.size === 'big' ? 'ធំ' : 'តូច'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {item.parity === 'odd' ? 'សេស' : 'គូ'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => {
                                  sound.playBlocked();
                                  onDeleteResult(item.roundId);
                                }}
                                className="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-950/80 rounded transition-colors"
                                title="លុបលទ្ធផលនេះ (Delete)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUBSECTION 4: DEPOSITS & WITHDRAWALS MANAGEMENT */}
            {/* ======================================================== */}
            {activeSection === 'transactions' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Balance & Action Bar */}
                <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">សមតុល្យគណនីអ្នកលេងបច្ចុប្បន្ន (Player Wallet)</div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-1">
                      {playerBalance.toLocaleString()}៛
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTxType('deposit');
                        setIsDepositModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>+ ដាក់ប្រាក់បញ្ចូល (Deposit)</span>
                    </button>

                    <button
                      onClick={() => {
                        setTxType('withdrawal');
                        setIsDepositModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>- ដកប្រាក់ (Withdrawal)</span>
                    </button>
                  </div>
                </div>

                {/* Transaction Queue Table */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 overflow-hidden shadow-xl">
                  <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-yellow-300 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      <span>បញ្ជីប្រតិបត្តិការដាក់/ដកប្រាក់ (Transactions Queue)</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      សរុប {transactions.length} ប្រតិបត្តិការ
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">កាលបរិច្ឆេទ & ម៉ោង</th>
                          <th className="py-2.5 px-3">ឈ្មោះអ្នកលេង</th>
                          <th className="py-2.5 px-3">ទូរស័ព្ទ</th>
                          <th className="py-2.5 px-3 text-center">ប្រភេទ</th>
                          <th className="py-2.5 px-3">ធនាគារ / វិធី</th>
                          <th className="py-2.5 px-3 text-right">ចំនួនទឹកប្រាក់</th>
                          <th className="py-2.5 px-3 text-center">ស្ថានភាព</th>
                          <th className="py-2.5 px-3 text-center">ការអនុម័ត</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-800/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {tx.timeString}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              {tx.userName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {tx.userPhone}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.type === 'deposit'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                    : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                                }`}
                              >
                                {tx.type === 'deposit' ? 'ដាក់ប្រាក់ (+)' : 'ដកប្រាក់ (-)'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-300">
                              {tx.method}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-black text-sm ${
                                tx.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {tx.type === 'deposit' ? '+' : '-'}
                              {tx.amount.toLocaleString()}៛
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  tx.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                    : tx.status === 'rejected'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                                }`}
                              >
                                {tx.status === 'approved'
                                  ? '✓ ជោគជ័យ'
                                  : tx.status === 'rejected'
                                  ? '✕ បដិសេធ'
                                  : '⏳ រង់ចាំពិនិត្យ'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {tx.status === 'pending' ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleApproveTx(tx)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shadow-xs active:scale-95"
                                  >
                                    យល់ព្រម
                                  </button>
                                  <button
                                    onClick={() => handleRejectTx(tx)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow-xs active:scale-95"
                                  >
                                    បដិសេធ
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUBSECTION 5: OWNER WIN / LOSS FINANCIAL REPORT */}
            {/* ======================================================== */}
            {activeSection === 'owner_report' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Filter by Year / Month / Day Bar */}
                <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div>
                    <div className="text-sm font-bold text-yellow-300 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>របាយការណ៍សង្ខេប ឈ្នះ-ចាញ់ សម្រាប់ម្ចាស់វេទិកា (Platform Owner Win/Loss Summary)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      គណនាចេញពីការភ្នាល់ជាក់ស្តែង 100% (មិនរាប់បញ្ចូលគណនីសាកល្បង ឬ Demo ឡើយ) • លេខសម្គាល់ភ្នាល់ចាប់ផ្តើមពី #0001
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg font-bold text-yellow-300"
                    >
                      <option value="all">គ្រប់ឆ្នាំ (All Years)</option>
                      {availableReportYears.map((y) => (
                        <option key={y} value={String(y)}>
                          ឆ្នាំ {y}
                        </option>
                      ))}
                    </select>

                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg font-bold text-slate-200"
                    >
                      <option value="all">គ្រប់ខែ (All Months)</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={String(m)}>
                          ខែ {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>

                    <select
                      value={reportDay}
                      onChange={(e) => setReportDay(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg font-bold text-slate-200"
                    >
                      <option value="all">គ្រប់ថ្ងៃ (All Days)</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>
                          ថ្ងៃទី {String(d).padStart(2, '0')}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setReportYear(String(liveMeta.year));
                        setReportMonth(String(liveMeta.month));
                        setReportDay(String(liveMeta.day));
                      }}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black rounded-lg"
                    >
                      ថ្ងៃនេះ ({liveMeta.date})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReportYear('all');
                        setReportMonth('all');
                        setReportDay('all');
                      }}
                      className="px-3 py-1.5 bg-slate-700 text-slate-200 font-bold rounded-lg hover:bg-slate-600"
                    >
                      ទាំងអស់
                    </button>
                  </div>
                </div>

                {/* 4 Core Financial KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Turnover */}
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-xs text-slate-400 font-semibold">សរុបប្រាក់ភ្នាល់ជាក់ស្តែង (Actual Turnover)</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-yellow-300 mt-1">
                      {financialReport.settledTurnover.toLocaleString()}៛
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <span>សំបុត្រសរុប: {dateFilteredOwnerBets.length} (រួមទាំងរង់ចាំ: {financialReport.totalTurnover.toLocaleString()}៛)</span>
                    </div>
                  </div>

                  {/* Total Payouts */}
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-xs text-slate-400 font-semibold">សរុបប្រាក់សងអ្នកលេង (Player Payouts)</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-rose-300 mt-1">
                      {financialReport.totalPayout.toLocaleString()}៛
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      រង្វាន់ដែលម្ចាស់បានទូទាត់សងជាក់ស្តែង
                    </div>
                  </div>

                  {/* Net House Profit */}
                  <div
                    className={`p-4 rounded-xl border shadow-lg ${
                      financialReport.netHouseProfit >= 0
                        ? 'bg-emerald-950/40 border-emerald-500/60'
                        : 'bg-rose-950/40 border-rose-500/60'
                    }`}
                  >
                    <div className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>ចំណេញ/ខាត សុទ្ធម្ចាស់វេទិកា (Owner Win/Loss)</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/40 text-yellow-300">
                        {financialReport.marginPercent.toFixed(1)}% Margin
                      </span>
                    </div>
                    <div
                      className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                        financialReport.netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {financialReport.netHouseProfit >= 0 ? '+' : ''}
                      {financialReport.netHouseProfit.toLocaleString()}៛
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {financialReport.netHouseProfit >= 0
                        ? '✓ ម្ចាស់វេទិកាឈ្នះ (House Profit)'
                        : '⚠️ ម្ចាស់វេទិកាខាតបង់ (House Loss)'}
                    </div>
                  </div>

                  {/* Net Cash Flow (Deposits - Withdrawals) */}
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg">
                    <div className="text-xs text-slate-400 font-semibold">លំហូរសាច់ប្រាក់ (Cashflow)</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-blue-400 mt-1">
                      {financialReport.netCashflow >= 0 ? '+' : ''}
                      {financialReport.netCashflow.toLocaleString()}៛
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      ដាក់ {financialReport.totalDeposits.toLocaleString()}៛ • ដក {financialReport.totalWithdrawals.toLocaleString()}៛
                    </div>
                  </div>
                </div>

                {/* Actual Wagers Financial Breakdown by Bet ID (0001+) & Date (Year-Month-Day) */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-700/90 overflow-hidden shadow-xl">
                  <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 font-bold text-xs sm:text-sm text-yellow-300 flex items-center justify-between">
                    <span>របាយការណ៍លម្អិតតាមលេខសម្គាល់ភ្នាល់ជាក់ស្តែង (Actual Wagers Breakdown — ID #0001+)</span>
                    <span className="text-xs text-slate-400">សរុប {dateFilteredOwnerBets.length} សំបុត្រ</span>
                  </div>

                  <div className="overflow-x-auto max-h-[450px] scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">លេខសម្គាល់ (Bet ID)</th>
                          <th className="py-2.5 px-3">កាលបរិច្ឆេទ (Year-Month-Day)</th>
                          <th className="py-2.5 px-3">ម៉ោង (Time)</th>
                          <th className="py-2.5 px-3">លេខជុំ (Round)</th>
                          <th className="py-2.5 px-3">លទ្ធផលចេញ</th>
                          <th className="py-2.5 px-3 text-right">ប្រាក់ភ្នាល់ជាក់ស្តែង</th>
                          <th className="py-2.5 px-3 text-right">ប្រាក់សងអ្នកលេង</th>
                          <th className="py-2.5 px-3 text-right">ម្ចាស់វេទិកា ឈ្នះ/ចាញ់</th>
                          <th className="py-2.5 px-3 text-center">ស្ថានភាព</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {dateFilteredOwnerBets.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                              មិនមានទិន្នន័យភ្នាល់ជាក់ស្តែងសម្រាប់កាលបរិច្ឆេទដែលបានជ្រើសរើសនៅឡើយទេ
                            </td>
                          </tr>
                        ) : (
                          dateFilteredOwnerBets.map((rec) => {
                            const ownerProfit = rec.totalStake - rec.totalPayout;
                            return (
                              <tr key={rec.id} className="hover:bg-slate-800/60 transition-colors">
                                <td className="py-2.5 px-3 font-mono font-black text-indigo-300">
                                  #{rec.ticketId}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300 font-mono">
                                  {rec.date}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-mono">
                                  {rec.time}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-yellow-400">
                                  #{formatSequentialRoundId(rec.roundId, 1)}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-white">
                                  {rec.resultNumber
                                    ? `លេខ ${rec.resultNumber} (${ANIMALS_DATA[rec.resultNumber]?.khmerName || ''})`
                                    : rec.status === 'pending'
                                    ? 'រង់ចាំចេញ...'
                                    : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                  {rec.totalStake.toLocaleString()}៛
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-300">
                                  {rec.status === 'pending' ? '-' : `${rec.totalPayout.toLocaleString()}៛`}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-mono font-bold ${
                                    rec.status === 'pending'
                                      ? 'text-amber-300'
                                      : ownerProfit >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {rec.status === 'pending'
                                    ? 'រង់ចាំ'
                                    : `${ownerProfit >= 0 ? '+' : ''}${ownerProfit.toLocaleString()}៛`}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      rec.status === 'pending'
                                        ? 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
                                        : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                                    }`}
                                  >
                                    {rec.status === 'pending' ? '⏳ រង់ចាំ' : '✓ ទូទាត់រួច'}
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
            )}
          </div>
        </div>
      )}

      {/* 5. Deposit / Withdrawal Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setIsDepositModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-bold text-yellow-300 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span>{txType === 'deposit' ? 'ដាក់ប្រាក់បញ្ចូល (Deposit)' : 'ដកប្រាក់ចេញ (Withdrawal)'}</span>
            </h3>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ឈ្មោះអ្នកលេង (Player Name)</label>
                <input
                  type="text"
                  value={txUserName}
                  onChange={(e) => setTxUserName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">លេខទូរស័ព្ទ (Phone Number)</label>
                <input
                  type="text"
                  value={txUserPhone}
                  onChange={(e) => setTxUserPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ចំនួនទឹកប្រាក់ (KHR)</label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-yellow-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                    placeholder="100000"
                    min="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">វិធីទូទាត់ (Method)</label>
                  <select
                    value={txMethod}
                    onChange={(e) => setTxMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:border-amber-400"
                  >
                    <option value="ABA Bank">ABA Bank</option>
                    <option value="Wing">Wing Bank</option>
                    <option value="ACLEDA">ACLEDA Bank</option>
                    <option value="TrueMoney">TrueMoney</option>
                    <option value="Cash">Cash (សាច់ប្រាក់សុទ្ធ)</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">កំណត់សម្គាល់ (Note / Reason)</label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="ឧ. បញ្ចូលតាម ABA ឬ ដកប្រាក់ឈ្នះ"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold text-white rounded-lg shadow-md transition-all active:scale-95 ${
                    txType === 'deposit'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {txType === 'deposit' ? 'យល់ព្រមបញ្ចូលប្រាក់ (+)' : 'យល់ព្រមដកប្រាក់ (-)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
