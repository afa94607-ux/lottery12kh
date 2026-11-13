import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DrawResult,
  BetHistoryRecord,
  TransactionRecord,
  FirestoreGameState,
  DEFAULT_PAYOUT_ODDS,
  getDateTimeMetadata,
  normalizeRealBetRecords,
  normalizeRoundIndex,
  formatSequentialRoundId,
} from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Silence noisy internal WebChannel 10s transport timeout logs in restricted iframe/proxy networks
try {
  setLogLevel('silent');
} catch {
  // Ignore if setLogLevel is unavailable
}

// Initialize Firestore with specific database ID and automatic long-polling detection for proxy/iframe reliability
function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function isTransientNetworkOrOfflineError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code = (error as { code?: string })?.code?.toLowerCase() || '';
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('failed to get document from server') ||
    msg.includes('network error') ||
    msg.includes(' unavailable')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  if (isTransientNetworkOrOfflineError(error)) {
    // Gracefully allow Firestore offline cache & WebSocket sync to continue during transient network latency
    console.warn(`[Firestore Offline/Transient] ${operationType} on ${path || 'unknown'}: operating in cached mode.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  const msg = errInfo.error.toLowerCase();
  if (msg.includes('missing or insufficient permissions') || msg.includes('permission-denied') || msg.includes('permission_denied')) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  console.warn('Firestore operation warning:', JSON.stringify(errInfo));
}

// Connection test on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('✅ Firebase Firestore connection verified.');
  } catch (error) {
    if (isTransientNetworkOrOfflineError(error)) {
      console.warn('Firestore backend unreachable on initial probe; operating with live fallback & auto-reconnect.');
      return;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline; will sync automatically when online.');
    }
  }
}

// Auth helpers
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error) {
    console.warn('Google sign-in popup closed or cancelled:', error);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Sanitize GameState payload to strictly match firebase-blueprint.json & firestore.rules
function sanitizeGameStatePayload(state: Partial<FirestoreGameState>): Record<string, any> {
  const clean: Record<string, any> = {
    updatedAt: new Date().toISOString().slice(0, 64),
  };

  if (typeof state.roundId === 'string') {
    clean.roundId = state.roundId.slice(0, 64);
  }
  if (typeof state.roundIndex === 'number' && !isNaN(state.roundIndex) && state.roundIndex >= 1) {
    clean.roundIndex = Math.floor(state.roundIndex);
  }
  if (typeof state.roundTime === 'string') {
    clean.roundTime = state.roundTime.slice(0, 32);
  }
  if (typeof state.roundDuration === 'number' && state.roundDuration >= 15 && state.roundDuration <= 3600) {
    clean.roundDuration = Math.floor(state.roundDuration);
  }
  if (typeof state.roundEndTime === 'number' && state.roundEndTime >= 0) {
    clean.roundEndTime = Math.floor(state.roundEndTime);
  }
  if (typeof state.countdown === 'number' && state.countdown >= 0 && state.countdown <= 3600) {
    clean.countdown = Math.floor(state.countdown);
  }
  if (typeof state.isRevealing === 'boolean') {
    clean.isRevealing = state.isRevealing;
  }
  if (typeof state.revealStep === 'number' && state.revealStep >= 0 && state.revealStep <= 12) {
    clean.revealStep = Math.floor(state.revealStep);
  }
  if (typeof state.revealStartTime === 'number' && state.revealStartTime >= 0) {
    clean.revealStartTime = Math.floor(state.revealStartTime);
  }
  if (state.forcedWinningNumber === null) {
    clean.forcedWinningNumber = null;
  } else if (
    typeof state.forcedWinningNumber === 'number' &&
    state.forcedWinningNumber >= 1 &&
    state.forcedWinningNumber <= 12
  ) {
    clean.forcedWinningNumber = Math.floor(state.forcedWinningNumber);
  }
  if (Array.isArray(state.drawMix) && state.drawMix.length <= 12) {
    clean.drawMix = state.drawMix.slice(0, 12).map((n) => Number(n));
  }
  if (state.pendingWinningResult !== undefined) {
    clean.pendingWinningResult = state.pendingWinningResult;
  }
  if (state.payoutOdds && typeof state.payoutOdds === 'object') {
    clean.payoutOdds = {
      smallBig: Number(state.payoutOdds.smallBig) || DEFAULT_PAYOUT_ODDS.smallBig,
      oddEven: Number(state.payoutOdds.oddEven) || DEFAULT_PAYOUT_ODDS.oddEven,
      color: Number(state.payoutOdds.color) || DEFAULT_PAYOUT_ODDS.color,
      animal: Number(state.payoutOdds.animal) || DEFAULT_PAYOUT_ODDS.animal,
    };
  }
  if (typeof state.autoDrawEnabled === 'boolean') {
    clean.autoDrawEnabled = state.autoDrawEnabled;
  }

  return clean;
}

// Fetch Authoritative Game State (game_state/current) on initial boot
export async function fetchFirestoreGameState(): Promise<Partial<FirestoreGameState> | null> {
  try {
    const docRef = doc(db, 'game_state', 'current');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Partial<FirestoreGameState>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'game_state/current');
  }
  return null;
}

// 1. Subscribe to Authoritative Game State (game_state/current) via onSnapshot
export function subscribeToGameState(
  onUpdate: (state: Partial<FirestoreGameState>) => void,
  onError?: (err: any) => void
): () => void {
  const docRef = doc(db, 'game_state', 'current');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as Partial<FirestoreGameState>);
      }
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, 'game_state/current');
    }
  );
}

// 2. Subscribe to Authoritative Draw History (draw_history) via onSnapshot (Sorted Newest-First)
export function subscribeToDrawHistory(
  onUpdate: (history: DrawResult[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, 'draw_history');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const docs = snapshot.docs.map((d, idx) => {
        const raw = d.data() as DrawResult;
        const ts = raw.timestamp || Date.now();
        const meta = getDateTimeMetadata(new Date(ts));
        const dateStr = raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : meta.date;
        const [yStr, mStr, dStr] = dateStr.split('-');
        const roundIdx = normalizeRoundIndex(raw.roundIndex ?? raw.roundId, idx + 1);
        const roundId = formatSequentialRoundId(raw.roundId ?? raw.roundIndex, roundIdx);
        return {
          ...raw,
          roundId,
          roundIndex: roundIdx,
          date: dateStr,
          year: raw.year || parseInt(yStr, 10) || meta.year,
          month: raw.month || parseInt(mStr, 10) || meta.month,
          day: raw.day || parseInt(dStr, 10) || meta.day,
          timestamp: ts,
        };
      });
      // Sort newest-first so index 0 is always the most recent result across all devices
      docs.sort((a, b) => {
        if ((b.timestamp || 0) !== (a.timestamp || 0)) return (b.timestamp || 0) - (a.timestamp || 0);
        return (b.roundIndex || 0) - (a.roundIndex || 0);
      });
      onUpdate(docs);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, 'draw_history');
    }
  );
}

// 3. Subscribe to Live Bets (bets) via onSnapshot so Admin Panel sees real-time actual wagers across all devices
export function subscribeToBets(
  onUpdate: (bets: BetHistoryRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, 'bets');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const rawDocs = snapshot.docs.map((d) => d.data() as BetHistoryRecord);
      const normalized = normalizeRealBetRecords(rawDocs);
      onUpdate(normalized);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, 'bets');
    }
  );
}

// 4. Subscribe to Transactions (transactions) via onSnapshot
export function subscribeToTransactions(
  onUpdate: (txs: TransactionRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, 'transactions');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data() as TransactionRecord);
      docs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(docs);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, 'transactions');
    }
  );
}

// Write / Merge Authoritative Game State to Firestore
export async function updateFirestoreGameState(state: Partial<FirestoreGameState>) {
  const docRef = doc(db, 'game_state', 'current');
  const payload = sanitizeGameStatePayload(state);
  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'game_state/current');
  }
}

// Write / Merge Official Draw Result to Firestore
export async function addFirestoreDrawResult(result: DrawResult) {
  const roundIdx = normalizeRoundIndex(result.roundIndex ?? result.roundId, 1);
  const seqRoundId = formatSequentialRoundId(result.roundId ?? result.roundIndex, roundIdx);
  const safeId = seqRoundId.replace(/[^a-zA-Z0-9_\-#]/g, '_').slice(0, 128);
  const docRef = doc(db, 'draw_history', safeId);
  const ts = Number(result.timestamp) || Date.now();
  const meta = getDateTimeMetadata(new Date(ts));
  const dateStr = result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? result.date : meta.date;
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = result.year || parseInt(yStr, 10) || meta.year;
  const month = result.month || parseInt(mStr, 10) || meta.month;
  const day = result.day || parseInt(dStr, 10) || meta.day;

  try {
    await setDoc(
      docRef,
      {
        roundId: seqRoundId.slice(0, 64),
        roundIndex: roundIdx,
        date: dateStr.slice(0, 16),
        year,
        month,
        day,
        time: String(result.time || meta.shortTime).slice(0, 32),
        number: Math.min(12, Math.max(1, Number(result.number) || 1)),
        animal: String(result.animal).slice(0, 32),
        color: result.color,
        size: result.size,
        parity: result.parity,
        timestamp: ts,
        savedAt: new Date().toISOString().slice(0, 64),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `draw_history/${safeId}`);
  }
}

// Delete Draw Result from Firestore
export async function deleteFirestoreDrawResult(roundId: string) {
  const safeIds = [
    String(roundId).replace('#', '_'),
    String(roundId).replace(/[^a-zA-Z0-9_\-#]/g, '_'),
  ];
  for (const id of Array.from(new Set(safeIds))) {
    try {
      await deleteDoc(doc(db, 'draw_history', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `draw_history/${id}`);
    }
  }
}

// Record Actual Player Bet to Firestore so Admin Panel receives it immediately via onSnapshot
export async function addFirestoreBetRecord(record: BetHistoryRecord) {
  const safeId = String(record.id).replace(/[^a-zA-Z0-9_\-#]/g, '_').slice(0, 128);
  const docRef = doc(db, 'bets', safeId);
  const ts = Number(record.timestamp) || Date.now();
  const meta = getDateTimeMetadata(new Date(ts));
  const dateStr = record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date) ? record.date : meta.date;
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = record.year || parseInt(yStr, 10) || meta.year;
  const month = record.month || parseInt(mStr, 10) || meta.month;
  const day = record.day || parseInt(dStr, 10) || meta.day;
  const ticketId = String(record.ticketId || '0001').padStart(4, '0').slice(0, 16);

  try {
    await setDoc(
      docRef,
      {
        id: safeId,
        ticketId,
        userId: (auth.currentUser?.uid || record.userId || 'player_1').slice(0, 128),
        roundId: String(record.roundId).slice(0, 64),
        date: dateStr.slice(0, 16),
        year,
        month,
        day,
        time: String(record.time || meta.time).slice(0, 32),
        timestamp: ts,
        isRealBet: true,
        bets: (record.bets || []).slice(0, 50),
        totalStake: Math.max(1, Number(record.totalStake) || 1000),
        totalPotentialPayout: Number(record.totalPotentialPayout) || 0,
        totalPayout: Number(record.totalPayout) || 0,
        netProfit: Number(record.netProfit) || 0,
        ...(typeof record.resultNumber === 'number' ? { resultNumber: record.resultNumber } : {}),
        status: record.status || 'pending',
        createdAt: new Date().toISOString().slice(0, 64),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `bets/${safeId}`);
  }
}

// Upsert Transaction Record (Deposit / Withdrawal) to Firestore
export async function upsertFirestoreTransaction(tx: TransactionRecord) {
  const safeId = String(tx.id).replace(/[^a-zA-Z0-9_\-#]/g, '_').slice(0, 128);
  const docRef = doc(db, 'transactions', safeId);
  try {
    await setDoc(
      docRef,
      {
        id: safeId,
        userName: String(tx.userName || 'អតិថិជន Player #1').slice(0, 128),
        userPhone: String(tx.userPhone || '012 888 999').slice(0, 64),
        type: tx.type || 'deposit',
        amount: Math.max(1, Number(tx.amount) || 1000),
        method: String(tx.method || 'ABA Bank').slice(0, 64),
        status: tx.status || 'pending',
        timestamp: Number(tx.timestamp) || Date.now(),
        timeString: String(tx.timeString || '').slice(0, 32),
        note: String(tx.note || '').slice(0, 256),
        updatedAt: new Date().toISOString().slice(0, 64),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${safeId}`);
  }
}
