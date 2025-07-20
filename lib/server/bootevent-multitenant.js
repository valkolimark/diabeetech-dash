'use strict';

const _ = require('lodash');
const UPDATE_THROTTLE = 5000;

function boot (env, language) {

  function startBoot(ctx, next) {
    console.log('Executing startBoot (Multi-tenant)');

    ctx.bootErrors = [ ];
    ctx.moment = require('moment-timezone');
    ctx.runtimeState = 'booting';
    ctx.settings = env.settings;
    ctx.bus = require('../bus')(env.settings, ctx);
    ctx.adminnotifies = require('../adminnotifies')(ctx);
    
    // Initialize multi-tenant components
    ctx.multiTenant = {
      enabled: env.MULTI_TENANT_ENABLED !== 'false',
      connectionManager: null,
      models: {}
    };
    
    if (env.notifies) {
      for (var i = 0; i < env.notifies.length; i++) {
        ctx.adminnotifies.addNotify(env.notifies[i]);
      }
    }
    next();
  }

  function checkNodeVersion (ctx, next) {
    console.log('Executing checkNodeVersion');

    var semver = require('semver');
    var nodeVersion = process.version;
    const isLTS = process.release.lts ? true : false;

    if (isLTS && (semver.satisfies(nodeVersion, '^20.0.0') || semver.satisfies(nodeVersion, '^18.0.0') || semver.satisfies(nodeVersion, '^16.0.0') || semver.satisfies(nodeVersion, '^14.0.0'))) {
      console.debug('Node LTS version ' + nodeVersion + ' is supported');
      next();
      return;
    }

    console.log( 'ERROR: Node version ' + nodeVersion + ' is not supported. Please use a secure LTS version or upgrade your Node');
    process.exit(1);
  }

  function checkEnv (ctx, next) {
    console.log('Executing checkEnv');

    ctx.language = language;
    if (env.err.length > 0) {
      ctx.bootErrors = ctx.bootErrors || [ ];
      ctx.bootErrors.push({'desc': 'ENV Error', err: env.err});
    }
    
    // Check multi-tenant specific environment variables
    if (ctx.multiTenant.enabled) {
      if (!env.MASTER_MONGODB_URI && !env.storageURI) {
        ctx.bootErrors.push({
          desc: 'Multi-tenant ENV Error',
          err: 'MASTER_MONGODB_URI or MONGODB_URI required for multi-tenant mode'
        });
      }
      
      if (!env.JWT_SECRET) {
        console.warn('JWT_SECRET not set, using default. This is insecure for production!');
      }
    }
    
    next();
  }

  function hasBootErrors(ctx) {
    return ctx.bootErrors && ctx.bootErrors.length > 0;
  }

  function augmentSettings (ctx, next) {
    console.log('Executing augmentSettings');

    var configURL = env.IMPORT_CONFIG || null;
    var url = require('url');
    var href = null;

    if (configURL) {
      try {
        href = url.parse(configURL).href;
      } catch (e) {
        console.error('Parsing config URL from IMPORT_CONFIG failed');
      }
    }

    if(configURL && href) {
      var axios_default = { headers: { 'Accept': 'application/json' } };
      var axios = require('axios').create(axios_default);
      console.log('Getting settings from', href);
      return axios.get(href).then(function (resp) {
        var body = resp.data;
        var settings = body.settings || body;
        console.log('extending settings with', settings);
        _.merge(env.settings, settings);
        if (body.extendedSettings) {
          console.log('extending extendedSettings with', body.extendedSettings);
          _.merge(env.extendedSettings, body.extendedSettings);
        }
        next( );
      }).catch(function (err) {
        console.log('IMPORT_CONFIG failed', err);
        ctx.bootErrors = ctx.bootErrors || [ ];
        ctx.bootErrors.push({'desc': 'IMPORT_CONFIG Failed', err: err});
        next();
      });
    } else {
      next();
    }
  }

  function setupStorage (ctx, next) {
    if (hasBootErrors(ctx)) {
      return next();
    }

    console.log('Executing setupStorage (Multi-tenant)');
    
    if (ctx.multiTenant.enabled) {
      // Initialize connection manager
      ctx.multiTenant.connectionManager = require('../utils/connectionManager')(env);
      
      // Initialize master database connection
      ctx.multiTenant.connectionManager.initMaster()
        .then(masterDb => {
          console.log('Master database initialized for multi-tenant');
          
          // Set up master store
          ctx.store = {
            db: masterDb,
            collection: function(name) {
              return masterDb.collection(name);
            },
            client: {
              close: async function() {
                await ctx.multiTenant.connectionManager.closeAll();
              }
            }
          };
          
          // Initialize models
          ctx.multiTenant.models.tenant = require('../models/tenant')(env, ctx);
          ctx.multiTenant.models.user = require('../models/user')(env, ctx);
          
          // Ensure indexes
          Promise.all([
            ctx.multiTenant.models.tenant.ensureIndexes(),
            ctx.multiTenant.models.user.ensureIndexes()
          ]).then(() => {
            console.log('Multi-tenant indexes created');
            next();
          }).catch(err => {
            console.error('Failed to create multi-tenant indexes:', err);
            ctx.bootErrors.push({'desc': 'Multi-tenant Index Error', err: err});
            next();
          });
        })
        .catch(err => {
          console.error('Failed to initialize master database:', err);
          ctx.bootErrors.push({'desc': 'Multi-tenant Storage Error', err: err});
          next();
        });
    } else {
      // Fall back to single-tenant storage
      require('../storage/mongo-storage')(env, function(err, store) {
        if (err) {
          console.log('ERROR CONNECTING TO MONGO', err);
          ctx.bootErrors.push({'desc': 'Storage Error', err: err});
        }
        console.log('Storage system ready (Single-tenant)');
        ctx.store = store;
        next();
      });
    }
  }

  function setupAPISecret (ctx, next) {
    if (hasBootErrors(ctx)) {
      return next();
    }

    console.log('Executing setupAPISecret');
    
    // In multi-tenant mode, API_SECRET is optional (used for system admin access)
    if (ctx.multiTenant.enabled && !env.enclave.isApiKeySet()) {
      console.log('Multi-tenant mode: API_SECRET not required, using JWT authentication');
    }
    
    ctx.apiSecret = env.api_secret;
    next();
  }

  function ensureIndexes (ctx, next) {
    if (hasBootErrors(ctx)) {
      return next();
    }

    console.log('Executing ensureIndexes');
    
    if (ctx.multiTenant.enabled) {
      // Indexes are created per tenant database, not in master
      console.log('Multi-tenant mode: Indexes will be created per tenant');
      next();
    } else {
      // Original single-tenant index creation
      ctx.store.ensureIndexes(ctx.entries(), ctx.entries.indexedFields);
      ctx.store.ensureIndexes(ctx.treatments(), ctx.treatments.indexedFields);
      ctx.store.ensureIndexes(ctx.devicestatus(), ctx.devicestatus.indexedFields);
      ctx.store.ensureIndexes(ctx.profile(), ctx.profile.indexedFields);
      ctx.store.ensureIndexes(ctx.food(), ctx.food.indexedFields);
      ctx.store.ensureIndexes(ctx.activity(), ctx.activity.indexedFields);
      next();
    }
  }

  function setupListeners (ctx, next) {
    if (hasBootErrors(ctx)) {
      return next();
    }

    console.log('Executing setupListeners');
    
    // In multi-tenant mode, data loaders are set up per request
    if (ctx.multiTenant.enabled) {
      console.log('Multi-tenant mode: Data listeners will be set up per tenant');
      next();
    } else {
      // Original single-tenant listener setup
      var dataloader = require('../data/dataloader')(env, ctx);
      ctx.dataloader = dataloader;
      ctx.entries = require('../server/entries')(env, ctx);
      ctx.treatments = require('../server/treatments')(env, ctx);
      ctx.devicestatus = require('../server/devicestatus')(env, ctx);
      ctx.profile = require('../server/profile')(env, ctx);
      ctx.food = require('../server/food')(env, ctx);
      ctx.activity = require('../server/activity')(env, ctx);
      
      ctx.bus.on('tick', function timedReloadData (tick) {
        dataloader.update(tick);
      });
      
      ctx.bus.on('data-received', function forceReloadData () {
        dataloader.update({ type: 'data-received' }, true);
      });
      
      ctx.bus.on('data-loaded', function updatePlugins (sbx) {
        ctx.ddata.sgvs = sbx.data.sgvs;
        ctx.ddata.treatments = sbx.data.treatments;
        ctx.ddata.profiles = sbx.data.profiles;
        ctx.ddata.devicestatus = sbx.data.devicestatus;
        ctx.ddata.food = sbx.data.food;
        ctx.ddata.activity = sbx.data.activity;
        
        ctx.ddata.processRawData(ctx.settings);
        
        ctx.bus.emit('data-processed');
      });
      
      ctx.bus.on('data-processed', function processed () {
        ctx.bus.emit('tick', {
          type: 'data-processed',
          now: Date.now()
        });
      });
      
      ctx.bus.on('notification', ctx.pushnotify.emitNotification);
      
      next();
    }
  }

  function finishBoot (ctx, next) {
    console.log('Executing finishBoot');

    // Set up middleware
    ctx.wares = require('../middleware/')(env);
    
    // Set up authorization
    ctx.authorization = require('../authorization')(env, ctx);
    
    // Set up data handler
    ctx.ddata = require('../data/ddata')();
    
    // Set up plugins
    ctx.plugins = require('../plugins')({
      settings: env.settings
      , language: ctx.language
    });

    // Initialize notifications and push services
    ctx.pushover = require('../plugins/pushover')(env, ctx);
    ctx.maker = require('../plugins/maker')(env);
    ctx.pushnotify = require('./pushnotify')(env, ctx);
    ctx.notifications = require('../notifications')(env, ctx);

    ctx.runtimeState = 'booted';
    ctx.bus.uptime( );
    
    // Initialize bridge manager for multi-tenant data collection
    if (ctx.multiTenant.enabled) {
      ctx.bridgeManager = require('../services/bridge-manager')(env, ctx);
      // Initialize bridges after boot completes
      process.nextTick(() => {
        ctx.bridgeManager.initializeAll().catch(err => {
          console.error('Failed to initialize bridge manager:', err);
        });
      });
    }

    if (hasBootErrors(ctx)) {
      console.log('UNABLE TO BOOT SERVER DUE TO ERRORS');
      return next();
    }

    if (ctx.multiTenant.enabled) {
      // In multi-tenant mode, we're always "loaded" since data is loaded per tenant
      ctx.runtimeState = 'loaded';
      console.log('Nightscout Multi-tenant server ready');
    } else {
      console.log('Nightscout Single-tenant server ready');
    }
    
    next( );
  }

  return {
    boot: function booted (booted_callback) {
      const steps = [
        startBoot,
        checkNodeVersion,
        checkEnv,
        augmentSettings,
        setupStorage,
        setupAPISecret,
        ensureIndexes,
        setupListeners,
        finishBoot
      ];

      let currentStep = 0;
      
      function next (err) {
        if (err) {
          console.error('Boot error at step', currentStep, ':', err);
          ctx.bootErrors = ctx.bootErrors || [];
          ctx.bootErrors.push({ desc: 'Boot Step Error', err: err });
        }
        
        currentStep++;
        
        if (currentStep < steps.length) {
          steps[currentStep](ctx, next);
        } else {
          booted_callback(ctx);
        }
      }
      
      const ctx = {
        env: env,
        language: language,
        settings: env.settings,
        bus: null,
        multiTenant: {
          enabled: env.MULTI_TENANT_ENABLED !== 'false'
        }
      };
      
      steps[0](ctx, next);
    }
  };
}

module.exports = function(env, language) {
  const bootInstance = boot(env, language);
  // Make it compatible with both patterns
  bootInstance.boot = bootInstance.boot || function(cb) { cb({}); };
  return bootInstance;
};