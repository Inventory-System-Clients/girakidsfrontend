import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Clock, Download, GripVertical, PackageCheck, Search } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Badge,
  Button,
  Card,
  Dialog,
  FiltroMulti,
  Paginacao,
  PeriodoPicker,
  PageHeader,
  Skeleton,
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  useConfirm,
  useToast,
} from "../components/ui";
import AcoesPedido from "../components/pedido/AcoesPedido";
import { EtiquetasChips } from "../components/Etiquetas";
import { CelulaData, CelulaEnvio, CelulaExpedicao, CelulaFinanceiro, CelulaMetodo, CelulaNumero, CelulaVendas } from "../components/pedido/StatusCelulas";
import { dataHora, exportarCsv, inicioMesISO, hojeISO, moeda } from "../utils/format";
import { EXPEDICAO, FINANCEIRO, FORMAS_PAGAMENTO, METODOS_ENVIO, VENDAS, corLinhaPedido, nomeForma } from "../utils/status";

// Pedidos em reserva (aguardando estoque) ficam só na aba "Em reserva".
const ABAS = [
  { value: "AGUARDANDO", label: "Aguardando liberação", filtro: { vendas: "AGUARDANDO", reserva: "0" } },
  { value: "CORREIOS", label: "Entrega correios", filtro: { envio: "PAC,SEDEX", reserva: "0" } },
  { value: "TRANSPORTADORA", label: "Entrega transportadora", filtro: { envio: "TRANSPORTADORA", reserva: "0" } },
  { value: "ORCAMENTOS", label: "Orçamentos", filtro: { tipo: "ORCAMENTO" } },
  { value: "PEDIDOS", label: "Pedidos", filtro: { reserva: "0" } },
  { value: "RESERVA", label: "Em reserva", filtro: { reserva: "1" } },
];

// Abas que mostram tudo o que está pendente, sem limitar pelo período.
const SEM_PERIODO = ["AGUARDANDO", "RESERVA"];

// Pode ir para a reserva arrastando: pedido ativo e ainda não expedido.
const podeReservar = (p) => p.tipo === "PEDIDO" && p.statusVendas !== "CANCELADO" && p.statusExpedicao !== "EXPEDIDO" && !p.reservaEm;

const opcoesFormas = Object.fromEntries(Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => [k, v.label]));

