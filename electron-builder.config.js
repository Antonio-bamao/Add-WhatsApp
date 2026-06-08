const packageJson = require('./package.json');

module.exports = {
  ...packageJson.build,
  win: {
    ...packageJson.build.win,
    signAndEditExecutable: false,
    forceCodeSigning: false
  }
};
