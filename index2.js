const express = require('express');
const axios = require('axios');
const os = require('os');

const app = express();
const PORT = 3000;

// ===== CONFIGURAÇÕES =====
const PANEL_URL = 'https://backend.magmanode.com'; // URL do painel
const SERVER_ID = 'c9593e69'; // ID do servidor
const CLIENT_TOKEN = 'ptlc_ZLN2GPS3fO4t1jYPU4IS9YPYaXQ72l1osG24wmsi4JQ'; // Token da API

// ===== MIDDLEWARE =====
app.use(express.json());

// CORS para HTML hospedado em outro lugar
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // pode trocar '*' pelo domínio do HTML
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ===== FUNÇÕES AUXILIARES =====
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function fetchServerData() {
  try {
    const response = await axios.get(
      `${PANEL_URL}/api/client/servers/${SERVER_ID}/resources`,
      {
        headers: {
          Authorization: `Bearer ${CLIENT_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'Application/vnd.pterodactyl.v1+json',
        },
      }
    );

    const data = response.data.attributes;
    return {
      status: data.current_state,
      players: data.players || 'Indisponível',
      cpu: `${data.resources.cpu_absolute.toFixed(2)}%`,
      ram: `${(data.resources.memory_bytes / 1024 / 1024).toFixed(0)}MB`,
      disk: `${(data.resources.disk_bytes / 1024 / 1024).toFixed(0)}MB`,
    };
  } catch (err) {
    console.error('[ERRO API]', err.response?.data || err.message);
    throw new Error('Erro ao buscar dados do MagmaNode');
  }
}

// ===== ROTAS =====
app.get('/', (req, res) => {
  res.json({ message: 'API do Painel Minecraft rodando ✅' });
});

app.get('/api/status', async (req, res) => {
  try {
    const data = await fetchServerData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/info', (req, res) => {
  res.json({
    ip: 'exemplo.aternos.me',
    porta: '12345',
    mensagem: 'Servidor Minecraft Bedrock configurado',
  });
});

// ===== ROTAS DE CONTROLE (LIGAR/DESLIGAR) =====
app.post('/api/power/start', async (req, res) => {
  try {
    await axios.post(
      `${PANEL_URL}/api/client/servers/${SERVER_ID}/power`,
      { signal: 'start' },
      {
        headers: {
          Authorization: `Bearer ${CLIENT_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'Application/vnd.pterodactyl.v1+json',
        },
      }
    );
    res.json({ success: true, message: 'Servidor iniciando...' });
  } catch (err) {
    console.error('[ERRO START]', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Erro ao ligar servidor' });
  }
});

app.post('/api/power/stop', async (req, res) => {
  try {
    await axios.post(
      `${PANEL_URL}/api/client/servers/${SERVER_ID}/power`,
      { signal: 'stop' },
      {
        headers: {
          Authorization: `Bearer ${CLIENT_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'Application/vnd.pterodactyl.v1+json',
        },
      }
    );
    res.json({ success: true, message: 'Servidor desligando...' });
  } catch (err) {
    console.error('[ERRO STOP]', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Erro ao desligar servidor' });
  }
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`✅ Backend rodando em: http://${ip}:${PORT}`);
});
