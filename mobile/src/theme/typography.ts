// Central font-size scale, so a design change only needs updating here
// instead of hunting through every screen's StyleSheet for a raw number.
export const typography = {
  h1: { fontSize: 34, lineHeight: 41 }, // screen titles: Play/History/Leaderboard/Account
  h2: { fontSize: 24 }, // secondary screen title (match vote)
  h3: { fontSize: 20 }, // back-arrow glyph, stake stepper, stat values
  h4: { fontSize: 18 }, // Book/Get coins screen titles, key text
  display: { fontSize: 32 }, // empty-state label
  body: { fontSize: 16 }, // primary button labels (Log in / Log out)
  bodySmall: { fontSize: 15 }, // team name, error-state message
  label: { fontSize: 14 }, // leaderboard row text
  caption: { fontSize: 13 }, // general form error text
  small: { fontSize: 12 }, // tab bar label, muted captions, field error text
  tiny: { fontSize: 11 }, // badges, vote button text
};
