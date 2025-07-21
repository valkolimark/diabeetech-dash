'use strict';

var times = require('../times');
var consts = require('../constants');

function init (ctx) {
  var clock = {
    name: 'clock'
    , label: 'Clock Views'
    , pluginType: 'clock'
  };

  clock.setProperties = function setProperties (sbx) {
    sbx.offerProperty('clock', function setProp ( ) {
      return {
        enabled: true
      };
    });
  };

  clock.checkNotifications = function checkNotifications (sbx) {
  };

  clock.updateVisualisation = function updateVisualisation (sbx) {
  };

  return clock;
}

module.exports = init;