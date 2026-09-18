/**
 * Can fifty simultaneous bets spend the same gg twice?
 *
 * This is a correctness test wearing a load test's clothes. Throughput is
 * beside the point - the question is whether `select_for_update` in
 * betting.place_bet actually serialises fifty real connections through real
 * worker processes, the way it does two threads in a unit test.
 *
 * The expected answer is arithmetic, not a guess: with a stake of exactly a
 * tenth of the balance, ten bets can succeed and forty cannot, the final
 * balance is zero, and it is never negative on the way there.
 *
 *   k6 run loadtest/overdraft.js
 *
 * Re-seed before every run (see loadtest/README.md) - this one spends the
 * fixture's whole balance, so a second run against an empty wallet proves
 * nothing while still reporting success.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8000';
const EMAIL = __ENV.EMAIL || 'api-tests@example.com';
const PASSWORD = __ENV.PASSWORD || 'api-tests-password';
// Fifty by default. Django's development server cannot take a wave that
// size - it drops connections rather than answering them, which fails the
// "answered" gate for a reason that has nothing to do with the code under
// test. Lower it for a local smoke run, or point BASE_URL at a real WSGI
// server (the CI job runs gunicorn, as production does).
const ATTEMPTS = Number(__ENV.ATTEMPTS || 50);

const attempts = new Counter('bets_attempted');
const accepted = new Counter('bets_accepted');
const refused = new Counter('bets_refused');

export const options = {
  scenarios: {
    // One wave rather than a stream: fifty users, fifty attempts between
    // them, all arriving at once. A `duration`-based scenario would spread
    // them out, which is exactly what must not happen here.
    stampede: { executor: 'shared-iterations', vus: ATTEMPTS, iterations: ATTEMPTS, maxDuration: '1m' },
  },
  thresholds: {
    // Nothing but "taken" or "you cannot afford it". A 500, a deadlock or a
    // timeout is the failure this test is looking for.
    'checks{kind:answered}': ['rate==1'],
    // The arithmetic, checked in teardown once the dust settles.
    'checks{kind:settled}': ['rate==1'],
    // A threshold on a metric with no samples passes vacuously, so a run
    // that died in setup would otherwise report every gate green. This one
    // fails unless the wave actually happened.
    bets_attempted: [`count==${ATTEMPTS}`],
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

  const me = http.get(`${BASE}/api/auth/me/`, authed(token)).json();
  const matches = http.get(`${BASE}/api/matches/`, authed(token)).json('results');
  const target = matches.find(m => m.status === 'upcoming' || m.status === 'live');
  if (!target) throw new Error('no bettable match in the fixture');

  // A tenth of the balance, so the number of bets that can possibly succeed
  // is known before a single request is sent.
  const stake = Math.floor(me.balance / 10);
  if (stake < 1) throw new Error(`balance is ${me.balance} - re-run seed_api_tests`);

  return { token, matchId: target.id, teamId: target.team_a.id, stake, startingBalance: me.balance };
}

export default function (data) {
  attempts.add(1);
  const res = http.post(
    `${BASE}/api/matches/${data.matchId}/vote/`,
    JSON.stringify({ predicted_team: data.teamId, stake: data.stake }),
    authed(data.token),
  );

  check(res, { 'accepted or refused, nothing else': r => r.status === 201 || r.status === 400 },
        { kind: 'answered' });

  if (res.status === 201) accepted.add(1);
  else refused.add(1);
}

export function teardown(data) {
  const balance = http.get(`${BASE}/api/auth/me/`, authed(data.token)).json('balance');
  const expectedWinners = data.startingBalance / data.stake;

  console.log(`stake ${data.stake} gg, started at ${data.startingBalance} gg, ended at ${balance} gg`);

  check(balance, {
    // The whole point. If more than ten bets were taken, two of them read
    // the same balance and the wallet paid for one of them twice.
    'spent no more than it had': b => b === data.startingBalance - expectedWinners * data.stake,
    'never went negative': b => b >= 0,
  }, { kind: 'settled' });
}
