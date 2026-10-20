import { useEffect, useState } from "react";
import { FileDown, Image as ImageIcon } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, Spinner } from "../ui";
import { carimbo, data, dataHora, mascaraDocumento, moeda, moedaUnitaria, pesoKg } from "../../utils/format";
import { EXPEDICAO, FINANCEIRO, METODOS_ENVIO, VENDAS, nomeForma } from "../../utils/status";
import { gerarPdfPedido } from "../../utils/pdf";

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
              <Info rotulo="Email">{pedido.clienteEmail}</Info>
              <Info rotulo="Telefone">{pedido.clienteTelefone}</Info>
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
                  {pedido.expedidoEm && <p className="text-xs text-muted-foreground">{pedido.expedidoPor} · {carimbo(pedido.expedidoEm)}</p>}
                  {pedido.observacoesExpedicao && <p className="mt-1 text-xs">Obs.: {pedido.observacoesExpedicao}</p>}
                  {pedido.imagemExpedicaoUrl && (
                    <a href={pedido.imagemExpedicaoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <ImageIcon className="h-3 w-3" /> Foto da expedição
                    </a>
                  )}
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
                        <p className="font-medium">{i.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.categoria} · Embalagens: {i.quantidade} x {i.unidadesPacote} un. = {i.quantidade * i.unidadesPacote} un.
                        </p>
                      </td>
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