function AlertasPagamento({ aberto, onFechar, onResolvido }) {
  const [alertas, setAlertas] = useState(null);
  const toast = useToast();
  useEffect(() => {
    if (aberto) api.get("/pedidos/alertas-pagamento").then(({ data }) => setAlertas(data));
  }, [aberto]);
  const resolver = async (id) => {
    try {
      await api.put(`/pedidos/alertas-pagamento/${id}/resolver`);
      setAlertas((a) => a.filter((x) => x.id !== id));
      onResolvido();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Dialog aberto={aberto} onFechar={onFechar} tamanho="lg" titulo="Alertas de pagamento" descricao="Retornos do banco/gateway que precisam de revisão antes da conciliação.">
      {!alertas && <Skeleton className="h-24" />}
      {alertas?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta ativo.</p>}
      <div className="space-y-2">
        {alertas?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Badge variant={a.severidade === "critical" ? "danger" : "warning"}>{a.severidade === "critical" ? "Crítico" : "Revisar"}</Badge>
              <p className="mt-1 text-sm font-medium">{a.mensagem}</p>
              <p className="text-xs text-muted-foreground">
                {dataHora(a.createdAt)} · {a.provedor || "-"}
                {a.valorRecebido != null && ` · recebido ${moeda(a.valorRecebido)}`}
                {a.valorEsperado != null && ` · esperado ${moeda(a.valorEsperado)}`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => resolver(a.id)}>
              Marcar como revisado
            </Button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

export default function HistoricoPedidos() {
  const { pode } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const [arrastando, setArrastando] = useState(null);
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") || "PEDIDOS";
  const [periodo, setPeriodo] = useState({ inicio: inicioMesISO(), fim: hojeISO() });
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtros, setFiltros] = useState({ formas: [], financeiro: [], vendas: [], expedicao: [] });
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(30);
  const [dados, setDados] = useState(null);
  const [contadores, setContadores] = useState({});
  const [cartoes, setCartoes] = useState(null);
  const [verAlertas, setVerAlertas] = useState(false);

  const filtroAba = ABAS.find((a) => a.value === aba)?.filtro || {};
  const parametros = useCallback(
    (extra = {}) => ({
      ...filtroAba,
      // "Aguardando liberação" mostra tudo que está pendente, sem limitar pelo período.
      inicio: SEM_PERIODO.includes(aba) ? undefined : periodo.inicio,
      fim: SEM_PERIODO.includes(aba) ? undefined : periodo.fim,
      busca: buscaAplicada || undefined,
      formas: filtros.formas.join(",") || undefined,
      financeiro: filtros.financeiro.join(",") || undefined,
      vendas: filtroAba.vendas || filtros.vendas.join(",") || undefined,
      expedicao: filtros.expedicao.join(",") || undefined,
      ...extra,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aba, periodo, buscaAplicada, filtros],
  );

  const carregar = useCallback(() => {
    setDados(null);
    api
      .get("/pedidos", { params: parametros({ pagina, limite }) })
      .then(({ data }) => setDados(data))
      .catch((e) => {
        toast({ titulo: "Erro ao carregar pedidos", descricao: mensagemErro(e), tipo: "erro" });
        setDados({ itens: [], total: 0, pagina: 1, paginas: 1 });
      });
    api.get("/pedidos/contadores").then(({ data }) => setContadores(data)).catch(() => {});
  }, [parametros, pagina, limite, toast]);

  useEffect(carregar, [carregar]);
  useEffect(() => {
    api.get("/checkout/opcoes").then(({ data }) => setCartoes(data.cartoesOnlineHabilitados)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim().length >= 2 ? busca.trim() : "");
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const atualizarLinha = (pedido) => {
    if (!pedido) return carregar();
    // Entrou ou saiu da reserva pelo menu: muda de aba, recarrega a lista.
    if (pedido.tipo === "PEDIDO" && Boolean(pedido.reservaEm) !== (aba === "RESERVA")) return carregar();
    setDados((d) => (d?.itens.some((p) => p.id === pedido.id) ? { ...d, itens: d.itens.map((p) => (p.id === pedido.id ? { ...p, ...pedido } : p)) } : d));
    if (pedido.tipo === "PEDIDO" && !dados?.itens.some((p) => p.id === pedido.id)) carregar();
    api.get("/pedidos/contadores").then(({ data }) => setContadores(data)).catch(() => {});
  };

  const alternarCartoes = async (valor) => {
    try {
      const { data } = await api.put("/pedidos/config/cartoes-online", { habilitado: valor });
      setCartoes(data.habilitado);
      toast({ titulo: data.habilitado ? "Cartões online habilitados" : "Cartões online desabilitados" });
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const exportar = async () => {
    try {
      const { data } = await api.get("/pedidos", { params: parametros({ pagina: 1, limite: 500 }) });
      exportarCsv(`pedidos-${periodo.inicio}-a-${periodo.fim}`, [
        { titulo: "Número", valor: (p) => p.numeroFormatado },
        { titulo: "Cliente", valor: (p) => p.clienteNome },
        { titulo: "Email", valor: (p) => p.clienteEmail },
        { titulo: "Data", valor: (p) => dataHora(p.createdAt) },
        { titulo: "Itens", valor: (p) => p.quantidadeItens },
        { titulo: "Total", valor: (p) => String(p.total).replace(".", ",") },
        { titulo: "Método", valor: (p) => nomeForma(p.formaPagamento) },
        { titulo: "Entrega", valor: (p) => METODOS_ENVIO[p.metodoEnvio] || "" },
        { titulo: "Time Financeiro", valor: (p) => FINANCEIRO[p.statusFinanceiroEfetivo] },
        { titulo: "Time Vendas", valor: (p) => VENDAS[p.statusVendas] },
        { titulo: "Time Expedição", valor: (p) => EXPEDICAO[p.statusExpedicao] },
      ], data.itens);
    } catch (error) {
      toast({ titulo: "Erro ao exportar", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const alterarReserva = async (pedido, reserva) => {
    if (!reserva) {
      const ok = await confirmar({ titulo: `O produto do pedido ${pedido.numeroFormatado} chegou?`, mensagem: "O pedido volta para a lista de pedidos e aparece de novo para o time de expedição.", confirmar: "Produto chegou" });
      if (!ok) return;
    }
    try {
      await api.post(`/pedidos/${pedido.id}/reserva`, { reserva });
      toast({
        titulo: reserva ? `Pedido ${pedido.numeroFormatado} em reserva` : `Pedido ${pedido.numeroFormatado} voltou para a lista`,
        descricao: reserva ? "Saiu da lista de pedidos e da expedição até o produto chegar." : "Já aparece de novo para o time de expedição.",
      });
      carregar();
    } catch (error) {
      toast({ titulo: "Erro ao alterar reserva", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const soltarNaReserva = (e) => {
    const id = e.dataTransfer.getData("text/pedido-id");
    const pedido = dados?.itens.find((p) => p.id === id);
    setArrastando(null);
    if (pedido && podeReservar(pedido)) alterarReserva(pedido, true);
  };

  const orcamentos = aba === "ORCAMENTOS";
  const reservas = aba === "RESERVA";
  const arrastavel = !orcamentos && !reservas && pode("VENDAS");
  const set = (chave) => (valores) => {
    setFiltros((f) => ({ ...f, [chave]: valores }));
    setPagina(1);
  };

  return (
    <div className="container-app py-6">
      <PageHeader titulo="Histórico de Pedidos" subtitulo="Gerencie todos os pedidos realizados na plataforma" />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          abas={ABAS.map((a) => ({
            ...a,
            label:
              a.value === "RESERVA" ? (
                <>
                  <Clock className="h-3.5 w-3.5" /> Em reserva
                </>
              ) : (
                a.label
              ),
            contador: a.value === "AGUARDANDO" ? contadores.aguardandoLiberacao : a.value === "RESERVA" ? contadores.emReserva : 0,
            ...(a.value === "RESERVA" && arrastavel ? { onDrop: soltarNaReserva, destaque: Boolean(arrastando) } : {}),
          }))}
          ativa={aba}
          onChange={(v) => {
            setParams({ aba: v });
            setPagina(1);
          }}
        />
        {pode("VENDAS", "FINANCEIRO") && cartoes !== null && <Switch label="Habilitar cartões online" checked={cartoes} onChange={alternarCartoes} />}
      </div>

      {arrastavel && (
        <p className={`-mt-2 mb-3 text-xs ${arrastando ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
          {arrastando
            ? `Solte o pedido ${arrastando} na aba "Em reserva" para colocá-lo aguardando estoque.`
            : "Pedido aguardando estoque? Arraste a linha até a aba \"Em reserva\" (ou use o menu ⋮ → Colocar em reserva)."}
        </p>
      )}
      {reservas && (
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">
          Pedidos aguardando chegar estoque. Eles não aparecem na lista de pedidos nem para o time de expedição; valores, financeiro e pagamentos seguem normais. Quando o produto chegar, clique em <strong>Produto chegou</strong>.
        </p>
      )}

      {contadores.alertasPagamento > 0 && (
        <Card className="mb-4 flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Alertas de pagamento <Badge variant="warning">{contadores.alertasPagamento}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">Há pedidos com pagamento online que receberam retorno do banco e precisam de revisão antes da conciliação.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setVerAlertas(true)}>
            Ver alertas
          </Button>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar por número do pedido, nome ou email..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <FiltroMulti titulo="Método" opcoes={opcoesFormas} valores={filtros.formas} onChange={set("formas")} />
        {!orcamentos && (
          <>
            <FiltroMulti titulo="Time Financeiro" opcoes={FINANCEIRO} valores={filtros.financeiro} onChange={set("financeiro")} />
            {aba !== "AGUARDANDO" && <FiltroMulti titulo="Time Vendas" opcoes={VENDAS} valores={filtros.vendas} onChange={set("vendas")} />}
            <FiltroMulti titulo="Time Expedição" opcoes={{ NAO_INICIADO: "Não iniciado", MONTAGEM: "Montagem Pedido", EXPEDIDO: "Expedido" }} valores={filtros.expedicao} onChange={set("expedicao")} />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!SEM_PERIODO.includes(aba) && (
            <PeriodoPicker
              inicio={periodo.inicio}
              fim={periodo.fim}
              onChange={(p) => {
                setPeriodo(p);
                setPagina(1);
              }}
            />
          )}
          <Button variant="outline" size="icon" onClick={exportar} aria-label="Exportar">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Cliente</Th>
            <Th>Data</Th>
            <Th>Itens</Th>
            <Th>Total</Th>
            <Th>Método</Th>
            <Th>Método de entrega</Th>
            <Th>Time Financeiro</Th>
            <Th>Time Vendas</Th>
            <Th>Time Expedição</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {!dados &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={11} className="p-3">
                  <Skeleton className="h-8" />
                </td>
              </tr>
            ))}
          {dados?.itens.map((p) => (
            <tr
              key={p.id}
              className={`${orcamentos ? "hover:bg-muted/50" : corLinhaPedido(p)} ${arrastando === p.numeroFormatado ? "opacity-50" : ""}`}
              {...(arrastavel && podeReservar(p)
                ? {
                    draggable: true,
                    onDragStart: (e) => {
                      e.dataTransfer.setData("text/pedido-id", p.id);
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(p.numeroFormatado);
                    },
                    onDragEnd: () => setArrastando(null),
                  }
                : {})}
            >
              <Td>
                <div className="flex items-center gap-1">
                  {arrastavel && podeReservar(p) && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />}
                  <CelulaNumero pedido={p} />
                </div>
                {reservas && p.reservaEm && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    Em reserva desde {dataHora(p.reservaEm)}
                    {p.reservaPor ? ` · ${p.reservaPor}` : ""}
                  </p>
                )}
              </Td>
              <Td className="max-w-44">
                {p.clienteNome}
                {p.cliente?.etiquetas?.length > 0 && <EtiquetasChips etiquetas={p.cliente.etiquetas} className="mt-0.5 justify-center" />}
              </Td>
              <Td>
                <CelulaData pedido={p} />
              </Td>
              <Td>{p.quantidadeItens}</Td>
              <Td className="font-semibold whitespace-nowrap">{moeda(p.total)}</Td>
              <Td>
                <CelulaMetodo pedido={p} />
              </Td>
              <Td>
                <CelulaEnvio pedido={p} />
              </Td>
              <Td>
                <CelulaFinanceiro pedido={p} />
              </Td>
              <Td>
                <CelulaVendas pedido={p} />
              </Td>
              <Td>
                <CelulaExpedicao pedido={p} />
              </Td>
              <Td>
                <div className="flex items-center justify-center gap-1">
                  {reservas && pode("VENDAS") && (
                    <Button size="sm" className="bg-emerald-600 whitespace-nowrap hover:bg-emerald-700" onClick={() => alterarReserva(p, false)}>
                      <PackageCheck className="h-4 w-4" /> Produto chegou
                    </Button>
                  )}
                  <AcoesPedido pedido={p} contexto={orcamentos ? "orcamento" : "vendas"} onAtualizado={atualizarLinha} />
                </div>
              </Td>
            </tr>
          ))}
          {dados && !dados.itens.length && (
            <tr>
              <td colSpan={11} className="py-12 text-center text-muted-foreground">
                {reservas ? "Nenhum pedido em reserva." : "Nenhum pedido encontrado."}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {dados && (
        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          total={dados.total}
          onChange={setPagina}
          limite={limite}
          onLimite={(n) => {
            setLimite(n);
            setPagina(1);
          }}
        />
      )}
      <AlertasPagamento aberto={verAlertas} onFechar={() => setVerAlertas(false)} onResolvido={() => setContadores((c) => ({ ...c, alertasPagamento: Math.max(0, (c.alertasPagamento || 1) - 1) }))} />
    </div>
  );
}
