// Test fix for delta timing issue
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  const sbx = client.sbx;
  const bgnow = client.plugins('bgnow');
  
  console.log('=== Testing Delta Fix ===');
  
  // Check if SGVs are sorted correctly
  if (sbx.data.sgvs && sbx.data.sgvs.length > 1) {
    const isSorted = sbx.data.sgvs.every((sgv, i) => {
      if (i === 0) return true;
      return sgv.mills >= sbx.data.sgvs[i-1].mills;
    });
    console.log('SGVs sorted oldest to newest?', isSorted);
    
    // Find actual latest SGV
    const actualLatest = _.maxBy(sbx.data.sgvs, 'mills');
    const reportedLatest = sbx.lastSGVEntry();
    
    console.log('Actual latest SGV:', actualLatest);
    console.log('Reported latest SGV:', reportedLatest);
    console.log('Match?', actualLatest.mills === reportedLatest.mills);
  }
  
  // Test bucket fill with offset adjustment
  if (bgnow) {
    console.log('\n=== Testing Bucket Fill with Correct Time ===');
    
    // Get the actual latest SGV
    const actualLatestMills = _.maxBy(sbx.data.sgvs, 'mills').mills;
    
    // Temporarily override lastSGVMills
    const originalLastSGVMills = sbx.lastSGVMills;
    sbx.lastSGVMills = function() { return actualLatestMills; };
    
    try {
      const buckets = bgnow.fillBuckets(sbx);
      console.log('Buckets with fix:', buckets);
      
      const recent = bgnow.mostRecentBucket(buckets);
      const previous = bgnow.previousBucket(recent, buckets);
      
      console.log('Recent bucket:', recent);
      console.log('Previous bucket:', previous);
      
      if (recent && previous) {
        const delta = bgnow.calcDelta(recent, previous, sbx);
        console.log('Calculated delta:', delta);
        console.log('Delta display:', delta ? delta.display : 'none');
      }
    } finally {
      // Restore original function
      sbx.lastSGVMills = originalLastSGVMills;
    }
  }
})();