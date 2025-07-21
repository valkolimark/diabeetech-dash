// Debug timestamp issues
(function() {
  console.log('=== TIMESTAMP DEBUG ===');
  
  if (window.Nightscout && window.Nightscout.client && window.Nightscout.client.entries) {
    const entries = window.Nightscout.client.entries;
    if (entries.length > 0) {
      const latest = entries[entries.length - 1];
      
      console.log('\nLatest entry raw data:');
      console.log('- mills:', latest.mills);
      console.log('- date:', latest.date);
      console.log('- dateString:', latest.dateString);
      
      const entryDate = new Date(latest.mills);
      const now = new Date();
      
      console.log('\nTimestamp analysis:');
      console.log('- Entry date:', entryDate.toISOString());
      console.log('- Local time:', entryDate.toLocaleString());
      console.log('- Now (UTC):', now.toISOString());
      console.log('- Now (local):', now.toLocaleString());
      console.log('- Difference (ms):', now - entryDate);
      console.log('- Difference (hours):', (now - entryDate) / (1000 * 60 * 60));
      
      // Check if date is actually from yesterday
      const daysDiff = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 1) {
        console.log('\n⚠️ WARNING: Data is', daysDiff, 'day(s) old!');
        console.log('This explains why it shows "a day ago" on the chart');
      }
      
      // Show last 5 entries with full timestamps
      console.log('\nLast 5 entries (full timestamps):');
      entries.slice(-5).reverse().forEach((entry, i) => {
        const d = new Date(entry.mills);
        console.log(`${i+1}. ${d.toISOString()} (${d.toLocaleString()}) - ${entry.mgdl} mg/dL`);
      });
    }
  }
  
  // Check current date setting
  console.log('\n=== SYSTEM TIME CHECK ===');
  console.log('Browser thinks current time is:', new Date().toString());
  console.log('Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
})();