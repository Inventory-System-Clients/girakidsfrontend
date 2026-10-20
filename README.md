# Gira Kids — Frontend

Catálogo digital e sistema de gestão Gira Kids (React + Vite + Tailwind).

Telas: Catálogo, Checkout, Meus Pedidos, Meu Perfil, **Time Financeiro** (resumo, meta, pedidos expedidos, estoque), **Time de Vendas** (aguardando liberação, correios, transportadora, orçamentos, pedidos), **Time Expedição** (checklist de montagem e expedição), **Gerenciar Produtos** (produtos e categorias), **Entradas** (recebimentos e parceiros), **Orçamentos**, **Gerenciar Usuários** e **Comercial** (Transportadoras, Calculadora de Pedidos, Pedidos e Notas Fiscais, Correios) — as ferramentas do Comercial podem puxar os dados direto de um pedido da loja.

## Rodando localmente

```bash
cp .env.example .env    # VITE_API_URL apontando para o backend
npm install
npm run dev             # http://localhost:5173
```

Build de produção: `npm run build` (saída em `dist/`; `vercel.json` já redireciona as rotas para o SPA).
