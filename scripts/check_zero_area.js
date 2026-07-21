const fs = require('fs');

function checkZeroArea(filename) {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const bad = data.filter(t => {
    if (!t.geometry) return false; // ignore null
    try {
      const geo = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
      const coords = geo.coordinates?.[0];
      if (!coords || !Array.isArray(coords)) return true;
      if (coords.length === 0) return true;
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      coords.forEach(c => {
        if (c[0] !== null && c[1] !== null) {
          minX = Math.min(minX, c[0]);
          maxX = Math.max(maxX, c[0]);
          minY = Math.min(minY, c[1]);
          maxY = Math.max(maxY, c[1]);
        }
      });
      if (minX === maxX && minY === maxY) return true;
    } catch (e) {
      return true;
    }
    return false;
  });
  
  if (bad.length > 0) {
    console.log(`\nZero-area records in ${filename}:`);
    bad.forEach(b => console.log(`ID: ${b.id}, Name: ${b.nome}, Geometry: ${JSON.stringify(b.geometry)}`));
  } else {
    console.log(`No zero-area records in ${filename}`);
  }
}

checkZeroArea('dump_talhoes.json');
