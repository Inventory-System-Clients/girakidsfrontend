import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  LogOut,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { Button, Popover, cx } from "./ui";
import { moeda } from "../utils/format";
import { useAlertasRecebimentos } from "./recebimentos/comum";

function grupos(pode, usuario, alertasRecebimentos) {
  const lista = [
    {
      titulo: "Conta",
      itens: [
        usuario?.role !== "SHOWROOM" && { label: "Meu Perfil", rota: "/perfil" },
        usuario?.role === "CLIENTE" && { label: "Meus Pedidos", rota: "/meus-pedidos" },
      ],
    },
    {
      titulo: "Operação",
      itens: [
        pode("FINANCEIRO") && { label: "Time Financeiro", rota: "/dashboard" },
        pode("VENDAS") && { label: "Time de Vendas", rota: "/historico-pedidos" },
        pode("EXPEDICAO") && { label: "Time Expedição", rota: "/expedicao" },
      ],
    },
    {
      titulo: "Gestão",
      itens: [
        pode("PRODUTOS") && { label: "Gerenciar Produtos", rota: "/produtos" },
        pode("RECEBIMENTOS") && { label: "Recebimentos", rota: "/recebimentos", contador: alertasRecebimentos },
        pode("ORCAMENTOS") && { label: "Orçamentos", rota: "/orcamentos" },
        pode("PRODUTOS", "COMERCIAL") && { label: "Banners do catálogo", rota: "/banners" },
      ],
    },
    {
      titulo: "Comercial",
      itens: pode("COMERCIAL")
        ? [
            { label: "🚚 Transportadoras", rota: "/comercial/transportadoras" },
            { label: "📦 Calculadora de Pedidos", rota: "/comercial/calculadora-pedidos" },
            { label: "📑 Pedidos e Notas Fiscais", rota: "/comercial/pedidos-notas-fiscais" },
            { label: "📮 Correios", rota: "/comercial/correios" },
            { label: "💸 Custos pós-venda", rota: "/comercial/custos-pos-venda" },
          ]
        : pode("FINANCEIRO", "VENDAS")
          ? [{ label: "💸 Custos pós-venda", rota: "/comercial/custos-pos-venda" }]
          : [],
    },
    {
      titulo: "Administração",
      itens: [
        pode("USUARIOS") && { label: "Gerenciar Usuários", rota: "/usuarios" },
      ],
    },
  ];
  return lista.map((g) => ({ ...g, itens: g.itens.filter(Boolean) })).filter((g) => g.itens.length);
}

function CarrinhoDrawer({ aberto, onFechar }) {
  const { itens, definirQuantidade, subtotal, limpar } = useCart();
  const navigate = useNavigate();
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5 text-primary" /> Carrinho
          </h2>
          <button onClick={onFechar} className="rounded p-1 hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!itens.length && <p className="py-10 text-center text-muted-foreground">Carrinho vazio</p>}
          {itens.map(({ produto, quantidade }) => (
            <div key={produto.id} className="flex gap-3 border-b border-border py-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {produto.imagemUrl && <img src={produto.imagemUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{produto.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {produto.unidadesPacote > 1 ? `${quantidade} pct × ${produto.unidadesPacote} un` : `${quantidade} un`}
                </p>
                <p className="text-sm font-semibold text-primary">{moeda(produto.precoVenda * produto.unidadesPacote * quantidade)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded border p-1" onClick={() => definirQuantidade(produto, quantidade - 1)} aria-label="Diminuir">
                  {quantidade === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </button>
                <span className="w-7 text-center text-sm">{quantidade}</span>
                <button className="rounded border p-1" onClick={() => definirQuantidade(produto, quantidade + 1)} aria-label="Aumentar">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>{moeda(subtotal)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={!itens.length} onClick={limpar}>
              Esvaziar
            </Button>
            <Button
              variant="success"
              className="flex-1"
              disabled={!itens.length}
              onClick={() => {
                onFechar();
                navigate("/checkout");
              }}
            >
              Finalizar Pedido
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function Header() {
  const { usuario, logout, pode } = useAuth();
  const { quantidade } = useCart();
  const navigate = useNavigate();
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const alertasRecebimentos = useAlertasRecebimentos(Boolean(usuario) && pode("RECEBIMENTOS"))?.total || 0;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.webp" alt="" className="h-11 w-11 object-contain" />
          <span className="text-lg font-semibold">Gira Kids</span>
        </Link>
        <div className="flex items-center gap-2">
          {usuario ? (
            <Popover
              alinhamento="end"
              gatilho={
                <button className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium hover:bg-muted">
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-32 truncate sm:inline">{usuario.nome?.split(" ")[0]}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  {alertasRecebimentos > 0 && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Há alertas em Recebimentos" />}
                </button>
              }
            >
              {(fechar) => (
                <nav className="w-60 py-1">
                  {grupos(pode, usuario, alertasRecebimentos).map((g) => (
                    <div key={g.titulo} className="mb-1">
                      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.titulo}</p>
                      {g.itens.map((i) => (
                        <button
                          key={i.rota}
                          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            fechar();
                            navigate(i.rota);
                          }}
                        >
                          {i.label}
                          {i.contador > 0 && <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{i.contador}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="mt-1 border-t border-border pt-1">
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
                        fechar();
                        logout();
                        navigate("/");
                      }}
                    >
                      <LogOut className="h-4 w-4" /> Sair
                    </button>
                  </div>
                </nav>
              )}
            </Popover>
          ) : (
            <Button variant="ghost" onClick={() => navigate("/login")}>
              <User className="h-4 w-4" /> Login
            </Button>
          )}
          <button
            onClick={() => setCarrinhoAberto(true)}
            className="hidden h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-muted sm:flex"
          >
            <ShoppingBag className="h-4 w-4" />
            {quantidade ? `${quantidade} ${quantidade === 1 ? "item" : "itens"}` : "Carrinho Vazio"}
          </button>
          <button
            onClick={() => (quantidade ? navigate("/checkout") : setCarrinhoAberto(true))}
            className={cx(
              "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition",
              quantidade ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-300",
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Finalizar Pedido</span>
            {quantidade > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs sm:hidden">{quantidade}</span>}
          </button>
        </div>
      </div>
      <CarrinhoDrawer aberto={carrinhoAberto} onFechar={() => setCarrinhoAberto(false)} />
    </header>
  );
}

// Compatibilidade com as telas do Comercial herdadas do AgarraMais (lá cada
// página renderizava a própria Navbar/Footer; aqui o Header é global).
export const Navbar = () => null;
export const Footer = () => null;
