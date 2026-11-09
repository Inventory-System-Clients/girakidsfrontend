import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Search, Send, Undo2, XCircle } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, MetricCard, Select, Skeleton, Table, Tabs, Td, Textarea, Th, cx, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { data, hojeISO, moeda } from "../../utils/format";

const situacao = (c) =>
  c.status === "ENVIADO" ? `Cheque enviado para ${c.fornecedorNome}` : c.status === "DEVOLVIDO" ? "Cheque devolvido" : "Cheque no caixa";
const COR = { CAIXA: "success", ENVIADO: "info", DEVOLVIDO: "danger" };

const somarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const centavos = (v) => Math.round(Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) * 100) || 0;
const campoValor = (v) => Number(v || 0).toFixed(2).replace(".", ",");

// Cheques do pedido: quantos cheques, e valor, bom para, nº e banco de cada.
// Trocar a quantidade divide o total em partes iguais (o último acerta os
// centavos), com bom para de 30 em 30 dias a partir do primeiro.
function EditarCheques({ cheque, todos, onFechar, onSalvo }) {
  const grupo = todos.filter((c) => c.grupo === cheque.grupo).sort((a, b) => a.ordem - b.ordem);
  const total = grupo.reduce((s, c) => s + Math.round(c.valor * 100), 0);
  const travado = grupo.some((c) => c.status !== "CAIXA");
  const [linhas, setLinhas] = useState(() =>
    grupo.map((c) => ({ id: c.id, valor: campoValor(c.valor), bomPara: c.bomPara || "", numero: c.numero || "", banco: c.banco || "", status: c.status, fornecedorNome: c.fornecedorNome })),
  );
  const [observacao, setObservacao] = useState(cheque.observacao || "");
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const soma = linhas.reduce((s, l) => s + centavos(l.valor), 0);

  const dividir = (qtd) => {
    const parte = Math.floor(total / qtd);
    const primeira = linhas[0]?.bomPara || cheque.bomPara || cheque.recebidoEm || "";
    setLinhas(
      Array.from({ length: qtd }, (_, i) => ({
        ...(linhas[i] || { numero: "", banco: linhas[0]?.banco || "" }),
        valor: campoValor((i === qtd - 1 ? total - parte * (qtd - 1) : parte) / 100),
        bomPara: primeira ? somarDias(primeira, 30 * i) : "",
        status: linhas[i]?.status || "CAIXA",
      })),
    );
  };
  const alterar = (i, campo, valor) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/cheques/${cheque.id}/distribuir`, { cheques: linhas.map(({ id, valor, bomPara, numero, banco }) => ({ id, valor: centavos(valor) / 100, bomPara, numero, banco })) });
      if (observacao !== (cheque.observacao || "") && linhas.some((l) => l.id === cheque.id)) await api.put(`/cheques/${cheque.id}`, { observacao });
      toast({ titulo: linhas.length > 1 ? `Pedido dividido em ${linhas.length} cheques` : "Cheque atualizado" });
      onSalvo();
    } catch (e) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Cheques do pedido ${cheque.pedidoNumeroFormatado}`}
      descricao={`${cheque.clienteNome} · total ${moeda(total / 100)}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button loading={salvando} disabled={soma !== total} onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Quantidade de cheques" className="w-48">
            <Select value={linhas.length} disabled={travado} onChange={(e) => dividir(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "cheque" : "cheques"}</option>
              ))}
            </Select>
          </Field>
          <Button variant="outline" disabled={travado} onClick={() => dividir(linhas.length)}>
            Dividir igualmente (30 em 30 dias)
          </Button>
        </div>
        {travado && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Há cheque deste pedido enviado ou devolvido: dá para editar nº, banco e bom para, mas para mudar valores ou a quantidade volte esses cheques ao caixa primeiro.
          </p>
        )}
        <div className="space-y-2">
          {linhas.map((l, i) => (
            <div key={l.id || `novo-${i}`} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2.5rem_1fr_1fr_9.5rem_8rem] sm:items-end">
              <span className="col-span-2 text-sm font-semibold sm:col-span-1 sm:pb-2">{i + 1}º</span>
              <Field label="Nº do cheque">
                <Input value={l.numero} onChange={(e) => alterar(i, "numero", e.target.value)} />
              </Field>
              <Field label="Banco">
                <Input value={l.banco} onChange={(e) => alterar(i, "banco", e.target.value)} placeholder="Ex.: Itaú" />
              </Field>
              <Field label="Bom para">
                <Input type="date" value={l.bomPara} onChange={(e) => alterar(i, "bomPara", e.target.value)} />
              </Field>
              <Field label={l.status !== "CAIXA" ? (l.status === "ENVIADO" ? `Valor (com ${l.fornecedorNome})` : "Valor (devolvido)") : "Valor"}>
                <Input inputMode="decimal" value={l.valor} disabled={travado} onChange={(e) => alterar(i, "valor", e.target.value.replace(/[^\d,.]/g, ""))} />
              </Field>
            </div>
          ))}
        </div>
        <p className={cx("text-right text-sm", soma === total ? "text-emerald-700" : "font-semibold text-amber-700")}>
          Soma dos cheques {moeda(soma / 100)} de {moeda(total / 100)}
          {soma !== total && ` · ${soma > total ? "sobram" : "faltam"} ${moeda(Math.abs(total - soma) / 100)}`}
        </p>
        <Field label="Observação deste cheque (opcional)">
          <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

// Enviar para fornecedor ou marcar como devolvido.
function MudarStatus({ cheque, status, onFechar, onSalvo }) {
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorId, setFornecedorId] = useState("");
  const [dia, setDia] = useState(hojeISO());
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const enviar = status === "ENVIADO";
  useEffect(() => {
    if (enviar) api.get("/parceiros", { params: { tipo: "FORNECEDOR" } }).then(({ data: l }) => setFornecedores(l.filter((x) => x.ativo !== false))).catch(() => {});
  }, [enviar]);
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post(`/cheques/${cheque.id}/status`, { status, fornecedorId, data: dia, motivo });
      toast({ titulo: enviar ? "Cheque enviado ao fornecedor" : "Cheque marcado como devolvido", tipo: enviar ? undefined : "aviso" });
      onSalvo();
    } catch (e) {
      toast({ titulo: "Erro", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={enviar ? "Enviar cheque para fornecedor" : "Cheque devolvido"}
      descricao={`Pedido ${cheque.pedidoNumeroFormatado} · ${cheque.clienteNome} · ${moeda(cheque.valor)}${cheque.numero ? ` · nº ${cheque.numero}` : ""}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button variant={enviar ? "primary" : "danger"} loading={salvando} disabled={enviar && !fornecedorId} onClick={salvar}>
            {enviar ? "Enviar" : "Marcar como devolvido"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {enviar ? (
          <Field label="Fornecedor">
            <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {cheque.fornecedorNome ? `O cheque estava com ${cheque.fornecedorNome}. ` : ""}Depois de marcar, entre em contato com o cliente ({cheque.clienteNome}) para acertar o pagamento.
            </p>
            <Field label="Motivo (opcional)">
              <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem fundos" />
            </Field>
          </>
        )}
        <Field label={enviar ? "Data do envio" : "Data da devolução"}>
          <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function TabelaCheques({ cheques, todos, onAtualizar }) {
  const [acao, setAcao] = useState(null);
  const toast = useToast();
  const voltarCaixa = async (c) => {
    try {
      await api.post(`/cheques/${c.id}/status`, { status: "CAIXA" });
      toast({ titulo: "Cheque de volta no caixa" });
      onAtualizar();
    } catch (e) {
      toast({ titulo: "Erro", descricao: mensagemErro(e), tipo: "erro" });
    }
  };
  if (!cheques.length) return <EmptyState titulo="Nenhum cheque" descricao="Nenhum cheque encontrado." />;
  return (
    <Card className="overflow-hidden">
      <Table>
        <thead>
          <tr>
            {["Pedido", "Cliente", "Data", "Cheque", "Valor", "Situação", ""].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cheques.map((c) => (
            <tr key={c.id} className={cx("hover:bg-muted/40", c.status === "DEVOLVIDO" && "bg-red-50")}>
              <Td className="font-semibold">
                {c.pedidoNumeroFormatado}
                {!c.pedidoPago && <span className="block text-xs font-normal text-amber-700">pedido aguardando pagamento</span>}
              </Td>
              <Td className="text-left">{c.clienteNome}</Td>
              <Td>{data(c.recebidoEm)}</Td>
              <Td className="text-xs">
                {c.totalGrupo > 1 && <span className="mr-1 rounded bg-slate-100 px-1 font-semibold">{c.posicao}/{c.totalGrupo}</span>}
                {c.numero ? <span className="font-medium">nº {c.numero}</span> : <span className="text-muted-foreground">sem nº</span>}
                {c.banco && <span className="block">{c.banco}</span>}
                {c.bomPara && <span className="block text-muted-foreground">bom para {data(c.bomPara)}</span>}
              </Td>
              <Td className="font-semibold">{moeda(c.valor)}</Td>
              <Td className="text-left">
                <Badge variant={COR[c.status]}>{situacao(c)}</Badge>
                {c.status === "ENVIADO" && <span className="block text-xs text-muted-foreground">em {data(c.enviadoEm)}</span>}
                {c.status === "DEVOLVIDO" && (
                  <span className="mt-1 block text-xs text-red-800">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    Voltou em {data(c.devolvidoEm)}
                    {c.fornecedorNome && ` (estava com ${c.fornecedorNome})`}
                    {c.motivoDevolucao && ` · ${c.motivoDevolucao}`}. Entre em contato com o cliente
                    {c.clienteTelefone && (
                      <>
                        {": "}
                        <BotaoWhatsapp telefone={c.clienteTelefone} texto={`Olá, ${c.clienteNome}! Aqui é da Gira Kids. O cheque${c.numero ? ` nº ${c.numero}` : ""} de ${moeda(c.valor)} do pedido ${c.pedidoNumeroFormatado} voltou. Podemos combinar o pagamento?`} variante="link">
                          {c.clienteTelefone}
                        </BotaoWhatsapp>
                      </>
                    )}
                  </span>
                )}
              </Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setAcao({ tipo: "editar", cheque: c })} aria-label="Cheques do pedido" title="Dividir em vários cheques, valor, nº, banco e bom para">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {c.status === "CAIXA" && (
                    <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "ENVIADO", cheque: c })}>
                      <Send className="h-4 w-4" /> Enviar a fornecedor
                    </Button>
                  )}
                  {c.status !== "CAIXA" && (
                    <Button size="sm" variant="outline" onClick={() => voltarCaixa(c)} title={c.status === "DEVOLVIDO" ? "Desfazer a devolução" : "O cheque voltou para nós"}>
                      <Undo2 className="h-4 w-4" /> Voltar ao caixa
                    </Button>
                  )}
                  {c.status !== "DEVOLVIDO" && (
                    <Button size="sm" variant="danger-outline" onClick={() => setAcao({ tipo: "DEVOLVIDO", cheque: c })}>
                      <XCircle className="h-4 w-4" /> Cheque voltou
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {acao?.tipo === "editar" && <EditarCheques cheque={acao.cheque} todos={todos} onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); onAtualizar(); }} />}
      {(acao?.tipo === "ENVIADO" || acao?.tipo === "DEVOLVIDO") && (
        <MudarStatus cheque={acao.cheque} status={acao.tipo} onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); onAtualizar(); }} />
      )}
    </Card>
  );
}

