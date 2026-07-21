const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

async function run() {
  const idsToDelete = [77, 78];
  
  for (const id of idsToDelete) {
    const res = await fetch(`${URL}/rest/v1/talhoes?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (res.ok) {
      console.log(`Successfully deleted talhao ID ${id}`);
    } else {
      console.log(`Failed to delete talhao ID ${id}: ${res.status} ${res.statusText}`);
      console.log(await res.text());
    }
  }

  // Update ID 76 to a dummy valid polygon (so it is not null anymore)
  const dummyPolygon = {
    type: "Polygon",
    coordinates: [[
      [-48.2772, -18.9186],
      [-48.2772, -18.9196],
      [-48.2782, -18.9196],
      [-48.2782, -18.9186],
      [-48.2772, -18.9186]
    ]]
  };

  const resUpdate = await fetch(`${URL}/rest/v1/talhoes?id=eq.76`, {
    method: 'PATCH',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ geometry: dummyPolygon })
  });

  if (resUpdate.ok) {
    console.log(`Successfully updated talhao ID 76 with a dummy polygon so it's not null.`);
  } else {
    console.log(`Failed to update talhao ID 76: ${resUpdate.status} ${resUpdate.statusText}`);
    console.log(await resUpdate.text());
  }
}

run();
