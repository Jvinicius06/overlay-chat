# 🐳 Docker Quick Start

## Uso Rápido

```bash
# 1. Configure canais e URLs
cp .env.docker .env
nano .env

# 2. Build e start
docker-compose up -d

# 3. Acesse
# http://localhost:3000 - Chat Overlay
# http://localhost:3000/mobile.html - Mobile com áudio
```

## Comandos Essenciais

```bash
# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

## Configuração Mínima (.env)

```env
TWITCH_CHANNELS=sacy,aspas
LIVEPIX_URLS=https://sua-url.livepix.gg
```

## Features Incluídas

✅ **Puppeteer** - Captura de áudio do LivePix
✅ **Chrome Headless** - Todas as dependências instaladas
✅ **Health Check** - Monitoramento automático
✅ **Auto-restart** - Reinicia se falhar
✅ **Logs persistentes** - Salvos em `./logs`

## Recursos Mínimos

- **RAM**: 512MB (recomendado: 1GB)
- **CPU**: 1 core
- **Disco**: ~500MB

## Troubleshooting

**Puppeteer não inicia:**
```bash
docker-compose build --no-cache
docker-compose up -d
```

**Ver logs do Puppeteer:**
```bash
docker-compose logs -f | grep AudioCapture
```

**Health check:**
```bash
curl http://localhost:3000/api/health
```

📖 **Documentação completa:** Ver [DOCKER_GUIDE.md](DOCKER_GUIDE.md)
