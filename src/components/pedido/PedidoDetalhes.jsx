import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, Spinner } from "../ui";
import { carimbo, data, dataHora, mascaraDocumento, moeda, moedaUnitaria, pesoKg } from "../../utils/format";
import { EXPEDICAO, FINANCEIRO, METODOS_ENVIO, VENDAS, nomeForma } from "../../utils/status";
import { gerarPdfPedido } from "../../utils/pdf";
import { GaleriaFotos } from "./Fotos";
import { EditorEtiquetas, EtiquetasChips } from "../Etiquetas";
import { BotaoWhatsapp } from "../Whatsapp";

const Info = ({ rotulo, children }) => (
  <div className="flex gap-2 text-sm">
    <span className="shrink-0 text-muted-foreground">{rotulo}:</span>
    <span className="min-w-0 break-words font-medium">{children || "-"}</span>
  </div>
);

const Bloco = ({ titulo, children, className }) => (
  <section className={`rounded-lg border border-border p-4 ${className || ""}`}>
    <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
    <div className="space-y-1.5">{children}</div>
  </section>
);

export const textoVendas = (p) =>
  p.statusVendas === "LIBERADO" ? "Pedido liberado para expedição." : p.statusVendas === "CANCELADO" ? "Pedido cancelado." : "Aguardando liberação do time de vendas.";

export const textoFinanceiro = (p) => {
  if (p.statusFinanceiro === "PAGO") return "Pagamento confirmado.";
  if (p.statusFinanceiro === "CANCELADO") return "Financeiro cancelado.";
  if (p.statusFinanceiroEfetivo === "ATRASADO") return "Há parcela vencida em aberto.";
  if (p.pendenciaStatus === "ABERTA") return "Há valor em aberto para acompanhar até a quitação.";
  return "Aguardando pagamento.";
};

export const textoExpedicao = (p) =>
  p.statusExpedicao === "EXPEDIDO" ? "Pedido expedido." : p.statusExpedicao === "MONTAGEM" ? "Produtos em montagem antes da expedição." : "Montagem ainda não iniciada.";

