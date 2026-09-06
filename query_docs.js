const { spawn } = require('child_process');
const fs = require('fs');

const proc = spawn('npx.cmd', ['-y', '@supabase/mcp-server-supabase@0.8.1', '--project-ref', 'hejewayflbuemnffrhae'], {
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: 'sbp_7931894c6914cd810a92536eefd28a995c0b4522' },
  shell: true
});

proc.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        console.log(JSON.stringify(msg, null, 2));
      } catch (e) { }
    }
  }
});

proc.stderr.on('data', (data) => {
  // console.error('STDERR:', data.toString());
});

const initReq = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" }
  }
};

proc.stdin.write(JSON.stringify(initReq) + '\n');

setTimeout(() => {
    const queryReq = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
          name: "query_database",
          arguments: {
              query: "SELECT DISTINCT source FROM knowledge_chunks UNION SELECT DISTINCT source FROM farm_documents;"
          }
      }
    };
    proc.stdin.write(JSON.stringify(queryReq) + '\n');
}, 3000);

setTimeout(() => {
    proc.kill();
}, 8000);
