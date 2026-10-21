import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, ChevronDown, ChevronUp, Eye } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, useToast } from "./ui";
import PedidoDetalhes from "./pedido/PedidoDetalhes";
import { BotaoWhatsapp } from "./Whatsapp";
import { EtiquetasChips } from "./Etiquetas";
import { dataHora, moeda } from "../utils/format";
import { METODOS_ENVIO, nomeForma } from "../utils/status";

const INTERVALO = 60000;

// Faixa no topo para o comercial: pedidos que o cliente fez sozinho pelo
// site e que ninguém viu ainda.
export default function AlertasClientes() {
  const { pode, usuario } = useAuth();
  const toast = useToast();
  const [alertas, setAlertas] = useState([]);
  const [aberto, setAberto] = useState(true);
  const [ver, setVer] = useState(null);
  const anterior = useRef(null);
  const habilitado = Boolean(usuario) && pode("VENDAS", "COMERCIAL");

  const carregar = useCallback(() => {
    if (!habilitado) return;
    api
      .get("/comercial/alertas-clientes")
      .then(({ data }) => {
        if (anterior.current != null && data.length > anterior.current) {
          toast({ titulo: "Novo pedido feito pelo cliente!", descricao: `${data[0].clienteNome} · ${moeda(data[0].total)}`, tipo: "aviso" });
          setAberto(true);
        }
        anterior.current = data.length;
        setAlertas(data);
      })
      .catch(() => {});
  }, [habilitado, toast]);

  useEffect(() => {
    carregar();
    if (!habilitado) return undefined;
    const t = setInterval(carregar, INTERVALO);
    return () => clearInterval(t);
  }, [carregar, habilitado]);

  if (!habilitado || !alertas.length) return null;

  const marcar = async (id) => {
    await api.post(`/comercial/alertas-clientes/${id}/visto`);
    setAlertas((a) => (id === "todos" ? [] : a.filter((x) => x.id !== id)));
    anterior.current = id === "todos" ? 0 : (anterior.current || 1) - 1;
  };

  return (
    <div className="no-print border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setAberto(!aberto)} className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <BellRing className="h-4 w-4 animate-pulse" />
            {alertas.length === 1 ? "1 cliente comprou sozinho pelo site" : `${alertas.length} clientes compraram sozinhos pelo site`} — entre em contato
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {alertas.length > 1 && (
            <button type="button" className="text-xs text-amber-900 underline" onClick={() => marcar("todos")}>
              Marcar todos como vistos
            </button>
          )}
        </div>
        {aberto && (
          <div className="mt-2 space-y-2 pb-1">
            {alertas.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <strong>Pedido {a.numero}</strong> · {a.clienteNome} <EtiquetasChips etiquetas={a.etiquetas} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {moeda(a.total)} · {nomeForma(a.formaPagamento)} · {METODOS_ENVIO[a.metodoEnvio] || "-"} · {dataHora(a.createdAt)}
                  </p>
                  {a.observacaoComercial && <p className="text-xs text-amber-800">Obs.: {a.observacaoComercial}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.clienteTelefone && (
                    <BotaoWhatsapp telefone={a.clienteTelefone} texto={`Olá ${a.clienteNome.split(" ")[0]}! Aqui é do comercial da Gira Kids. Recebemos seu pedido nº ${a.numero} de ${moeda(a.total)}. Posso te ajudar a finalizar?`}>
                      WhatsApp do cliente
                    </BotaoWhatsapp>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setVer(a.id)}>
                    <Eye className="h-4 w-4" /> Ver pedido
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => marcar(a.id)}>
                    <Check className="h-4 w-4" /> Visto
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PedidoDetalhes pedidoId={ver} onFechar={() => setVer(null)} />
    </div>
  );
}
