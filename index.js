const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();

// Middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ===== CONFIGS =====
const PANEL_URL = 'https://backend.magmanode.com';
const CLIENT_TOKEN = 'ptlc_UbX2bgSDd7s6ZTaUOt7sSCtJ4lpekqxDujT1v5EOG57';
const SERVER_ID = 'aafeb84b';
const PORT = process.env.PORT || 3000;

const clientHeaders = {
  Authorization: `Bearer ${CLIENT_TOKEN}`,
  Accept: 'Application/vnd.pterodactyl.v1+json',
  'Content-Type': 'application/json',
};

// ===== FUNÇÕES =====
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
    const uso = res.data.attributes.resources;
    return {
      cpu: `${(uso.cpu_absolute || 0).toFixed(2)}%`,
      ram: `${(uso.memory_bytes / 1024 / 1024).toFixed(2)} MB`,
      disco: `${(uso.disk_bytes / 1024 / 1024).toFixed(2)} MB`,
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
      headers: clientHeaders,
    });
    return `Servidor ${signal} com sucesso!`;
  } catch (err) {
    console.error(`Erro ao ${signal} servidor:`, err.message);
    return `Erro ao ${signal} servidor!`;
  }
}

// ===== MOCKS =====
let jogadores = ['Jogador1', 'Jogador2'];
let consoleLogs = [];

function adicionarLogConsole(msg) {
  const timestamp = new Date().toISOString();
  consoleLogs.push(`[${timestamp}] ${msg}`);
  if (consoleLogs.length > 100) consoleLogs.shift();
}

setInterval(() => {
  adicionarLogConsole('Log automático do servidor.');
}, 10000);

// ===== ROTAS API =====
app.get('/status', async (req, res) => {
  const status = await statusServidor();
  res.json({ status });
});

app.post('/iniciar', async (req, res) => {
  const result = await acaoPowerServidor('start');
  adicionarLogConsole('Comando: Iniciar servidor');
  res.json({ message: result });
});

app.post('/parar', async (req, res) => {
  const result = await acaoPowerServidor('stop');
  adicionarLogConsole('Comando: Parar servidor');
  res.json({ message: result });
});

app.post('/reiniciar', async (req, res) => {
  const result = await acaoPowerServidor('restart');
  adicionarLogConsole('Comando: Reiniciar servidor');
  res.json({ message: result });
});

app.get('/ip', async (req, res) => {
  const ip = await obterIpDoServidor();
  res.json({ ip });
});

app.get('/uso', async (req, res) => {
  const uso = await obterUsoServidor();
  res.json(uso);
});

app.get('/players', (req, res) => {
  res.json({ jogadores });
});

app.get('/console', (req, res) => {
  res.json({ logs: consoleLogs });
});

// ===== ROTA HTML =====
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/painel.html');
});

// ===== PAINEL HTML =====
const fs = require('fs');
fs.writeFileSync(__dirname + '/painel.html', `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Painel do Servidor</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-gray-900 via-indigo-800 to-purple-800 min-h-screen text-white font-sans p-6">
  <div class="max-w-3xl mx-auto bg-white bg-opacity-10 backdrop-blur-md p-10 rounded-2xl shadow-xl space-y-6">
    <h1 class="text-4xl font-bold text-center">🎮 Painel do Servidor</h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button onclick="controlarServidor('start')" class="bg-green-500 hover:bg-green-600 py-2 rounded-lg">Iniciar</button>
      <button onclick="controlarServidor('stop')" class="bg-red-500 hover:bg-red-600 py-2 rounded-lg">Parar</button>
      <button onclick="controlarServidor('restart')" class="bg-yellow-400 hover:bg-yellow-500 text-black py-2 rounded-lg">Reiniciar</button>
    </div>

    <div>
      <h2 class="text-2xl font-semibold mt-6 mb-2">📊 Status</h2>
      <div class="bg-black bg-opacity-40 p-4 rounded">
        <p><strong>Status:</strong> <span id="status">Carregando...</span></p>
        <p><strong>IP:</strong> <span id="ip">Carregando...</span></p>
        <p><strong>CPU:</strong> <span id="cpu">-</span></p>
        <p><strong>RAM:</strong> <span id="ram">-</span></p>
        <p><strong>Disco:</strong> <span id="disco">-</span></p>
      </div>
    </div>

    <div>
      <h2 class="text-2xl font-semibold mt-6 mb-2">👥 Jogadores</h2>
      <ul id="players" class="list-disc list-inside text-white text-sm"></ul>
    </div>

    <div>
      <h2 class="text-2xl font-semibold mt-6 mb-2">📜 Console Logs</h2>
      <div id="consoleLogs" class="bg-black bg-opacity-40 p-4 rounded text-xs h-48 overflow-y-auto whitespace-pre-wrap"></div>
    </div>
  </div>

  <script>
    const BASE_URL = "";

    async function fetchStatus() {
      const res = await fetch(\`\${BASE_URL}/status\`);
      const data = await res.json();
      document.getElementById('status').textContent = data.status;
    }

    async function fetchIp() {
      const res = await fetch(\`\${BASE_URL}/ip\`);
      const data = await res.json();
      document.getElementById('ip').textContent = data.ip;
    }

    async function fetchUso() {
      const res = await fetch(\`\${BASE_URL}/uso\`);
      const data = await res.json();
      document.getElementById('cpu').textContent = data.cpu;
      document.getElementById('ram').textContent = data.ram;
      document.getElementById('disco').textContent = data.disco;
    }

    async function fetchPlayers() {
      const res = await fetch(\`\${BASE_URL}/players\`);
      const data = await res.json();
      const playersList = document.getElementById('players');
      playersList.innerHTML = '';
      data.jogadores.forEach(j => {
        const li = document.createElement('li');
        li.textContent = j;
        playersList.appendChild(li);
      });
    }

    async function fetchConsoleLogs() {
      const res = await fetch(\`\${BASE_URL}/console\`);
      const data = await res.json();
      const consoleLogs = document.getElementById('consoleLogs');
      consoleLogs.innerHTML = data.logs.join('\\n');
    }

    async function controlarServidor(acao) {
      const endpoint = acao === 'start' ? 'iniciar' : acao === 'stop' ? 'parar' : 'reiniciar';
      const res = await fetch(\`\${BASE_URL}/\${endpoint}\`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Ação executada.');
      adicionarLogLocal(\`Comando enviado: \${acao}\`);
    }

    function adicionarLogLocal(msg) {
      const log = document.getElementById('consoleLogs');
      const timestamp = new Date().toISOString();
      log.textContent += \`\\n[\${timestamp}] \${msg}\`;
      log.scrollTop = log.scrollHeight;
    }

    async function atualizarTudo() {
      await Promise.all([fetchStatus(), fetchIp(), fetchUso(), fetchPlayers(), fetchConsoleLogs()]);
    }

    setInterval(atualizarTudo, 5000);
    atualizarTudo();
  </script>
</body>
</html>
`);

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`🚀 Painel rodando em http://localhost:${PORT}`);
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
