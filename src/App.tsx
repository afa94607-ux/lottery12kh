import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { HeaderNav, MainTab, SubTab } from './components/HeaderNav';
import { Sidebar } from './components/Sidebar';
import { Side2BowlArena, calculateRevealSequence } from './components/Side2BowlArena';
import {
  testConnection,
  fetchFirestoreGameState,
  subscribeToGameState,
  subscribeToDrawHistory,
  subscribeToBets,
  subscribeToTransactions,
  updateFirestoreGameState,
  addFirestoreDrawResult,
  deleteFirestoreDrawResult,
  addFirestoreBetRecord,
  upsertFirestoreTransaction,
} from './lib/firebase';
import { BettingBoard } from './components/BettingBoard';
import { RoadGrid } from './components/RoadGrid';
import { WinLossView } from './components/WinLossView';
import { ResultsView } from './components/ResultsView';
import { OtherGamesView } from './components/OtherGamesView';
import { Lottery199 } from './components/Lottery199';
import { AdminPanel } from './components/AdminPanel';
import { TopUpModal } from './components/TopUpModal';
import { HelpRulesModal } from './components/HelpRulesModal';
import { BetAmountModal } from './components/BetAmountModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { sound } from './utils/sound';
import { countdownAudioSync, CountdownSyncSegment } from './utils/countdownAudioSync';
import { realtimeSync, ConnectionStatus } from './utils/realtimeSync';
import {
  ANIMALS_DATA,
  DrawResult,
  BetCategory,
  BetHistoryRecord,
  TransactionRecord,
  TransactionStatus,
  PayoutOddsConfig,
  DEFAULT_PAYOUT_ODDS,
  getDateTimeMetadata,
  getNextSequentialTicketId,
  normalizeRealBetRecords,
  normalizeRoundIndex,
  formatSequentialRoundId,
} from './types';

// Preloaded historical results starting sequentially from 0001+
const INITIAL_HISTORY: DrawResult[] = [
  // Col 15
  { roundId: '0001', roundIndex: 1, time: '16:19', number: 1, animal: 'ជូត', color: 'red', size: 'small', parity: 'odd', timestamp: Date.now() - 60000 },
  // Col 14
  { roundId: '0002', roundIndex: 2, time: '16:15', number: 9, animal: 'វក', color: 'blue', size: 'big', parity: 'odd', timestamp: Date.now() - 120000 },
  { roundId: '0003', roundIndex: 3, time: '16:12', number: 8, animal: 'មមែ', color: 'green', size: 'big', parity: 'even', timestamp: Date.now() - 180000 },
  // Col 13 (6 items)
  { roundId: '0004', roundIndex: 4, time: '16:08', number: 10, animal: 'រកា', color: 'red', size: 'big', parity: 'even', timestamp: Date.now() - 240000 },
  { roundId: '0005', roundIndex: 5, time: '16:05', number: 11, animal: 'ច', color: 'green', size: 'big', parity: 'odd', timestamp: Date.now() - 300000 },
  { roundId: '0006', roundIndex: 6, time: '16:01', number: 12, animal: 'កុរ', color: 'blue', size: 'big', parity: 'even', timestamp: Date.now() - 360000 },
  { roundId: '0007', roundIndex: 7, time: '15:58', number: 9, animal: 'វក', color: 'blue', size: 'big', parity: 'odd', timestamp: Date.now() - 420000 },
  { roundId: '0008', roundIndex: 8, time: '15:54', number: 10, animal: 'រកា', color: 'red', size: 'big', parity: 'even', timestamp: Date.now() - 480000 },
  { roundId: '0009', roundIndex: 9, time: '15:50', number: 8, animal: 'មមែ', color: 'green', size: 'big', parity: 'even', timestamp: Date.now() - 540000 },
  // Col 12 (2 items)
  { roundId: '0010', roundIndex: 10, time: '15:47', number: 6, animal: 'ម្សាញ់', color: 'blue', size: 'small', parity: 'even', timestamp: Date.now() - 600000 },
  { roundId: '0011', roundIndex: 11, time: '15:43', number: 2, animal: 'ឆ្លូវ', color: 'green', size: 'small', parity: 'even', timestamp: Date.now() - 660000 },
  // Col 11
  { roundId: '0012', roundIndex: 12, time: '15:40', number: 12, animal: 'កុរ', color: 'blue', size: 'big', parity: 'even', timestamp: Date.now() - 720000 },
  // Col 10
  { roundId: '0013', roundIndex: 13, time: '15:36', number: 6, animal: 'ម្សាញ់', color: 'blue', size: 'small', parity: 'even', timestamp: Date.now() - 780000 },
  // Col 9 (2 items)
  { roundId: '0014', roundIndex: 14, time: '15:32', number: 8, animal: 'មមែ', color: 'green', size: 'big', parity: 'even', timestamp: Date.now() - 840000 },
  { roundId: '0015', roundIndex: 15, time: '15:28', number: 11, animal: 'ច', color: 'green', size: 'big', parity: 'odd', timestamp: Date.now() - 900000 },
  // Col 8
  { roundId: '0016', roundIndex: 16, time: '15:25', number: 6, animal: 'ម្សាញ់', color: 'blue', size: 'small', parity: 'even', timestamp: Date.now() - 960000 },
  // Col 7
  { roundId: '0017', roundIndex: 17, time: '15:21', number: 7, animal: 'មមី', color: 'red', size: 'big', parity: 'odd', timestamp: Date.now() - 1020000 },
  // Col 6 (4 items)
  { roundId: '0018', roundIndex: 18, time: '15:18', number: 5, animal: 'រោង', color: 'green', size: 'small', parity: 'odd', timestamp: Date.now() - 1080000 },
  { roundId: '0019', roundIndex: 19, time: '15:14', number: 5, animal: 'រោង', color: 'green', size: 'small', parity: 'odd', timestamp: Date.now() - 1140000 },
  { roundId: '0020', roundIndex: 20, time: '15:10', number: 1, animal: 'ជូត', color: 'red', size: 'small', parity: 'odd', timestamp: Date.now() - 1200000 },
  { roundId: '0021', roundIndex: 21, time: '15:06', number: 6, animal: 'ម្សាញ់', color: 'blue', size: 'small', parity: 'even', timestamp: Date.now() - 1260000 },
  // Col 5 (2 items)
  { roundId: '0022', roundIndex: 22, time: '15:02', number: 10, animal: 'រកា', color: 'red', size: 'big', parity: 'even', timestamp: Date.now() - 1320000 },
  { roundId: '0023', roundIndex: 23, time: '14:58', number: 7, animal: 'មមី', color: 'red', size: 'big', parity: 'odd', timestamp: Date.now() - 1380000 },
  // Col 4
  { roundId: '0024', roundIndex: 24, time: '14:54', number: 1, animal: 'ជូត', color: 'red', size: 'small', parity: 'odd', timestamp: Date.now() - 1440000 },
  // Col 3
  { roundId: '0025', roundIndex: 25, time: '14:50', number: 12, animal: 'កុរ', color: 'blue', size: 'big', parity: 'even', timestamp: Date.now() - 1500000 },
  // Col 2
  { roundId: '0026', roundIndex: 26, time: '14:46', number: 2, animal: 'ឆ្លូវ', color: 'green', size: 'small', parity: 'even', timestamp: Date.now() - 1560000 },
  // Col 1
  { roundId: '0027', roundIndex: 27, time: '14:42', number: 12, animal: 'កុរ', color: 'blue', size: 'big', parity: 'even', timestamp: Date.now() - 1620000 },
];