function Totais({ resumo }) {
  const [verFornecedores, setVerFornecedores] = useState(false);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo="Total em cheques" valor={moeda(resumo.total)} detalhe={`${resumo.quantidade} cheques (sem os devolvidos)`} />
        <MetricCard titulo="Cheques no caixa" valor={moeda(resumo.caixa)} detalhe={`${resumo.qtdCaixa} ainda conosco`} />
        <button type="button" className="text-left" onClick={() => setVerFornecedores(!verFornecedores)} aria-expanded={verFornecedores}>
          <MetricCard
            className={cx("h-full transition hover:border-primary/50", verFornecedores && "border-primary! ring-2 ring-primary/20")}
            titulo="Enviados a fornecedores"
            valor={moeda(resumo.enviados)}
            detalhe={`${resumo.qtdEnviados} cheques · ${verFornecedores ? "esconder" : "ver"} por fornecedor`}
          />
        </button>
        <MetricCard className={resumo.qtdDevolvidos ? "border-red-200! bg-red-50!" : ""} titulo="Devolvidos" valor={moeda(resumo.devolvidos)} detalhe={resumo.qtdDevolvidos ? `${resumo.qtdDevolvidos} cheques voltaram: fale com os clientes` : "Nenhum cheque voltou"} />
      </div>
      {verFornecedores && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">Cheques enviados por fornecedor</p>
          {!resumo.porFornecedor.length ? (
            <p className="text-sm text-muted-foreground">Nenhum cheque enviado.</p>
          ) : (
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {resumo.porFornecedor.map((f) => (
                <div key={f.nome} className="flex justify-between gap-3 border-b border-border py-1 text-sm">
                  <span>
                    {f.nome} <span className="text-xs text-muted-foreground">({f.quantidade})</span>
                  </span>
                  <span className="font-medium">{moeda(f.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

// Financeiro → Cheques: todos os cheques (no caixa, enviados, devolvidos) e
// os recebidos no período selecionado.
export default function Cheques({ periodo }) {
  const [sub, setSub] = useState("todos");
  const [d, setD] = useState(null);
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setD(null);
    const req = sub === "todos" ? api.get("/cheques") : api.get("/cheques/periodo", { params: periodo });
    req
      .then(({ data: r }) => setD(r))
      .catch((e) => {
        toast({ titulo: "Erro ao carregar cheques", descricao: mensagemErro(e), tipo: "erro" });
        setD({ cheques: [], resumo: { total: 0, quantidade: 0, caixa: 0, qtdCaixa: 0, enviados: 0, qtdEnviados: 0, devolvidos: 0, qtdDevolvidos: 0, porFornecedor: [] } });
      });
  }, [sub, periodo, recarregar, toast]);

  const termo = busca.trim().toLowerCase();
  const lista = (d?.cheques || [])
    .filter((c) => !status || c.status === status)
    .filter((c) => !termo || [c.clienteNome, c.numero, c.banco, c.fornecedorNome, c.pedidoNumeroFormatado].some((v) => String(v || "").toLowerCase().includes(termo)));

  return (
    <div className="space-y-4">
      <Tabs abas={[{ value: "todos", label: "Todos os cheques" }, { value: "periodo", label: "Recebidos no período" }]} ativa={sub} onChange={setSub} />
      <p className="text-xs text-muted-foreground">
        {sub === "todos"
          ? "Todos os pedidos com cheque (forma Cheque ou parcela em cheque), de qualquer data."
          : `Cheques recebidos entre ${data(periodo.inicio)} e ${data(periodo.fim)} (troque o período no alto da página).`}
      </p>
      {!d ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Totais resumo={d.resumo} />
          <div className="flex flex-wrap items-center gap-2">
            <Select className="w-52" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas as situações</option>
              <option value="CAIXA">No caixa</option>
              <option value="ENVIADO">Enviados a fornecedores</option>
              <option value="DEVOLVIDO">Devolvidos</option>
            </Select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <input className="input h-9 pl-9" placeholder="Cliente, pedido, nº, fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <TabelaCheques cheques={lista} todos={d.cheques} onAtualizar={() => setRecarregar((n) => n + 1)} />
        </>
      )}
    </div>
  );
}
