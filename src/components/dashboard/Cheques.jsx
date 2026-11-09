import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Search, Send, Undo2, XCircle } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, MetricCard, Select, Skeleton, Table, Tabs, Td, Textarea, Th, cx, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { data, hojeISO, moeda } from "../../utils/format";

const situacao = (c) =>
  c.status === "ENVIADO" ? `Cheque enviado para ${c.fornecedorNome}` : c.status === "DEVOLVIDO" ? "Cheque devolvido" : "Cheque no caixa";
const COR = { CAIXA: "success", ENVIADO: "info", DEVOLVIDO: "danger" };

// Número, banco, bom para e observação do cheque.
function EditarCheque({ cheque, onFechar, onSalvo }) {
  const [f, setF] = useState({ numero: cheque.numero || "", banco: cheque.banco || "", bomPara: cheque.bomPara || "", observacao: cheque.observacao || "" });
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/cheques/${cheque.id}`, f);
      toast({ titulo: "Cheque atualizado" });
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
      titulo={`Dados do cheque · Pedido ${cheque.pedidoNumeroFormatado}`}
      descricao={`${cheque.clienteNome} · ${moeda(cheque.valor)}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button loading={salvando} onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nº do cheque">
          <Input autoFocus value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        </Field>
        <Field label="Banco do cheque">
          <Input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} placeholder="Ex.: Itaú" />
        </Field>
        <Field label="Bom para">
          <Input type="date" value={f.bomPara} onChange={(e) => setF({ ...f, bomPara: e.target.value })} />
        </Field>
        <Field label="Observação" className="sm:col-span-3">
          <Textarea rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
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

function TabelaCheques({ cheques, onAtualizar }) {
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
                  <Button size="icon" variant="ghost" onClick={() => setAcao({ tipo: "editar", cheque: c })} aria-label="Dados do cheque" title="Nº, banco e bom para">
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
      {acao?.tipo === "editar" && <EditarCheque cheque={acao.cheque} onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); onAtualizar(); }} />}
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
          <TabelaCheques cheques={lista} onAtualizar={() => setRecarregar((n) => n + 1)} />
        </>
      )}
    </div>
  );
}
