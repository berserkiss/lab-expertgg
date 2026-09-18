/**
 * What the Play screen costs under ordinary use.
 *
 * The only one of the three that is a load test in the usual sense. It asks
 * nothing about correctness: it reads the match list and pages through it
 * the way a scrolling user does, and reports what that costs. The list is
 * the most expensive read in the app - a join across tournament, game and
 * both teams, plus a per-match "has this user bet on it" lookup - so it is
 * the one worth watching.
 *
 *   k6 run loadtest/browse.js
 *
 * Read-only, so unlike the other two it can be run repeatedly without
 * re-seeding. Look at p(95), not the average: the average hides the tail,
 * and the tail is what a person actually feels.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8000';
const EMAIL = __ENV.EMAIL || 'api-tests@example.com';
const PASSWORD = __ENV.PASSWORD || 'api-tests-password';

export const options = {
  scenarios: {
    scrolling: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 10 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    'checks{kind:ok}': ['rate==1'],
    // Not a service-level objective anybody agreed to - a line in the sand,
    // so a change that makes the list ten times slower fails rather than
    // being noticed a month later. Move it when you have a real number.
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

function authed(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
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
  return { token: login.json('access') };
}

export default function (data) {
  const first = http.get(`${BASE}/api/matches/`, authed(data.token));
  check(first, {
    'first page is served': r => r.status === 200,
    'first page has rows': r => r.json('results').length > 0,
  }, { kind: 'ok' });

  // One page further, as a user reaching the end of the screen would.
  const next = first.json('next');
  if (next) {
    const second = http.get(next, authed(data.token));
    check(second, { 'next page is served': r => r.status === 200 }, { kind: 'ok' });
  }

  // Think time. Without it this measures how fast k6 can shout, not what
  // the server does under a load shaped like people using it.
  sleep(1);
}
