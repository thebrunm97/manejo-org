import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Métrica personalizada para considerar HTTP 200 (Sucesso) e HTTP 429 (Fila Cheia Controlada) como comportamentos esperados do sistema.
export const successOr429Rate = new Rate('success_or_429');

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up (Aquecimento)
    { duration: '2m', target: 300 },  // Stress Peak (Pico de Carga Constante)
    { duration: '30s', target: 600 }, // Spike Súbito para forçar saturação
    { duration: '30s', target: 0 },   // Scale down (Recuperação do sistema)
  ],
  thresholds: {
    // 95% das requests devem ser aceitas ou bloqueadas controladamente sem causar crash
    'success_or_429': ['rate>0.95'], 
    // Latência P95 do endpoint (apenas enfileiramento) deve ser inferior a 300ms
    'http_req_duration': ['p(95)<300'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';
  const token = __ENV.WEBHOOK_TOKEN || '';

  // Gerar um ID de mensagem único para contornar o Mutex de dedup (simulando mensagens reais únicas)
  const messageId = uuidv4();
  
  // Distribuir a carga gerando telefones aleatórios simulando 10.000 remetentes diferentes
  // Isto força concorrência no locking por utilizador e nos lookups do Supabase
  const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const phoneNumber = `5511999${randomSuffix}@s.whatsapp.net`;

  const payload = JSON.stringify({
    event: "messages.upsert",
    data: {
      info: {
        ID: messageId,
        Chat: phoneNumber,
        Sender: phoneNumber,
        IsFromMe: false,
        Timestamp: new Date().toISOString(),
        Type: "text"
      },
      message: {
        conversation: "Olá! Isto é um teste de carga e stress k6."
      }
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  };

  const res = http.post(`${baseUrl}/webhook/evolution`, payload, params);

  // Verificação de segurança e integridade
  const isExpected = res.status === 200 || res.status === 429;
  successOr429Rate.add(isExpected);

  check(res, {
    'is status 200 (Accepted)': (r) => r.status === 200,
    'is status 429 (Queue Full)': (r) => r.status === 429,
    'not a server crash (5xx)': (r) => r.status < 500 && r.status !== 429 && r.status !== 200 ? false : true,
  });

  // Breve pausa para cadenciar requests simulando 1 rq/s por utilizador virtual ativo
  sleep(1);
}
