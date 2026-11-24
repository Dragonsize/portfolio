import { isInteractiveLab, verifyInteractiveFlag } from './interactive-labs.js';

// Every lab is a request-driven simulation in interactive-labs.js and interactive-labs-extra.js.
// This module is the small public surface the flag verifier uses.
export function verifyFlag(challengeId, flag) { return isInteractiveLab(challengeId) && verifyInteractiveFlag(challengeId, flag); }
export function knownChallenge(challengeId) { return isInteractiveLab(challengeId); }
