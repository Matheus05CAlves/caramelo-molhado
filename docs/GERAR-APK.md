# Gerar os APKs

São dois apps Android (Capacitor 8, Android 7.0+ / API 24+):

| APK | Pacote | Ícone |
|---|---|---|
| `caramelo-empresa.apk` — **Caramelo Equipe** | `br.com.caramelomolhado.equipe` | mascote em fundo escuro |
| `caramelo-cliente.apk` — **Caramelo Molhado** | `br.com.caramelomolhado.cliente` | mascote em fundo laranja |

## Opção A — GitHub Actions (sem instalar nada)
1. Crie um repositório no GitHub e envie esta pasta.
2. (Opcional) Em *Settings → Secrets and variables → Actions*, crie `SERVER_URL` com o endereço público do
   servidor (ex.: `https://app.seupetshop.com.br`). Assim o cliente abre o app e já cai no login, sem digitar endereço.
3. Aba **Actions → APKs Android → Run workflow**. Em ~8 minutos os dois APKs aparecem em **Artifacts**.

Sem segredos de assinatura o workflow gera APKs *debug*: instalam normalmente por arquivo (o Android pede para
permitir "instalar apps desconhecidos"), mas não servem para a Play Store.

### APK assinado (Play Store)
```
keytool -genkey -v -keystore caramelo.jks -alias caramelo -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 caramelo.jks   # cole o resultado no segredo KEYSTORE_BASE64
```
Crie também `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`caramelo`) e `KEY_PASSWORD`. **Guarde o .jks** — sem ele não dá
para publicar atualizações.

## Opção B — Android Studio no seu computador
Requer Node 20+, JDK 21 e Android Studio (SDK 36).
```
npm install
npm run apk:empresa   # → mobile/empresa/android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:cliente   # → mobile/cliente/android/app/build/outputs/apk/debug/app-debug.apk
```
Ou `npm run android:sync` e abra `mobile/empresa/android` / `mobile/cliente/android` no Android Studio
(*Build → Build APK(s)*).

Para embutir o endereço do servidor no app do cliente:
`VITE_SERVER_URL=https://app.seupetshop.com.br npm run apk:cliente` (no Windows: `set VITE_SERVER_URL=...` antes).

## Depois de mudar o código
- Interface: `npm run android:sync` (recompila e copia para os projetos Android).
- Ícones/splash: `npm run android:assets`.
- Versão do app: `versionCode`/`versionName` em `mobile/*/android/app/build.gradle`.
