const { createClient } = require('@supabase/supabase-js');

// Puxando as credenciais de .env.prod (onde SUPABASE_KEY é a service_role/anon key)
require('dotenv').config({ path: '../.env.prod' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('Iniciando auditoria no Staging...');
  const { data, error } = await supabase
    .from('propriedades')
    .select(`
      id,
      nome,
      user_id,
      created_at,
      profiles!inner(nome)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Erro na query:', error);
    process.exit(1);
  }

  console.log(`Encontradas ${data.length} propriedades. Avaliando padrões...`);
  
  let anomalias = 0;
  data.forEach(r => {
    // Exibe os dados formatados
    console.log(`\n[${new Date(r.created_at).toISOString()}] Propriedade ID: ${r.id}`);
    console.log(`-> Nome Propriedade: "${r.nome}"`);
    console.log(`-> Nome do Dono (Profile): "${r.profiles.nome}"`);
    console.log(`-> User ID: ${r.user_id}`);

    // Heurística básica de anomalia: Nomes muito discrepantes ou repetidos
    if (r.profiles.nome === 'Sem Nome' || r.profiles.nome == null) {
      console.log('⚠️ ALERTA: Dono não tem nome configurado no profile (Onboarding incompleto?)');
      anomalias++;
    }
  });

  console.log(`\nAuditoria concluída. ${anomalias} alertas secundários encontrados.`);
}

runAudit();
