const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ===== CONFIGS =====
const PANEL_URL = 'ptlc_xKdSdxVPJxk3SFwokPr8Wlz6qLvaY5wJJcbfAKKcDiR';
const CLIENT_TOKEN = 'ptlc_UbX2bgSDd7s6ZTaUOt7sSCtJ4lpekqxDujT1v5EOG57';
const SERVER_ID = 'aafeb84b';
const PORT = process.env.PORT || 3000;

const clientHeaders = {
  Authorization: `Bearer ${CLIENT_TOKEN}`,
  Accept: 'Application/vnd.pterodactyl.v1+json',
  'Content-Type': 'application/json',
};

// ===== FUNÇÕES API =====
async function obterIpDoServidor() {
  try {
    const res = await axios.get(`${PANEL_URL}/api/client/servers/${SERVER_ID}`, {
      headers: clientHeaders,
    });
    const allocations = res.data.attributes.relationships.allocations.data;
    const principal = allocations.find(a => a.attributes.is_default);
    if (!principal) return 'Nenhum IP padrão configurado.';
    return `${principal.attributes.ip}:${principal.attributes.port}`;
  } catch (err) {
    console.error('Erro ao obter IP:', err.message);
    return 'Erro ao obter IP!';
  }
}

async function obterUsoServidor() {
  try {
    const res = await axios.get(`${PANEL_URL}/api/client/servers/${SERVER_ID}/resources`, {
      headers: clientHeaders,
    });
    const usage = res.data.attributes.resources;
    return {
      cpu: `${(usage.cpu_absolute || 0).toFixed(2)}%`,
      ram: `${(usage.memory_bytes / 1024 / 1024).toFixed(2)} MB`,
      disco: `${(usage.disk_bytes / 1024 / 1024).toFixed(2)} MB`,
    };
  } catch (err) {
    console.error('Erro ao obter uso:', err.message);
    return { erro: 'Erro ao obter uso!' };
  }
}

async function statusServidor() {
  try {
    const res = await axios.get(`${PANEL_URL}/api/client/servers/${SERVER_ID}/resources`, {
      headers: clientHeaders,
    });
    return res.data.attributes.current_state;
  } catch (err) {
    console.error('Erro ao verificar status:', err.message);
    return 'Erro';
  }
}

async function acaoPowerServidor(signal) {
  try {
    await axios.post(`${PANEL_URL}/api/client/servers/${SERVER_ID}/power`, { signal }, {
      headers: clientHeaders
    });
    return `Servidor ${signal} com sucesso!`;
  } catch (err) {
    console.error(`Erro ao ${signal} servidor:`, err.message);
    return `Erro ao ${signal} servidor!`;
  }
}

async function enviarComando(comando) {
  try {
    await axios.post(`${PANEL_URL}/api/client/servers/${SERVER_ID}/command`, {
      command: comando
    }, { headers: clientHeaders });
    return `Comando enviado: ${comando}`;
  } catch (err) {
    console.error('Erro ao enviar comando:', err.message);
    return 'Erro ao enviar comando!';
  }
}

async function listarArquivos() {
  try {
    const res = await axios.get(`${PANEL_URL}/api/client/servers/${SERVER_ID}/files/list?directory=/`, {
      headers: clientHeaders,
    });
    return res.data.data.map(file => file.attributes.name);
  } catch (err) {
    console.error('Erro ao listar arquivos:', err.message);
    return ['Erro ao listar arquivos.'];
  }
}

async function obterTokenWebSocket() {
  try {
    const response = await axios.get(`${PANEL_URL}/api/client/servers/${SERVER_ID}/websocket`, {
      headers: clientHeaders,
    });
    return {
      socket: response.data.data.socket,
      token: response.data.data.token,
    };
  } catch (err) {
    console.error('Erro ao obter WebSocket token:', err.message);
    return null;
  }
}

// ===== ROTAS API =====
app.get('/status', async (req, res) => res.json({ status: await statusServidor() }));
app.get('/ip', async (req, res) => res.json({ ip: await obterIpDoServidor() }));
app.get('/uso', async (req, res) => res.json(await obterUsoServidor()));
app.post('/iniciar', async (req, res) => res.json({ message: await acaoPowerServidor('start') }));
app.post('/parar', async (req, res) => res.json({ message: await acaoPowerServidor('stop') }));
app.post('/reiniciar', async (req, res) => res.json({ message: await acaoPowerServidor('restart') }));
app.post('/comando', async (req, res) => res.json({ resultado: await enviarComando(req.body.cmd || '') }));
app.get('/arquivos', async (req, res) => res.json({ arquivos: await listarArquivos() }));
app.get('/ws/token', async (req, res) => {
  const data = await obterTokenWebSocket();
  if (!data) return res.status(500).json({ erro: 'Erro ao gerar token WebSocket' });
  res.json(data);
});

