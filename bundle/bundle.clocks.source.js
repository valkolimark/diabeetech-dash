
$ = require("jquery");

window.Nightscout = {
    client: require('../lib/client/clock-client'),
    units: require('../lib/units')(),
};

// Create alias for compatibility
window.Diabeetech = window.Nightscout;

console.info('Diabeetech clock bundle ready');