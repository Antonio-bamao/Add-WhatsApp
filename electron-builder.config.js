const packageJson = require('./package.json');

const signingConfigured = Boolean(
  process.env.CSC_LINK
  || process.env.WIN_CSC_LINK
  || process.env.CSC_NAME
);

module.exports = {
  ...packageJson.build,
  win: {
    ...packageJson.build.win,
    signAndEditExecutable: signingConfigured
  }
};
