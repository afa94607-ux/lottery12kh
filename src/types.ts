export type ColorGroup = 'red' | 'green' | 'blue';
export type SizeGroup = 'small' | 'big';
export type ParityGroup = 'odd' | 'even';

export interface AnimalData {
  number: number;
  khmerName: string;
  animalEn: string;
  color: ColorGroup;
  size: SizeGroup;
  parity: ParityGroup;
  odds: number;
}

export interface PayoutOddsConfig {
  smallBig: number; // default 1.95
  oddEven: number;  // default 1.95
  color: number;    // default 2.95
  animal: number;   // default 11
}

export const DEFAULT_PAYOUT_ODDS: PayoutOddsConfig = {
  smallBig: 1.95,
  oddEven: 1.95,
  color: 2.95,
  animal: 11,
};

export const ANIMALS_DATA: Record<number, AnimalData> = {
  1: { number: 1, khmerName: 'ជូត', animalEn: 'Rat', color: 'red', size: 'small', parity: 'odd', odds: 11 },
  2: { number: 2, khmerName: 'ឆ្លូវ', animalEn: 'Ox', color: 'green', size: 'small', parity: 'even', odds: 11 },
  3: { number: 3, khmerName: 'ខាល', animalEn: 'Tiger', color: 'blue', size: 'small', parity: 'odd', odds: 11 },
  4: { number: 4, khmerName: 'ថោះ', animalEn: 'Rabbit', color: 'red', size: 'small', parity: 'even', odds: 11 },
  5: { number: 5, khmerName: 'រោង', animalEn: 'Dragon', color: 'green', size: 'small', parity: 'odd', odds: 11 },
  6: { number: 6, khmerName: 'ម្សាញ់', animalEn: 'Snake', color: 'blue', size: 'small', parity: 'even', odds: 11 },
  7: { number: 7, khmerName: 'មមី', animalEn: 'Horse', color: 'red', size: 'big', parity: 'odd', odds: 11 },
  8: { number: 8, khmerName: 'មមែ', animalEn: 'Goat', color: 'green', size: 'big', parity: 'even', odds: 11 },
  9: { number: 9, khmerName: 'វក', animalEn: 'Monkey', color: 'blue', size: 'big', parity: 'odd', odds: 11 },
  10: { number: 10, khmerName: 'រកា', animalEn: 'Rooster', color: 'red', size: 'big', parity: 'even', odds: 11 },
  11: { number: 11, khmerName: 'ច', animalEn: 'Dog', color: 'green', size: 'big', parity: 'odd', odds: 11 },
  12: { number: 12, khmerName: 'កុរ', animalEn: 'Pig', color: 'blue', size: 'big', parity: 'even', odds: 11 },
};

export interface DrawResult {
  roundId: string; // e.g. "2004#284"
  roundIndex: number;
  date?: string;   // e.g. "2026-11-12"
  year?: number;
  month?: number;
  day?: number;
  time: string;    // e.g. "16:22"
  number: number;  // 1..12
  animal: string;
  color: ColorGroup;
  size: SizeGroup;
  parity: ParityGroup;
  timestamp: number;
}

export interface FirestoreGameState {
  roundId: string;
  roundIndex: number;
  roundTime: string;
  roundDuration: number;
  roundEndTime: number;
  countdown: number;
  isRevealing: boolean;
  revealStep: number;
  revealStartTime: number;
  forcedWinningNumber: number | null;
  drawMix: number[];
  pendingWinningResult: DrawResult | null;
  payoutOdds: PayoutOddsConfig;
  autoDrawEnabled: boolean;
  updatedAt?: string;
}

export type BetCategory = 
  | 'small'       // 1.95
  | 'big'         // 1.95
  | 'odd'         // 1.95
  | 'even'        // 1.95
  | 'color_red'   // 2.95
  | 'color_green' // 2.95
  | 'color_blue'  // 2.95
  | `animal_${number}`; // 11

export interface ActiveBet {
  type: BetCategory;
  label: string;
  amount: number;
  odds: number;
}

export interface BetHistoryRecord {
  id: string;        // Unique storage key e.g. "2026-11-12_0001"
  ticketId: string;  // Sequential 4-digit ID beginning at "0001"
  userId?: string;
  roundId: string;
  date: string;      // "YYYY-MM-DD"
  year: number;      // e.g. 2026
  month: number;     // 1..12
  day: number;       // 1..31
  time: string;      // "HH:mm:ss"
  timestamp: number; // Epoch ms
  isRealBet?: boolean; // True for actual player wagers (excludes demo/test activity)
  bets: {
    type: BetCategory;
    label: string;
    amount: number;
    odds: number;
    potentialWin?: number;
    won: boolean;
    payout: number;
  }[];
  totalStake: number;
  totalPotentialPayout: number;
  totalPayout: number;
  netProfit: number;
  resultNumber?: number;
  status: 'won' | 'lost' | 'pending';
  createdAt?: string;
}

export type PostLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Lottery199Result {
  roundId: string;
  roundIndex: number;
  time: string;
  posts: Record<PostLetter, number>;
  timestamp: number;
}

export interface Lottery199BetRecord {
  id: string;
  ticketId?: string;
  roundId: string;
  date?: string;
  year?: number;
  month?: number;
  day?: number;
  time: string;
  posts: PostLetter[];
  numbers: string[];
  amountPerBet: number;
  totalStake: number;
  totalPayout: number;
  status: 'won' | 'lost' | 'pending';
  winningDetails?: { post: PostLetter; number: string; payout: number }[];
}

