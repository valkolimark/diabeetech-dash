// Refresh live data in browser
console.log(`
To see your live Dexcom data:

1. Go to your browser and run this in the console:

   fetch('/js/check-live-data.js').then(r=>r.text()).then(eval)

2. This will show:
   - Current SGV readings
   - Data freshness
   - WebSocket connection status

3. The test data we inserted should be showing now
   - Latest: 122 mg/dL at 9:08 PM CST

4. Once Dexcom Share syncs (usually within 5-10 minutes of enabling):
   - Real data will start flowing
   - The bridge will poll every 2.5 minutes
   - Deploy to Heroku to enable automatic updates

Current status:
✅ Bridge configured in MongoDB
✅ Authentication working
✅ Test data inserted
⏳ Waiting for Dexcom Share to sync
`);
