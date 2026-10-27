import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Copy, Plus, Settings2, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { CarregarPedidoLoja } from "../../components/comercial/CarregarPedidoLoja";
import { Badge, Button, Card, Dialog, Field, Input, MetricCard, PageHeader, Spinner, Table, Td, Th, cx, useToast } from "../../components/ui";
import api, { mensagemErro } from "../../services/api";
import { moeda, numero } from "../../utils/format";

// Calculadora de Pedidos: valor de nota, peso e plano de caixas. A base das
// caixas é a 70x50x60 (3000 encapsulados de 1" ou 1000 de 2"); os parâmetros
// ficam editáveis em "Parâmetros de cálculo".

const avulsoVazio = () => ({ nome: "", quantidade: "", valorNf: "", pesoUnitario: "", altura: "", largura: "", comprimento: "" });
const kg = (v) => `${numero(v, v < 10 ? 2 : 1)} kg`;

function Medidas({ valor = {}, onChange, compacto }) {
  return (
    <div className="flex items-center gap-1">
      {["altura", "largura", "comprimento"].map((campo, i) => (
        <span key={campo} className="flex items-center gap-1">
          {i > 0 && <span className="text-xs text-muted-foreground">×</span>}
          <Input
            inputMode="decimal"
            className={cx("h-8 px-2 text-center text-xs", compacto ? "w-12" : "w-16")}
            placeholder={campo[0].toUpperCase()}
            value={valor[campo] ?? ""}
            onChange={(e) => onChange({ ...valor, [campo]: e.target.value })}
          />
        </span>
      ))}
      <span className="text-xs text-muted-foreground">cm</span>
    </div>
  );
}

// Plano de caixas em texto (para colar no WhatsApp ou na expedição).
const textoPlano = (r) =>
  [
    `Pedido: ${r.itens.map((i) => `${numero(i.quantidade)} ${i.label}`).join(", ")}`,
    `Valor de nota: ${moeda(r.resumo.valorNf)} · Peso: ${kg(r.resumo.pesoKg)}`,
    ...r.volumes.map((v, n) => `Volume ${n + 1}: caixa ${v.caixa} cm (${v.ocupacao}% cheia, ${kg(v.pesoKg)}) — ${v.itens.map((i) => `${numero(i.quantidade)} ${i.label}`).join(" + ")}`),
  ].join("\n");

