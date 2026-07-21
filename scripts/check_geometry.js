const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

async function checkTable(tableName) {
  const res = await fetch(`${URL}/rest/v1/${tableName}?select=*&limit=1000`, {
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Accept': 'application/json'
    }
  });
  
  if (!res.ok) {
    if (res.status !== 404 && !res.statusText.includes('Not Found')) {
      console.log(`Could not fetch ${tableName}: ${res.status} ${res.statusText}`);
    }
    return;
  }
  
  const data = await res.json();
  const badRecords = data.filter(row => {
    const geom = row.geometry || row.geom || row.poligono || row.area;
    if (!geom) return false;
    
    const str = JSON.stringify(geom);
    if (str === '{}' || str === '[]' || str.includes('NaN') || str.includes('null')) {
       return true;
    }
    return false;
  });
  
  if (badRecords.length > 0) {
    console.log(`\nFound ${badRecords.length} bad records in table '${tableName}':`);
    badRecords.forEach(r => {
      console.log(`  - ID: ${r.id}, Name/Label: ${r.nome || r.name || r.label || 'N/A'}`);
      console.log(`    Geometry: ${JSON.stringify(r.geometry || r.geom || r.poligono || r.area)}`);
    });
  } else {
    console.log(`No bad geometry found in ${tableName} (checked ${data.length} records).`);
  }
}

async function run() {
  await checkTable('talhoes');
  await checkTable('focos');
  await checkTable('focus_targets');
  await checkTable('properties');
  await checkTable('propriedades');
}

run();
