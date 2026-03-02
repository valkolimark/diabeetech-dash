// Debug delta bucket calculation
(function() {
  const client = window.Nightscout.client;
  if (!client || !client.sbx) {
    console.error('Client or sandbox not ready');
    return;
  }
  
  console.log('=== Delta Bucket Debug ===');
  const sbx = client.sbx;
  const bgnow = client.plugins('bgnow');
  
  if (!bgnow) {
    console.error('BGNow plugin not loaded');
    return;
  }
  
  // Check SGV data
  console.log('\nSGV Data:');
  console.log('Total SGVs:', sbx.data.sgvs ? sbx.data.sgvs.length : 0);
  if (sbx.data.sgvs && sbx.data.sgvs.length > 0) {
    console.log('Last 5 SGVs:');
    sbx.data.sgvs.slice(-5).forEach((sgv, i) => {
      console.log(`  ${i}: ${new Date(sgv.mills).toLocaleTimeString()} - ${sgv.mgdl} mg/dL`);
    });
  }
  
  // Try to manually fill buckets
  console.log('\n=== Manual Bucket Fill ===');
  try {
    const buckets = bgnow.fillBuckets(sbx);
    console.log('Buckets created:', buckets.length);
    buckets.forEach((bucket, i) => {
      console.log(`Bucket ${i}:`, {
        isEmpty: bucket.isEmpty,
        sgvs: bucket.sgvs ? bucket.sgvs.length : 0,
        fromTime: new Date(bucket.fromMills).toLocaleTimeString(),
        toTime: new Date(bucket.toMills).toLocaleTimeString(),
        mean: bucket.mean,
        last: bucket.last
      });
    });
    
    const recent = bgnow.mostRecentBucket(buckets);
    const previous = bgnow.previousBucket(recent, buckets);
    console.log('\nRecent bucket:', recent);
    console.log('Previous bucket:', previous);
    
    if (recent && previous) {
      const delta = bgnow.calcDelta(recent, previous, sbx);
      console.log('Calculated delta:', delta);
    }
  } catch (e) {
    console.error('Error filling buckets:', e);
  }
  
  // Check last SGV mills
  console.log('\n=== Timing Check ===');
  console.log('Last SGV mills:', sbx.lastSGVMills());
  console.log('Last SGV time:', sbx.lastSGVMills() ? new Date(sbx.lastSGVMills()).toLocaleString() : 'none');
  console.log('Current sbx time:', new Date(sbx.time).toLocaleString());
})();