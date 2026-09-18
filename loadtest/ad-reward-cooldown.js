/**
 * Can ten simultaneous claims collect the same free reward more than once?
 *
 * The other invariant in this system is a clock rather than an amount: the
 * ad reward may be claimed once per cooldown window. `AdRewardView` reads
 * the last reward's timestamp and writes the new one inside a transaction
 * that holds the wallet's row lock, so a second claim arriving in the same
 * millisecond should find the first one already recorded. Nothing proved
 * that under real concurrency.
 *
 *   k6 run loadtest/ad-reward-cooldown.js
 *
 * Deliberately asserts "at most one", not "exactly one": whether a claim is
 * available at all depends on when the wallet last claimed, which is not
 * something this script controls. At most one is the invariant; exactly one
 * would only be a statement about the fixture's recent history.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8000';
const EMAIL = __ENV.EMAIL || 'api-tests@example.com';
const PASSWORD = __ENV.PASSWORD || 'api-tests-password';
const CLAIMS = Number(__ENV.CLAIMS || 10);

const attempts = new Counter('claims_attempted');
const granted = new Counter('rewards_granted');

export const options = {
  scenarios: {
    all_at_once: { executor: 'shared-iterations', vus: CLAIMS, iterations: CLAIMS, maxDuration: '30s' },
  },
  thresholds: {
    'checks{kind:answered}': ['rate==1'],
    'checks{kind:settled}': ['rate==1'],
    // See overdraft.js: without this, a run that never sent a request
    // reports every gate green.
    claims_attempted: [`count==${CLAIMS}`],
  },
};

function authed(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

export function setup() {
  const login = http.post(
    `${BASE}/api/auth/login/`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (login.status !== 200) {
    throw new Error(`login failed (${login.status}) - is the server up and seeded?`);
  }
  const token = login.json('access');
  const status = http.get(`${BASE}/api/wallet/ad-reward/`, authed(token)).json();
  return { token, reward: status.reward, startingBalance: status.balance };
}

export default function (data) {
  attempts.add(1);
  const res = http.post(`${BASE}/api/wallet/ad-reward/`, null, authed(data.token));

  // 200 granted, 429 still on cooldown. Anything else means the lock or the
  // cooldown read went wrong rather than the request being refused.
  check(res, { 'granted or on cooldown, nothing else': r => r.status === 200 || r.status === 429 },
        { kind: 'answered' });

  if (res.status === 200) granted.add(1);
}

export function teardown(data) {
  const balance = http.get(`${BASE}/api/auth/me/`, authed(data.token)).json('balance');
  const gained = balance - data.startingBalance;

  console.log(`${CLAIMS} simultaneous claims, balance moved by ${gained} gg`);

  check(gained, {
    // Either nobody got it (the window was already used) or exactly one did.
    'at most one reward was granted': g => g === 0 || g === data.reward,
    'the balance did not move by an unexplained amount': g => g % data.reward === 0,
  }, { kind: 'settled' });
}
