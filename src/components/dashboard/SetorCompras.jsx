import { useEffect, useMemo, useState } from "react";
import { Download, PackageCheck, RotateCcw, ShoppingBag } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Card, Dialog, EmptyState, Field, FiltroMulti, Input, MetricCard, Segmented, Select, Skeleton, Table, Td, Textarea, Th, useConfirm, useToast } from "../ui";
import TabelaOrdenavel from "./TabelaOrdenavel";
import { data, dataHora, exportarCsv, hojeISO, lerNumero, moeda, numero } from "../../utils/format";

// Financeiro → Setor de compras: recebimentos conferidos (mercadoria já no
// estoque) esperando o registro do pagamento, e o histórico de compras pagas.

const AZUL = "#2563eb";
const eixoMoeda = (v) => (v >= 1000 ? `R$ ${numero(v / 1000, 1)} mil` : `R$ ${numero(v)}`);
const rotuloPeriodo = (p) => (p.length === 7 ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : `${p.slice(8, 10)}/${p.slice(5, 7)}`);

function DicaGrafico({ active, payload, label, formatarRotulo }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{formatarRotulo ? formatarRotulo(label) : label}</p>
      <p className="text-foreground">{moeda(payload[0].value)}</p>
      {d.compras != null && <p className="text-muted-foreground">{d.compras} {d.compras === 1 ? "compra" : "compras"}</p>}
      {d.quantidade != null && <p className="text-muted-foreground">{numero(d.quantidade)} un.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registrar pagamento
// ---------------------------------------------------------------------------

function RegistrarCompraDialog({ compra, opcoes, onFechar, onSalvo }) {
  const toast = useToast();
  const [form, setForm] = useState({
    compradoPor: compra.compradoPor || "",
    formaPagamento: compra.compraFormaPagamento || "",
    parcelas: String(compra.compraParcelas || 1),
    pagoEm: compra.compraPagoEm || hojeISO(),
    valor: String(compra.compraValor ?? (compra.valorItens || "")).replace(".", ","),
    observacao: compra.compraObservacao || "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const parcelado = ["CARTAO_CREDITO", "BOLETO"].includes(form.formaPagamento);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: d } = await api.put(`/compras/${compra.id}`, { ...form, valor: lerNumero(form.valor), parcelas: parcelado ? form.parcelas : 1 });
      toast({ titulo: "Compra registrada", descricao: `Recebimento nº ${d.numero} · ${moeda(d.compraValor)}` });
      onSalvo(d);
    } catch (error) {
      toast({ titulo: "Não foi possível salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Compra · recebimento nº ${compra.numero}`}
      descricao={`${compra.fornecedorNome || "Sem fornecedor"} · recebido ${compra.recebidoEm ? dataHora(compra.recebidoEm) : "-"}${compra.recebidoPor ? ` por ${compra.recebidoPor}` : ""}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!form.compradoPor.trim() || !form.formaPagamento || !form.pagoEm || !(lerNumero(form.valor) > 0)} onClick={salvar}>
            Salvar compra
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="mb-1 font-medium">Itens recebidos</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {compra.itens.map((i) => (
              <li key={i.id}>
                {numero(i.quantidadeRecebida ?? i.quantidadeSolicitada)} × {i.produtoNome}
                {i.custoUnitario ? ` · ${moeda(i.custoUnitario)} cada` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Valor pelos custos informados: <strong>{moeda(compra.valorItens)}</strong>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quem comprou / pagou" obrigatorio>
            <Input list="compradores-compra" value={form.compradoPor} onChange={set("compradoPor")} placeholder="Nome de quem fez a compra" />
            <datalist id="compradores-compra">
              {opcoes?.compradores.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Forma de pagamento" obrigatorio>
            <Select value={form.formaPagamento} onChange={set("formaPagamento")}>
              <option value="">Selecione</option>
              {opcoes?.formas.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data do pagamento" obrigatorio>
            <Input type="date" value={form.pagoEm} onChange={set("pagoEm")} />
          </Field>
          <Field label="Valor pago (R$)" obrigatorio>
            <Input inputMode="decimal" value={form.valor} onChange={set("valor")} />
          </Field>
          {parcelado && (
            <Field label="Parcelas">
              <Select value={form.parcelas} onChange={set("parcelas")}>
                {Array.from({ length: 12 }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "À vista" : `${n}x`}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Observação">
          <Textarea value={form.observacao} onChange={set("observacao")} placeholder="Ex.: nº do boleto, nota do fornecedor..." />
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// A pagar
// ---------------------------------------------------------------------------

function APagar({ lista, onRegistrar }) {
  if (!lista) return <Skeleton className="h-32" />;
  if (!lista.length)
    return <EmptyState icon={PackageCheck} titulo="Nada a pagar" descricao="Quando a aba Recebimentos conferir uma mercadoria, ela aparece aqui para registrar a compra." />;
  return (
    <Table>
      <thead>
        <tr>
          {["Nº", "Fornecedor", "Itens", "Criado por", "Recebido", "Valor (custos)", ""].map((c) => (
            <Th key={c}>{c}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lista.map((c) => (
          <tr key={c.id}>
            <Td className="font-mono text-xs">{c.numero}</Td>
            <Td className="text-left font-medium">{c.fornecedorNome || "—"}</Td>
            <Td className="text-left text-xs">
              <p className="max-w-72 truncate">{c.itens.map((i) => `${numero(i.quantidadeRecebida ?? 0)} × ${i.produtoNome}`).join(", ")}</p>
            </Td>
            <Td className="text-left text-xs">{c.criadoPor || "—"}</Td>
            <Td className="text-left text-xs">
              {c.recebidoEm ? dataHora(c.recebidoEm) : "—"}
              {c.recebidoPor && <span className="block text-muted-foreground">por {c.recebidoPor}</span>}
            </Td>
            <Td>{c.valorItens ? moeda(c.valorItens) : <span className="text-muted-foreground">sem custo</span>}</Td>
            <Td>
              <Button size="sm" onClick={() => onRegistrar(c)}>
                <ShoppingBag className="h-4 w-4" /> Registrar compra
              </Button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Compras finalizadas: filtros, indicadores, gráficos e registros
// ---------------------------------------------------------------------------

const DIMENSOES = [
  { value: "porFornecedor", label: "Fornecedor" },
  { value: "porComprador", label: "Quem pagou" },
  { value: "porForma", label: "Forma de pagamento" },
  { value: "porProduto", label: "Produto" },
];

// Top 10 + "Outros" (o gráfico continua legível com muitos fornecedores).
const top = (linhas, n = 10) => {
  if (linhas.length <= n) return linhas;
  const resto = linhas.slice(n);
  return [...linhas.slice(0, n), { nome: `Outros (${resto.length})`, valor: resto.reduce((s, l) => s + l.valor, 0), compras: resto.reduce((s, l) => s + l.compras, 0) }];
};

function Finalizadas({ periodo, opcoes, versao, onEditar, onReabrir }) {
  const [compradores, setCompradores] = useState([]);
  const [formas, setFormas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produto, setProduto] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [d, setD] = useState(null);
  const [tempo, setTempo] = useState("barras");
  const [dimensao, setDimensao] = useState("porFornecedor");
  const [vista, setVista] = useState("grafico");

  useEffect(() => {
    const t = setTimeout(() => {
      setD(null);
      api
        .get("/compras", {
          params: {
            ...periodo,
            compradores: compradores.join(",") || undefined,
            formas: formas.join(",") || undefined,
            fornecedores: fornecedores.join(",") || undefined,
            produto: produto.trim() || undefined,
            valorMin: lerNumero(valorMin) || undefined,
            valorMax: lerNumero(valorMax) || undefined,
          },
        })
        .then(({ data: r }) => setD(r))
        .catch(() => setD({ registros: [], resumo: { total: 0, compras: 0, ticketMedio: 0, fornecedores: 0, unidades: 0 }, linhaDoTempo: [], porForma: [], porComprador: [], porFornecedor: [], porProduto: [] }));
    }, 300);
    return () => clearTimeout(t);
  }, [periodo, compradores, formas, fornecedores, produto, valorMin, valorMax, versao]);

  const acumulado = useMemo(() => {
    let soma = 0;
    return (d?.linhaDoTempo || []).map((p) => ({ ...p, valor: (soma += p.valor) }));
  }, [d]);

  const nomeForma = (v) => opcoes?.formas.find((f) => f.valor === v)?.nome || v;
  const paraOpcoes = (lista) => Object.fromEntries((lista || []).map((n) => [n, n]));
  const linhasDimensao = d ? d[dimensao] : [];

  const exportar = () =>
    exportarCsv(
      "compras",
      ["Nº", "Fornecedor", "Produtos", "Quem pagou", "Forma", "Parcelas", "Pago em", "Valor", "Criado por", "Recebido por", "Status"],
      d.registros.map((r) => [
        r.numero,
        r.fornecedorNome || "",
        r.itens.map((i) => `${i.quantidadeRecebida ?? 0}x ${i.produtoNome}`).join(" | "),
        r.compradoPor,
        nomeForma(r.compraFormaPagamento),
        r.compraParcelas || 1,
        data(r.compraPagoEm),
        String(r.compraValor).replace(".", ","),
        r.criadoPor || "",
        r.recebidoPor || "",
        r.status === "ESTORNADO" ? "Estornado" : "Pago",
      ]),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <FiltroMulti titulo="Quem pagou" opcoes={paraOpcoes(opcoes?.compradores)} valores={compradores} onChange={setCompradores} />
        <FiltroMulti titulo="Forma de pagamento" opcoes={Object.fromEntries((opcoes?.formas || []).map((f) => [f.valor, f.nome]))} valores={formas} onChange={setFormas} />
        <FiltroMulti titulo="Fornecedor" opcoes={paraOpcoes(opcoes?.fornecedores)} valores={fornecedores} onChange={setFornecedores} />
        <Input className="w-48" placeholder="Produto ou SKU" value={produto} onChange={(e) => setProduto(e.target.value)} />
        <Input className="w-28" inputMode="decimal" placeholder="Valor mín." value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
        <Input className="w-28" inputMode="decimal" placeholder="Valor máx." value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Período pela data do pagamento (seletor no topo da página). Recebimentos estornados aparecem na tabela, mas ficam fora dos totais e gráficos.</p>

      {!d ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard titulo="Total comprado" valor={moeda(d.resumo.total)} detalhe={`${d.resumo.compras} ${d.resumo.compras === 1 ? "compra" : "compras"}`} destaque />
            <MetricCard titulo="Ticket médio" valor={moeda(d.resumo.ticketMedio)} detalhe="Valor médio por compra" />
            <MetricCard titulo="Fornecedores" valor={numero(d.resumo.fornecedores)} detalhe="Diferentes no período" />
            <MetricCard titulo="Unidades recebidas" valor={numero(d.resumo.unidades)} detalhe="Somando todos os itens" />
          </div>

          {d.registros.length === 0 ? (
            <EmptyState icon={ShoppingBag} titulo="Nenhuma compra encontrada" descricao="Ajuste o período ou os filtros." />
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">Compras no tempo</h3>
                      <p className="text-xs text-muted-foreground">Valor pago por {d.agrupamento === "mes" ? "mês" : "dia"}</p>
                    </div>
                    <Segmented
                      value={tempo}
                      onChange={setTempo}
                      opcoes={[
                        { value: "barras", label: "Por período" },
                        { value: "acumulado", label: "Acumulado" },
                      ]}
                    />
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    {tempo === "barras" ? (
                      <BarChart data={d.linhaDoTempo} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="periodo" tickFormatter={rotuloPeriodo} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={eixoMoeda} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                        <Tooltip content={<DicaGrafico formatarRotulo={rotuloPeriodo} />} cursor={{ fill: "#f1f5f9" }} />
                        <Bar dataKey="valor" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    ) : (
                      <LineChart data={acumulado} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="periodo" tickFormatter={rotuloPeriodo} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={eixoMoeda} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                        <Tooltip content={<DicaGrafico formatarRotulo={rotuloPeriodo} />} />
                        <Line type="monotone" dataKey="valor" stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL, stroke: "#fff", strokeWidth: 2 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Card>

                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">Para onde foi o dinheiro</h3>
                      <p className="text-xs text-muted-foreground">Valor pago por {DIMENSOES.find((x) => x.value === dimensao).label.toLowerCase()}</p>
                    </div>
                    <Segmented
                      value={vista}
                      onChange={setVista}
                      opcoes={[
                        { value: "grafico", label: "Gráfico" },
                        { value: "tabela", label: "Tabela" },
                      ]}
                    />
                  </div>
                  <Segmented value={dimensao} onChange={setDimensao} opcoes={DIMENSOES} className="mb-3 flex-wrap" />
                  {vista === "grafico" ? (
                    <ResponsiveContainer width="100%" height={Math.max(180, top(linhasDimensao).length * 30 + 20)}>
                      <BarChart data={top(linhasDimensao)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tickFormatter={eixoMoeda} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<DicaGrafico />} cursor={{ fill: "#f1f5f9" }} />
                        <Bar dataKey="valor" fill={AZUL} radius={[0, 4, 4, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <TabelaOrdenavel
                      chave="_chave"
                      linhas={linhasDimensao.map((l) => ({ ...l, _chave: l.produtoId || l.nome }))}
                      maxAltura="max-h-72"
                      colunas={[
                        { titulo: DIMENSOES.find((x) => x.value === dimensao).label, valor: (l) => l.nome, render: (l) => l.nome, alinhar: "text-left", total: () => "Total" },
                        ...(dimensao === "porProduto" ? [{ titulo: "Unidades", valor: (l) => l.quantidade, render: (l) => numero(l.quantidade), total: (ls) => numero(ls.reduce((s, l) => s + l.quantidade, 0)) }] : []),
                        { titulo: "Compras", valor: (l) => l.compras, render: (l) => l.compras, total: (ls) => ls.reduce((s, l) => s + l.compras, 0) },
                        { titulo: "Valor", valor: (l) => l.valor, render: (l) => moeda(l.valor), total: (ls) => moeda(ls.reduce((s, l) => s + l.valor, 0)) },
                        {
                          titulo: "% do total",
                          valor: (l) => l.valor,
                          render: (l) => `${numero(d.resumo.total ? (l.valor / d.resumo.total) * 100 : 0)}%`,
                        },
                      ]}
                    />
                  )}
                  {dimensao === "porProduto" && <p className="mt-2 text-xs text-muted-foreground">O valor de cada compra é dividido entre os produtos pelo custo informado no recebimento.</p>}
                </Card>
              </div>

              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Compras finalizadas ({d.registros.length})</h3>
                  <Button size="sm" variant="outline" onClick={exportar}>
                    <Download className="h-4 w-4" /> Exportar CSV
                  </Button>
                </div>
                <Table>
                  <thead>
                    <tr>
                      {["Nº", "Pago em", "Fornecedor", "Produtos", "Quem pagou", "Forma", "Valor", "Criado / recebido", ""].map((c) => (
                        <Th key={c}>{c}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.registros.map((r) => (
                      <tr key={r.id} className={r.status === "ESTORNADO" ? "opacity-60" : ""}>
                        <Td className="font-mono text-xs">{r.numero}</Td>
                        <Td>{data(r.compraPagoEm)}</Td>
                        <Td className="text-left font-medium">
                          {r.fornecedorNome || "—"}
                          {r.status === "ESTORNADO" && (
                            <Badge variant="danger" className="ml-1">
                              estornado
                            </Badge>
                          )}
                        </Td>
                        <Td className="text-left text-xs">
                          <p className="max-w-64 truncate" title={r.itens.map((i) => `${i.quantidadeRecebida ?? 0} × ${i.produtoNome}`).join("\n")}>
                            {r.itens.map((i) => `${numero(i.quantidadeRecebida ?? 0)} × ${i.produtoNome}`).join(", ")}
                          </p>
                        </Td>
                        <Td className="text-left">{r.compradoPor}</Td>
                        <Td className="text-left text-xs">
                          {nomeForma(r.compraFormaPagamento)}
                          {r.compraParcelas > 1 ? ` · ${r.compraParcelas}x` : ""}
                        </Td>
                        <Td className="font-semibold">{moeda(r.compraValor)}</Td>
                        <Td className="text-left text-xs text-muted-foreground">
                          {r.criadoPor || "—"} / {r.recebidoPor || "—"}
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => onEditar(r)}>
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost" title="Voltar para a pagar" onClick={() => onReabrir(r)}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function SetorCompras({ periodo }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [pendentes, setPendentes] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [editando, setEditando] = useState(null);
  const [versao, setVersao] = useState(0);

  const carregar = () => {
    api.get("/compras/pendentes").then(({ data: d }) => setPendentes(d)).catch(() => setPendentes([]));
    api.get("/compras/opcoes").then(({ data: d }) => setOpcoes(d)).catch(() => {});
  };
  useEffect(carregar, []);

  const salvo = () => {
    setEditando(null);
    setVersao((v) => v + 1);
    carregar();
  };

  const reabrir = async (r) => {
    const ok = await confirmar({ titulo: `Voltar a compra nº ${r.numero} para "a pagar"?`, mensagem: "Os dados do pagamento (quem pagou, forma, data e valor) são apagados.", confirmar: "Voltar para a pagar" });
    if (!ok) return;
    try {
      await api.post(`/compras/${r.id}/reabrir`);
      toast({ titulo: "Compra voltou para a pagar" });
      salvo();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="mb-3">
          <h3 className="flex items-center gap-2 font-semibold">
            A pagar
            {pendentes?.length > 0 && <Badge variant="warning">{pendentes.length}</Badge>}
          </h3>
          <p className="text-xs text-muted-foreground">Recebimentos já conferidos (a mercadoria já entrou no estoque). Registre quem comprou, como e quando pagou.</p>
        </div>
        <APagar lista={pendentes} onRegistrar={setEditando} />
      </Card>
      <Finalizadas periodo={periodo} opcoes={opcoes} versao={versao} onEditar={setEditando} onReabrir={reabrir} />
      {editando && <RegistrarCompraDialog compra={editando} opcoes={opcoes} onFechar={() => setEditando(null)} onSalvo={salvo} />}
    </div>
  );
}
