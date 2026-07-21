const fs = require('fs');
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

async function fetchTable(tableName) {
  const res = await fetch(`${URL}/rest/v1/${tableName}?select=*&limit=1000`, {
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) return [];
  return await res.json();
}

async function run() {
  const talhoes = await fetchTable('talhoes');
  const propriedades = await fetchTable('propriedades');
  
  fs.writeFileSync('dump_talhoes.json', JSON.stringify(talhoes, null, 2));
  fs.writeFileSync('dump_propriedades.json', JSON.stringify(propriedades, null, 2));
  console.log(`Dumped ${talhoes.length} talhoes and ${propriedades.length} propriedades`);
}

run();
