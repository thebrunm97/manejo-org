const fs = require('fs');

function findBad(filename) {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const bad = data.filter(item => {
    const str = JSON.stringify(item.geometry);
    if (!str) return true; // empty geometry
    if (str === '{}' || str === '[]') return true;
    if (str.includes('null')) return true; // coordinates with null/NaN
    return false;
  });
  
  if (bad.length > 0) {
    console.log(`\nBad records in ${filename}:`);
    bad.forEach(b => console.log(`ID: ${b.id}, Name: ${b.nome}, Geometry: ${JSON.stringify(b.geometry)}`));
  } else {
    console.log(`No bad records in ${filename}`);
  }
}

findBad('dump_talhoes.json');
findBad('dump_propriedades.json');
