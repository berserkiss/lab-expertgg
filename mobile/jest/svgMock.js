// Stands in for an .svg imported as a component. The tests care about
// behaviour, not about what the icon renders.
const React = require('react');
module.exports = {
  __esModule: true,
  default: props => React.createElement('Svg', props, null),
};
