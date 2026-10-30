import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, ChevronDown, ChevronUp, Download, Landmark, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { mensagemErro } from "../services/api";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  FiltroMulti,
  Input,
  MetricCard,
  PageHeader,
  Paginacao,
  PeriodoPicker,
  Segmented,
  Skeleton,
  Table,
  Tabs,
  Td,
  Th,
  cx,
  useToast,
} from "../components/ui";
import AcoesPedido from "../components/pedido/AcoesPedido";
import RankingProdutos from "../components/dashboard/RankingProdutos";
import Analise from "../components/dashboard/Analise";
import TabelaOrdenavel from "../components/dashboard/TabelaOrdenavel";
import { CelulaData, CelulaEnvio, CelulaExpedicao, CelulaFinanceiro, CelulaMetodo, CelulaNumero, CelulaVendas } from "../components/pedido/StatusCelulas";
import { dataHora, exportarCsv, hojeISO, inicioMesISO, lerNumero, moeda, numero, percentual } from "../utils/format";
import { FINANCEIRO, FORMAS_PAGAMENTO, nomeForma } from "../utils/status";

const ROSA = "#f43f5e";
const AZUL = "#2563eb";
const VERDE = "#0f766e";
const somar = (linhas, campo) => linhas.reduce((t, l) => t + (Number(l[campo]) || 0), 0);
const margemLiquida = (liquida, bruta) => (bruta > 0 ? (liquida / bruta) * 100 : null);
const ORDEM_DIA = (l) => ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].indexOf(l.dia);

// Colunas das tabelas por dia da semana (clicar no título ordena).
const COLUNAS_VENDAS = [
  { titulo: "Dia", alinhar: "text-left", valor: ORDEM_DIA, render: (l) => <span className="font-medium">{l.dia}</span>, total: () => "Total" },
  { titulo: "Pedidos", valor: (l) => l.pedidos, render: (l) => numero(l.pedidos), total: (ls) => numero(somar(ls, "pedidos")) },
  {
    titulo: "Ticket médio",
    valor: (l) => (l.pedidos ? l.bruta / l.pedidos : null),
    render: (l) => (l.pedidos ? moeda(l.bruta / l.pedidos) : "--"),
    total: (ls) => (somar(ls, "pedidos") ? moeda(somar(ls, "bruta") / somar(ls, "pedidos")) : "--"),
  },
  { titulo: "Vendas", valor: (l) => l.bruta, render: (l) => moeda(l.bruta), total: (ls) => moeda(somar(ls, "bruta")) },
];

const COLUNAS_LUCRO = [
  { titulo: "Dia", alinhar: "text-left", valor: ORDEM_DIA, render: (l) => <span className="font-medium">{l.dia}</span>, total: () => "Total" },
  { titulo: "Pedidos", valor: (l) => l.pedidos, render: (l) => numero(l.pedidos), total: (ls) => numero(somar(ls, "pedidos")) },
  { titulo: "Receita", valor: (l) => l.bruta, render: (l) => moeda(l.bruta), total: (ls) => moeda(somar(ls, "bruta")) },
  {
    titulo: "Margem",
    valor: (l) => margemLiquida(l.liquida, l.bruta),
    render: (l) => (l.bruta > 0 ? percentual(margemLiquida(l.liquida, l.bruta)) : "--"),
    total: (ls) => (somar(ls, "bruta") > 0 ? percentual(margemLiquida(somar(ls, "liquida"), somar(ls, "bruta"))) : "--"),
  },
  {
    titulo: "Lucro líquido",
    valor: (l) => l.liquida,
    render: (l) => <span className={l.liquida < 0 ? "text-red-700" : ""}>{moeda(l.liquida)}</span>,
    total: (ls) => moeda(somar(ls, "liquida")),
  },
];

const moedaCurta = (v) => (Math.abs(v) >= 1000 ? `R$ ${numero(v / 1000, 1)} mil` : moeda(v));

// ---------------------------------------------------------------------------