export default function App() {
  // Navigation State
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('lottery_12');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('lottery');
  const [mobileView, setMobileView] = useState<'full' | 'game' | 'sidebar'>('full');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);
  const lastServerTickRef = useRef<number>(Date.now());

  // Live daily date state (YYYY-MM-DD) — automatically updates with new data daily
  const [currentDate, setCurrentDate] = useState<string>(() => getDateTimeMetadata().date);
  useEffect(() => {
    const dayCheckInterval = setInterval(() => {
      const latestDate = getDateTimeMetadata().date;
      setCurrentDate((prev) => (prev !== latestDate ? latestDate : prev));
    }, 15000);
    return () => clearInterval(dayCheckInterval);
  }, []);

  const WALLET_BALANCE_STORAGE_KEY = 'cambodia_lottery_balance_v2';
  const CURRENT_ROUND_STORAGE_KEY = 'cambodia_lottery_current_round_v3';
  const DRAW_HISTORY_STORAGE_KEY = 'cambodia_lottery_12_draw_history_v3';

  // Account & Wallet State
  const [balance, setBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(WALLET_BALANCE_STORAGE_KEY);
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch (e) {}
    return 500000;
  });

  useEffect(() => {
    try {
      localStorage.setItem(WALLET_BALANCE_STORAGE_KEY, balance.toString());
    } catch (e) {}
  }, [balance]);

  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Centralized Firestore Settings State (Schedule & Payout Odds)
  const [roundDuration, setRoundDuration] = useState<number>(180);
  const roundDurationRef = useRef<number>(180);
  const [autoDrawEnabled, setAutoDrawEnabled] = useState<boolean>(true);
  const [payoutOdds, setPayoutOdds] = useState<PayoutOddsConfig>(DEFAULT_PAYOUT_ODDS);

  // Authoritative Shared Wall-Clock Round End Timestamp (ms) synchronized via Firestore across all devices
  const roundEndTimeRef = useRef<number>(0);
  const hasSyncedFirestoreTimeRef = useRef<boolean>(false);

  // Round & Timer State (Default 3 minutes / 180s per round, starting from 0001+)
  const [countdown, setCountdown] = useState<number>(180);
  const countdownRef = useRef<number>(180);
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_ROUND_STORAGE_KEY);
      if (saved) {
        const val = normalizeRoundIndex(saved, 1);
        if (val >= 1) return val;
      }
    } catch (e) {}
    return 1;
  });
  const currentRoundIndexRef = useRef<number>(currentRoundIndex);

  useEffect(() => {
    currentRoundIndexRef.current = currentRoundIndex;
    try {
      localStorage.setItem(CURRENT_ROUND_STORAGE_KEY, currentRoundIndex.toString());
    } catch (e) {}
  }, [currentRoundIndex]);

  const [currentRoundTime, setCurrentRoundTime] = useState<string>(() => getDateTimeMetadata().shortTime);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const isRevealingRef = useRef<boolean>(false);
  useEffect(() => {
    isRevealingRef.current = isRevealing;
  }, [isRevealing]);

  const [revealStep, setRevealStep] = useState<number>(0); // 0: closed, 1..6: row 1, 7..11: row 2, 12: row 3 final result
  const [pendingWinningResult, setPendingWinningResult] = useState<DrawResult | null>(null);
  
  // Admin Panel Control States (Synchronized via Firestore onSnapshot across all devices)
  const [forcedWinningNumber, setForcedWinningNumber] = useState<number | null>(null);
  const forcedWinningNumberRef = useRef<number | null>(null);
  const lockedRoundResultRef = useRef<{ roundIndex: number; number: number } | null>(null);

  useEffect(() => {
    forcedWinningNumberRef.current = forcedWinningNumber;
  }, [forcedWinningNumber]);

  const getAuthoritativeForcedNumber = (): number | null => {
    const locked = lockedRoundResultRef.current;
    if (locked && locked.number >= 1 && locked.number <= 12) {
      return locked.number;
    }
    const current = forcedWinningNumberRef.current;
    if (current && current >= 1 && current <= 12) {
      return current;
    }
    return null;
  };

  // Deterministic reveal sequence aligned with currentRoundId and forcedWinningNumber
  const [drawMix, setDrawMix] = useState<number[]>(() =>
    calculateRevealSequence(formatSequentialRoundId(currentRoundIndex), null)
  );

  // Re-align drawMix whenever currentRoundIndex or forcedWinningNumber changes
  useEffect(() => {
    if (!isRevealing) {
      setDrawMix(calculateRevealSequence(formatSequentialRoundId(currentRoundIndex), forcedWinningNumber));
    }
  }, [currentRoundIndex, forcedWinningNumber, isRevealing]);

  // Transactions State (Deposits & Withdrawals)
  const TRANSACTION_STORAGE_KEY = 'cambodia_lottery_transactions_v2';
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(TRANSACTION_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse transactions', e);
    }
    return [
      {
        id: 'tx-1001',
        userName: 'អតិថិជន Player #1',
        userPhone: '012 888 999',
        type: 'deposit',
        amount: 500000,
        method: 'ABA Bank',
        status: 'approved',
        timestamp: Date.now() - 3600000,
        timeString: '15:20',
        note: 'ABA PayWay Deposit',
      },
      {
        id: 'tx-1002',
        userName: 'អតិថិជន Player #2',
        userPhone: '098 777 666',
        type: 'withdrawal',
        amount: 200000,
        method: 'Wing',
        status: 'pending',
        timestamp: Date.now() - 1800000,
        timeString: '15:55',
        note: 'ដកប្រាក់ឈ្នះជុំ 2004#280',
      },
      {
        id: 'tx-1003',
        userName: 'អតិថិជន Player #3',
        userPhone: '077 111 222',
        type: 'deposit',
        amount: 300000,
        method: 'ACLEDA',
        status: 'pending',
        timestamp: Date.now() - 900000,
        timeString: '16:10',
        note: 'ACLEDA Mobile Top-up',
      },
      {
        id: 'tx-1004',
        userName: 'អតិថិជន Player #1',
        userPhone: '012 888 999',
        type: 'deposit',
        amount: 100000,
        method: 'TrueMoney',
        status: 'approved',
        timestamp: Date.now() - 600000,
        timeString: '16:15',
        note: 'TrueMoney Deposit',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.warn('Failed to save transactions', e);
    }
  }, [transactions]);

  const handleSetForcedWinningNumber = (num: number | null) => {
    const cleanNum = typeof num === 'number' && num >= 1 && num <= 12 ? num : null;
    const roundIdx = normalizeRoundIndex(currentRoundIndexRef.current, 1);
    const roundId = formatSequentialRoundId(roundIdx, 1);
    const alignedMix = calculateRevealSequence(roundId, cleanNum);

    forcedWinningNumberRef.current = cleanNum;
    lockedRoundResultRef.current = cleanNum ? { roundIndex: roundIdx, number: cleanNum } : null;
    setForcedWinningNumber(cleanNum);
    setDrawMix(alignedMix);

    const activeEndTime =
      roundEndTimeRef.current > Date.now()
        ? roundEndTimeRef.current
        : Date.now() + Math.max(1, countdownRef.current) * 1000;

    realtimeSync.setForcedResult(cleanNum);
    realtimeSync.syncRoundState({
      roundIndex: roundIdx,
      roundEndTime: activeEndTime,
      roundDuration: roundDurationRef.current,
      forcedWinningNumber: cleanNum,
    });

    updateFirestoreGameState({
      roundId,
      roundIndex: roundIdx,
      forcedWinningNumber: cleanNum,
      drawMix: alignedMix,
      roundEndTime: activeEndTime,
    });
  };

  const handleAddTransaction = (newTx: Omit<TransactionRecord, 'id' | 'timestamp' | 'timeString'>) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const record: TransactionRecord = {
      ...newTx,
      id: `tx-${Date.now()}`,
      timestamp: Date.now(),
      timeString: timeStr,
    };
    setTransactions((prev) => [record, ...prev]);
    realtimeSync.createTransaction(newTx);
    upsertFirestoreTransaction(record);
  };

  const handleUpdateTransactionStatus = (id: string, status: TransactionStatus) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, status };
          upsertFirestoreTransaction(updated);
          return updated;
        }
        return t;
      })
    );
    realtimeSync.updateTransactionStatus(id, status);
  };

  const handleAddManualResult = (result: DrawResult) => {
    const normalizedResult: DrawResult = {
      ...result,
      roundIndex: normalizeRoundIndex(result.roundIndex ?? result.roundId, 1),
      roundId: formatSequentialRoundId(result.roundId ?? result.roundIndex, 1),
      timestamp: result.timestamp || Date.now(),
    };

    // If the betting countdown is still running (> 0) and this result is for the current/upcoming round,
    // lock it in as the scheduled winning result so it only appears when the countdown reaches 0.
    if (countdownRef.current > 0 && normalizedResult.roundIndex >= currentRoundIndexRef.current) {
      handleSetForcedWinningNumber(normalizedResult.number);
      return;
    }

    setHistory((prev) => {
      const filtered = prev.filter((r) => r.roundId !== normalizedResult.roundId);
      return [normalizedResult, ...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });
    realtimeSync.addManualResult(normalizedResult);
    addFirestoreDrawResult(normalizedResult);
  };

  const handleDeleteResult = (roundId: string) => {
    setHistory((prev) => prev.filter((r) => r.roundId !== roundId));
    realtimeSync.deleteResult(roundId);
    deleteFirestoreDrawResult(roundId);
  };

  const handleTriggerImmediateDraw = (targetNum?: number) => {
    const winningTarget = targetNum ?? getAuthoritativeForcedNumber() ?? undefined;
    if (winningTarget && winningTarget >= 1 && winningTarget <= 12) {
      handleSetForcedWinningNumber(winningTarget);
    }
    // New results will appear ONLY once the countdown has reached 0.
    // If the countdown for the betting period has not yet finished, do not reveal early.
    if (countdownRef.current > 0) {
      return;
    }
    realtimeSync.forceDrawNow(winningTarget);
    startDrawSequence(true, winningTarget);
  };

  // Real-Time Sound & Figure Synchronization States (10s Countdown)
  const [audioSyncSegment, setAudioSyncSegment] = useState<CountdownSyncSegment | null>(null);
  const [isAudioSyncing, setIsAudioSyncing] = useState<boolean>(false);
  const isAudioSyncingRef = useRef<boolean>(false);
  useEffect(() => {
    isAudioSyncingRef.current = isAudioSyncing;
  }, [isAudioSyncing]);
  const [betBlockedNotice, setBetBlockedNotice] = useState<string | null>(null);

  // Real-time cross-device synchronization hook (Firestore onSnapshot + WebSocket)
  useEffect(() => {
    testConnection();
    realtimeSync.connect();
    realtimeSync.fetchInitialState();

    const unsubStatus = realtimeSync.subscribeStatus((st) => setConnectionStatus(st));

    const applyFirestoreGameState = (firestoreState: any) => {
      if (!firestoreState) return;

      // Sync centralized Payout Odds
      if (firestoreState.payoutOdds) {
        setPayoutOdds({
          smallBig: Number(firestoreState.payoutOdds.smallBig) || DEFAULT_PAYOUT_ODDS.smallBig,
          oddEven: Number(firestoreState.payoutOdds.oddEven) || DEFAULT_PAYOUT_ODDS.oddEven,
          color: Number(firestoreState.payoutOdds.color) || DEFAULT_PAYOUT_ODDS.color,
          animal: Number(firestoreState.payoutOdds.animal) || DEFAULT_PAYOUT_ODDS.animal,
        });
      }

      // Sync centralized Drawing Schedule Duration & Auto-Draw
      if (typeof firestoreState.roundDuration === 'number' && firestoreState.roundDuration >= 15) {
        roundDurationRef.current = firestoreState.roundDuration;
        setRoundDuration(firestoreState.roundDuration);
      }
      if (typeof firestoreState.autoDrawEnabled === 'boolean') {
        setAutoDrawEnabled(firestoreState.autoDrawEnabled);
      }

      // Sync Round Index (normalized to start from 0001+)
      let activeRoundIdx = currentRoundIndexRef.current;
      if (typeof firestoreState.roundIndex === 'number' && firestoreState.roundIndex >= 1) {
        const normIdx = normalizeRoundIndex(firestoreState.roundIndex, 1);
        activeRoundIdx = normIdx;
        if (normIdx !== currentRoundIndexRef.current) {
          currentRoundIndexRef.current = normIdx;
          setCurrentRoundIndex(normIdx);
        }
      }

      // Sync Forced Winning Number from Admin Panel across all devices immediately
      if (firestoreState.forcedWinningNumber !== undefined) {
        const rawForced = firestoreState.forcedWinningNumber;
        const nextForced =
          typeof rawForced === 'number' && rawForced >= 1 && rawForced <= 12 ? rawForced : null;

        forcedWinningNumberRef.current = nextForced;
        lockedRoundResultRef.current = nextForced
          ? { roundIndex: activeRoundIdx, number: nextForced }
          : null;
        setForcedWinningNumber(nextForced);

        const roundId = formatSequentialRoundId(activeRoundIdx, 1);
        const alignedMix = calculateRevealSequence(
          roundId,
          nextForced,
          Array.isArray(firestoreState.drawMix) ? firestoreState.drawMix : undefined
        );
        setDrawMix(alignedMix);
        realtimeSync.setForcedResult(nextForced);
      } else if (Array.isArray(firestoreState.drawMix) && firestoreState.drawMix.length === 12) {
        const activeForced = getAuthoritativeForcedNumber();
        const roundId = formatSequentialRoundId(activeRoundIdx, 1);
        setDrawMix(calculateRevealSequence(roundId, activeForced, firestoreState.drawMix));
      }

      // Authoritative Cross-Device Wall-Clock Countdown Synchronization via roundEndTime
      if (typeof firestoreState.roundEndTime === 'number' && firestoreState.roundEndTime > Date.now()) {
        hasSyncedFirestoreTimeRef.current = true;
        roundEndTimeRef.current = firestoreState.roundEndTime;
        const remaining = Math.max(0, Math.ceil((firestoreState.roundEndTime - Date.now()) / 1000));

        if (!firestoreState.isRevealing && !isRevealingRef.current && remaining > 0 && remaining <= 3600) {
          countdownRef.current = remaining;
          setCountdown(remaining);
          if (remaining <= 10 && remaining >= 1) {
            isAudioSyncingRef.current = true;
            setIsAudioSyncing(true);
            setIsBetModalOpen(false);
            const seg = countdownAudioSync.syncToSecond(remaining, sound.isMuted());
            if (seg) setAudioSyncSegment(seg);
          } else if (remaining > 10 && isAudioSyncingRef.current) {
            countdownAudioSync.stop();
            isAudioSyncingRef.current = false;
            setIsAudioSyncing(false);
            setAudioSyncSegment(null);
          }
        }

        // Keep local server container synchronized with Firestore's authoritative roundEndTime
        realtimeSync.syncRoundState({
          roundIndex: activeRoundIdx,
          roundEndTime: firestoreState.roundEndTime,
          roundDuration: roundDurationRef.current,
          forcedWinningNumber: getAuthoritativeForcedNumber(),
        });
      } else if (
        !firestoreState.isRevealing &&
        !isRevealingRef.current &&
        (!firestoreState.roundEndTime || firestoreState.roundEndTime <= Date.now() - 2000)
      ) {
        // Initialize a shared roundEndTime in Firestore so any device opened later joins at the exact remaining time
        const dur = roundDurationRef.current || 180;
        const fallbackEndTime =
          roundEndTimeRef.current > Date.now()
            ? roundEndTimeRef.current
            : Date.now() + dur * 1000;
        hasSyncedFirestoreTimeRef.current = true;
        roundEndTimeRef.current = fallbackEndTime;
        const remaining = Math.max(1, Math.ceil((fallbackEndTime - Date.now()) / 1000));
        countdownRef.current = remaining;
        setCountdown(remaining);

        updateFirestoreGameState({
          roundId: formatSequentialRoundId(activeRoundIdx, 1),
          roundIndex: activeRoundIdx,
          roundDuration: dur,
          roundEndTime: fallbackEndTime,
          countdown: remaining,
          isRevealing: false,
          revealStep: 0,
        });
        realtimeSync.syncRoundState({
          roundIndex: activeRoundIdx,
          roundEndTime: fallbackEndTime,
          roundDuration: dur,
          forcedWinningNumber: getAuthoritativeForcedNumber(),
        });
      }

      // Sync Pending Winning Result only when countdown has reached 0
      if (firestoreState.pendingWinningResult !== undefined && countdownRef.current <= 0) {
        const activeForced = getAuthoritativeForcedNumber();
        if (activeForced && firestoreState.pendingWinningResult) {
          const forcedAnimal = ANIMALS_DATA[activeForced];
          setPendingWinningResult({
            ...firestoreState.pendingWinningResult,
            number: activeForced,
            animal: forcedAnimal.khmerName,
            color: forcedAnimal.color,
            size: forcedAnimal.size,
            parity: forcedAnimal.parity,
          });
        } else {
          setPendingWinningResult(firestoreState.pendingWinningResult);
        }
      }

      // Sync Authoritative Reveal State across devices — strictly only when countdown === 0
      if (
        firestoreState.isRevealing === true &&
        !isRevealingRef.current &&
        countdownRef.current <= 0 &&
        (firestoreState.countdown === undefined || firestoreState.countdown <= 0)
      ) {
        const targetWin =
          getAuthoritativeForcedNumber() ??
          firestoreState.forcedWinningNumber ??
          firestoreState.pendingWinningResult?.number ??
          undefined;
        startDrawSequence(true, targetWin, false);
      } else if (firestoreState.isRevealing === false && isRevealingRef.current && firestoreState.revealStep === 0) {
        isRevealingRef.current = false;
        setIsRevealing(false);
        setRevealStep(0);
      }
    };

    // Fetch authoritative Firestore state immediately on boot AND subscribe to real-time changes
    fetchFirestoreGameState().then((initialDoc) => {
      if (initialDoc) {
        applyFirestoreGameState(initialDoc);
      } else {
        // Bootstrap Firestore game_state/current if it doesn't exist yet
        const dur = roundDurationRef.current || 180;
        const initEndTime = Date.now() + dur * 1000;
        hasSyncedFirestoreTimeRef.current = true;
        roundEndTimeRef.current = initEndTime;
        updateFirestoreGameState({
          roundId: formatSequentialRoundId(currentRoundIndexRef.current, 1),
          roundIndex: currentRoundIndexRef.current,
          roundDuration: dur,
          roundEndTime: initEndTime,
          countdown: dur,
          isRevealing: false,
          revealStep: 0,
          forcedWinningNumber: null,
        });
      }
    });

    // 1. Authoritative Firestore GameState Listener (onSnapshot)
    const unsubFirestoreGame = subscribeToGameState(applyFirestoreGameState);

    // 2. Authoritative Firestore Draw History Listener (onSnapshot) — Sorted Newest First
    const unsubFirestoreHistory = subscribeToDrawHistory((firestoreHistory) => {
      if (firestoreHistory && firestoreHistory.length > 0) {
        setHistory((prev) => {
          const map = new Map<string, DrawResult>();
          firestoreHistory.forEach((item: DrawResult, idx: number) => {
            const seqId = formatSequentialRoundId(item.roundId ?? item.roundIndex, idx + 1);
            const seqIdx = normalizeRoundIndex(item.roundIndex ?? item.roundId, idx + 1);
            map.set(seqId, {
              ...item,
              roundId: seqId,
              roundIndex: seqIdx,
              timestamp: item.timestamp || Date.now() - idx * 1000,
            });
          });
          prev.forEach((item, idx) => {
            const seqId = formatSequentialRoundId(item.roundId ?? item.roundIndex, idx + 1);
            const existing = map.get(seqId);
            if (!existing || (item.timestamp || 0) > (existing.timestamp || 0)) {
              map.set(seqId, {
                ...item,
                roundId: seqId,
                roundIndex: normalizeRoundIndex(item.roundIndex ?? item.roundId, idx + 1),
                timestamp: item.timestamp || existing?.timestamp || Date.now() - idx * 1000,
              });
            }
          });
          return Array.from(map.values()).sort((a, b) => {
            const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
            if (timeDiff !== 0) return timeDiff;
            return (b.roundIndex || 0) - (a.roundIndex || 0);
          });
        });
      }
    });

    // 3. Authoritative Firestore Bets Listener (onSnapshot) — Actual Wagers Only
   
const unsubFirestoreBets = subscribeToBets((firestoreBets) => {
  setRecentBetRecords(normalizeRealBetRecords(firestoreBets ?? []));
});


    // 4. Authoritative Firestore Transactions Listener (onSnapshot)
    const unsubFirestoreTransactions = subscribeToTransactions((firestoreTxs) => {
      if (firestoreTxs && firestoreTxs.length > 0) {
        setTransactions((prev) => {
          const map = new Map<string, TransactionRecord>();
          firestoreTxs.forEach((tx) => {
            if (tx.id) map.set(tx.id, tx);
          });
          prev.forEach((tx) => {
            if (!map.has(tx.id)) map.set(tx.id, tx);
          });
          return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });
      }
    });

    const unsubscribe = realtimeSync.subscribe((stateUpdate, eventType) => {
      lastServerTickRef.current = Date.now();

      // Adopt server roundEndTime only if Firestore hasn't synced yet or on a fresh round reset
      if (
        typeof stateUpdate.roundEndTime === 'number' &&
        stateUpdate.roundEndTime > Date.now() &&
        (!hasSyncedFirestoreTimeRef.current || roundEndTimeRef.current <= Date.now())
      ) {
        roundEndTimeRef.current = stateUpdate.roundEndTime;
      }

      // Compute authoritative remaining seconds from shared wall-clock roundEndTimeRef if available
      if (roundEndTimeRef.current > Date.now() && !isRevealingRef.current) {
        const wallClockRemaining = Math.max(0, Math.ceil((roundEndTimeRef.current - Date.now()) / 1000));
        if (!isAudioSyncingRef.current) {
          countdownRef.current = wallClockRemaining;
          setCountdown(wallClockRemaining);
        }
      } else if (
        stateUpdate.countdown !== undefined &&
        !hasSyncedFirestoreTimeRef.current &&
        (!isAudioSyncingRef.current || eventType === 'ROUND_RESET')
      ) {
        countdownRef.current = stateUpdate.countdown;
        setCountdown(stateUpdate.countdown);
      }

      if (stateUpdate.currentRoundIndex !== undefined && !hasSyncedFirestoreTimeRef.current) {
        const normIdx = normalizeRoundIndex(stateUpdate.currentRoundIndex, 1);
        currentRoundIndexRef.current = normIdx;
        setCurrentRoundIndex(normIdx);
      }
      if (stateUpdate.currentRoundTime !== undefined) setCurrentRoundTime(stateUpdate.currentRoundTime);

      // Align any server draw outcome with Admin Panel's forcedWinningNumber
      if (
        stateUpdate.forcedWinningNumber !== undefined &&
        stateUpdate.forcedWinningNumber !== null &&
        stateUpdate.forcedWinningNumber >= 1 &&
        stateUpdate.forcedWinningNumber <= 12
      ) {
        forcedWinningNumberRef.current = stateUpdate.forcedWinningNumber;
        lockedRoundResultRef.current = {
          roundIndex: currentRoundIndexRef.current,
          number: stateUpdate.forcedWinningNumber,
        };
        setForcedWinningNumber(stateUpdate.forcedWinningNumber);
      }

      const activeForced = getAuthoritativeForcedNumber();
      const roundId = formatSequentialRoundId(
        stateUpdate.currentRoundIndex ?? currentRoundIndexRef.current,
        1
      );

      if (stateUpdate.drawMix !== undefined && !isRevealingRef.current) {
        setDrawMix(calculateRevealSequence(roundId, activeForced, stateUpdate.drawMix));
      }

      // Strictly allow reveal state & steps only once countdown has reached 0
      const canRevealNow = countdownRef.current <= 0;

      if (eventType === 'DRAW_STARTED' && canRevealNow && !isRevealingRef.current) {
        startDrawSequence(true, activeForced ?? undefined, true);
        return;
      }

      if (stateUpdate.balance !== undefined) setBalance(stateUpdate.balance);
      if (stateUpdate.recentBets !== undefined) {
        setRecentBetRecords(normalizeRealBetRecords(stateUpdate.recentBets));
      }
      if (stateUpdate.transactions !== undefined) setTransactions(stateUpdate.transactions);
    });

    return () => {
      unsubscribe();
      unsubStatus();
      unsubFirestoreGame();
      unsubFirestoreHistory();
      unsubFirestoreBets();
      unsubFirestoreTransactions();
    };
  }, []);

  const drawTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Once 10 seconds remain, the acceptance of new bets is closed
  const isBettingClosed = countdown <= 10 || isRevealing || isAudioSyncing;

  // Clear all pending draw sequence timeouts
  const clearAllDrawTimeouts = () => {
    drawTimeoutsRef.current.forEach((t) => clearTimeout(t));
    drawTimeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAllDrawTimeouts();
      countdownAudioSync.stop();
    };
  }, []);

  // Start the 10-second vocal audio countdown synchronized to the shared wall-clock remaining seconds
  const start10sCountdown = () => {
    if (isRevealingRef.current || countdownRef.current > 11) return;
    const rem = Math.max(1, Math.min(10, countdownRef.current || 10));
    isAudioSyncingRef.current = true;
    setIsAudioSyncing(true);
    setIsBetModalOpen(false);
    countdownRef.current = rem;
    setCountdown(rem);

    const seg = countdownAudioSync.syncToSecond(rem, sound.isMuted());
    if (seg) setAudioSyncSegment(seg);
  };

  const handleBlockedAttempt = () => {
    sound.playBlocked();
    setBetBlockedNotice('⚠️ ការទទួលការភ្នាល់ត្រូវបានបិទ! (Betting Closed - មិនទទួលការភ្នាល់ក្នុងអំឡុងពេលរាប់ថយក្រោយឡើយ)');
    setTimeout(() => {
      setBetBlockedNotice(null);
    }, 3200);
  };

  // Results History with persistent local caching sorted newest-first
  const [history, setHistory] = useState<DrawResult[]>(() => {
    try {
      const saved = localStorage.getItem(DRAW_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
      }
    } catch (e) {
      console.warn('Failed to load draw history from localStorage', e);
    }
    return INITIAL_HISTORY;
  });
  const latestResult = history[0] || null;

  // Persist history updates to localStorage
  useEffect(() => {
    try {
      if (history && history.length > 0) {
        localStorage.setItem(DRAW_HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch (e) {
      console.warn('Failed to save draw history to localStorage', e);
    }
  }, [history]);

  // Betting State
  const [selectedChip, setSelectedChip] = useState<number>(10000); // 10,000 KHR default
  const [pendingBets, setPendingBets] = useState<Record<string, number>>({});
  const [confirmedBets, setConfirmedBets] = useState<Record<string, number>>({});
  const [lastRoundBets, setLastRoundBets] = useState<Record<string, number>>({});
  
  // Persistent Betting History Storage (Strictly Actual Wagers Only)
  const BET_HISTORY_STORAGE_KEY = 'cambodia_lottery_12_bet_history_v2';
  const [recentBetRecords, setRecentBetRecords] = useState<BetHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(BET_HISTORY_STORAGE_KEY);
      if (saved) {
        return normalizeRealBetRecords(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load bet history from localStorage', e);
    }
    return [];
  });

  // Sync betting history to persistent localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(BET_HISTORY_STORAGE_KEY, JSON.stringify(recentBetRecords));
    } catch (e) {
      console.warn('Failed to save bet history to localStorage', e);
    }
  }, [recentBetRecords]);

  // Bet Amount Modal State
  const [isBetModalOpen, setIsBetModalOpen] = useState<boolean>(false);
  const [selectedBetTarget, setSelectedBetTarget] = useState<{
    category: BetCategory;
    odds: number;
    label: string;
  } | null>(null);

  // Winning Announcement Toast
  const [winNotice, setWinNotice] = useState<{ amount: number; number: number; animal: string } | null>(null);

  // Calculation of totals
  const pendingBetsTotal = Object.values(pendingBets).reduce((a, b) => a + b, 0);
  const confirmedBetsTotal = Object.values(confirmedBets).reduce((a, b) => a + b, 0);

  // Active bets map displayed on the board
  const displayedBets = { ...confirmedBets, ...pendingBets };

  // Authoritative Wall-Clock Countdown Loop (250ms resolution) — Guarantees all devices opened at any time stay 100% synchronized
  useEffect(() => {
    if (!autoDrawEnabled) return;

    const timer = setInterval(() => {
      if (isRevealingRef.current) return;

      // Ensure roundEndTimeRef is initialized if not yet set
      if (roundEndTimeRef.current <= 0) {
        roundEndTimeRef.current = Date.now() + (countdownRef.current || roundDurationRef.current || 180) * 1000;
      }

      const remainingSec = Math.max(0, Math.ceil((roundEndTimeRef.current - Date.now()) / 1000));

      if (remainingSec !== countdownRef.current) {
        countdownRef.current = remainingSec;
        setCountdown(remainingSec);

        if (remainingSec > 10 && remainingSec % 10 === 0) {
          sound.playTick();
        }
      }

      if (remainingSec <= 10 && remainingSec >= 1) {
        if (!isAudioSyncingRef.current) {
          isAudioSyncingRef.current = true;
          setIsAudioSyncing(true);
          setIsBetModalOpen(false);
        }
        const seg = countdownAudioSync.syncToSecond(remainingSec, sound.isMuted());
        if (seg) {
          setAudioSyncSegment((prev) => (prev?.number === seg.number ? prev : seg));
        }
      } else if (remainingSec === 0) {
        countdownAudioSync.syncToSecond(0, sound.isMuted());
        isAudioSyncingRef.current = false;
        setIsAudioSyncing(false);
        setAudioSyncSegment(null);
        countdownRef.current = 0;
        setCountdown(0);

        if (!isRevealingRef.current) {
          startDrawSequence(true, getAuthoritativeForcedNumber() ?? undefined, true);
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, [autoDrawEnabled, currentRoundIndex]);

  // Settle bets when final winning result appears
  const finalizeBets = (outcome: DrawResult) => {
    let roundTotalWinPayout = 0;
    const currentRoundId = outcome.roundId;

    const checkIsCategoryWon = (catKey: BetCategory): boolean => {
      if (catKey === 'small') return outcome.size === 'small';
      if (catKey === 'big') return outcome.size === 'big';
      if (catKey === 'odd') return outcome.parity === 'odd';
      if (catKey === 'even') return outcome.parity === 'even';
      if (catKey === 'color_red') return outcome.color === 'red';
      if (catKey === 'color_green') return outcome.color === 'green';
      if (catKey === 'color_blue') return outcome.color === 'blue';
      if (catKey.startsWith('animal_')) {
        const betNum = parseInt(catKey.replace('animal_', ''), 10);
        return betNum === outcome.number;
      }
      return false;
    };

    setRecentBetRecords((prevRecords) => {
      return prevRecords.map((rec) => {
        if (rec.status !== 'pending' && rec.roundId !== currentRoundId) {
          return rec;
        }

        let recordWonPayout = 0;
        const updatedBets = rec.bets.map((b) => {
          const won = checkIsCategoryWon(b.type);
          const payout = won ? Math.round(b.amount * b.odds) : 0;
          if (won) {
            recordWonPayout += payout;
          }
          return {
            ...b,
            won,
            payout,
          };
        });

        const isWon = recordWonPayout > 0;
        if (isWon) {
          roundTotalWinPayout += recordWonPayout;
        }

        const settledRec: BetHistoryRecord = {
          ...rec,
          bets: updatedBets,
          totalPayout: recordWonPayout,
          netProfit: isWon ? recordWonPayout - rec.totalStake : -rec.totalStake,
          resultNumber: outcome.number,
          status: isWon ? 'won' : 'lost',
        };
        addFirestoreBetRecord(settledRec);
        return settledRec;
      });
    });

    if (roundTotalWinPayout > 0) {
      setBalance((prev) => prev + roundTotalWinPayout);
      setWinNotice({
        amount: roundTotalWinPayout,
        number: outcome.number,
        animal: outcome.animal,
      });

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#eab308', '#f59e0b', '#3b82f6', '#ef4444', '#10b981'],
      });
      sound.playWin();
    }
  };

  // Sequence of New Result Display (Strictly appears ONLY once countdown has reached 0)
  const startDrawSequence = (
    fromAudioCompletion: boolean = false,
    explicitTargetNum?: number,
    broadcastToFirestore: boolean = true
  ) => {
    if (!fromAudioCompletion) {
      if (!isRevealingRef.current && !isAudioSyncingRef.current && countdownRef.current <= 11) {
        start10sCountdown();
      }
      return;
    }

    // Never reveal or display a new result if the countdown for the betting period has not yet finished (> 0)
    if (isRevealingRef.current || countdownRef.current > 0) return;
    clearAllDrawTimeouts();
    countdownAudioSync.stop();
    isAudioSyncingRef.current = false;
    setIsAudioSyncing(false);
    setAudioSyncSegment(null);

    const roundIdx = normalizeRoundIndex(currentRoundIndexRef.current, 1);
    const roundId = formatSequentialRoundId(roundIdx, 1);
    const targetForced =
      explicitTargetNum ??
      getAuthoritativeForcedNumber() ??
      null;

    // Calculate deterministic 12-bowl reveal sequence aligned with Firestore forcedWinningNumber
    const mix = calculateRevealSequence(roundId, targetForced);
    const winningNum =
      targetForced && targetForced >= 1 && targetForced <= 12
        ? targetForced
        : mix[11];

    setDrawMix(mix);
    const animal = ANIMALS_DATA[winningNum];

    const now = new Date();
    const meta = getDateTimeMetadata(now);
    const timeStr = meta.shortTime;
    setCurrentDate(meta.date);

    const outcomeResult: DrawResult = {
      roundId,
      roundIndex: roundIdx,
      date: meta.date,
      year: meta.year,
      month: meta.month,
      day: meta.day,
      time: timeStr,
      number: winningNum,
      animal: animal.khmerName,
      color: animal.color,
      size: animal.size,
      parity: animal.parity,
      timestamp: meta.timestamp,
    };

    setPendingWinningResult(outcomeResult);
    isRevealingRef.current = true;
    setIsRevealing(true);
    countdownRef.current = 0;
    setCountdown(0);
    sound.playBowlShake();

    // Step 1: Open Number 1 at t = 0ms
    setRevealStep(1);
    sound.playCardFlip(1);

    if (broadcastToFirestore) {
      updateFirestoreGameState({
        roundId,
        roundIndex: roundIdx,
        roundTime: timeStr,
        countdown: 0,
        isRevealing: true,
        revealStep: 1,
        revealStartTime: Date.now(),
        forcedWinningNumber: targetForced,
        drawMix: mix,
        pendingWinningResult: outcomeResult,
      });
    }

    // Row 1 (Positions 2–6): 1,100ms interval
    for (let s = 2; s <= 6; s++) {
      const delay = (s - 1) * 1100;
      const t = setTimeout(() => {
        setRevealStep(s);
        sound.playCardFlip(s);
      }, delay);
      drawTimeoutsRef.current.push(t);
    }

    // Row 2 (Positions 7–11): 1,100ms interval
    for (let s = 7; s <= 11; s++) {
      const delay = (s - 1) * 1100;
      const t = setTimeout(() => {
        setRevealStep(s);
        sound.playCardFlip(s);
      }, delay);
      drawTimeoutsRef.current.push(t);
    }

    // Row 3 (Final Result / Position 12): 12,100ms (1,100ms after Bowl 11)
    const finalResultDelay = 11 * 1100;
    const tFinal = setTimeout(() => {
      setRevealStep(12);
      sound.playGongReveal();

      finalizeBets(outcomeResult);

      setHistory((prev) => {
        const filtered = prev.filter((r) => r.roundId !== outcomeResult.roundId);
        return [outcomeResult, ...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      });

      // Persist the completed result to Firestore on all devices so even if Admin device closed, result is saved
      addFirestoreDrawResult(outcomeResult);

      // Reset after 5,000ms for the next round
      const tReset = setTimeout(() => {
        const nextRoundIdx = roundIdx + 1;
        const nextRoundId = formatSequentialRoundId(nextRoundIdx);
        const nextDuration = roundDurationRef.current || 180;
        const nextEndTime = Date.now() + nextDuration * 1000;
        const nextMix = calculateRevealSequence(nextRoundId, null);

        countdownAudioSync.stop();
        isAudioSyncingRef.current = false;
        setIsAudioSyncing(false);
        setAudioSyncSegment(null);
        isRevealingRef.current = false;
        setIsRevealing(false);
        setRevealStep(0);
        setPendingWinningResult(null);
        setWinNotice(null);
        forcedWinningNumberRef.current = null;
        lockedRoundResultRef.current = null;
        setForcedWinningNumber(null);
        roundEndTimeRef.current = nextEndTime;
        countdownRef.current = nextDuration;
        setCountdown(nextDuration);
        currentRoundIndexRef.current = nextRoundIdx;
        setCurrentRoundIndex(nextRoundIdx);
        setDrawMix(nextMix);

        updateFirestoreGameState({
          roundId: nextRoundId,
          roundIndex: nextRoundIdx,
          countdown: nextDuration,
          roundDuration: nextDuration,
          roundEndTime: nextEndTime,
          isRevealing: false,
          revealStep: 0,
          forcedWinningNumber: null,
          drawMix: nextMix,
          pendingWinningResult: null,
        });

        realtimeSync.syncRoundState({
          roundIndex: nextRoundIdx,
          roundEndTime: nextEndTime,
          roundDuration: nextDuration,
          forcedWinningNumber: null,
        });

        if (Object.keys(confirmedBets).length > 0) {
          setLastRoundBets(confirmedBets);
        }
        setConfirmedBets({});
        setPendingBets({});
      }, 5000);
      drawTimeoutsRef.current.push(tReset);
    }, finalResultDelay);
    drawTimeoutsRef.current.push(tFinal);
  };

  // Place bet triggers the bet amount specification modal
  const handlePlaceBet = (category: BetCategory, defaultOdds: number, label: string) => {
    if (isBettingClosed) {
      handleBlockedAttempt();
      return;
    }
    setSelectedBetTarget({ category, odds: defaultOdds, label });
    setIsBetModalOpen(true);
  };

  const handleConfirmBetFromModal = (
    category: BetCategory,
    amount: number,
    label: string,
    odds: number,
    _singlePost: boolean
  ) => {
    if (isBettingClosed) {
      handleBlockedAttempt();
      return;
    }
    if (balance < amount) {
      setIsTopUpOpen(true);
      return;
    }
    setBalance((prev) => prev - amount);
    setConfirmedBets((prev) => {
      const cur = prev[category] || 0;
      return {
        ...prev,
        [category]: cur + amount,
      };
    });

    const meta = getDateTimeMetadata(new Date());
    setCurrentDate(meta.date);
    const potentialWin = Math.round(amount * odds);

    setRecentBetRecords((prev) => {
      const ticketId = getNextSequentialTicketId(prev, meta.date);
      const newRecord: BetHistoryRecord = {
        id: `bet_${meta.date.replace(/-/g, '')}_${ticketId}_${meta.timestamp}`,
        ticketId,
        roundId: formatSequentialRoundId(currentRoundIndex, 1),
        date: meta.date,
        year: meta.year,
        month: meta.month,
        day: meta.day,
        time: meta.time,
        timestamp: meta.timestamp,
        isRealBet: true,
        bets: [
          {
            type: category,
            label: label || category,
            amount,
            odds,
            potentialWin,
            won: false,
            payout: 0,
          },
        ],
        totalStake: amount,
        totalPotentialPayout: potentialWin,
        totalPayout: 0,
        netProfit: -amount,
        status: 'pending',
      };

      realtimeSync.placeBet(newRecord);
      addFirestoreBetRecord(newRecord);
      return normalizeRealBetRecords([newRecord, ...prev]);
    });
  };

  // Clear betting history if requested
  const handleClearBetHistory = () => {
    setRecentBetRecords([]);
    try {
      localStorage.removeItem(BET_HISTORY_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear bet history', e);
    }
  };

  // Add Funds
  const handleAddFunds = (amount: number) => {
    setBalance((prev) => prev + amount);
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col font-['Kantumruy_Pro',sans-serif] text-slate-800">
      {/* 1. Header Navigation Bar */}
      <HeaderNav
        activeMainTab={activeMainTab}
        onSelectMainTab={setActiveMainTab}
        activeSubTab={activeSubTab}
        onSelectSubTab={setActiveSubTab}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        connectionStatus={connectionStatus}
      />

      {/* 2. Main Body Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeMainTab === 'admin' ? (
          <AdminPanel
            currentRoundIndex={currentRoundIndex}
            currentRoundTime={currentRoundTime}
            countdown={countdown}
            isRevealing={isRevealing}
            history={history}
            onAddManualResult={handleAddManualResult}
            onDeleteResult={handleDeleteResult}
            forcedWinningNumber={forcedWinningNumber}
            onSetForcedWinningNumber={handleSetForcedWinningNumber}
            onTriggerImmediateDraw={handleTriggerImmediateDraw}
            recentBets={recentBetRecords}
            playerBalance={balance}
            onUpdatePlayerBalance={setBalance}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onUpdateTransactionStatus={handleUpdateTransactionStatus}
            onReturnToGame={() => setActiveMainTab('lottery_12')}
            onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
            payoutOdds={payoutOdds}
            onUpdatePayoutOdds={setPayoutOdds}
            roundDuration={roundDuration}
            onUpdateRoundDuration={(sec) => {
              const newEndTime = Date.now() + sec * 1000;
              roundDurationRef.current = sec;
              roundEndTimeRef.current = newEndTime;
              setRoundDuration(sec);
              countdownRef.current = sec;
              setCountdown(sec);
              realtimeSync.syncRoundState({
                roundIndex: currentRoundIndexRef.current,
                roundEndTime: newEndTime,
                roundDuration: sec,
                forcedWinningNumber: getAuthoritativeForcedNumber(),
              });
            }}
            autoDrawEnabled={autoDrawEnabled}
            onToggleAutoDraw={setAutoDrawEnabled}
          />
        ) : activeMainTab === 'lottery_1_99' ? (
          <Lottery199
            balance={balance}
            onUpdateBalance={setBalance}
            onOpenTopUp={() => setIsTopUpOpen(true)}
          />
        ) : activeMainTab !== 'lottery_12' ? (
          <OtherGamesView
            tab={activeMainTab}
            onReturnTo12={() => setActiveMainTab('lottery_12')}
          />
        ) : activeSubTab === 'win_loss' ? (
          <WinLossView
            records={recentBetRecords}
            currentDate={currentDate}
            onBackToGame={() => setActiveSubTab('lottery')}
          />
        ) : activeSubTab === 'results' ? (
          <ResultsView
            history={history}
            onBackToGame={() => setActiveSubTab('lottery')}
          />
        ) : (
          /* Main Cambodian 12 Lottery Board (Responsive & Consistent across all devices) */
          <div className="flex-1 flex flex-col w-full overflow-hidden">
            {/* Mobile View Switcher Tabs */}
            <div className="lg:hidden bg-slate-900 border-b border-slate-700 px-2 sm:px-3 py-1.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px] font-bold">
                <button
                  onClick={() => setMobileView('full')}
                  className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                    mobileView === 'full'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="ប្លង់ពេញលេញដូចកុំព្យូទ័រ (Full Kiosk Layout)"
                >
                  <span>📱</span>
                  <span>ប្លង់ពេញ (Full)</span>
                </button>
                <button
                  onClick={() => setMobileView('game')}
                  className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                    mobileView === 'game'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="មើលតែផ្ទាំងឆ្នោត (Board Only)"
                >
                  <span>🎲</span>
                  <span>ផ្ទាំងឆ្នោត</span>
                </button>
                <button
                  onClick={() => setMobileView('sidebar')}
                  className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                    mobileView === 'sidebar'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="មើលសមតុល្យ និងប្រវត្តិ (Account & History)"
                >
                  <span>📋</span>
                  <span>គណនី</span>
                </button>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 bg-black/40 px-2.5 py-1 rounded-md border border-emerald-500/30">
                {balance.toLocaleString()}៛
              </div>
            </div>

            <div className={`flex-1 flex flex-col lg:flex-row overflow-y-auto ${mobileView === 'full' ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
              <div className={`flex flex-col lg:flex-row flex-1 ${mobileView === 'full' ? 'min-w-[980px] lg:min-w-0' : 'w-full'}`}>
                {/* Left Sidebar */}
                <div className={`${mobileView === 'full' || mobileView === 'sidebar' ? 'block' : 'hidden'} lg:block shrink-0`}>
                  <Sidebar
                    balance={balance}
                    activeBetsTotal={confirmedBetsTotal + pendingBetsTotal}
                    latestResults={history}
                    recentBets={recentBetRecords}
                    currentDate={currentDate}
                    onAddBalance={() => setIsTopUpOpen(true)}
                    onRefreshResults={() => sound.playButton()}
                    onClearBetsHistory={handleClearBetHistory}
                  />
                </div>

                {/* Right Main Playfield */}
                <div className={`${mobileView === 'full' || mobileView === 'game' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col bg-white overflow-x-auto min-w-0 w-full`}>
                  {/* Top Row: Center Bowls (Left) & Betting Odds + 12 Animals (Right) */}
                  <div className="flex flex-col md:flex-row border-b border-[#94a3b8]">
                    {/* 12 Bowls & Center Main Chamber (Aligned via Firestore & calculateRevealSequence) */}
                    <Side2BowlArena
                      countdown={countdown}
                      isRevealing={isRevealing && countdown === 0}
                      revealStep={countdown === 0 ? revealStep : 0}
                      latestResult={isRevealing && countdown === 0 ? pendingWinningResult : latestResult}
                      drawMix={drawMix}
                      forcedWinningNumber={forcedWinningNumber}
                      currentRoundId={formatSequentialRoundId(currentRoundIndex, 1)}
                      onBowlClick={(num) =>
                        handlePlaceBet(`animal_${num}` as BetCategory, payoutOdds.animal, `ពានលេខ ${num}`)
                      }
                      onTriggerDraw={start10sCountdown}
                      audioSyncSegment={audioSyncSegment}
                      isBettingClosed={isBettingClosed}
                      onTrigger10sCountdown={start10sCountdown}
                      onBlockedAttempt={handleBlockedAttempt}
                    />

                    {/* Right Betting Board */}
                    <BettingBoard
                      countdown={countdown}
                      currentRoundId={formatSequentialRoundId(currentRoundIndex, 1)}
                      currentRoundTime={currentRoundTime}
                      currentDate={currentDate}
                      activeBets={displayedBets}
                      onPlaceBet={handlePlaceBet}
                      selectedChip={selectedChip}
                      latestResult={isRevealing && countdown === 0 && revealStep >= 12 ? pendingWinningResult : latestResult}
                      isRevealing={isRevealing && countdown === 0 && revealStep >= 12}
                      revealStep={countdown === 0 ? revealStep : 0}
                      onRefreshRound={() => {
                        sound.playButton();
                        realtimeSync.fetchInitialState();
                      }}
                      audioSyncSegment={audioSyncSegment}
                      isBettingClosed={isBettingClosed}
                      onBlockedAttempt={handleBlockedAttempt}
                      payoutOdds={payoutOdds}
                    />
                  </div>

                  {/* Bottom Row: Streak Roads & Bead Plate */}
                  <RoadGrid history={history} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bet Blocked Warning Toast */}
      {betBlockedNotice && (
        <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-6 py-2.5 rounded-full shadow-2xl border-2 border-yellow-300 flex items-center gap-3 animate-bounce">
          <span className="text-xl">🚫</span>
          <div className="font-black text-sm drop-shadow">
            {betBlockedNotice}
          </div>
        </div>
      )}

      {/* Floating Win Notification Banner */}
      {winNotice && (
        <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-900 px-6 py-2.5 rounded-full shadow-2xl border-2 border-white flex items-center gap-3 animate-bounce">
          <span className="text-xl">🏆</span>
          <div className="font-black text-sm">
            អបអរសាទរ! អ្នកបានឈ្នះ{' '}
            <span className="text-red-700 font-extrabold text-base underline">
              +{winNotice.amount.toLocaleString()}៛
            </span>{' '}
            (លេខ {winNotice.number} {winNotice.animal})
          </div>
        </div>
      )}

      {/* Top-up Balance Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        currentBalance={balance}
        onAddFunds={handleAddFunds}
      />

      {/* Help & Rules Modal */}
      <HelpRulesModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Bet Amount Specification Modal */}
      <BetAmountModal
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        onConfirmBet={handleConfirmBetFromModal}
        currentRoundId={`#${formatSequentialRoundId(currentRoundIndex, 1)}`}
        currentRoundTime={currentRoundTime}
        betCategory={selectedBetTarget?.category || null}
        betLabel={selectedBetTarget?.label || ''}
        betOdds={selectedBetTarget?.odds || payoutOdds.smallBig}
        balance={balance}
        onOpenTopUp={() => setIsTopUpOpen(true)}
        isBettingClosed={isBettingClosed}
      />

      {/* Cloudflare Remote Management & How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />
    </div>
  );
}
