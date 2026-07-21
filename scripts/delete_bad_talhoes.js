const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;

async function deleteBadTalhoes() {
  const ids = [74, 76, 81, 82];
  
  for (const id of ids) {
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
      const text = await res.text();
      console.log(text);
    }
  }
}

deleteBadTalhoes();
