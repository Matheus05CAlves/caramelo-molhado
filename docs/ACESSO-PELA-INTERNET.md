# Clientes usando o app fora da loja

Na rede Wi-Fi da loja os celulares acessam o PC direto (`http://192.168.x.x:3737`). Para o cliente usar de casa,
no 4G, o servidor precisa de um endereço na internet. Três caminhos, do mais simples ao mais robusto:

## 1. Túnel gratuito da Cloudflare (recomendado para começar)
Mantém o banco no PC da loja e dá um endereço **HTTPS** sem abrir portas no roteador.
1. Instale o `cloudflared` no PC da loja (site da Cloudflare → *Cloudflare Tunnel*).
2. Teste rápido (endereço muda a cada execução):
   `cloudflared tunnel --url http://localhost:3737`
3. Definitivo: crie uma conta grátis, adicione seu domínio e crie um túnel nomeado apontando para
   `http://localhost:3737`, como serviço do Windows. Você ganha algo como `https://app.seupetshop.com.br`.
4. Use esse endereço nos apps (ou embuta no APK do cliente com o segredo `SERVER_URL` — ver `GERAR-APK.md`).

> O PC precisa ficar ligado com o app desktop aberto para os clientes conseguirem agendar.

## 2. Redirecionamento de porta no roteador
Redirecione a porta 3737 do roteador para o IP do PC e use um DNS dinâmico (ex.: No-IP).
Funciona, mas o tráfego fica **sem HTTPS** — prefira o túnel.

## 3. Servidor na nuvem (PC não precisa ficar ligado)
O `Dockerfile` roda o mesmo servidor em Render, Railway, Fly.io ou uma VPS:
```
docker build -t caramelo .
docker run -d -p 3737:3737 -v caramelo-dados:/data caramelo
```
- **Obrigatório** um volume persistente em `/data` (é onde fica o banco).
- Na nuvem o banco é o da nuvem: a recepção passa a usar o **app da equipe** (APK ou navegador) apontando
  para esse endereço. Para levar os dados atuais: no desktop faça um backup e, logado como admin no app da equipe
  conectado à nuvem, use *Configurações → Dados → Restaurar backup*.
- `DEMO=0` (padrão no Dockerfile) começa sem dados de exemplo; login inicial `admin` / `admin123`.
