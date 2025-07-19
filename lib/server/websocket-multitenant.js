'use strict';

var times = require('../times');
var calcData = require('../data/calcdelta');
var ObjectID = require('mongodb').ObjectID;
const forwarded = require('forwarded-for');
const jwt = require('jsonwebtoken');

function getRemoteIP (req) {
  const address = forwarded(req, req.headers);
  return address.ip;
}

function init (env, ctx, server) {

  const tenantModel = require('../models/tenant')(env, ctx);
  const connectionManager = require('../utils/connectionManager')(env);

  function websocket () {
    return websocket;
  }

  //var log_yellow = '\x1B[33m';
  var log_green = '\x1B[32m';
  var log_magenta = '\x1B[35m';
  var log_reset = '\x1B[0m';
  var LOG_WS = log_green + 'WS: ' + log_reset;
  var LOG_DEDUP = log_magenta + 'DEDUPE: ' + log_reset;

  var io;
  var watchers = {};  // Changed to object to track per tenant
  var lastData = {};  // Changed to object to track per tenant
  var lastProfileSwitch = {};  // Changed to object to track per tenant

  // TODO: this would be better to have somehow integrated/improved
  var supportedCollections = {
    'treatments': env.treatments_collection
    , 'entries': env.entries_collection
    , 'devicestatus': env.devicestatus_collection
    , 'profile': env.profile_collection
    , 'food': env.food_collection
    , 'activity': env.activity_collection
  };

  // This is little ugly copy but I was unable to pass testa after making module from status and share with /api/v1/status
  function status (tenantId) {
    var versionNum = 0;
    const vString = '' + env.version;
    const verParse = vString.split('.');
    if (verParse) {
      versionNum = 10000 * Number(verParse[0]) + 100 * Number(verParse[1]) + 1 * Number(verParse[2]);
    }

    var apiEnabled = env.enclave.isApiKeySet();
    
    // Get tenant-specific ddata if available
    var tenantDdata = ctx.ddata;  // TODO: make this tenant-specific
    var activeProfile = tenantDdata.lastProfileFromSwitch;

    var info = {
      status: 'ok'
      , name: env.name
      , version: env.version
      , versionNum: versionNum
      , serverTime: new Date().toISOString()
      , apiEnabled: apiEnabled
      , careportalEnabled: apiEnabled && env.settings.enable.indexOf('careportal') > -1
      , boluscalcEnabled: apiEnabled && env.settings.enable.indexOf('boluscalc') > -1
      , settings: env.settings
      , extendedSettings: ctx.plugins && ctx.plugins.extendedClientSettings ? ctx.plugins.extendedClientSettings(env.extendedSettings) : {}
      , tenantId: tenantId
    };

    if (activeProfile) {
      info.activeProfile = activeProfile;
    }
    return info;
  }

  // Authenticate websocket connection
  async function authenticateSocket(socket) {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    // For now, allow connections without initial auth - they'll authenticate via authorize event
    // This is for backwards compatibility with the existing client
    if (!token) {
      console.log(LOG_WS + 'No JWT token in handshake, waiting for authorize event');
      return null; // Will be handled in authorize event
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, env.JWT_SECRET);
      
      // Get tenant information
      const tenant = await tenantModel.findById(decoded.tenantId);
      if (!tenant || !tenant.isActive) {
        socket.emit('error', { message: 'Invalid tenant' });
        socket.disconnect();
        return null;
      }

      // Get tenant database
      const tenantDb = await connectionManager.getTenantDb(tenant);

      return {
        user: decoded,
        tenant: tenant,
        tenantDb: tenantDb
      };
    } catch (err) {
      console.error('Socket authentication error:', err);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
      return null;
    }
  }

  function start () {
    const { Server } = require('socket.io');
    io = new Server(server, {
      // Socket.IO v4 options
      allowEIO3: true, // Allow v3 clients
      transports: ["polling", "websocket"],
      cors: {
        origin: true,
        credentials: true
      },
      perMessageDeflate: {
        threshold: 512
      }
    });

    ctx.bus.on('teardown', function serverTeardown () {
      Object.keys(io.sockets.sockets).forEach(function(s) {
        io.sockets.sockets[s].disconnect(true);
      });
      io.close();
    });
	
    // Multi-tenant data processing
    ctx.bus.on('data-processed', function(data) {
      if (data && data.tenantId) {
        updateForTenant(data.tenantId);
      }
    });

    ctx.bus.on('notification', function(notify) {
      if (notify && notify.tenantId) {
        emitNotificationForTenant(notify);
      }
    });
  }

  async function loadDataForTenant(tenantId, tenantDb) {
    console.log(LOG_WS + 'loading data for tenant', tenantId);
    
    try {
      // Load recent entries (glucose data)
      console.log(LOG_WS + 'Querying entries collection for tenant', tenantId);
      const entries = await tenantDb.collection('entries')
        .find({})
        .sort({ date: -1 })
        .limit(300)
        .toArray();
      console.log(LOG_WS + 'Found', entries.length, 'entries for tenant', tenantId);
      if (entries.length > 0) {
        console.log(LOG_WS + 'Sample entry:', JSON.stringify(entries[0]));
      }
      
      // Load recent treatments
      const treatments = await tenantDb.collection('treatments')
        .find({})
        .sort({ created_at: -1 })
        .limit(100)
        .toArray();
      
      // Load profiles
      const profiles = await tenantDb.collection('profile')
        .find({})
        .toArray();
      
      // Load device status
      const devicestatus = await tenantDb.collection('devicestatus')
        .find({})
        .sort({ created_at: -1 })
        .limit(50)
        .toArray();
      
      // Create data object similar to ddata
      const tenantData = {
        sgvs: entries,
        treatments: treatments,
        profiles: profiles,
        devicestatus: devicestatus,
        mbgs: [],
        cals: [],
        lastUpdated: Date.now()
      };
      
      lastData[tenantId] = tenantData;
      console.log(LOG_WS + 'loaded data for tenant', tenantId, '- entries:', entries.length, 'treatments:', treatments.length);
      
      return tenantData;
    } catch (err) {
      console.error('Error loading data for tenant', tenantId, err);
      return null;
    }
  }

  function updateForTenant(tenantId) {
    if (lastData[tenantId]) {
      console.log(LOG_WS + 'running websocket.update for tenant', tenantId);
      io.to('tenant-' + tenantId).emit('dataUpdate', lastData[tenantId]);
    }
  }

  function emitNotificationForTenant (notify) {
    if (notify.tenantId) {
      io.to('tenant-' + notify.tenantId).emit('notification', notify);
    }
  }

  function listeners () {
    io.sockets.on('connection', async function(socket) {
      var socketAuthorization = null;
      var clientType = null;
      var timeDiff;
      var history;

      var remoteIP = getRemoteIP(socket.request);
      console.log(LOG_WS + 'Connection from client ID: ', socket.client.id, ' IP: ', remoteIP);
      console.log(LOG_WS + 'Socket handshake headers:', socket.handshake.headers.host);

      // Try to authenticate the socket connection
      var authInfo = await authenticateSocket(socket);
      var user = null;
      var tenant = null;
      var tenantDb = null;
      var tenantId = null;
      
      if (authInfo) {
        user = authInfo.user;
        tenant = authInfo.tenant;
        tenantDb = authInfo.tenantDb;
        tenantId = tenant.tenantId;
      
        // Join tenant-specific room
        socket.join('tenant-' + tenantId);
        
        // Initialize tenant tracking if needed
        if (!watchers[tenantId]) {
          watchers[tenantId] = 0;
        }
        if (!lastData[tenantId]) {
          lastData[tenantId] = {};
        }
      }

      // Create tenant-specific context (even without auth for authorize event)
      var tenantCtx = null;
      if (tenantDb) {
        tenantCtx = Object.create(ctx);
        tenantCtx.store = {
          db: tenantDb,
          collection: function(name) {
            return tenantDb.collection(name);
          }
        };
      }

      socket.on('ack', function onAck (level, message, title) {
        ctx.notifications.ack(level, times.calc(message, times.mins(1).msecs), title);
      });

      // Handle the authorize event from the client
      socket.on('authorize', async function onAuthorize (data, callback) {
        console.log(LOG_WS + 'Authorize client ID: ', socket.client.id);
        console.log(LOG_WS + 'Authorize data keys:', Object.keys(data));
        console.log(LOG_WS + 'Has token:', !!data.token);
        console.log(LOG_WS + 'Has secret:', !!data.secret);
        console.log(LOG_WS + 'Current authInfo:', authInfo ? 'exists' : 'null');
        console.log(LOG_WS + 'Current tenantId:', tenantId || 'none');
        
        // If not already authenticated, try to authenticate now
        if (!authInfo) {
          // Try JWT token from localStorage (passed via data.token)
          const token = data.token || localStorage.getItem('authToken');
          
          if (token) {
            try {
              const decoded = jwt.verify(token, env.JWT_SECRET);
              tenant = await tenantModel.findById(decoded.tenantId);
              if (tenant && tenant.isActive) {
                tenantDb = await connectionManager.getTenantDb(tenant);
                user = { userId: decoded.userId, role: decoded.role };
                tenantId = tenant.tenantId;
                authInfo = { user, tenant, tenantDb };
                
                // Join tenant room
                socket.join('tenant-' + tenantId);
                
                // Initialize tenant tracking
                if (!watchers[tenantId]) {
                  watchers[tenantId] = 0;
                }
                if (!lastData[tenantId]) {
                  lastData[tenantId] = {};
                }
                
                // Create tenant context
                tenantCtx = Object.create(ctx);
                tenantCtx.store = {
                  db: tenantDb,
                  collection: function(name) {
                    return tenantDb.collection(name);
                  }
                };
              }
            } catch (err) {
              console.error('JWT verification failed:', err);
            }
          }
          
          // If still no auth, try to get tenant from subdomain
          if (!authInfo) {
            const host = socket.handshake.headers.host;
            const subdomain = host.split('.')[0];
            tenant = await tenantModel.findOne({ subdomain });
            
            if (tenant && tenant.isActive) {
              tenantDb = await connectionManager.getTenantDb(tenant);
              tenantId = tenant.tenantId;
              // Limited access without authentication
              user = { role: 'viewer' };
              authInfo = { user, tenant, tenantDb };
              
              socket.join('tenant-' + tenantId);
              
              if (!watchers[tenantId]) {
                watchers[tenantId] = 0;
              }
              if (!lastData[tenantId]) {
                lastData[tenantId] = {};
              }
              
              // Create tenant context
              tenantCtx = Object.create(ctx);
              tenantCtx.store = {
                db: tenantDb,
                collection: function(name) {
                  return tenantDb.collection(name);
                }
              };
            }
          }
        }
        
        if (authInfo && callback) {
          callback({
            success: true,
            message: 'Authorized',
            tenantId: tenantId
          });
          
          // Load data if not already loaded
          if (!lastData[tenantId] || Object.keys(lastData[tenantId]).length === 0) {
            await loadDataForTenant(tenantId, tenantDb);
          }
          
          // Send initial data
          console.log(LOG_WS + 'Sending initial data to client for tenant', tenantId);
          console.log(LOG_WS + 'Data keys:', lastData[tenantId] ? Object.keys(lastData[tenantId]) : 'no data');
          if (lastData[tenantId] && lastData[tenantId].sgvs) {
            console.log(LOG_WS + 'SGV count:', lastData[tenantId].sgvs.length);
          }
          socket.emit('dataUpdate', lastData[tenantId]);
          socket.emit('status', status(tenantId));
          console.log(LOG_WS + 'Initial data sent');
        } else if (callback) {
          callback({
            success: false,
            message: 'Authorization failed'
          });
        }
      });

      socket.on('disconnect', function onDisconnect () {
        console.log(LOG_WS + 'Disconnected client ID: ', socket.client.id);
        if (tenantId && watchers[tenantId] > 0) {
          watchers[tenantId] -= 1;
        }
        io.emit('clients', watchers[tenantId] || 0);
      });

      socket.on('subscribe', function onSubscribe (message, callback) {
        console.log(LOG_WS + 'subscribe client ID: ', socket.client.id, ' ', message);
        console.log(LOG_WS + 'Subscribe: current tenantId:', tenantId);
        console.log(LOG_WS + 'Subscribe: has tenantDb:', !!tenantDb);
        console.log(LOG_WS + 'Subscribe: has authInfo:', !!authInfo);
        
        if (!tenantId || !tenantDb) {
          console.log(LOG_WS + 'Subscribe: No tenant context, cannot load data');
          if (callback) {
            callback({ error: 'Not authenticated' });
          }
          return;
        }
        
        if (tenantId) {
          watchers[tenantId] += 1;
        }

        if (message && message.category) {
          socket.join(message.category);
        }
        
        if (callback) {
          callback(watchers[tenantId] || 0);
        }
        
        io.to('tenant-' + tenantId).emit('clients', watchers[tenantId] || 0);
        
        // Load data if not already loaded
        console.log(LOG_WS + 'Subscribe: checking data for tenant', tenantId);
        if (tenantDb && (!lastData[tenantId] || Object.keys(lastData[tenantId]).length === 0)) {
          console.log(LOG_WS + 'Subscribe: loading data for tenant', tenantId);
          loadDataForTenant(tenantId, tenantDb).then(() => {
            console.log(LOG_WS + 'Subscribe: data loaded, emitting to client');
            socket.emit('dataUpdate', lastData[tenantId]);
          }).catch(err => {
            console.error(LOG_WS + 'Subscribe: error loading data:', err);
          });
        } else {
          console.log(LOG_WS + 'Subscribe: using cached data for tenant', tenantId);
          console.log(LOG_WS + 'Subscribe: data keys:', lastData[tenantId] ? Object.keys(lastData[tenantId]) : 'no data');
          socket.emit('dataUpdate', lastData[tenantId]);
        }
      });

      // Handle database operations with tenant context
      socket.on('dbUpdate', function dbUpdate (data, callback) {
        console.log(LOG_WS + 'dbUpdate client ID: ', socket.client.id, ' data: ', data);
        var collection = supportedCollections[data.collection];

        // Check user permissions
        if (!user || user.role === 'viewer') {
          if (callback) {
            callback({ result: 'error', message: 'Insufficient permissions' });
          }
          return;
        }

        var id;
        try {
          id = new ObjectID(data._id);
        } catch (err) {
          console.error(err);
          id = new ObjectID();
        }

        tenantCtx.store.collection(collection).update({ '_id': id }
          , { $set: data.data }
          , function(err, results) {
            if (!err) {
              tenantCtx.store.collection(collection).findOne({ '_id': id }
                , function(err, results) {
                  console.log('Got results', results);
                  if (!err && results !== null) {
                    ctx.bus.emit('data-update', {
                      type: data.collection
                      , op: 'update'
                      , changes: ctx.ddata.processRawDataForRuntime([results])
                      , tenantId: tenantId
                    });
                  }
                });
            }
          }
        );

        if (callback) {
          callback({ result: 'success' });
        }
        ctx.bus.emit('data-received');
      });

      // Handle other database operations similarly...
      socket.on('dbAdd', function dbAdd (data, callback) {
        console.log(LOG_WS + 'dbAdd client ID: ', socket.client.id, ' data: ', data);
        var collection = supportedCollections[data.collection];

        if (!user || user.role === 'viewer') {
          if (callback) {
            callback({ result: 'error', message: 'Insufficient permissions' });
          }
          return;
        }

        if (data.collection === 'treatments' && data.treatments) {
          tenantCtx.treatments.create(data.treatments, function(err, created) {
            if (!err && created) {
              ctx.bus.emit('data-update', {
                type: 'treatments'
                , op: 'update'
                , changes: ctx.ddata.processRawDataForRuntime(created)
                , tenantId: tenantId
              });
            }
            if (callback) {
              callback(created);
            }
          });
        } else {
          tenantCtx.store.collection(collection).insert(data.data, function(err, doc) {
            if (!err) {
              ctx.bus.emit('data-update', {
                type: data.collection
                , op: 'update'
                , doc: doc
                , tenantId: tenantId
              });
            }
            if (callback) {
              callback(doc);
            }
          });
        }
        ctx.bus.emit('data-received');
      });

      socket.on('dbRemove', function dbRemove (data, callback) {
        console.log(LOG_WS + 'dbRemove client ID: ', socket.client.id, ' data: ', data);
        var collection = supportedCollections[data.collection];

        if (!user || user.role === 'viewer') {
          if (callback) {
            callback({ result: 'error', message: 'Insufficient permissions' });
          }
          return;
        }

        var objId = new ObjectID(data._id);
        tenantCtx.store.collection(collection).remove({ '_id': objId }, function(err, removed) {
          if (!err) {
            ctx.bus.emit('data-update', {
              type: data.collection
              , op: 'remove'
              , count: removed.result.n
              , changes: removed.result
              , tenantId: tenantId
            });
          }
          if (callback) {
            callback({ result: 'success' });
          }
          ctx.bus.emit('data-received');
        });
      });

      // Send initial status
      socket.emit('status', status(tenantId));
      io.to('tenant-' + tenantId).emit('clients', watchers[tenantId] || 0);
    });
  }

  websocket.start = start;
  websocket.listeners = listeners;
  websocket.emitNotification = emitNotificationForTenant;
  websocket.emitAnnouncement = function (announcement) {
    if (announcement.tenantId) {
      io.to('tenant-' + announcement.tenantId).emit('announcement', announcement);
    }
  };

  // Start the websocket server
  start();
  listeners();

  return websocket;
}

module.exports = init;