# Instalar o Hugo's Piano no iPhone (grátis, com SideStore)

A app do iPhone é igual à versão web, mas lê o piano por **cabo USB** e por **Bluetooth MIDI**, e mantém o ecrã sempre ligado.

## 1. Preparar o Mac (uma vez)

1. Instala o **Xcode** a partir da Mac App Store e abre-o uma vez, para aceitar a licença.
2. No Terminal, aponta as ferramentas para o Xcode (vai pedir a tua password do Mac):

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

## 2. Gerar a app (`.ipa`)

Na pasta `HugosPiano`:

```bash
npm run ipa
```

O resultado fica em `HugosPiano/HugosPiano.ipa`. Não precisa de assinatura: a SideStore assina-a com o teu Apple ID.

## 3. Instalar a SideStore no iPhone (uma vez)

Segue o guia oficial, que muda de vez em quando: **https://docs.sidestore.io**

Em resumo:
- No Mac, usa o instalador indicado no guia para pôr a SideStore no iPhone com o teu Apple ID grátis.
- No iPhone, ativa o **Modo de programador**: Definições → Privacidade e segurança → Modo de programador.
- Instala a app de VPN local que o guia indicar. É o que deixa a SideStore renovar as apps sozinha pelo Wi-Fi.

## 4. Pôr o Hugo's Piano na SideStore

1. Envia o `HugosPiano.ipa` para o iPhone (AirDrop → guardar em Ficheiros).
2. Abre a SideStore → **My Apps** → **+** → escolhe o `HugosPiano.ipa`.
3. Pronto. A SideStore renova a app antes dos 7 dias, desde que a abras de vez em quando com a VPN ligada.

Limite do Apple ID grátis: 3 apps assinadas ao mesmo tempo, e a SideStore conta como uma.

## 5. Ligar o piano

- **Cabo:** o iPhone 13 tem porta Lightning, por isso precisas do **Lightning to USB Camera Adapter** (Apple). A versão "USB 3" deixa-te carregar o telemóvel ao mesmo tempo. O cabo USB do piano liga ao adaptador. A app deteta o teclado sozinha e mostra "Keyboard connected".
- **Bluetooth:** em Input → Bluetooth MIDI abre-se a janela de Bluetooth MIDI do iOS. Escolhe o piano, toca em Done e ele passa a aparecer como teclado ligado.
- **Microfone:** funciona como na versão web.

## Atualizar a app

Depois de mudanças no código: volta a correr `npm run ipa` e, na SideStore, instala o novo `.ipa` por cima. As músicas importadas e o progresso ficam guardados.
