# App Icons

## Quick Setup (usando SVG como fallback)

Se você não quiser gerar PNGs, pode usar o SVG diretamente:

1. Renomeie `icon.svg` para cada tamanho necessário:
```bash
cd /Users/joaoviniciussilva/overlay-chat/client/public/icons
cp icon.svg icon-72x72.png
cp icon.svg icon-96x96.png
cp icon.svg icon-128x128.png
cp icon.svg icon-144x144.png
cp icon.svg icon-152x152.png
cp icon.svg icon-192x192.png
cp icon.svg icon-384x384.png
cp icon.svg icon-512x512.png
```

## Opção 1: Gerar PNGs com ImageMagick (Recomendado)

Se você tem ImageMagick instalado:

```bash
cd /Users/joaoviniciussilva/overlay-chat/client/public/icons

# Instalar ImageMagick (se necessário)
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# Gerar todos os tamanhos
convert icon.svg -resize 72x72 icon-72x72.png
convert icon.svg -resize 96x96 icon-96x96.png
convert icon.svg -resize 128x128 icon-128x128.png
convert icon.svg -resize 144x144 icon-144x144.png
convert icon.svg -resize 152x152 icon-152x152.png
convert icon.svg -resize 192x192 icon-192x192.png
convert icon.svg -resize 384x384 icon-384x384.png
convert icon.svg -resize 512x512 icon-512x512.png
```

## Opção 2: Usar um editor online

1. Acesse: https://www.photopea.com/ ou https://www.figma.com/
2. Abra `icon.svg`
3. Exporte nos tamanhos necessários:
   - 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

## Opção 3: Usar seu próprio logo

Substitua `icon.svg` pelo seu logo e execute os comandos acima.

## Tamanhos necessários:

- **72x72**: Android Chrome
- **96x96**: Android Chrome
- **128x128**: Chrome Web Store
- **144x144**: Windows tile
- **152x152**: iOS Safari
- **192x192**: Android Chrome (padrão)
- **384x384**: Android Chrome
- **512x512**: Splash screens e alta resolução