function Resumo({ periodo }) {
  const [d, setD] = useState(null);
  const [modo, setModo] = useState("bruta");
  const [expandido, setExpandido] = useState(false);
  useEffect(() => {
    setD(null);
    api.get("/dashboard/resumo", { params: periodo }).then(({ data }) => setD(data));
  }, [periodo]);
  if (!d) return <Skeleton className="h-96" />;
  const r = modo === "bruta" ? "bruta" : "liquida";
  const nome = modo === "bruta" ? "Receita bruta" : "Receita líquida";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Receita = pedidos criados no período, menos cancelados (mesmo valor do "Realizado" da Meta). Pedido tirado em outro período conta lá, mesmo que seja expedido agora. Receita líquida desconta taxas, frete, custo dos itens e custos pós-venda; sem custo cadastrado, considera R$ 0,00.</p>
        <Segmented value={modo} onChange={setModo} opcoes={[{ value: "bruta", label: "Receita bruta" }, { value: "liquida", label: "Receita líquida" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo={nome} valor={moeda(d.cards.total[r])} detalhe={`${d.cards.total.pedidos} pedidos criados no período`} />
        <MetricCard titulo={`${nome} recebida`} valor={moeda(d.cards.recebida[r])} detalhe={`${d.cards.recebida.pedidos} pedidos do período já pagos`} />
        <MetricCard titulo={`${nome} em aberto`} valor={moeda(d.cards.aberto[r])} detalhe={`${d.cards.aberto.pedidos} pedidos do período com pagamento em aberto`} />
        <MetricCard titulo={`${nome} aguardando liberação`} valor={moeda(d.cards.aguardando[r])} detalhe={`${d.cards.aguardando.pedidos} pedidos do período ainda não liberados pelo Time de Vendas`} />
      </div>
      <div className="flex justify-center">
        <button onClick={() => setExpandido(!expandido)} className="rounded-full border border-border bg-white p-1.5 shadow-sm" aria-label="Mais indicadores">
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expandido && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard titulo="Ticket médio" valor={moeda(d.extras.ticketMedio)} />
          <MetricCard titulo="Custo dos itens" valor={moeda(d.extras.custoItens)} />
          <MetricCard titulo="Taxas de pagamento" valor={moeda(d.extras.taxas)} />
          <MetricCard titulo="Frete cobrado" valor={moeda(d.extras.frete)} />
          <MetricCard titulo="Descontos concedidos" valor={moeda(d.extras.desconto)} />
          <MetricCard titulo="Custos pós-venda" valor={moeda(d.extras.custosPosVenda)} detalhe="Reenvios, avarias, trocas" />
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">Pedidos por dia da semana</h2>
        <p className="mb-3 text-sm text-muted-foreground">Quantidade, receita bruta e receita líquida dos pedidos criados no período selecionado (menos cancelados), pelo dia em que foram tirados.</p>
        <Card className="h-80 p-4">
          <ResponsiveContainer>
            <ComposedChart data={d.semana}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="q" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
              <Tooltip formatter={(v, n) => (n === "Pedidos" ? v : moeda(v))} />
              <Legend />
              <Bar yAxisId="q" dataKey="pedidos" name="Pedidos" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Line yAxisId="v" dataKey="bruta" name="Receita bruta" stroke={ROSA} strokeWidth={2} dot />
              <Line yAxisId="v" dataKey="liquida" name="Receita líquida" stroke={VERDE} strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Vendas por dia da semana</p>
              <p className="text-xs text-muted-foreground">Mesmo valor do "Realizado" da Meta: pedidos criados no período, menos cancelados.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold">{moeda(somar(d.semana, "bruta"))}</p>
            </div>
          </div>
          <TabelaOrdenavel linhas={d.semana} colunas={COLUNAS_VENDAS} chave="dia" />
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Lucro líquido por dia da semana</p>
              <p className="text-xs text-muted-foreground">Pedidos do período: receita menos taxas, frete, custo dos itens e custos pós-venda (sem custo cadastrado vale R$ 0,00).</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold">{moeda(somar(d.semana, "liquida"))}</p>
            </div>
          </div>
          <TabelaOrdenavel linhas={d.semana} colunas={COLUNAS_LUCRO} chave="dia" />
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Produtos em destaque</h2>
        <p className="mb-3 text-sm text-muted-foreground">Todos os produtos do período por quantidade vendida e por margem de lucro — filtre Top 10, Top 3 ou o mais.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <RankingProdutos titulo="Por quantidade vendida" descricao="Itens com maior volume vendido nos pedidos do período." dados={d.topQuantidade} chave="pacotes" cor={AZUL} colunas={[["Qtd.", (x) => `${numero(x.pacotes)} un.`, "pacotes"], ["Receita", (x) => moeda(x.receita), "receita"]]} />
          <RankingProdutos titulo="Por margem de lucro" descricao="Itens vendidos no período com custo totalmente cadastrado, ordenados pela margem percentual." dados={d.topMargem} chave="margemPercentual" cor={VERDE} colunas={[["Margem", (x) => percentual(x.margemPercentual), "margemPercentual"], ["Receita", (x) => moeda(x.receita), "receita"], ["Lucro", (x) => moeda(x.lucro), "lucro"]]} />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

const STATUS_META = {
  BATIDA: { label: "Batida", cor: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  NAO_BATIDA: { label: "Não batida", cor: "bg-red-50 border-red-200 text-red-700" },
  A_CUMPRIR: { label: "A cumprir", cor: "bg-sky-50 border-sky-200 text-sky-700" },
  SEM_META: { label: "Sem meta", cor: "bg-slate-50 border-slate-200 text-slate-600" },
  NAO_COMERCIAL: { label: "Não comercial", cor: "bg-white border-slate-200 text-slate-400" },
  FORA: { label: "Fora do período", cor: "bg-slate-100 border-slate-100 text-slate-300" },
};

function Meta({ periodo }) {
  const [d, setD] = useState(null);
  const [editar, setEditar] = useState(false);
  const carregar = () => api.get("/dashboard/meta", { params: periodo }).then(({ data }) => setD(data));
  useEffect(() => {
    setD(null);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);
  if (!d) return <Skeleton className="h-96" />;
  const [ano, mes] = d.mes.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = d.calendario[0]?.diaSemana || 0;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Meta do período</h2>
            <p className="text-sm text-muted-foreground">Metas mensais proporcionais aos dias comerciais do período selecionado para acompanhamento do Time Comercial.</p>
          </div>
          <Button variant="outline" onClick={() => setEditar(true)}>
            Editar metas
          </Button>
        </div>
        <p className="mt-3 text-sm font-medium capitalize">{nomeMes}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Critério: a meta mensal cadastrada é dividida por {d.diasComerciaisMes} dias comerciais do mês, considerando segunda a sexta. Neste filtro entram {d.diasComerciaisPeriodo} dias comerciais; a meta do período é a meta diária multiplicada por esses dias. O realizado soma os pedidos criados no período filtrado, excluindo cancelados e orçamentos.
        </p>
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold tracking-wide text-muted-foreground uppercase">Progresso</span>
            <span className="font-bold">{d.progresso != null ? `${Math.round(d.progresso)}%` : "Sem meta"}</span>
          </div>
          <div className="mt-1 h-3 rounded-full bg-muted">
            <div className="gradient-primary h-3 rounded-full" style={{ width: `${Math.min(100, d.progresso || 0)}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {moeda(d.realizado)} realizado de {moeda(d.metaPeriodo)}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard titulo="Meta do período" valor={moeda(d.metaPeriodo)} />
          <MetricCard titulo="Realizado no período" valor={moeda(d.realizado)} detalhe="Pedidos criados no período, menos cancelados" />
          <MetricCard titulo="Média diária" valor={moeda(d.metaDiaria)} detalhe="Meta diária do mês" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">O realizado é o mesmo valor da receita bruta do Resumo e das demais abas do Financeiro.</p>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Calendário da meta diária</h2>
        <p className="mb-3 text-sm text-muted-foreground">Cada dia comercial mostra se a meta diária foi batida dentro do período.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.values(STATUS_META).map((s) => (
            <span key={s.label} className={cx("rounded-full border px-2 py-0.5 text-xs", s.cor)}>
              {s.label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((d2) => (
            <p key={d2} className="text-xs font-semibold text-muted-foreground">
              {d2}
            </p>
          ))}
          {Array.from({ length: primeiroDia }).map((_, i) => (
            <div key={`v${i}`} />
          ))}
          {d.calendario.map((dia) => (
            <div key={dia.data} className={cx("min-h-16 rounded-lg border p-1.5 text-left", STATUS_META[dia.status].cor)}>
              <p className="text-xs font-bold">{Number(dia.data.slice(8))}</p>
              <p className="hidden text-[10px] sm:block">{STATUS_META[dia.status].label}</p>
              <p className="text-[10px] font-semibold sm:text-xs">{dia.realizado != null ? moedaCurta(dia.realizado) : "--"}</p>
            </div>
          ))}
        </div>
      </Card>
      {editar && (
        <EditarMetas
          metas={d.metas}
          onFechar={() => setEditar(false)}
          onSalvo={() => {
            setEditar(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function EditarMetas({ metas, onFechar, onSalvo }) {
  const toast = useToast();
  const ano = Number(hojeISO().slice(0, 4));
  const [anoSel, setAnoSel] = useState(ano);
  const [valores, setValores] = useState(() => Object.fromEntries(Object.entries(metas).map(([k, v]) => [k, String(v).replace(".", ",")])));
  const salvar = async () => {
    try {
      const corpo = {};
      for (let m = 1; m <= 12; m += 1) {
        const chave = `${anoSel}-${String(m).padStart(2, "0")}`;
        corpo[chave] = lerNumero(valores[chave]);
      }
      await api.put("/dashboard/metas", { metas: corpo });
      toast({ titulo: "Metas salvas" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar metas", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo="Editar metas mensais"
      descricao="Valor total de vendas esperado em cada mês."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar metas</Button>
        </>
      }
    >
      <Segmented className="mb-4" value={anoSel} onChange={setAnoSel} opcoes={[ano - 1, ano, ano + 1].map((a) => ({ value: a, label: String(a) }))} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => {
          const chave = `${anoSel}-${String(i + 1).padStart(2, "0")}`;
          return (
            <Field key={chave} label={new Date(anoSel, i, 1).toLocaleDateString("pt-BR", { month: "long" })} className="capitalize">
              <Input placeholder="0,00" value={valores[chave] || ""} onChange={(e) => setValores({ ...valores, [chave]: e.target.value })} />
            </Field>
          );
        })}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

const opcoesFormas = Object.fromEntries(Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => [k, v.label]));

function PedidosExpedidos({ periodo }) {
  const [d, setD] = useState(null);
  const [busca, setBusca] = useState("");
  const [formas, setFormas] = useState([]);
  const [financeiro, setFinanceiro] = useState([]);
  const [mostrarFormas, setMostrarFormas] = useState(true);
  const carregar = () =>
    api.get("/dashboard/expedidos", { params: { ...periodo, busca: busca || undefined, formas: formas.join(",") || undefined, financeiro: financeiro.join(",") || undefined } }).then(({ data }) => setD(data));
  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, busca, formas, financeiro]);
  if (!d) return <Skeleton className="h-96" />;
  const pct = (a, b) => (b ? `(${Math.round((a / b) * 100)}%)` : "");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">Total do período</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard titulo="Valor dos pedidos expedidos" valor={moeda(d.totalPeriodo.valor)} />
          <MetricCard titulo="Qtd. de pedidos expedidos" valor={d.totalPeriodo.quantidade} />
          <MetricCard titulo='Qtd. de pedidos "Aguardando pagamento"' valor={d.totalPeriodo.aguardandoPagamento} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Resultado filtrado</p>
          <button className="text-xs text-primary" onClick={() => setMostrarFormas(!mostrarFormas)}>
            {mostrarFormas ? "Ocultar" : "Exibir"} resultado filtrado por forma de pagamento
          </button>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <MetricCard titulo="Valor dos pedidos expedidos" valor={moeda(d.filtrado.valor)} detalhe={pct(d.filtrado.valor, d.totalPeriodo.valor)} />
          <MetricCard titulo="Qtd. de pedidos expedidos" valor={d.filtrado.quantidade} detalhe={pct(d.filtrado.quantidade, d.totalPeriodo.quantidade)} />
          <MetricCard titulo='Qtd. de pedidos "Aguardando pagamento"' valor={d.filtrado.aguardandoPagamento} detalhe={pct(d.filtrado.aguardandoPagamento, d.totalPeriodo.aguardandoPagamento)} />
        </div>
        {mostrarFormas && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.porForma.map((f) => (
              <Badge key={f.forma} variant="outline" className="px-3 py-1 text-sm">
                {nomeForma(f.forma)}: <strong>{moeda(f.valor)}</strong> · {f.quantidade}
              </Badge>
            ))}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Número ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <FiltroMulti titulo="Método" opcoes={opcoesFormas} valores={formas} onChange={setFormas} />
        <FiltroMulti titulo="Time Financeiro" opcoes={FINANCEIRO} valores={financeiro} onChange={setFinanceiro} />
      </div>
      <Table>
        <thead>
          <tr>
            {["Número", "Cliente", "Data", "Itens", "Total", "Método", "Método de entrega", "Time Financeiro", "Time Vendas", "Time Expedição", "Ações"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.pedidos.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td>
                <CelulaNumero pedido={p} />
              </Td>
              <Td>{p.clienteNome}</Td>
              <Td>
                <CelulaData pedido={p} />
              </Td>
              <Td>{p.quantidadeItens}</Td>
              <Td className="font-semibold">{moeda(p.total)}</Td>
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
                <AcoesPedido pedido={p} contexto="vendas" onAtualizado={carregar} />
              </Td>
            </tr>
          ))}
          {!d.pedidos.length && (
            <tr>
              <td colSpan={11} className="py-10 text-center text-muted-foreground">
                Nenhum pedido expedido encontrado para o período selecionado.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TabelaEstoque({ titulo, descricao, linhas, vazio, extra }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">{titulo}</p>
      <p className="mb-3 text-sm text-muted-foreground">{descricao}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="py-2 text-left">Produto</th>
              <th>Estoque atual</th>
              <th>Alerta baixo</th>
              <th>Média semanal</th>
              {extra && <th>Semanas</th>}
              <th>Fornecedor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-2">
                  <p className="font-medium">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">SKU {l.sku}</p>
                </td>
                <td className="text-center">{numero(l.estoque)}</td>
                <td className="text-center">{l.estoqueMinimo ?? "Não definido"}</td>
                <td className="text-center">{l.mediaSemanal ? numero(l.mediaSemanal) : "Sem vendas recebidas"}</td>
                {extra && <td className="text-center">{l.semanasRestantes < 1 ? "Menos de 1 semana" : numero(l.semanasRestantes, 1)}</td>}
                <td className="text-center text-xs">{l.fornecedorPreferencial?.nome || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!linhas.length && <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>}
      </div>
    </Card>
  );
}

function Estoque({ periodo }) {
  const [sub, setSub] = useState("RESUMO");
  const [resumo, setResumo] = useState(null);
  const [mov, setMov] = useState(null);
  const [fila, setFila] = useState(null);
  const [busca, setBusca] = useState("");
  const [tipos, setTipos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const toast = useToast();

  useEffect(() => {
    if (sub === "RESUMO") api.get("/dashboard/estoque").then(({ data }) => setResumo(data));
    if (sub === "FILA") api.get("/dashboard/fila-sob-demanda").then(({ data }) => setFila(data));
  }, [sub]);
  useEffect(() => {
    if (sub !== "MOVIMENTACOES") return undefined;
    const t = setTimeout(
      () => api.get("/dashboard/movimentacoes", { params: { ...periodo, busca: busca.length >= 2 ? busca : undefined, tipo: tipos.join(",") || undefined, pagina, limite: 50 } }).then(({ data }) => setMov(data)),
      300,
    );
    return () => clearTimeout(t);
  }, [sub, periodo, busca, tipos, pagina]);

  const exportar = async () => {
    try {
      const { data } = await api.get("/dashboard/movimentacoes", { params: { ...periodo, busca: busca.length >= 2 ? busca : undefined, tipo: tipos.join(",") || undefined, limite: 5000 } });
      if (!data.itens.length) return toast({ titulo: "Não há dados para exportar com os filtros atuais.", tipo: "aviso" });
      exportarCsv(`movimentacoes-${periodo.inicio}-a-${periodo.fim}`, [
        { titulo: "Data", valor: (m) => dataHora(m.createdAt) },
        { titulo: "Produto", valor: (m) => m.produtoNome },
        { titulo: "SKU", valor: (m) => m.produtoSku },
        { titulo: "Tipo", valor: (m) => m.tipo },
        { titulo: "Quantidade", valor: (m) => m.quantidade },
        { titulo: "Quantidade Anterior", valor: (m) => m.quantidadeAnterior },
        { titulo: "Quantidade Nova", valor: (m) => m.quantidadeNova },
        { titulo: "Motivo", valor: (m) => m.motivo },
        { titulo: "Pedido", valor: (m) => m.pedidoNumero },
        { titulo: "Cliente", valor: (m) => m.clienteNome },
        { titulo: "Email Cliente", valor: (m) => m.clienteEmail },
        { titulo: "Usuário", valor: (m) => m.usuarioNome },
      ], data.itens);
    } catch (error) {
      toast({ titulo: "Erro ao exportar", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs abas={[{ value: "RESUMO", label: "Resumo" }, { value: "MOVIMENTACOES", label: "Movimentações" }, { value: "FILA", label: "Fila sob demanda" }]} ativa={sub} onChange={setSub} />
      {sub === "RESUMO" &&
        (!resumo ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Média por semana = quantidade vendida em pedidos pagos dos últimos 6 meses ÷ total de semanas dos últimos 6 meses. O período do dashboard não altera a projeção.</p>
            <TabelaEstoque titulo="Estoque zerado" descricao="Produtos com estoque atual zerado." linhas={resumo.zerados} vazio="Nenhum produto está com estoque zerado." />
            <TabelaEstoque titulo="Estoque já baixo" descricao="Produtos com saldo positivo e quantidade atual menor ou igual ao Alerta de Estoque Baixo." linhas={resumo.baixos} vazio="Nenhum produto está abaixo do alerta de estoque baixo." />
            <TabelaEstoque titulo="Projeção de ruptura" descricao="Produtos com saldo positivo que ainda não estão no alerta baixo, mas podem zerar em menos de 4 semanas pelo ritmo médio semanal." linhas={resumo.projecao} vazio="Nenhum produto tem projeção de zerar em menos de 4 semanas." extra />
          </>
        ))}
      {sub === "MOVIMENTACOES" && (
        <>
          <p className="text-xs text-muted-foreground">O período selecionado filtra a auditoria de movimentações.</p>
          {mov && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard titulo="Movimentos carregados" valor={mov.total} detalhe="Do período selecionado" />
              <MetricCard titulo="Entradas" valor={numero(mov.resumo.ENTRADA.unidades)} detalhe={`${mov.resumo.ENTRADA.movimentos} reposições, recebimentos ou devoluções`} />
              <MetricCard titulo="Saídas" valor={numero(mov.resumo.SAIDA.unidades)} detalhe={`${mov.resumo.SAIDA.movimentos} vendas, consumo ou baixas`} />
              <MetricCard titulo="Ajustes manuais" valor={mov.resumo.AJUSTE.movimentos} detalhe={mov.resumo.AJUSTE.movimentos ? "Conferir motivos do período" : "Nenhum ajuste carregado"} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <input
                className="input h-9 pl-9"
                placeholder="Buscar por produto, cliente, e-mail, motivo..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
              />
            </div>
            <FiltroMulti titulo="Tipo" opcoes={{ ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" }} valores={tipos} onChange={setTipos} />
            <Button variant="outline" size="sm" className="ml-auto" onClick={exportar}>
              <Download className="h-4 w-4" /> Exportar movimentações
            </Button>
          </div>
          <Table>
            <thead>
              <tr>
                {["Data", "Produto", "Tipo", "Quantidade", "Antes → Depois", "Motivo", "Pedido / Cliente", "Usuário"].map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mov?.itens.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">{dataHora(m.createdAt)}</Td>
                  <Td className="text-left">
                    <p className="font-medium">{m.produtoNome}</p>
                    <p className="text-xs text-muted-foreground">SKU {m.produtoSku}</p>
                  </Td>
                  <Td>
                    <Badge variant={m.tipo === "ENTRADA" ? "success" : m.tipo === "SAIDA" ? "danger" : "warning"}>{m.tipo === "SAIDA" ? "Saída" : m.tipo === "ENTRADA" ? "Entrada" : "Ajuste"}</Badge>
                  </Td>
                  <Td>{numero(m.quantidade)}</Td>
                  <Td className="whitespace-nowrap">
                    {numero(m.quantidadeAnterior)} → {numero(m.quantidadeNova)}
                  </Td>
                  <Td className="max-w-56 text-left text-xs">{m.motivo}</Td>
                  <Td className="text-xs">
                    {m.pedidoNumero && <span className="block font-medium">{m.pedidoNumero}</span>}
                    {m.clienteNome}
                  </Td>
                  <Td className="text-xs">{m.usuarioNome}</Td>
                </tr>
              ))}
              {mov && !mov.itens.length && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          {mov && <Paginacao pagina={mov.pagina} paginas={mov.paginas} total={mov.total} onChange={setPagina} />}
        </>
      )}
      {sub === "FILA" &&
        (!fila ? (
          <Skeleton className="h-40" />
        ) : (
          <Card className="p-4">
            <p className="font-semibold">Fila sob demanda</p>
            <p className="mb-3 text-sm text-muted-foreground">Produtos por encomenda em pedidos ainda não expedidos. O período acima não altera os itens pendentes de compra.</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Produto</th>
                  <th>Pedido (un.)</th>
                  <th>Estoque atual</th>
                  <th>Faltando</th>
                  <th>Fornecedor</th>
                  <th className="text-left">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {fila.map((f) => (
                  <tr key={f.produtoId} className="border-b border-border/60">
                    <td className="py-2 font-medium">{f.nome}</td>
                    <td className="text-center">{numero(f.unidades)}</td>
                    <td className="text-center">{numero(f.estoque)}</td>
                    <td className="text-center font-semibold text-primary">{numero(f.faltando)}</td>
                    <td className="text-center text-xs">{f.fornecedorPreferencial?.nome || "Não definido"}</td>
                    <td className="text-xs">{f.pedidos.map((p) => p.numero).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!fila.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item por encomenda pendente.</p>}
          </Card>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

const ABAS = [
  { value: "resumo", label: "Resumo" },
  { value: "meta", label: "Meta" },
  { value: "pedidos", label: "Pedidos expedidos" },
  { value: "estoque", label: "Estoque" },
  { value: "analise", label: "📊 Análise" },
];

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const aba = params.get("view") || "resumo";
  const [periodo, setPeriodo] = useState({ inicio: inicioMesISO(), fim: hojeISO() });
  const [atualizado] = useState(() => new Date());
  const { usuario } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container-app py-6">
      <PageHeader
        titulo="Visão executiva de pedidos expedidos"
        subtitulo="Leitura consolidada de caixa, recebíveis, margem, estoque e operação."
        extra={<p className="mt-1 text-xs text-muted-foreground">Atualizado em {dataHora(atualizado)}</p>}
      >
        {usuario?.role === "ADMIN" && (
          <Button variant="info" onClick={() => navigate("/pagamentos")}>
            <Landmark className="h-4 w-4" /> Pagamentos (bancos)
          </Button>
        )}
        {aba !== "analise" && (
          <Button variant="secondary" onClick={() => setParams({ view: "analise" })}>
            <BarChart3 className="h-4 w-4" /> Análise de produtos
          </Button>
        )}
      </PageHeader>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs abas={ABAS} ativa={aba} onChange={(v) => setParams({ view: v })} />
        <PeriodoPicker inicio={periodo.inicio} fim={periodo.fim} onChange={setPeriodo} />
      </div>
      {aba === "resumo" && <Resumo periodo={periodo} />}
      {aba === "meta" && <Meta periodo={periodo} />}
      {aba === "pedidos" && <PedidosExpedidos periodo={periodo} />}
      {aba === "estoque" && <Estoque periodo={periodo} />}
      {aba === "analise" && <Analise periodo={periodo} />}
    </div>
  );
}
