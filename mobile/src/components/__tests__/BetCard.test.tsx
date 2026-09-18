/**
 * The history card's four states.
 *
 * A bet's outcome is carried by a colour and a sign, and both are easy to
 * get subtly wrong in a way no type checks: a void bet tinted like a loss, a
 * refund shown as "- 30 gg" when the money came back. The colours are the
 * ones from the frame, so this also stops a palette edit changing what a row
 * means.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import BetCard from '../BetCard';
import { colors } from '../../theme/colors';

jest.mock('../../assets/wallet.svg', () => 'WalletIcon', { virtual: true });

const team = (id: number, name: string) => ({ id, name, logo_url: null });

function bet(overrides: Partial<any> = {}) {
  return {
    id: 1,
    stake: 30,
    amount: 30,
    status: 'active',
    created_at: '2026-09-18T20:15:00Z',
    predicted_team: team(1, 'Alpha'),
    match: {
      id: 10,
      tournament: { id: 1, name: 'Test Cup', game: { id: 1, slug: 'cs', name: 'Counter-Strike' } },
      team_a: team(1, 'Alpha'),
      team_b: team(2, 'Beta'),
      start_time: '2026-09-18T21:00:00Z',
      status: 'upcoming',
      winner: null,
      has_active_bet: true,
      payout_multiplier: 2,
      payout_bonus: 2,
    },
    ...overrides,
  };
}

function render(item: any) {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<BetCard item={item} />);
  });
  return tree!.root;
}

// Every string the card draws, flattened - enough to assert on without
// pinning the layout down.
function texts(root: ReactTestRenderer.ReactTestInstance) {
  return root
    .findAllByType('Text' as any)
    .map(node => node.children.filter(c => typeof c === 'string').join(''))
    .filter(Boolean);
}

function colorOf(root: ReactTestRenderer.ReactTestInstance, label: string) {
  const node = root
    .findAllByType('Text' as any)
    .find(n => n.children.join('') === label);
  const style = ([] as any[]).concat(node!.props.style).filter(Boolean);
  return style.map(s => s.color).filter(Boolean).pop();
}

describe('BetCard', () => {
  it('shows a win as a gain', () => {
    const root = render(bet({ status: 'win', amount: 32 }));
    expect(texts(root)).toContain('Win');
    expect(texts(root)).toContain('+ 32 gg');
    expect(colorOf(root, '+ 32 gg')).toBe(colors.win);
  });

  it('shows a loss as a loss, without a double minus', () => {
    // The API sends the amount already signed for a losing bet.
    const root = render(bet({ status: 'lose', amount: -30 }));
    expect(texts(root)).toContain('Lose');
    expect(texts(root)).toContain('- 30 gg');
    expect(colorOf(root, '- 30 gg')).toBe(colors.lose);
  });

  it('shows a running bet as the stake at risk, unsigned', () => {
    const root = render(bet({ status: 'active', amount: 30 }));
    expect(texts(root)).toContain('Active');
    expect(texts(root)).toContain('30 gg');
  });

  it('shows a refunded bet as neither a win nor a loss', () => {
    // A voided match gives the stake back: no sign, and the neutral outline
    // rather than one of the three result colours.
    const root = render(bet({ status: 'void', amount: 30 }));
    expect(texts(root)).toContain('Void');
    expect(texts(root)).toContain('30 gg');
    expect(colorOf(root, 'Void')).toBe(colors.teamButtonBorder);
    expect(colorOf(root, 'Void')).not.toBe(colors.lose);
  });

  it('names the tournament the bet was placed in', () => {
    const root = render(bet());
    expect(texts(root).join(' ')).toContain('Counter-Strike: Test Cup');
  });
});
