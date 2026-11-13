import React, { useMemo } from 'react';
import { DrawResult, ANIMALS_DATA } from '../types';
import { CountdownSyncSegment } from '../utils/countdownAudioSync';
import { BowlDrawArea } from './BowlDrawArea';

export interface Side2BowlArenaProps {
  countdown: number;
  isRevealing: boolean;
  revealStep: number;
  latestResult: DrawResult | null;
  drawMix?: number[];
  forcedWinningNumber?: number | null;
  currentRoundId?: string;
  onBowlClick?: (index: number) => void;
  onTriggerDraw?: () => void;
  audioSyncSegment?: CountdownSyncSegment | null;
  isBettingClosed?: boolean;
  onTrigger10sCountdown?: () => void;
  onBlockedAttempt?: () => void;
}

/**
 * Calculates the authoritative 12-bowl reveal sequence based on `currentRoundId`
 * and result/forcedWinningNumber data pulled from the Firestore database (not local client clocks).
 *
 * Guarantees:
 * 1. All 12 bowls (Positions 1..12) contain a unique permutation of numbers 1..12.
 * 2. If `forcedNum` (or authoritative winning result) is configured in Firestore,
 *    Position 12 (index 11, the central winning bowl) is strictly aligned to `forcedNum`.
 * 3. Every client device across any network or location computes the exact same
 *    reveal sequence for a given `roundId` and Firestore configuration.
 */
export function calculateRevealSequence(
  roundId: string,
  forcedNum?: number | null,
  firestoreDrawMix?: number[]
): number[] {
  const validForced =
    typeof forcedNum === 'number' && forcedNum >= 1 && forcedNum <= 12
      ? Math.floor(forcedNum)
      : null;

  // If Firestore provides a complete 12-number mix that already aligns with the configured outcome, use it
  if (
    Array.isArray(firestoreDrawMix) &&
    firestoreDrawMix.length === 12 &&
    new Set(firestoreDrawMix).size === 12 &&
    (!validForced || firestoreDrawMix[11] === validForced)
  ) {
    return firestoreDrawMix;
  }

  // Deterministic avalanche hash from roundId (FNV-1a + MurmurHash3 finalizer)
  const normalizedId = String(roundId || '2004#284').trim();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < normalizedId.length; i++) {
    h ^= normalizedId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  let state = h >>> 0;

  // Mulberry32 deterministic PRNG seeded by roundId
  const nextRand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Deterministic Fisher-Yates shuffle of 1..12
  const mix = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (let i = mix.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [mix[i], mix[j]] = [mix[j], mix[i]];
  }

  // Align index 11 (12th central bowl / final winning result) with the official Firestore configuration
  if (validForced !== null) {
    const currentIdx = mix.indexOf(validForced);
    if (currentIdx !== -1 && currentIdx !== 11) {
      [mix[currentIdx], mix[11]] = [mix[11], mix[currentIdx]];
    } else {
      mix[11] = validForced;
    }
  }

  return mix;
}

export const Side2BowlArena: React.FC<Side2BowlArenaProps> = (props) => {
  const {
    currentRoundId = '2004#284',
    forcedWinningNumber,
    latestResult,
    drawMix,
    isRevealing,
  } = props;

  // Determine the authoritative winning number from Firestore configuration
  const authoritativeWinningNumber = useMemo(() => {
    if (
      typeof forcedWinningNumber === 'number' &&
      forcedWinningNumber >= 1 &&
      forcedWinningNumber <= 12
    ) {
      return forcedWinningNumber;
    }
    if (
      isRevealing &&
      latestResult &&
      typeof latestResult.number === 'number' &&
      latestResult.number >= 1 &&
      latestResult.number <= 12
    ) {
      return latestResult.number;
    }
    return null;
  }, [forcedWinningNumber, isRevealing, latestResult]);

  // Calculate aligned 12-bowl reveal sequence from currentRoundId and Firestore result data
  const alignedDrawMix = useMemo(() => {
    return calculateRevealSequence(
      currentRoundId,
      authoritativeWinningNumber,
      drawMix
    );
  }, [currentRoundId, authoritativeWinningNumber, drawMix]);

  // Ensure the displayed winning result in the 12th central bowl strictly matches alignedDrawMix[11] during reveal
  const alignedResult = useMemo<DrawResult | null>(() => {
    if (!isRevealing) {
      return latestResult;
    }
    const finalWinningNum = alignedDrawMix[11] || latestResult?.number || 1;
    const animalData = ANIMALS_DATA[finalWinningNum];
    if (!animalData) return latestResult;

    const roundParts = currentRoundId.split('#');
    const roundIdx = parseInt(roundParts[1] || '284', 10) || 284;

    return {
      roundId: currentRoundId,
      roundIndex: latestResult?.roundIndex || roundIdx,
      time: latestResult?.time || '16:22',
      number: finalWinningNum,
      animal: animalData.khmerName,
      color: animalData.color,
      size: animalData.size,
      parity: animalData.parity,
      timestamp: latestResult?.timestamp || Date.now(),
    };
  }, [isRevealing, alignedDrawMix, latestResult, currentRoundId]);

  return (
    <BowlDrawArea
      {...props}
      drawMix={alignedDrawMix}
      latestResult={alignedResult}
    />
  );
};

export default Side2BowlArena;
