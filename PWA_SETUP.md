# PWA - Adicionar à Tela Inicial

O Twitch Chat Overlay agora pode ser instalado como um app na tela inicial do seu dispositivo!

## ✨ Recursos PWA

- 📱 **Fullscreen** - Abre em tela cheia como um app nativo
- 🎨 **Ícone personalizado** - Aparece na tela inicial com ícone próprio
- 🚀 **Lançamento rápido** - Abre direto sem navegar no browser
- 📵 **Modo standalone** - Interface limpa sem barra do navegador
- 🔄 **Sincronização automática** - Mantém mensagens sincronizadas mesmo offline

---

## 📱 Como Adicionar no Android (Chrome)

1. Acesse o app no Chrome: `http://seu-servidor:3000/mobile.html`

2. Toque no menu (⋮) no canto superior direito

3. Selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**

4. Confirme a instalação

5. O app aparecerá na tela inicial com o ícone! 🎉

### Alternativa rápida:
- Alguns navegadores mostram automaticamente um banner pedindo para instalar

---

## 🍎 Como Adicionar no iPhone (Safari)

1. Acesse o app no Safari: `http://seu-servidor:3000/mobile.html`

2. Toque no botão **Compartilhar** (quadrado com seta para cima)

3. Role para baixo e toque em **"Adicionar à Tela de Início"**

4. Edite o nome se quiser (ex: "Chat IRL")

5. Toque em **"Adicionar"**

6. O app aparecerá na tela inicial! 🎉

### Recursos no iOS:
- ✅ Tela cheia (sem barra do Safari)
- ✅ Status bar preta translúcida
- ✅ Ícone personalizado
- ✅ Nome personalizado

---

## 💻 Como Adicionar no Desktop (Chrome/Edge)

1. Acesse: `http://localhost:3000`

2. Clique no ícone de **"Instalar"** (➕) na barra de endereço

   Ou menu (⋮) → **"Instalar Twitch Chat Overlay"**

3. Confirme a instalação

4. O app abrirá em uma janela separada!

### Desktop features:
- ✅ Janela própria (sem barra de navegação)
- ✅ Atalho no menu Iniciar/Aplicativos
- ✅ Abre como app independente

---

## 🎯 Páginas Disponíveis

### 1. **Página Principal** (`/` ou `/index.html`)
- Seletor de modos
- Use para escolher entre Overlay ou Mobile

### 2. **Modo Mobile/IRL** (`/mobile.html`) ⭐ RECOMENDADO PARA PWA
- Interface otimizada para celular
- Ideal para lives IRL
- Histórico infinito de mensagens
- Suporte a LivePix (alertas de doação)
- **Melhor experiência em fullscreen**

### 3. **Modo Overlay** (`/overlay.html`)
- Para OBS Browser Source
- Fundo transparente
- Limite de 50 mensagens

---

## 🔧 Configuração no Servidor

O PWA já está configurado! Mas para produção:

1. **Configure o domínio/IP** no arquivo de configuração

2. **HTTPS é recomendado** (mas funciona em localhost sem HTTPS)
   ```bash
   # Para usar em rede local, acesse pelo IP:
   http://192.168.x.x:3000/mobile.html
   ```

3. **Personalize os ícones** (opcional)
   ```bash
   cd client/public/icons
   # Substitua os ícones pelos seus próprios
   # Veja client/public/icons/README.md para instruções
   ```

---

## 🎨 Personalização

### Mudar nome do app:
Edite `client/public/manifest.json`:
```json
{
  "name": "Seu Nome Aqui",
  "short_name": "Nome Curto"
}
```

### Mudar cores:
```json
{
  "theme_color": "#667eea",
  "background_color": "#0f0f0f"
}
```

### Depois de alterar, faça rebuild:
```bash
cd client
npm run build
```

---

## ✅ Checklist de Instalação

- [ ] Servidor rodando (`npm start` no `server/`)
- [ ] Acesse a URL no navegador móvel
- [ ] Veja o prompt de instalação ou adicione manualmente
- [ ] App aparece na tela inicial
- [ ] Abre em fullscreen
- [ ] Ícone personalizado visível

---

## 🐛 Troubleshooting

### "Não aparece opção de instalar"
- ✅ Certifique-se que está usando Chrome/Safari
- ✅ Acesse via HTTP ou HTTPS (não file://)
- ✅ Verifique se o manifest.json está acessível: `http://localhost:3000/manifest.json`

### "Ícones não aparecem"
- ✅ Gere os PNGs a partir do SVG (veja `client/public/icons/README.md`)
- ✅ Verifique se os arquivos existem em `server/public/icons/`

### "App não abre em fullscreen"
- ✅ No manifest.json, `"display": "standalone"` está configurado
- ✅ No iOS, adicione usando Safari (não Chrome)

---

## 📖 Mais Informações

- **PWA**: Progressive Web App
- **Manifest**: `client/public/manifest.json`
- **Ícones**: `client/public/icons/`
- **Build**: `npm run build` no diretório `client/`

Aproveite seu app! 🚀
