/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Card, Spinner, cx, useToast } from "../ui";
import { data, dataHora } from "../../utils/format";
import { METODOS_ENVIO, nomeForma } from "../../utils/status";

// Acompanhamento do pedido para o cliente: pagamento (time financeiro),
// separação (liberado para a expedição) e envio (finalizado pela expedição).

const CORREIOS = ["PAC", "SEDEX"];
export const siteCorreios = (codigo) => `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(codigo)}`;

const cancelado = (p) => p.statusVendas === "CANCELADO";
const enviado = (p) => p.statusExpedicao === "EXPEDIDO";
const emSeparacao = (p) => p.statusVendas === "LIBERADO" || p.statusExpedicao === "MONTAGEM" || enviado(p);
const pago = (p) => p.statusFinanceiro === "PAGO";
const retirada = (p) => p.metodoEnvio === "RETIRAR_LOCAL";

export const pedidoConcluido = (p) => enviado(p) || cancelado(p);

// Situação atual (o selo do pedido).
export const situacaoPedido = (p) => {
  if (cancelado(p)) return { rotulo: "Cancelado", cor: "danger" };
  if (enviado(p)) return { rotulo: retirada(p) ? "Pronto para retirada" : "Pedido enviado", cor: "success" };
  if (emSeparacao(p)) return { rotulo: "Pedido em separação", cor: "info" };
  if (pago(p)) return { rotulo: "Pagamento confirmado", cor: "success" };
  return { rotulo: "Aguardando pagamento", cor: "warning" };
};

const passosDoPedido = (p) => [
  { titulo: "Pedido realizado", feito: true, em: p.createdAt },
  { titulo: pago(p) ? "Pagamento confirmado" : "Aguardando pagamento", feito: pago(p), em: p.pagoEm },
  { titulo: "Pedido em separação", feito: emSeparacao(p), em: p.liberadoEm },
  { titulo: retirada(p) ? "Pronto para retirada" : "Pedido enviado", feito: enviado(p), em: p.expedidoEm },
  { titulo: "Concluído", feito: enviado(p), em: p.expedidoEm },
];

export function LinhaDoTempo({ pedido }) {
  if (cancelado(pedido)) {
    return <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">Pedido cancelado{pedido.canceladoEm ? ` em ${data(pedido.canceladoEm)}` : ""}.</p>;
  }
  const passos = passosDoPedido(pedido);
  const atual = passos.findIndex((x) => !x.feito);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {passos.map((passo, i) => (
        <li key={passo.titulo} className="flex flex-col items-center text-center">
          <div className="flex w-full items-center">
            <span className={cx("h-0.5 flex-1", i === 0 ? "invisible" : passo.feito ? "bg-emerald-500" : "bg-border")} />
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                passo.feito ? "border-emerald-500 bg-emerald-500 text-white" : i === atual ? "border-amber-500 bg-amber-50 text-amber-700" : "border-border bg-white text-muted-foreground",
              )}
            >
              {passo.feito ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cx("h-0.5 flex-1", i === passos.length - 1 ? "invisible" : passos[i + 1].feito ? "bg-emerald-500" : "bg-border")} />
          </div>
          <span className={cx("mt-1 text-[11px] leading-tight sm:text-xs", passo.feito ? "font-semibold" : i === atual ? "font-semibold text-amber-700" : "text-muted-foreground")}>{passo.titulo}</span>
          {passo.feito && passo.em && <span className="text-[10px] text-muted-foreground">{data(passo.em)}</span>}
        </li>
      ))}
    </ol>
  );
}

