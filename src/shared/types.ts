// Shared contract. Owned by lead. Coordinates normalised 0..1.
export type Vec = { x: number; y: number };

/** Waypoint: position reached at time tMs from round start (linear between waypoints, holds after last). */
export type Waypoint = { t: number; p: Vec };
export type Path = Waypoint[];

export type RoundKind = 'runner' | 'turner' | 'stopper' | 'pair' | 'doubleback';

export type Round = {
  index: number;        // 0..7
  kind: RoundKind;
  paths: Path[];        // one per opponent dot (1 or 2)
  showMs: number;       // visible time, e.g. 2500
  jumpMs: number;       // hidden time skipped after fog, 1500..3000
  marks: Vec[];         // visible map markers where hidden turns/stops/reversals happen (fairness tell); empty for runners
  // answer time = showMs + jumpMs
};

export type Pin = Vec;

export type RoundScore = {
  index: number;
  points: number;       // 0..1000 per round
  track: number;        // 0..1 distance quality
  read: number;         // 0..1 did the pin beat a naive straight-line extrapolation
  errors: number[];     // distance per dot (normalised units), after optimal matching
};

export type SessionResult = {
  total: number;        // sum of points
  track: number;        // mean 0..1
  read: number;         // mean 0..1
  rounds: RoundScore[];
};

export type ScoreEntry = {
  id: string;           // random id
  initials: string;     // /^[A-Z]{3}$/
  total: number;        // integer 0..8000
  track: number;
  read: number;
  seed: number;         // daily seed YYYYMMDD
  at: number;           // epoch ms
};

export type BoardScope = 'today' | 'all';

export type BoardMsg =
  | { type: 'playing'; round: number }
  | { type: 'idle' }
  | { type: 'score'; entry: ScoreEntry };

export const CHANNEL = 'fogtrack';
export const STORE_KEY = 'fogtrack.v1.scores';
export const STORE_CAP = 5000;
export const ROUNDS = 8;
