'use strict';

const crypto = require('crypto');

function init(env, ctx) {
  const tenantSettingsModel = {};
  
  // Encryption for sensitive data
  const algorithm = 'aes-256-cbc';
  const secretKey = env.TENANT_SETTINGS_KEY || env.API_SECRET || 'default-key-change-me';
  const key = crypto.createHash('sha256').update(String(secretKey)).digest('base64').substr(0, 32);
  
  function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  
  function decrypt(text) {
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (err) {
      console.error('Failed to decrypt:', err);
      return null;
    }
  }
  
  // Get tenant settings
  tenantSettingsModel.findByTenantId = async function(tenantId) {
    if (!ctx.store || !ctx.store.db) {
      throw new Error('Database not initialized');
    }
    
    const collection = ctx.store.db.collection('tenant_settings');
    const settings = await collection.findOne({ tenantId: tenantId });
    
    if (settings && settings.bridge) {
      // Decrypt sensitive fields
      if (settings.bridge.password) {
        settings.bridge.password = decrypt(settings.bridge.password);
      }
    }
    
    if (settings && settings.mmconnect) {
      // Decrypt sensitive fields
      if (settings.mmconnect.password) {
        settings.mmconnect.password = decrypt(settings.mmconnect.password);
      }
    }
    
    return settings;
  };
  
  // Save tenant settings
  tenantSettingsModel.save = async function(tenantId, settings) {
    if (!ctx.store || !ctx.store.db) {
      throw new Error('Database not initialized');
    }
    
    const collection = ctx.store.db.collection('tenant_settings');
    
    // Clone to avoid modifying original
    const toSave = JSON.parse(JSON.stringify(settings));
    toSave.tenantId = tenantId;
    toSave.updatedAt = new Date();
    
    // Encrypt sensitive fields
    if (toSave.bridge && toSave.bridge.password) {
      toSave.bridge.password = encrypt(toSave.bridge.password);
    }
    
    if (toSave.mmconnect && toSave.mmconnect.password) {
      toSave.mmconnect.password = encrypt(toSave.mmconnect.password);
    }
    
    const result = await collection.replaceOne(
      { tenantId: tenantId },
      toSave,
      { upsert: true }
    );
    
    return result;
  };
  
  // Update specific settings
  tenantSettingsModel.updateBridge = async function(tenantId, bridgeSettings) {
    const current = await this.findByTenantId(tenantId) || {};
    current.bridge = bridgeSettings;
    return await this.save(tenantId, current);
  };
  
  tenantSettingsModel.updateMMConnect = async function(tenantId, mmSettings) {
    const current = await this.findByTenantId(tenantId) || {};
    current.mmconnect = mmSettings;
    return await this.save(tenantId, current);
  };
  
  // Delete settings
  tenantSettingsModel.remove = async function(tenantId) {
    if (!ctx.store || !ctx.store.db) {
      throw new Error('Database not initialized');
    }
    
    const collection = ctx.store.db.collection('tenant_settings');
    return await collection.deleteOne({ tenantId: tenantId });
  };
  
  return tenantSettingsModel;
}

module.exports = init;