// Aberto só quando visível: o estado começa com os parâmetros atuais.
function Parametros({ onFechar, parametros, onSalvo }) {
  const toast = useToast();
  const [itens, setItens] = useState(() => parametros.itens.map((i) => ({ ...i, valorNf: String(i.valorNf), pesoKg: String(i.pesoKg), porCaixaRef: i.porCaixaRef ? String(i.porCaixaRef) : "" })));
  const [caixas, setCaixas] = useState(() => parametros.caixas.map((c) => ({ altura: String(c.altura), largura: String(c.largura), comprimento: String(c.comprimento) })));
  const [salvando, setSalvando] = useState(false);
  const mudar = (chave, campo, valor) => setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)));
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.put("/calculadora-pedidos/parametros", { itens, caixas });
      toast({ titulo: "Parâmetros salvos", descricao: "Os próximos cálculos já usam os valores novos." });
      onSalvo(data);
      onFechar();
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo="Parâmetros de cálculo"
      descricao={`Capacidade a granel medida na caixa de referência ${parametros.referencia}: as demais caixas comportam proporcionalmente ao volume.`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} onClick={salvar}>
            Salvar parâmetros
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Table>
          <thead>
            <tr>
              <Th className="text-left">Item</Th>
              <Th>Valor NF por un.</Th>
              <Th>Peso por un. (kg)</Th>
              <Th>Un. por caixa {parametros.referencia}</Th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.chave}>
                <Td className="text-left">
                  <p className="font-medium">{i.label}</p>
                  <p className="text-xs text-muted-foreground">{i.grupo}</p>
                </Td>
                <Td>
                  <Input inputMode="decimal" className="mx-auto h-8 w-24 text-center" value={i.valorNf} onChange={(e) => mudar(i.chave, "valorNf", e.target.value)} />
                </Td>
                <Td>
                  <Input inputMode="decimal" className="mx-auto h-8 w-24 text-center" value={i.pesoKg} onChange={(e) => mudar(i.chave, "pesoKg", e.target.value)} />
                </Td>
                <Td>
                  {i.granel ? (
                    <div className="flex items-center justify-center gap-2">
                      <Input inputMode="numeric" className="h-8 w-24 text-center" value={i.porCaixaRef} onChange={(e) => mudar(i.chave, "porCaixaRef", e.target.value.replace(/\D/g, ""))} />
                      <Badge variant={i.fonte === "informado" ? "success" : i.fonte === "ajustado" ? "info" : "warning"}>{i.fonte === "informado" ? "base da loja" : i.fonte}</Badge>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">medidas A × L × C no pedido</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="-mt-3 text-xs text-muted-foreground">
          <strong>Base da loja</strong>: medido por vocês. <strong>Estimado</strong>: calculado a partir dele — confira numa caixa real e ajuste se precisar.
        </p>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Caixas disponíveis (medidas internas, cm)</p>
            <Button variant="outline" size="sm" onClick={() => setCaixas([...caixas, { altura: "", largura: "", comprimento: "" }])}>
              <Plus className="h-4 w-4" /> Adicionar caixa
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {caixas.map((c, n) => {
              const referencia = `${c.altura}x${c.largura}x${c.comprimento}` === parametros.referencia;
              return (
                <div key={n} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                  <Medidas valor={c} onChange={(v) => setCaixas(caixas.map((x, j) => (j === n ? v : x)))} />
                  {referencia ? (
                    <Badge variant="primary">referência</Badge>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={() => setCaixas(caixas.filter((_, j) => j !== n))} aria-label="Remover caixa">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {parametros.atualizadoEm && (
          <p className="text-xs text-muted-foreground">
            Última alteração: {new Date(parametros.atualizadoEm).toLocaleString("pt-BR")}
            {parametros.atualizadoPor ? ` por ${parametros.atualizadoPor}` : ""}.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function OpcaoIA({ opcao }) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-semibold">{opcao.nomeOpcao}</p>
        <Badge>{opcao.caixas.length} {opcao.caixas.length === 1 ? "volume" : "volumes"}</Badge>
      </div>
      {opcao.resumoOpcao && <p className="mb-3 text-sm text-muted-foreground">{opcao.resumoOpcao}</p>}
      <div className="space-y-2">
        {opcao.caixas.map((c, n) => (
          <div key={n} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Caixa {c.dimensoes}</span>
              <Badge variant={c.tipo === "padrao" ? "success" : "warning"}>{c.tipo === "padrao" ? "padrão" : "nova"}</Badge>
            </div>
            <p className="mt-1">{c.itensAlocados}</p>
            {c.justificativa && <p className="mt-0.5 text-xs text-muted-foreground">{c.justificativa}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CalculadoraPedidos() {
  const toast = useToast();
  const [parametros, setParametros] = useState(null);
  const [verParametros, setVerParametros] = useState(false);
  const [quantidades, setQuantidades] = useState({});
  const [medidas, setMedidas] = useState({});
  const [avulsos, setAvulsos] = useState([]);
  const [calculo, setCalculo] = useState({ chave: null, resultado: null, erro: "" });
  const [calculando, setCalculando] = useState(false);
  const [analiseSalva, setAnalise] = useState({ chave: null, dados: null });
  const [analisando, setAnalisando] = useState(false);
  const controle = useRef(null);

  const [erroParametros, setErroParametros] = useState("");
  useEffect(() => {
    api.get("/calculadora-pedidos/parametros").then(({ data }) => setParametros(data)).catch((e) => setErroParametros(mensagemErro(e)));
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const item of parametros?.itens || []) mapa.set(item.grupo, [...(mapa.get(item.grupo) || []), item]);
    return [...mapa.entries()];
  }, [parametros]);

  const corpo = useMemo(() => ({ quantidades, medidas, avulsos: avulsos.filter((a) => a.nome.trim() && Number(a.quantidade) > 0) }), [quantidades, medidas, avulsos]);
  const temItens = Object.values(quantidades).some((v) => Number(v) > 0) || corpo.avulsos.length > 0;
  const chave = JSON.stringify(corpo);
  // Mostra o último cálculo enquanto o novo chega; a análise da IA vale só
  // para a entrada exata que a gerou.
  const resultado = temItens ? calculo.resultado : null;
  const erro = temItens ? calculo.erro || erroParametros : erroParametros;
  const analise = analiseSalva.chave === chave ? analiseSalva.dados : null;

  // Recalcula sozinho a cada alteração.
  useEffect(() => {
    if (!temItens) return undefined;
    const t = setTimeout(async () => {
      controle.current?.abort();
      controle.current = new AbortController();
      setCalculando(true);
      try {
        const { data } = await api.post("/calculadora-pedidos/calcular", JSON.parse(chave), { signal: controle.current.signal });
        setCalculo({ chave, resultado: data, erro: "" });
      } catch (e) {
        if (e.name === "CanceledError") return;
        setCalculo({ chave, resultado: null, erro: mensagemErro(e) });
      } finally {
        setCalculando(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [chave, temItens, parametros]);

  const limpar = () => {
    setQuantidades({});
    setMedidas({});
    setAvulsos([]);
  };

  const analisarIA = async () => {
    setAnalisando(true);
    try {
      const { data } = await api.post("/calculadora-pedidos/analisar-ia", corpo);
      setAnalise({ chave, dados: data });
    } catch (e) {
      toast({ titulo: "IA indisponível", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setAnalisando(false);
    }
  };

  const copiar = () =>
    navigator.clipboard
      .writeText(textoPlano(resultado))
      .then(() => toast({ titulo: "Plano copiado", descricao: "Cole no WhatsApp ou na expedição." }))
      .catch(() => toast({ titulo: "Não foi possível copiar", tipo: "erro" }));

  const alertas = resultado?.volumes.flatMap((v, n) => v.alertas.map((a) => `Volume ${n + 1}: ${a}`)) || [];

  return (
    <div className="container-app py-8">
      <PageHeader titulo="Calculadora de Pedidos" subtitulo="Valor de nota, peso e quantas caixas o pedido precisa — com base na caixa 70x50x60 (3000 encapsulados de 1&quot; ou 1000 de 2&quot;).">
        <Button variant="outline" onClick={() => setVerParametros(true)} disabled={!parametros}>
          <Settings2 className="h-4 w-4" /> Parâmetros de cálculo
        </Button>
      </PageHeader>

      <CarregarPedidoLoja
        descricao="Preenche as quantidades a partir dos itens de um pedido da loja. Itens sem padrão entram como avulsos (informe as medidas)."
        onCarregado={(pedido) => {
          setQuantidades(Object.fromEntries(Object.entries(pedido.quantidades || {}).map(([k, v]) => [k, String(v)])));
          setMedidas({});
          setAvulsos((pedido.produtosPersonalizados || []).map((p) => ({ ...avulsoVazio(), nome: p.nome, quantidade: String(p.quantidade), pesoUnitario: p.pesoUnitario ? String(Number(p.pesoUnitario.toFixed(4))) : "" })));
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Itens do pedido</h2>
              {temItens && (
                <Button variant="ghost" size="sm" onClick={limpar}>
                  Limpar tudo
                </Button>
              )}
            </div>
            {!parametros ? (
              <Spinner />
            ) : (
              <div className="space-y-5">
                {grupos.map(([grupo, itens]) => (
                  <div key={grupo}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{grupo}</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {itens.map((item) => {
                        const qtd = quantidades[item.chave] || "";
                        return (
                          <div key={item.chave} className={cx("rounded-lg border p-3", Number(qtd) > 0 ? "border-primary/40 bg-primary-soft/40" : "border-border")}>
                            <Field label={item.label} dica={item.granel ? `${numero(item.porCaixaRef)} un. por caixa ${parametros.referencia}` : "Informe as medidas de 1 unidade"}>
                              <Input inputMode="numeric" placeholder="0 un." value={qtd} onChange={(e) => setQuantidades({ ...quantidades, [item.chave]: e.target.value.replace(/\D/g, "") })} />
                            </Field>
                            {!item.granel && Number(qtd) > 0 && (
                              <div className="mt-2">
                                <p className="mb-1 text-[11px] text-muted-foreground">Medidas por unidade (A × L × C)</p>
                                <Medidas compacto valor={medidas[item.chave]} onChange={(v) => setMedidas({ ...medidas, [item.chave]: v })} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Produtos avulsos</h2>
                <p className="text-xs text-muted-foreground">Fora da lista acima: informe quantidade, medidas por unidade e, se quiser, valor de nota e peso.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAvulsos([...avulsos, avulsoVazio()])}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {!avulsos.length && <p className="text-sm text-muted-foreground">Nenhum produto avulso.</p>}
            <div className="space-y-3">
              {avulsos.map((a, n) => {
                const mudar = (campo, valor) => setAvulsos(avulsos.map((x, j) => (j === n ? { ...x, [campo]: valor } : x)));
                return (
                  <div key={n} className="grid items-end gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_5rem_6rem_6rem_auto_auto]">
                    <Field label="Produto">
                      <Input value={a.nome} placeholder="Ex.: Urso 25cm" onChange={(e) => mudar("nome", e.target.value)} />
                    </Field>
                    <Field label="Qtd">
                      <Input inputMode="numeric" value={a.quantidade} onChange={(e) => mudar("quantidade", e.target.value.replace(/\D/g, ""))} />
                    </Field>
                    <Field label="NF un. (R$)">
                      <Input inputMode="decimal" value={a.valorNf} placeholder="0,00" onChange={(e) => mudar("valorNf", e.target.value)} />
                    </Field>
                    <Field label="Peso un. (kg)">
                      <Input inputMode="decimal" value={a.pesoUnitario} placeholder="0,000" onChange={(e) => mudar("pesoUnitario", e.target.value)} />
                    </Field>
                    <Field label="Medidas (cm)">
                      <Medidas compacto valor={a} onChange={(v) => setAvulsos(avulsos.map((x, j) => (j === n ? { ...x, ...v } : x)))} />
                    </Field>
                    <Button variant="ghost" size="icon" onClick={() => setAvulsos(avulsos.filter((_, j) => j !== n))} aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {!temItens && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <Box className="mx-auto mb-2 h-8 w-8" />
              Informe as quantidades: o cálculo aparece aqui na hora.
            </Card>
          )}
          {temItens && erro && (
            <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <TriangleAlert className="mb-1 h-4 w-4" />
              {erro}
            </Card>
          )}
          {temItens && !resultado && !erro && (
            <Card className="flex justify-center p-6">
              <Spinner />
            </Card>
          )}
          {resultado && (
            <>
              <div className={cx("grid grid-cols-2 gap-3 transition-opacity", calculando && "opacity-60")}>
                <MetricCard titulo="Valor de nota" valor={moeda(resultado.resumo.valorNf)} />
                <MetricCard titulo="Peso real" valor={kg(resultado.resumo.pesoKg)} />
                <MetricCard titulo="Volumes" valor={resultado.resumo.volumes} detalhe={`${numero(resultado.resumo.litros, 1)} L ocupados`} />
                <MetricCard titulo="Peso taxado" valor={kg(resultado.resumo.pesoTaxadoKg)} detalhe="maior entre real e cubado" />
              </div>
              {alertas.length > 0 && (
                <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {alertas.map((a) => (
                    <p key={a}>⚠ {a}</p>
                  ))}
                </Card>
              )}
              <Card className={cx("p-4 transition-opacity", calculando && "opacity-60")}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Plano de caixas</h2>
                  <Button variant="ghost" size="sm" onClick={copiar}>
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                </div>
                <div className="space-y-3">
                  {resultado.volumes.map((v, n) => (
                    <div key={n} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">
                          Volume {n + 1} · {v.caixa} cm
                        </p>
                        {v.sobMedida ? <Badge variant="warning">sob medida</Badge> : <span className="text-xs text-muted-foreground">{kg(v.pesoKg)}</span>}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={cx("h-full rounded-full", v.ocupacao >= 90 ? "bg-emerald-500" : v.ocupacao >= 60 ? "bg-sky-500" : "bg-amber-400")} style={{ width: `${v.ocupacao}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {v.ocupacao}% cheia · cubado {kg(v.pesoCubadoKg)}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-sm">
                        {v.itens.map((i) => (
                          <li key={i.label}>
                            <strong>{numero(i.quantidade)}</strong> {i.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">Enche a maior caixa até a boca e coloca o restante na menor caixa que comporta.</p>
              </Card>
            </>
          )}
        </aside>
      </div>

      {resultado && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold">Detalhamento</h2>
            <Table>
              <thead>
                <tr>
                  <Th className="text-left">Item</Th>
                  <Th>Qtd</Th>
                  <Th>NF un.</Th>
                  <Th>NF total</Th>
                  <Th>Peso</Th>
                </tr>
              </thead>
              <tbody>
                {resultado.itens.map((i) => (
                  <tr key={i.chave}>
                    <Td className="text-left">{i.label}</Td>
                    <Td>{numero(i.quantidade)}</Td>
                    <Td>{moeda(i.valorNfUn)}</Td>
                    <Td className="font-medium">{moeda(i.valorNf)}</Td>
                    <Td>{kg(i.pesoKg)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 text-lg font-semibold">Usando um só tamanho de caixa</h2>
            <p className="mb-3 text-xs text-muted-foreground">Quantos volumes seriam necessários com cada caixa.</p>
            <Table>
              <thead>
                <tr>
                  <Th className="text-left">Caixa</Th>
                  <Th>Volumes</Th>
                  <Th>Ocupação média</Th>
                </tr>
              </thead>
              <tbody>
                {resultado.porTamanho.map((c) => (
                  <tr key={c.caixa}>
                    <Td className="text-left">
                      {c.caixa} <span className="text-xs text-muted-foreground">({numero(c.litros)} L)</span>
                    </Td>
                    <Td>{c.volumes ?? "—"}</Td>
                    <Td>{c.ocupacaoMedia != null ? `${c.ocupacaoMedia}%` : <span className="text-xs text-muted-foreground">{c.motivo}</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Segunda opinião da IA</h2>
                <p className="text-sm text-muted-foreground">Parte do plano acima e sugere duas alternativas (ex.: menos volumes ou caixas mais fáceis de manusear).</p>
              </div>
              <Button variant="outline" loading={analisando} onClick={analisarIA}>
                <Sparkles className="h-4 w-4" /> {analise ? "Gerar de novo" : "Pedir alternativas"}
              </Button>
            </div>
            {analise && (
              <div className="mt-4 space-y-3">
                {analise.resumo && <p className="rounded-lg bg-primary-soft/60 p-3 text-sm">{analise.resumo}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  {[analise.opcao1, analise.opcao2].filter(Boolean).map((o, n) => (
                    <OpcaoIA key={n} opcao={o} />
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {verParametros && parametros && <Parametros onFechar={() => setVerParametros(false)} parametros={parametros} onSalvo={setParametros} />}
    </div>
  );
}
