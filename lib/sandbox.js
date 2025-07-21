'use strict';

var _ = require('lodash');
var units = require('./units')();
var times = require('./times');

function init () {
  var sbx = {};

  function reset () {
    sbx.properties = {};
  }

  function extend () {
    sbx.unitsLabel = unitsLabel();
    sbx.data = sbx.data || {};
    //default to prevent adding checks everywhere
    sbx.extendedSettings = { empty: true };
  }

  function attachMethods (sandbox) {
    // Attach all utility methods to the sandbox instance
    
    /**
     * Properties are immutable, first plugin to set it wins, plugins should be in the correct order
     *
     * @param name
     * @param setter
     */
    sandbox.offerProperty = function offerProperty (name, setter) {
      if (!Object.keys(sandbox.properties).includes(name)) {
        var value = setter();
        if (value) {
          sandbox.properties[name] = value;
        }
      }
    };

    sandbox.isCurrent = function isCurrent (entry) {
      return entry && sandbox.time - entry.mills <= times.mins(15).msecs;
    };

    sandbox.lastEntry = function lastEntry (entries) {
      // For SGVs, we want the most recent entry that's not in the future
      // First filter out future entries, then get the one with highest mills
      var validEntries = _.filter(entries, function notInTheFuture (entry) {
        return sandbox.entryMills(entry) <= sandbox.time;
      });
      
      return _.maxBy(validEntries, function (entry) {
        return sandbox.entryMills(entry);
      });
    };

    sandbox.lastNEntries = function lastNEntries (entries, n) {
      var lastEntries = _.chain(entries)
        .filter(function notInTheFuture (entry) {
          return sandbox.entryMills(entry) <= sandbox.time;
        })
        .sortBy(function (entry) { return sandbox.entryMills(entry) * -1; })
        .take(n)
        .value();

      return lastEntries;
    };

    sandbox.prevEntry = function prevEntry (entries) {
      var last2 = sandbox.lastNEntries(entries, 2);
      return _.first(last2);
    };

    sandbox.prevSGVEntry = function prevSGVEntry () {
      return sandbox.prevEntry(sandbox.data.sgvs);
    };

    sandbox.lastSGVEntry = function lastSGVEntry () {
      return sandbox.lastEntry(sandbox.data.sgvs);
    };

    sandbox.lastSGVMgdl = function lastSGVMgdl () {
      var last = sandbox.lastSGVEntry();
      return last && last.mgdl;
    };

    sandbox.lastSGVMills = function lastSGVMills () {
      return sandbox.entryMills(sandbox.lastSGVEntry());
    };

    sandbox.entryMills = function entryMills (entry) {
      return entry && entry.mills;
    };

    sandbox.lastScaledSGV = function lastScaledSVG () {
      return sandbox.scaleEntry(sandbox.lastSGVEntry());
    };

    sandbox.lastDisplaySVG = function lastDisplaySVG () {
      return sandbox.displayBg(sandbox.lastSGVEntry());
    };

    sandbox.buildBGNowLine = function buildBGNowLine () {
      var line = 'BG Now: ' + sandbox.lastDisplaySVG();

      var delta = sandbox.properties.delta && sandbox.properties.delta.display;
      if (delta) {
        line += ' ' + delta;
      }

      var direction = sandbox.properties.direction && sandbox.properties.direction.label;
      if (direction) {
        line += ' ' + direction;
      }

      line += ' ' + sandbox.unitsLabel;

      return line;
    };

    sandbox.propertyLine = function propertyLine (propertyName) {
      return sandbox.properties[propertyName] && sandbox.properties[propertyName].displayLine;
    };

    sandbox.appendPropertyLine = function appendPropertyLine (propertyName, lines) {
      lines = lines || [];

      var displayLine = sandbox.propertyLine(propertyName);
      if (displayLine) {
        lines.push(displayLine);
      }

      return lines;
    };

    sandbox.prepareDefaultLines = function prepareDefaultLines () {
      var lines = [sandbox.buildBGNowLine()];
      sandbox.appendPropertyLine('rawbg', lines);
      sandbox.appendPropertyLine('ar2', lines);
      sandbox.appendPropertyLine('bwp', lines);
      sandbox.appendPropertyLine('iob', lines);
      sandbox.appendPropertyLine('cob', lines);

      return lines;
    };

    sandbox.buildDefaultMessage = function buildDefaultMessage () {
      return sandbox.prepareDefaultLines().join('\n');
    };

    sandbox.displayBg = function displayBg (entry) {
      if (Number(entry.mgdl) === 39) {
        return 'LOW';
      } else if (Number(entry.mgdl) === 401) {
        return 'HIGH';
      } else {
        return sandbox.scaleEntry(entry);
      }
    };

    sandbox.scaleEntry = function scaleEntry (entry) {

      if (entry && entry.scaled === undefined) {
        if (sandbox.settings.units === 'mmol') {
          entry.scaled = entry.mmol || units.mgdlToMMOL(entry.mgdl);
        } else {
          entry.scaled = entry.mgdl || units.mmolToMgdl(entry.mmol);
        }
      }

      return entry && entry.scaled;
    };

    sandbox.scaleBg = function scaleBg (bg) {

      if (sandbox.settings.units === 'mmol') {
        return units.mgdlToMMOL(bg);
      } else {
        return bg;
      }

    };

    sandbox.roundInsulinForDisplayFormat = function roundInsulinForDisplayFormat (insulin) {

      if (insulin === 0) {
        return '0';
      }

      if (sandbox.properties.roundingStyle === 'medtronic') {
        var denominator = 0.1;
        var digits = 1;
        if (insulin <= 0.5) {
          denominator = 0.05;
          digits = 2;
        }
        return (Math.floor(insulin / denominator) * denominator).toFixed(digits);
      }

      return (Math.floor(insulin / 0.01) * 0.01).toFixed(2);

    };

    sandbox.roundBGToDisplayFormat = function roundBGToDisplayFormat (bg) {
      return sandbox.settings.units === 'mmol' ? Math.round(bg * 10) / 10 : Math.round(bg);
    };

    return sandbox;
  }

  function withExtendedSettings (plugin, allExtendedSettings, sbx) {
    var sbx2 = _.extend({}, sbx);
    sbx2.extendedSettings = allExtendedSettings && allExtendedSettings[plugin.name] || {};
    return sbx2;
  }

  /**
   * A view into the safe notification functions for plugins
   *
   * @param ctx
   * @returns  {{notification}}
   */
  function safeNotifications (ctx) {
    return _.pick(ctx.notifications, ['requestNotify', 'requestSnooze', 'requestClear']);
  }

  /**
   * Initialize the sandbox using server state
   *
   * @param env - .js
   * @param ctx - created from bootevent
   * @returns {{sbx}}
   */
  sbx.serverInit = function serverInit (env, ctx) {
    reset();

    sbx.runtimeEnvironment = 'server';
    sbx.runtimeState = ctx.runtimeState;
    sbx.time = Date.now();
    sbx.settings = env.settings;
    sbx.data = ctx.ddata.clone();
    sbx.notifications = safeNotifications(ctx);

    sbx.levels = ctx.levels;
    sbx.language = ctx.language;
    sbx.translate = ctx.language.translate;

    var profile = require('./profilefunctions')(null, ctx);
    //Plugins will expect the right profile based on time
    profile.loadData(_.cloneDeep(ctx.ddata.profiles));
    profile.updateTreatments(ctx.ddata.profileTreatments, ctx.ddata.tempbasalTreatments, ctx.ddata.combobolusTreatments);
    sbx.data.profile = profile;
    delete sbx.data.profiles;

    sbx.properties = {};

    sbx.withExtendedSettings = function getPluginExtendedSettingsOnly (plugin) {
      return withExtendedSettings(plugin, env.extendedSettings, sbx);
    };

    extend();
    attachMethods(sbx);

    return sbx;
  };

  /**
   * Initialize the sandbox using client state
   *
   * @param settings - specific settings from the client, starting with the defaults
   * @param time - could be a retro time
   * @param pluginBase - used by visualization plugins to update the UI
   * @param data - svgs, treatments, profile, etc
   * @returns {{sbx}}
   */
  sbx.clientInit = function clientInit (ctx, time, data) {
    reset();

    sbx.runtimeEnvironment = 'client';
    sbx.settings = ctx.settings;
    sbx.showPlugins = ctx.settings.showPlugins;
    sbx.time = time;
    sbx.data = data;
    
    // Ensure SGVs are sorted oldest to newest for bucket calculations
    if (sbx.data && sbx.data.sgvs && Array.isArray(sbx.data.sgvs)) {
      sbx.data.sgvs.sort(function(a, b) {
        return a.mills - b.mills;
      });
    }
    
    sbx.pluginBase = ctx.pluginBase;
    sbx.notifications = safeNotifications(ctx);

    sbx.levels = ctx.levels;
    sbx.language = ctx.language;
    sbx.translate = ctx.language.translate;

    if (sbx.pluginBase) {
      sbx.pluginBase.forecastInfos = [];
      sbx.pluginBase.forecastPoints = {};
    }

    sbx.extendedSettings = { empty: true };
    sbx.withExtendedSettings = function getPluginExtendedSettingsOnly (plugin) {
      return withExtendedSettings(plugin, sbx.settings.extendedSettings, sbx);
    };

    extend();
    attachMethods(sbx);

    return sbx;
  };

  function unitsLabel () {
    return sbx.settings.units === 'mmol' ? 'mmol/L' : 'mg/dl';
  }

  return sbx;
}

module.exports = init;