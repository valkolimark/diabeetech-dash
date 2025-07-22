'use strict';

const hcaptcha = require('hcaptcha');

function createCaptchaMiddleware(env) {
  const HCAPTCHA_ENABLED = env.settings?.HCAPTCHA_ENABLED === 'true' || env.HCAPTCHA_ENABLED === 'true';
  const HCAPTCHA_SECRET_KEY = env.settings?.HCAPTCHA_SECRET_KEY || env.HCAPTCHA_SECRET_KEY;
  
  return async function verifyCaptcha(req, res, next) {
    // Skip captcha if not enabled
    if (!HCAPTCHA_ENABLED) {
      return next();
    }

    // Skip captcha for API requests with valid authentication
    if (req.headers.authorization) {
      return next();
    }

    const captchaResponse = req.body['h-captcha-response'];
    
    if (!captchaResponse) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification required'
      });
    }

    try {
      const result = await hcaptcha.verify(HCAPTCHA_SECRET_KEY, captchaResponse);
      
      if (result.success) {
        next();
      } else {
        res.status(400).json({
          success: false,
          message: 'Captcha verification failed'
        });
      }
    } catch (error) {
      console.error('Captcha verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Captcha verification error'
      });
    }
  };
}

function getCaptchaConfig(env) {
  // Check multiple sources for the config
  const HCAPTCHA_ENABLED = process.env.HCAPTCHA_ENABLED === 'true' || 
                           env.settings?.HCAPTCHA_ENABLED === 'true' || 
                           env.HCAPTCHA_ENABLED === 'true';
  
  const HCAPTCHA_SITE_KEY = process.env.HCAPTCHA_SITE_KEY || 
                            env.settings?.HCAPTCHA_SITE_KEY || 
                            env.HCAPTCHA_SITE_KEY;
  
  // Debug logging (remove in production)
  console.log('Captcha config:', { 
    enabled: HCAPTCHA_ENABLED, 
    siteKey: HCAPTCHA_SITE_KEY ? 'set' : 'not set',
    envCheck: !!process.env.HCAPTCHA_ENABLED 
  });
  
  return {
    enabled: HCAPTCHA_ENABLED,
    siteKey: HCAPTCHA_SITE_KEY
  };
}

module.exports = {
  createCaptchaMiddleware,
  getCaptchaConfig
};