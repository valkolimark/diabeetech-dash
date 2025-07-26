'use strict';

// Optimized MongoDB connection configuration for multi-tenant setup
// Reduces memory usage by limiting connection pool size

module.exports = function getConnectionConfig(env) {
  const isProduction = env.NODE_ENV === 'production';
  
  return {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    
    // Connection pool settings - reduced for memory optimization
    maxPoolSize: isProduction ? 10 : 5,  // Default is 100, we reduce significantly
    minPoolSize: 2,                       // Keep minimum connections
    maxIdleTimeMS: 30000,                 // Close idle connections after 30 seconds
    serverSelectionTimeoutMS: 5000,       // Fail fast on connection issues
    socketTimeoutMS: 45000,               // Socket timeout
    
    // Connection buffering
    bufferCommands: false,                // Don't buffer when disconnected
    
    // Write concern for better performance
    writeConcern: {
      w: 1,                               // Acknowledge writes
      j: false,                           // Don't wait for journal sync
      wtimeout: 5000                      // Write timeout
    },
    
    // Read preference
    readPreference: 'secondaryPreferred', // Use secondaries when available
    
    // Compression
    compressors: ['zlib'],                // Enable compression
    zlibCompressionLevel: 1               // Fast compression
  };
};

// Helper to create tenant-specific connection with even tighter limits
module.exports.getTenantConnectionConfig = function() {
  return {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 3,        // Very limited pool for tenant connections
    minPoolSize: 1,
    maxIdleTimeMS: 20000,  // Close even faster
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 30000
  };
};