// ===== HTML DO PAINEL =====
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Painel do Servidor</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white font-sans p-6">
  <div class="max-w-4xl mx-auto space-y-6">
    <h1 class="text-4xl font-bold text-center mb-6">🎮 Painel do Servidor</h1>

    <div class="grid grid-cols-3 gap-4">
      <button onclick="controlar('start')" class="bg-green-500 py-2 rounded">Iniciar</button>
      <button onclick="controlar('stop')" class="bg-red-500 py-2 rounded">Parar</button>
      <button onclick="controlar('restart')" class="bg-yellow-400 text-black py-2 rounded">Reiniciar</button>
    </div>

    <div class="bg-white bg-opacity-10 p-4 rounded">
      <p><strong>Status:</strong> <span id="status">-</span></p>
      <p><strong>IP:</strong> <span id="ip">-</span></p>
      <p><strong>CPU:</strong> <span id="cpu">-</span></p>
      <p><strong>RAM:</strong> <span id="ram">-</span></p>
      <p><strong>Disco:</strong> <span id="disco">-</span></p>
    </div>

    <div>
      <h2 class="text-xl font-bold mb-2">📂 Arquivos na raiz</h2>
      <ul id="arquivos" class="list-disc list-inside text-sm"></ul>
    </div>

    <div>
      <h2 class="text-xl font-bold mb-2">💻 Enviar Comando</h2>
      <input type="text" id="cmdInput" placeholder="Digite o comando" class="text-black px-2 py-1 rounded w-full">
      <button onclick="enviarComando()" class="mt-2 bg-blue-500 py-1 px-4 rounded">Enviar</button>
    </div>

    <div>
      <h2 class="text-xl font-bold mb-2">📜 Console Logs (ao vivo)</h2>
      <pre id="console" class="bg-black p-4 h-64 overflow-y-auto text-xs whitespace-pre-wrap rounded"></pre>
    </div>
  </div>

<script>
async function fetchInfo() {
  const status = await fetch('/status').then(r => r.json());
  const ip = await fetch('/ip').then(r => r.json());
  const uso = await fetch('/uso').then(r => r.json());
  const arq = await fetch('/arquivos').then(r => r.json());

  document.getElementById('status').textContent = status.status;
  document.getElementById('ip').textContent = ip.ip;
  document.getElementById('cpu').textContent = uso.cpu;
  document.getElementById('ram').textContent = uso.ram;
  document.getElementById('disco').textContent = uso.disco;

  const arqList = document.getElementById('arquivos');
  arqList.innerHTML = '';
  arq.arquivos.forEach(nome => {
    const li = document.createElement('li');
    li.textContent = nome;
    arqList.appendChild(li);
  });
}

async function controlar(acao) {
  const rota = acao === 'start' ? 'iniciar' : acao === 'stop' ? 'parar' : 'reiniciar';
  const res = await fetch('/' + rota, { method: 'POST' }).then(r => r.json());
  alert(res.message);
  fetchInfo();
}

async function enviarComando() {
  const cmd = document.getElementById('cmdInput').value;
  const res = await fetch('/comando', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd }),
  }).then(r => r.json());
  alert(res.resultado);
}

async function iniciarWebSocket() {
  const tokenData = await fetch('/ws/token').then(r => r.json());
  const socket = new WebSocket(\`\${tokenData.socket}?token=\${tokenData.token}\`);
  const consoleEl = document.getElementById('console');

  socket.onmessage = (e) => {
    consoleEl.textContent += e.data + '\\n';
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };
}

fetchInfo();
iniciarWebSocket();
setInterval(fetchInfo, 10000);
</script>
</body>
</html>
  `);
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`🚀 Painel rodando: http://localhost:${PORT}`);
  https.get('https://ifconfig.me/ip', (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      console.log(`🌍 IP público: ${data.trim()}`);
    });
  }).on('error', (err) => {
    console.error('Erro ao obter IP público:', err.message);
  });
});