// Rastreio dos Correios em tempo real (a API guarda 10 min; a tela consulta
// de novo a cada 5 min enquanto está aberta).
export function RastreioCorreios({ pedido, url, automatico = true }) {
  const [rastreio, setRastreio] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(automatico);
  const [erro, setErro] = useState("");

  const consultar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: d } = await api.get(url);
      setRastreio(d);
      setErro("");
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [url]);

  useEffect(() => {
    if (!aberto) return undefined;
    const primeira = setTimeout(consultar, 0);
    const t = setInterval(() => document.visibilityState === "visible" && consultar(), 5 * 60_000);
    return () => {
      clearTimeout(primeira);
      clearInterval(t);
    };
  }, [aberto, consultar]);

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <MapPin className="h-4 w-4" /> Ver rastreio
      </Button>
    );
  }
  const eventos = rastreio?.eventos || [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Rastreio em tempo real</p>
        <Button size="sm" variant="ghost" loading={carregando} onClick={consultar} aria-label="Atualizar rastreio">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>
      {!rastreio && carregando && <Spinner className="h-5 w-5" />}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      {rastreio && !eventos.length && (
        <p className="text-sm text-muted-foreground">
          {rastreio.indisponivel ? "O rastreio dos Correios não respondeu agora." : rastreio.mensagem || "Os Correios ainda não registraram movimentação deste objeto."}{" "}
          <a className="text-primary underline" href={siteCorreios(pedido.codigoRastreio)} target="_blank" rel="noopener noreferrer">
            Ver no site dos Correios
          </a>
        </p>
      )}
      {eventos.length > 0 && (
        <ol className="space-y-2 border-l-2 border-emerald-200 pl-3">
          {eventos.map((e, i) => (
            <li key={`${e.data}-${i}`} className="relative">
              <span className={cx("absolute -left-[1.1rem] top-1.5 h-2.5 w-2.5 rounded-full", i === 0 ? "bg-emerald-500" : "bg-emerald-200")} />
              <p className={cx("text-sm", i === 0 && "font-semibold")}>{e.descricao}</p>
              {e.detalhe && <p className="text-xs text-muted-foreground">{e.detalhe}</p>}
              <p className="text-xs text-muted-foreground">
                {dataHora(e.data)}
                {e.local ? ` · ${e.local}` : ""}
                {e.destino ? ` → ${e.destino}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CodigoRastreio({ codigo }) {
  const toast = useToast();
  return (
    <span className="inline-flex items-center gap-1">
      <b className="font-mono">{codigo}</b>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => navigator.clipboard?.writeText(codigo).then(() => toast({ titulo: "Código copiado" }))}
        aria-label="Copiar código de rastreio"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <a className="rounded p-1 text-muted-foreground hover:bg-muted" href={siteCorreios(codigo)} target="_blank" rel="noopener noreferrer" aria-label="Abrir no site dos Correios">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}

// Como o pedido está sendo entregue.
export function InfoEnvio({ pedido, urlRastreio, rastreioAutomatico = true }) {
  const metodo = METODOS_ENVIO[pedido.metodoEnvio] || "A definir";
  if (cancelado(pedido)) return null;
  // Etiqueta dos Correios já associada (inclusive feita por fora do site):
  // mostra o rastreio mesmo antes de a expedição finalizar o pedido.
  if (!enviado(pedido) && CORREIOS.includes(pedido.metodoEnvio) && pedido.codigoRastreio) {
    return (
      <div className="space-y-2 rounded-md bg-sky-50 p-3 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sky-900">
          <Truck className="h-4 w-4" /> Envio pelos Correios ({metodo.replace(" - Correios", "")}). Rastreio: <CodigoRastreio codigo={pedido.codigoRastreio} />
        </p>
        {urlRastreio && <RastreioCorreios pedido={pedido} url={urlRastreio} automatico={rastreioAutomatico} />}
      </div>
    );
  }
  if (!enviado(pedido)) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Truck className="h-4 w-4" /> Entrega: {pedido.metodoEnvio === "TRANSPORTADORA" && pedido.transportadoraNome ? `transportadora ${pedido.transportadoraNome}` : metodo}
      </p>
    );
  }
  if (retirada(pedido)) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
        <Package className="h-4 w-4" /> Pedido pronto para retirada na loja{pedido.expedidoEm ? ` desde ${data(pedido.expedidoEm)}` : ""}.
      </p>
    );
  }
  if (CORREIOS.includes(pedido.metodoEnvio)) {
    return (
      <div className="space-y-2 rounded-md bg-emerald-50 p-3 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-emerald-900">
          <Truck className="h-4 w-4" /> Enviado pelos Correios ({metodo.replace(" - Correios", "")})
          {pedido.expedidoEm ? ` em ${data(pedido.expedidoEm)}` : ""}.
          {pedido.codigoRastreio ? (
            <span>
              Rastreio: <CodigoRastreio codigo={pedido.codigoRastreio} />
            </span>
          ) : (
            <span>O código de rastreio aparece aqui assim que for registrado.</span>
          )}
        </p>
        {pedido.codigoRastreio && urlRastreio && <RastreioCorreios pedido={pedido} url={urlRastreio} automatico={rastreioAutomatico} />}
      </div>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">
      <Truck className="h-4 w-4" />
      {pedido.metodoEnvio === "TRANSPORTADORA" && pedido.transportadoraNome
        ? `Seu pedido já foi enviado pela transportadora ${pedido.transportadoraNome}${pedido.expedidoEm ? ` em ${data(pedido.expedidoEm)}` : ""}.`
        : `Seu pedido já foi enviado${pedido.expedidoEm ? ` em ${data(pedido.expedidoEm)}` : ""}.`}
    </p>
  );
}

// Cartão completo de um pedido (Meus pedidos e link de acompanhamento).
export function CartaoAcompanhamento({ pedido, urlRastreio, rastreioAutomatico, extra, children }) {
  const { rotulo, cor } = situacaoPedido(pedido);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">Pedido {pedido.numeroFormatado}</p>
          <p className="text-sm text-muted-foreground">
            Realizado em {data(pedido.createdAt)} · {pedido.quantidadeItens} {pedido.quantidadeItens === 1 ? "item" : "itens"} · {nomeForma(pedido.formaPagamento)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {pedidoConcluido(pedido) && !cancelado(pedido) && <Badge variant="success">Concluído</Badge>}
          <Badge variant={cor}>{rotulo}</Badge>
        </div>
      </div>
      <LinhaDoTempo pedido={pedido} />
      <InfoEnvio pedido={pedido} urlRastreio={urlRastreio} rastreioAutomatico={rastreioAutomatico} />
      {extra}
      {children && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">{children}</div>}
    </Card>
  );
}
