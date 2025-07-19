
$ = require("jquery");

window.Nightscout = {
    client: require('../lib/client/clock-client'),
    units: require('../lib/units')(),
};

console.info('Diabeetech clock bundle ready');