import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Link2, Pencil, RefreshCw, Trash2, Undo2 } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Button, Checkbox, Dialog, Field, Input, Select, Skeleton, Textarea, cx, useConfirm, useToast } from "../ui";
import { data, dataHora, hojeISO, lerNumero, moeda } from "../../utils/format";
import { LinkFornecedor, Miniatura, SOLUCOES, StatusPre, TipoItem, atualizarAlertasRecebimentos, excluirPreRecebimento, un } from "./comum";

const ABERTOS = ["AGUARDANDO_FORNECEDOR", "FORNECEDOR_RESPONDEU"];

function Linha({ rotulo, children }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{rotulo}: </span>
      {children}
    </p>
  );
}

export default function PreRecebimentoDetalhe({ id, linkInicial, fornecedores, onFechar, onAlterado, onEditar, onAbrirOutro }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [pre, setPre] = useState(null);
  const [token, setToken] = useState(linkInicial || null);
  const [recebidas, setRecebidas] = useState({});
  const [conferindo, setConferindo] = useState(false);
  const [div, setDiv] = useState({ descricao: "", solucao: "", detalhe: "", prazo: "", gerarRestante: true });
  const [resolucao, setResolucao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const aplicar = (d) => {
    setPre(d);
    if (d.linkToken) setToken(d.linkToken);
    setRecebidas(Object.fromEntries(d.itens.map((i) => [i.id, String(i.quantidadeRecebida ?? i.esperado)])));
  };

  useEffect(() => {
    if (!id) return;
    api
      .get(`/recebimentos/${id}`)
      .then(({ data: d }) => {
        aplicar(d);
        atualizarAlertasRecebimentos();
      })
      .catch((e) => toast({ titulo: "Erro ao abrir", descricao: mensagemErro(e), tipo: "erro" }));
  }, [id, toast]);

  if (!id) return null;
  const aberto = pre && ABERTOS.includes(pre.status);
  const fornecedor = fornecedores.find((f) => f.id === pre?.fornecedorId);
  const faltas = pre ? pre.itens.filter((i) => lerNumero(recebidas[i.id]) < i.esperado) : [];
  const temFalta = faltas.length > 0;

  const acao = async (fn, sucesso) => {
    setEnviando(true);
    try {
      const { data: d } = await fn();
      aplicar(d);
      if (sucesso) toast(sucesso(d));
      onAlterado?.();
      atualizarAlertasRecebimentos();
      return d;
    } catch (error) {
      toast({ titulo: "Não foi possível concluir", descricao: mensagemErro(error), tipo: "erro" });
      return null;
    } finally {
      setEnviando(false);
    }
  };

  const confirmarRecebimento = async () => {
    const d = await acao(
      () =>
        api.post(`/recebimentos/${pre.id}/receber`, {
          itens: pre.itens.map((i) => ({ id: i.id, quantidadeRecebida: lerNumero(recebidas[i.id]) })),
          divergencia: temFalta ? div : undefined,
        }),
      (r) =>
        r.status === "RECEBIDO"
          ? { titulo: "Recebimento confirmado", descricao: "Tudo conferido e lançado no estoque." }
          : { titulo: "Recebido com falta", descricao: "Estoque lançado com o que chegou. A divergência ficou em aberto nos alertas.", tipo: "aviso" },
    );
    if (d) {
      setConferindo(false);
      if (d.restante) {
        const ok = await confirmar({
          titulo: `Pré-recebimento nº ${d.restante.numero} criado com o que faltou`,
          mensagem: "Quer abrir agora para enviar o link ao fornecedor?",
          confirmar: "Abrir",
        });
        if (ok) onAbrirOutro?.(d.restante.id, d.restante.linkToken);
      }
    }
  };

  const cancelar = async () => {
    const motivo = await confirmar({ titulo: "Cancelar pré-recebimento?", mensagem: "O link do fornecedor deixa de funcionar.", perigo: true, confirmar: "Cancelar pré-recebimento", campo: { label: "Motivo (opcional)" } });
    if (motivo === false || motivo == null) return;
    await acao(() => api.post(`/recebimentos/${pre.id}/cancelar`, { motivo: typeof motivo === "string" ? motivo : "" }), () => ({ titulo: "Pré-recebimento cancelado" }));
  };

  const estornar = async () => {
    const motivo = await confirmar({
      titulo: "Estornar recebimento?",
      mensagem: "As quantidades recebidas saem do estoque (brinquedos, cápsulas e prontos).",
      perigo: true,
      confirmar: "Estornar",
      campo: { label: "Motivo do estorno", obrigatorio: true },
    });
    if (!motivo) return;
    await acao(() => api.post(`/recebimentos/${pre.id}/estornar`, { motivo }), () => ({ titulo: "Recebimento estornado" }));
  };

  const excluir = async () => {
    if (await excluirPreRecebimento(pre, { confirmar, toast })) {
      onAlterado?.();
      onFechar();
    }
  };

  const novoLink = async () => {
    const ok = await confirmar({ titulo: "Gerar novo link?", mensagem: "O link atual para de funcionar. Use se ele foi enviado para a pessoa errada.", confirmar: "Gerar novo link" });
    if (ok) await acao(() => api.post(`/recebimentos/${pre.id}/link`), () => ({ titulo: "Novo link gerado" }));
  };

  const podeConfirmar = !temFalta || (div.descricao.trim() && div.solucao && (div.solucao !== "OUTRO" || div.detalhe.trim()));

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo={pre ? `${pre.direto ? "Recebimento" : "Pré-recebimento"} nº ${pre.numero}` : "Carregando..."}
      descricao={pre?.fornecedorNome || "Sem fornecedor definido"}
      rodape={
        pre && (
          <>
            {aberto && !conferindo && (
              <>
                <Button variant="danger-outline" onClick={cancelar} disabled={enviando}>
                  <Ban className="h-4 w-4" /> Cancelar
                </Button>
                <Button variant="outline" onClick={() => onEditar(pre)}>
                  <Pencil className="h-4 w-4" /> Editar itens
                </Button>
                <Button variant="success" onClick={() => setConferindo(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Conferir chegada
                </Button>
              </>
            )}
            {conferindo && (
              <>
                <Button variant="outline" onClick={() => setConferindo(false)}>
                  Voltar
                </Button>
                <Button variant={temFalta ? "danger" : "success"} loading={enviando} disabled={!podeConfirmar} onClick={confirmarRecebimento}>
                  {temFalta ? "Confirmar recebimento com falta" : "Confirmar recebimento completo"}
                </Button>
              </>
            )}
            {["RECEBIDO", "RECEBIDO_PARCIAL"].includes(pre.status) && (
              <Button variant="danger-outline" onClick={estornar} disabled={enviando}>
                <Undo2 className="h-4 w-4" /> Estornar
              </Button>
            )}
            {!conferindo && (
              <Button variant="danger-outline" onClick={excluir} disabled={enviando} title="Apaga de vez; se já foi recebido, tira do estoque antes">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
            {!aberto && <Button variant="outline" onClick={onFechar}>Fechar</Button>}
          </>
        )
      }
    >
      {!pre ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-border p-3">
              <div className="mb-1">
                <StatusPre status={pre.status} />
              </div>
              <Linha rotulo="Criado">
                {dataHora(pre.createdAt)} por {pre.criadoPor}
              </Linha>
              {pre.previsaoEntrega && <Linha rotulo="Previsão (nossa)">{data(pre.previsaoEntrega)}</Linha>}
              {pre.origemNumero && <Linha rotulo="Restante do recebimento">nº {pre.origemNumero}</Linha>}
              {pre.observacao && <Linha rotulo="Observação">{pre.observacao}</Linha>}
              {pre.recebidoEm && (
                <Linha rotulo="Recebido">
                  {dataHora(pre.recebidoEm)} por {pre.recebidoPor}
                </Linha>
              )}
              {pre.canceladoEm && (
                <Linha rotulo={pre.status === "ESTORNADO" ? "Estornado" : "Cancelado"}>
                  {dataHora(pre.canceladoEm)} por {pre.canceladoPor}
                  {pre.motivoCancelamento && ` — ${pre.motivoCancelamento}`}
                </Linha>
              )}
            </div>
            <div className={cx("space-y-1 rounded-lg border p-3", pre.respondidoEm ? "border-blue-200 bg-blue-50" : "border-border")}>
              <p className="text-sm font-semibold">Resposta do fornecedor</p>
              {pre.respondidoEm ? (
                <>
                  <Linha rotulo="Respondido">
                    {dataHora(pre.respondidoEm)} por {pre.respondidoPor}
                  </Linha>
                  {pre.previsaoFornecedor && <Linha rotulo="Vai entregar em">{data(pre.previsaoFornecedor)}</Linha>}
                  {pre.observacaoFornecedor && <Linha rotulo="Observação">{pre.observacaoFornecedor}</Linha>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {pre.direto ? "Recebimento direto, sem link." : pre.linkAcessadoEm ? `Abriu o link em ${dataHora(pre.linkAcessadoEm)}, ainda sem resposta.` : "Ainda não abriu o link."}
                </p>
              )}
            </div>
          </div>

          {aberto && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-900">
                <Link2 className="h-4 w-4" /> Link para o fornecedor (sem login, só vê este pré-recebimento)
              </p>
              {token ? (
                <LinkFornecedor token={token} telefone={fornecedor?.telefone} numero={pre.numero} fornecedorNome={fornecedor?.contato || fornecedor?.nome} />
              ) : (
                <p className="text-sm text-muted-foreground">Link indisponível.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-sky-900">
                {pre.linkExpiraEm && <span>{pre.linkExpirado ? "Link expirado" : `Válido até ${data(pre.linkExpiraEm)}`}</span>}
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={novoLink}>
                  <RefreshCw className="h-3 w-3" /> Gerar novo link
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Fornecedor vai trazer</th>
                  <th className="px-3 py-2">Recebido</th>
                  <th className="px-3 py-2">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {pre.itens.map((i) => {
                  const recebida = conferindo ? lerNumero(recebidas[i.id]) : i.quantidadeRecebida;
                  const dif = recebida != null ? recebida - i.esperado : null;
                  return (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Miniatura src={i.imagemUrl} />
                          <div className="min-w-0">
                            <p className="font-medium">{i.produtoNome}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU {i.produtoSku}
                              {i.custoUnitario ? ` · ${moeda(i.custoUnitario)}/un.` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <TipoItem destino={i.destino} />
                      </td>
                      <td className="px-3 py-2 text-center">{un(i.quantidadeSolicitada)}</td>
                      <td className="px-3 py-2 text-center">
                        {i.quantidadeFornecedor != null ? (
                          <span className={cx("font-semibold", i.quantidadeFornecedor < i.quantidadeSolicitada && "text-amber-700")}>{un(i.quantidadeFornecedor)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {i.observacaoFornecedor && <span className="block text-xs text-muted-foreground">"{i.observacaoFornecedor}"</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {conferindo ? (
                          <Input
                            className="mx-auto h-9 w-28 text-center"
                            inputMode="numeric"
                            value={recebidas[i.id] ?? ""}
                            onChange={(e) => setRecebidas({ ...recebidas, [i.id]: e.target.value.replace(/\D/g, "") })}
                          />
                        ) : i.quantidadeRecebida != null ? (
                          <strong>{un(i.quantidadeRecebida)}</strong>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {dif == null ? "—" : dif === 0 ? <span className="text-emerald-700">OK</span> : <strong className={dif < 0 ? "text-red-600" : "text-blue-700"}>{dif > 0 ? `+${un(dif)}` : `-${un(-dif)}`}</strong>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    Total{pre.totais.valor > 0 && <span className="ml-2 font-normal text-muted-foreground">({moeda(pre.totais.valor)})</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{un(pre.totais.solicitado)}</td>
                  <td className="px-3 py-2 text-center">{pre.totais.fornecedor != null ? un(pre.totais.fornecedor) : "—"}</td>
                  <td className="px-3 py-2 text-center">{conferindo ? un(pre.itens.reduce((s, i) => s + lerNumero(recebidas[i.id]), 0)) : pre.totais.recebido != null ? un(pre.totais.recebido) : "—"}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {conferindo && (
            <p className="text-sm text-muted-foreground">
              Confira e corrija as quantidades que chegaram. O esperado é o que o fornecedor confirmou (ou o pedido, se ele não respondeu).
            </p>
          )}

          {conferindo && temFalta && (
            <div className="space-y-3 rounded-lg border-2 border-red-300 bg-red-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-red-800">
                <AlertTriangle className="h-5 w-5" /> Faltou mercadoria em {faltas.length} item(ns): {faltas.map((i) => `${i.produtoNome} (-${un(i.esperado - lerNumero(recebidas[i.id]))})`).join(", ")}
              </p>
              <Field label="O que aconteceu?" obrigatorio>
                <Textarea value={div.descricao} onChange={(e) => setDiv({ ...div, descricao: e.target.value })} placeholder="Ex.: chegaram 9 caixas de 10; motorista disse que a última ficou no depósito" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Como o fornecedor vai resolver?" obrigatorio>
                  <Select value={div.solucao} onChange={(e) => setDiv({ ...div, solucao: e.target.value })}>
                    <option value="">Selecione</option>
                    {Object.entries(SOLUCOES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Prazo combinado">
                  <Input type="date" min={hojeISO()} value={div.prazo} onChange={(e) => setDiv({ ...div, prazo: e.target.value })} />
                </Field>
              </div>
              <Field label={div.solucao === "OUTRO" ? "Detalhe da solução" : "Detalhe (opcional)"} obrigatorio={div.solucao === "OUTRO"}>
                <Input value={div.detalhe} onChange={(e) => setDiv({ ...div, detalhe: e.target.value })} placeholder="Ex.: vai mandar junto com o próximo pedido" />
              </Field>
              {div.solucao === "ENVIAR_RESTANTE" && (
                <Checkbox
                  checked={div.gerarRestante}
                  onChange={(v) => setDiv({ ...div, gerarRestante: v })}
                  label="Criar um novo pré-recebimento com o que faltou"
                  descricao="Com link próprio para o fornecedor confirmar a entrega do restante."
                />
              )}
              <p className="text-xs text-red-800">Fica um alerta aberto na aba Recebimentos até alguém marcar como resolvido.</p>
            </div>
          )}

          {pre.divergenciaStatus !== "NENHUMA" && (
            <div className={cx("space-y-2 rounded-lg border-2 p-4", pre.divergenciaStatus === "ABERTA" ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
              <p className={cx("flex items-center gap-2 font-semibold", pre.divergenciaStatus === "ABERTA" ? "text-red-800" : "text-emerald-800")}>
                <AlertTriangle className="h-5 w-5" /> {pre.divergenciaStatus === "ABERTA" ? "Divergência em aberto" : "Divergência resolvida"}
              </p>
              <Linha rotulo="O que aconteceu">{pre.divergenciaDescricao}</Linha>
              <Linha rotulo="Solução combinada">
                {SOLUCOES[pre.divergenciaSolucao] || pre.divergenciaSolucao}
                {pre.divergenciaDetalhe && ` — ${pre.divergenciaDetalhe}`}
              </Linha>
              {pre.divergenciaPrazo && <Linha rotulo="Prazo">{data(pre.divergenciaPrazo)}</Linha>}
              {pre.divergenciaStatus === "RESOLVIDA" ? (
                <Linha rotulo="Resolvido">
                  {dataHora(pre.divergenciaResolvidaEm)} por {pre.divergenciaResolvidaPor} — {pre.divergenciaResolucao}
                </Linha>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={resolucao} onChange={(e) => setResolucao(e.target.value)} placeholder="Como foi resolvido? Ex.: restante chegou no recebimento nº 12" className="flex-1" />
                  <Button
                    variant="success"
                    disabled={!resolucao.trim()}
                    loading={enviando}
                    onClick={() => acao(() => api.post(`/recebimentos/${pre.id}/divergencia/resolver`, { resolucao }), () => ({ titulo: "Divergência resolvida" }))}
                  >
                    Marcar como resolvida
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