export default function PedidoDetalhes({ pedidoId, onFechar }) {
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!pedidoId) return;
    setPedido(null);
    setErro("");
    api.get(`/pedidos/${pedidoId}`).then(({ data: d }) => setPedido(d)).catch((e) => setErro(mensagemErro(e)));
  }, [pedidoId]);

  const tituloTipo = pedido?.tipo === "ORCAMENTO" ? "Orçamento" : "Pedido";
  return (
    <Dialog
      aberto={Boolean(pedidoId)}
      onFechar={onFechar}
      tamanho="xl"
      titulo={pedido ? `Detalhes do ${tituloTipo} ${pedido.numeroFormatado}` : "Detalhes do Pedido"}
      descricao={pedido ? `Informações completas, itens e status do ${tituloTipo.toLowerCase()} ${pedido.numeroFormatado}.` : undefined}
      rodape={
        pedido && (
          <Button variant="outline" onClick={() => gerarPdfPedido(pedido)}>
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        )
      }
    >
      {!pedido && !erro && (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      )}
      {erro && <p className="text-red-600">{erro}</p>}
      {pedido && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Bloco titulo="Informações do Cliente">
              <Info rotulo="Nome">{pedido.clienteNome}</Info>
              {pedido.cliente && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <EtiquetasChips etiquetas={pedido.cliente.etiquetas} />
                  <EditorEtiquetas
                    clienteId={pedido.cliente.id}
                    etiquetas={pedido.cliente.etiquetas}
                    observacao={pedido.cliente.observacaoComercial}
                    onSalvo={(d) => setPedido((p) => ({ ...p, cliente: { ...p.cliente, ...d } }))}
                  />
                </div>
              )}
              {pedido.cliente?.observacaoComercial && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Obs. comercial: {pedido.cliente.observacaoComercial}</p>}
              <Info rotulo="Email">{pedido.clienteEmail}</Info>
              <Info rotulo="Telefone">{pedido.clienteTelefone}</Info>
              {pedido.clienteTelefone && pedido.cliente !== undefined && (
                <BotaoWhatsapp telefone={pedido.clienteTelefone} variante="contorno" className="py-1 text-xs" texto={`Olá ${pedido.clienteNome.split(" ")[0]}! Aqui é da Gira Kids, sobre o pedido ${pedido.numeroFormatado}.`}>
                  WhatsApp do cliente
                </BotaoWhatsapp>
              )}
              <Info rotulo="CPF/CNPJ">{pedido.documento ? `${pedido.documentoTipo || ""}: ${mascaraDocumento(pedido.documento)}` : "-"}</Info>
              <Info rotulo="Tipo">{pedido.origemCliente === "ADMIN" ? "Administrador" : "Cliente"}</Info>
              <Info rotulo="Criado por">{pedido.criadoPorNome}</Info>
              <Info rotulo="Data">{dataHora(pedido.createdAt)}</Info>
              {pedido.orcamentoOrigemNumero && <Info rotulo="Do orçamento">{String(pedido.orcamentoOrigemNumero).padStart(4, "0")}</Info>}
              {pedido.pedidoGeradoNumero && <Info rotulo="Gerou o pedido">{pedido.pedidoGeradoNumero}</Info>}
            </Bloco>
            <Bloco titulo="Informações de Entrega">
              <Info rotulo="Endereço">{pedido.rua}</Info>
              <Info rotulo="Número">{pedido.numeroEndereco}</Info>
              {pedido.complemento && <Info rotulo="Complemento">{pedido.complemento}</Info>}
              <Info rotulo="Bairro">{pedido.bairro}</Info>
              <Info rotulo="Cidade">{pedido.cidade ? `${pedido.cidade} - ${pedido.estado || ""}` : "-"}</Info>
              <Info rotulo="CEP">{pedido.cep}</Info>
              <Info rotulo="Método de envio">{METODOS_ENVIO[pedido.metodoEnvio] || "A definir"}</Info>
              <Info rotulo="Prazo de entrega">{pedido.prazoEntregaDias ? `${pedido.prazoEntregaDias} dias úteis` : "N/A"}</Info>
              <Info rotulo="Peso total">{pesoKg(pedido.pesoTotalGramas)}</Info>
              {pedido.codigoRastreio && <Info rotulo="Rastreio">{pedido.codigoRastreio}</Info>}
            </Bloco>
          </div>

          {pedido.tipo === "PEDIDO" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Bloco titulo="Transportadora">
                {pedido.transportadoraNome ? (
                  <>
                    <Info rotulo="Nome">{pedido.transportadoraNome}</Info>
                    {pedido.transportadora?.telefone && <Info rotulo="Telefone">{pedido.transportadora.telefone}</Info>}
                    {pedido.transportadoraObs && <Info rotulo="Observações">{pedido.transportadoraObs}</Info>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma transportadora vinculada.</p>
                )}
              </Bloco>
              <Bloco titulo="Nota Fiscal">
                {pedido.notaFiscalNumero || pedido.notaFiscalUrl ? (
                  <>
                    <Info rotulo="Número">{pedido.notaFiscalNumero}</Info>
                    {pedido.notaFiscalUrl && (
                      <a href={pedido.notaFiscalUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">
                        Abrir nota fiscal
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma nota fiscal anexada.</p>
                )}
              </Bloco>
            </div>
          )}

          {pedido.tipo === "PEDIDO" && (
            <Bloco titulo="Status dos Times">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Time Vendas</p>
                  <p className="mt-1 text-sm">{textoVendas(pedido)}</p>
                  {pedido.liberadoEm && <p className="text-xs text-muted-foreground">{pedido.liberadoPor} · {carimbo(pedido.liberadoEm)}</p>}
                  {pedido.observacaoLiberacao && <p className="mt-1 text-xs">Obs.: {pedido.observacaoLiberacao}</p>}
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Time Financeiro</p>
                  <p className="mt-1 text-sm">{textoFinanceiro(pedido)}</p>
                  {pedido.pagoEm && <p className="text-xs text-muted-foreground">{pedido.pagoPor} · {carimbo(pedido.pagoEm)}</p>}
                  {pedido.pendenciaStatus && (
                    <p className="mt-1 text-xs">
                      Recebimento manual {pedido.pendenciaStatus === "ABERTA" ? `em aberto: ${moeda(pedido.pendenciaValor)}` : "quitado"}
                      {pedido.pendenciaAbertaPor && ` · aberto por ${pedido.pendenciaAbertaPor} em ${dataHora(pedido.pendenciaAbertaEm)}`}
                    </p>
                  )}
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Time Expedição</p>
                  <p className="mt-1 text-sm">{textoExpedicao(pedido)}</p>
                  <p className="text-xs text-muted-foreground">
                    Itens conferidos: {pedido.checklist.conferidos} de {pedido.checklist.total}
                  </p>
                  {pedido.montagemConcluidaEm && <p className="text-xs text-muted-foreground">Montagem: {pedido.montagemConcluidaPor} · {carimbo(pedido.montagemConcluidaEm)}</p>}
                  {pedido.expedidoEm && <p className="text-xs text-muted-foreground">Expedição: {pedido.expedidoPor} · {carimbo(pedido.expedidoEm)}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant={pedido.statusFinanceiro === "PAGO" ? "success" : pedido.statusFinanceiro === "CANCELADO" ? "danger" : "warning"}>
                  {FINANCEIRO[pedido.statusFinanceiroEfetivo]}
                </Badge>
                <Badge variant={pedido.statusVendas === "LIBERADO" ? "info" : pedido.statusVendas === "CANCELADO" ? "danger" : "warning"}>{VENDAS[pedido.statusVendas]}</Badge>
                {pedido.statusExpedicao !== "NAO_INICIADO" && <Badge variant="primary">{EXPEDICAO[pedido.statusExpedicao]}</Badge>}
              </div>
              {pedido.motivoCancelamento && <p className="text-sm text-red-600">Cancelado por {pedido.canceladoPor}: {pedido.motivoCancelamento}</p>}
            </Bloco>
          )}

          {pedido.tipo === "PEDIDO" && pedido.statusVendas === "LIBERADO" && (
            <Bloco titulo="Montagem e expedição">
              <div className="grid gap-2 sm:grid-cols-2">
                <Info rotulo="Itens conferidos">
                  {pedido.checklist.conferidos} de {pedido.checklist.total}
                </Info>
                <Info rotulo="Montagem concluída">{pedido.montagemConcluidaEm ? `${pedido.montagemConcluidaPor} · ${carimbo(pedido.montagemConcluidaEm)}` : "Não"}</Info>
                <Info rotulo="Expedido">{pedido.expedidoEm ? `${pedido.expedidoPor} · ${carimbo(pedido.expedidoEm)}` : "Não"}</Info>
                <Info rotulo="Liberado por">{pedido.liberadoPor ? `${pedido.liberadoPor} · ${carimbo(pedido.liberadoEm)}` : null}</Info>
              </div>
              {(pedido.observacoes || pedido.observacaoLiberacao || pedido.observacoesExpedicao || pedido.transportadoraObs) && (
                <div className="mt-2 space-y-1 rounded-md bg-amber-50 p-3 text-sm">
                  {pedido.observacoes && <p><strong>Observações do pedido:</strong> {pedido.observacoes}</p>}
                  {pedido.observacaoLiberacao && <p><strong>Observação do time de vendas:</strong> {pedido.observacaoLiberacao}</p>}
                  {pedido.observacoesExpedicao && <p><strong>Observações da expedição:</strong> {pedido.observacoesExpedicao}</p>}
                  {pedido.transportadoraObs && <p><strong>Observações da transportadora:</strong> {pedido.transportadoraObs}</p>}
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <GaleriaFotos titulo="Fotos do pedido" fotos={pedido.imagensExpedicao} />
                <GaleriaFotos titulo="Fotos da transportadora" fotos={pedido.imagensTransportadora} />
              </div>
              {!pedido.imagensExpedicao?.length && !pedido.imagensTransportadora?.length && <p className="text-xs text-muted-foreground">Nenhuma foto anexada.</p>}
            </Bloco>
          )}

          {pedido.custosExtras?.length > 0 && (
            <Bloco titulo={`Custos pós-venda · ${moeda(pedido.custoExtraTotal)}`}>
              {pedido.custosExtras.map((c) => (
                <p key={c.id} className="text-sm">
                  {data(c.data)} · <strong>{moeda(c.valor)}</strong> · {c.descricao} <span className="text-xs text-muted-foreground">({c.usuarioNome})</span>
                </p>
              ))}
            </Bloco>
          )}

          <Bloco titulo="Pagamento">
            <Info rotulo="Forma">{nomeForma(pedido.formaPagamento)}{pedido.parcelasCartao ? ` · ${pedido.parcelasCartao}x` : ""}</Info>
            {pedido.pagamentoLink && (
              <Info rotulo="Link de pagamento">
                <a className="text-primary underline" href={pedido.pagamentoLink} target="_blank" rel="noreferrer">
                  abrir
                </a>
              </Info>
            )}
            <Info rotulo="Recebido">{moeda(pedido.totalRecebido)} de {moeda(pedido.total)}</Info>
            {pedido.parcelas.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left">Parcela</th>
                      <th className="text-left">Método</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.parcelas.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="py-1.5">{p.numero}</td>
                        <td>{nomeForma(p.metodoRecebido || p.metodoPrevisto)}</td>
                        <td className="text-center">{data(p.vencimento)}</td>
                        <td className="text-center">
                          <Badge variant={p.status === "RECEBIDA" ? "success" : p.status === "CANCELADA" ? "default" : "warning"}>
                            {p.status === "RECEBIDA" ? `Recebida ${data(p.recebidaEm)}` : p.status === "CANCELADA" ? "Cancelada" : "Em aberto"}
                          </Badge>
                        </td>
                        <td className="text-right">{moeda(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>

          <Bloco titulo={`Resumo do ${tituloTipo}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left">Produto</th>
                    {pedido.tipo === "PEDIDO" && <th>Conferência</th>}
                    <th>SKU</th>
                    <th>Emb.</th>
                    <th>Qtd</th>
                    <th className="text-right">Preço</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.itens.map((i) => (
                    <tr key={i.id} className="border-b border-border/60">
                      <td className="py-2">
                        <div className="flex items-center gap-3">
                          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                            {i.imagemUrl && <img src={i.imagemUrl} alt="" className="h-full w-full object-cover" />}
                          </span>
                          <span>
                            <span className="block font-medium">{i.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {i.categoria} · Embalagens: {i.quantidade} x {i.unidadesPacote} un. = {i.quantidade * i.unidadesPacote} un.
                            </span>
                          </span>
                        </div>
                      </td>
                      {pedido.tipo === "PEDIDO" && (
                        <td className="text-center text-xs">
                          {i.conferido ? (
                            <span className="text-emerald-700">
                              ✓ {i.conferidoPor || "Conferido"}
                              {i.conferidoEm && <span className="block text-muted-foreground">{carimbo(i.conferidoEm)}</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Pendente</span>
                          )}
                        </td>
                      )}
                      <td className="text-center">{i.sku || "-"}</td>
                      <td className="text-center">{i.quantidade}</td>
                      <td className="text-center">{i.quantidade * i.unidadesPacote}</td>
                      <td className="text-right">{moedaUnitaria(i.precoUnitario)}</td>
                      <td className="text-right">{moeda(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
              <Info rotulo="Subtotal">{moeda(pedido.subtotal)}</Info>
              {pedido.desconto > 0 && <Info rotulo="Desconto">- {moeda(pedido.desconto)}</Info>}
              {pedido.creditoUsado > 0 && <Info rotulo="Crédito">- {moeda(pedido.creditoUsado)}</Info>}
              <Info rotulo="Frete">{moeda(pedido.frete)}</Info>
              {pedido.freteAdicional > 0 && <Info rotulo="Custo adicional">{moeda(pedido.freteAdicional)}</Info>}
              {pedido.taxas > 0 && <Info rotulo="Taxas">{moeda(pedido.taxas)}</Info>}
              <p className="border-t border-border pt-1 text-base font-bold">Total: {moeda(pedido.total)}</p>
            </div>
            {pedido.observacoes && <p className="mt-2 text-sm">Observações: {pedido.observacoes}</p>}
          </Bloco>

          {pedido.historico?.length > 0 && (
            <Bloco titulo="Histórico">
              {pedido.historico.map((h, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {dataHora(h.em)} · {h.por} · {h.tipo === "FORMA_PAGAMENTO" ? `Forma de pagamento: ${nomeForma(h.de)} → ${nomeForma(h.para)}` : h.tipo.replaceAll("_", " ").toLowerCase()}
                  {h.totalNovo != null && h.totalAnterior !== h.totalNovo ? ` (total ${moeda(h.totalAnterior)} → ${moeda(h.totalNovo)})` : ""}
                  {h.motivo ? ` — ${h.motivo}` : ""}
                </p>
              ))}
            </Bloco>
          )}
        </div>
      )}
    </Dialog>
  );
}