export type TransactionType = 'deposit' | 'withdrawal' | 'adjustment';
export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface TransactionRecord {
  id: string;
  userName: string;
  userPhone: string;
  type: TransactionType;
  amount: number;
  method: 'ABA Bank' | 'Wing' | 'ACLEDA' | 'TrueMoney' | 'Cash' | 'Manual';
  status: TransactionStatus;
  timestamp: number;
  timeString: string;
  note?: string;
}

export interface LiveBetItem {
  id: string;
  ticketId: string;
  roundId: string;
  userName: string;
  date: string;
  year: number;
  month: number;
  day: number;
  time: string;
  type: BetCategory;
  label: string;
  amount: number;
  odds: number;
  potentialPayout: number;
  payout: number;
  status: 'won' | 'lost' | 'pending';
  timestamp: number;
}

export interface RoundSummaryReport {
  roundId: string;
  date: string;
  time: string;
  resultNumber: number;
  animal: string;
  totalTurnover: number;
  totalPayout: number;
  houseProfit: number;
  status: 'completed' | 'in_progress';
}

/**
 * Helper to extract current live date (Year, Month, Day, YYYY-MM-DD) and Time (HH:mm:ss)
 */
export function getDateTimeMetadata(dateObj: Date = new Date()) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
  const shortTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    date,
    time,
    shortTime,
    timestamp: dateObj.getTime(),
  };
}

/**
 * Normalizes any round index or legacy roundId (such as "2004#284") into a sequential 1-based integer starting at 1.
 */
export function normalizeRoundIndex(input: string | number | undefined | null, fallback: number = 1): number {
  if (typeof input === 'number' && !isNaN(input)) {
    if (input >= 284) return input - 283;
    if (input >= 257 && input <= 283) return 284 - input;
    return Math.max(1, Math.floor(input));
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes('#')) {
      const afterHash = parseInt(trimmed.split('#')[1], 10);
      if (!isNaN(afterHash)) {
        return normalizeRoundIndex(afterHash, fallback);
      }
    }
    const digits = parseInt(trimmed.replace(/\D/g, ''), 10);
    if (!isNaN(digits) && digits > 0) {
      return normalizeRoundIndex(digits, fallback);
    }
  }
  return Math.max(1, fallback);
}

/**
 * Formats any round ID or round index into a 4-digit sequential ID starting at "0001" ("0001", "0002", ...).
 */
export function formatSequentialRoundId(input: string | number | undefined | null, fallback: number = 1): string {
  const idx = normalizeRoundIndex(input, fallback);
  return String(idx).padStart(4, '0');
}

/**
 * Computes the next sequential 4-digit Bet ID beginning at "0001" for the given date.
 * Automatically starts at "0001" each new day.
 */
export function getNextSequentialTicketId(
  existingRecords: BetHistoryRecord[],
  targetDate: string
): string {
  let maxSeq = 0;
  existingRecords.forEach((rec) => {
    const recDate = rec.date || '';
    if (recDate === targetDate && rec.ticketId) {
      const parsed = parseInt(rec.ticketId.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });
  return String(maxSeq + 1).padStart(4, '0');
}

/**
 * Filters and normalizes bet records so only actual wagers (excluding any demo/test records)
 * are included and every record has a valid 4-digit ticketId ("0001"+) and Year/Month/Day metadata.
 */
export function normalizeRealBetRecords(records: BetHistoryRecord[]): BetHistoryRecord[] {
  if (!Array.isArray(records)) return [];

  // Filter out any test/demo records or invalid 0-stake records
  const validActualBets = records.filter((rec: any) => {
    if (!rec || typeof rec.totalStake !== 'number' || rec.totalStake <= 0) return false;
    if (rec.isTest === true || rec.isDemo === true) return false;
    if (typeof rec.userId === 'string' && (rec.userId.includes('demo') || rec.userId.includes('test'))) {
      return false;
    }
    return Array.isArray(rec.bets) && rec.bets.length > 0;
  });

  // Sort oldest-first per date to assign deterministic 0001, 0002... if any legacy record lacked ticketId
  const sortedAsc = [...validActualBets].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const dailyCounters: Record<string, number> = {};

  const normalized = sortedAsc.map((rec) => {
    const ts = rec.timestamp || (rec.createdAt ? new Date(rec.createdAt).getTime() : Date.now());
    const dt = new Date(isNaN(ts) ? Date.now() : ts);
    const meta = getDateTimeMetadata(dt);

    const dateStr = rec.date && /^\d{4}-\d{2}-\d{2}$/.test(rec.date) ? rec.date : meta.date;
    const [yStr, mStr, dStr] = dateStr.split('-');
    const year = rec.year || parseInt(yStr, 10) || meta.year;
    const month = rec.month || parseInt(mStr, 10) || meta.month;
    const day = rec.day || parseInt(dStr, 10) || meta.day;

    let seqNum = 0;
    if (rec.ticketId && /^\d+$/.test(rec.ticketId)) {
      seqNum = parseInt(rec.ticketId, 10);
    }
    if (seqNum <= 0) {
      seqNum = (dailyCounters[dateStr] || 0) + 1;
    }
    dailyCounters[dateStr] = Math.max(dailyCounters[dateStr] || 0, seqNum);
    const ticketId = String(seqNum).padStart(4, '0');

    return {
      ...rec,
      ticketId,
      roundId: formatSequentialRoundId(rec.roundId, seqNum),
      date: dateStr,
      year,
      month,
      day,
      time: rec.time || meta.time,
      timestamp: isNaN(ts) ? Date.now() : ts,
      isRealBet: true,
    };
  });

  // Return newest first (descending by timestamp / ticketId)
  return normalized.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    const seqA = parseInt(a.ticketId, 10) || 0;
    const seqB = parseInt(b.ticketId, 10) || 0;
    if (seqB !== seqA) return seqB - seqA;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}
