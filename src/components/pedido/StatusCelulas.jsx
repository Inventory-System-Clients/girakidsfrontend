import { Badge } from "../ui";
import { carimbo, data, moeda } from "../../utils/format";
import { EXPEDICAO, FINANCEIRO, FORMAS_PAGAMENTO, METODOS_ENVIO, VENDAS } from "../../utils/status";

const Carimbo = ({ quem, quando }) =>
  quando ? (
    <span className="block text-[11px] leading-tight text-muted-foreground">
      {quem}
      <br />
      {carimbo(quando)}
    </span>
  ) : null;

export const CelulaNumero = ({ pedido }) => (
  <span className="font-mono text-xs">
    {pedido.numeroFormatado}
    {pedido.orcamentoOrigemNumero && <span className="block font-sans text-[11px] text-muted-foreground">Do orçamento {String(pedido.orcamentoOrigemNumero).padStart(4, "0")}</span>}
    {pedido.pedidoGeradoNumero && <span className="block font-sans text-[11px] text-emerald-700">Gerou o pedido {pedido.pedidoGeradoNumero}</span>}
  </span>
);

export const CelulaMetodo = ({ pedido }) => {
  const forma = FORMAS_PAGAMENTO[pedido.formaPagamento];
  const Icone = forma?.icone;
  return (
    <span className="inline-flex flex-col items-center">
      <span className="inline-flex items-center gap-1.5">
        {Icone && <Icone className="h-4 w-4 text-muted-foreground" />}
        {forma?.label || pedido.formaPagamento}
      </span>
      {pedido.parcelasCartao && <span className="text-[11px] text-muted-foreground">{pedido.parcelasCartao > 1 ? `${pedido.parcelasCartao}x parcelas` : "À vista"}</span>}
    </span>
  );
};

export const CelulaEnvio = ({ pedido }) => (
  <span className="inline-flex flex-col items-center">
    {METODOS_ENVIO[pedido.metodoEnvio] || "—"}
    {["PAC", "SEDEX", "TRANSPORTADORA"].includes(pedido.metodoEnvio) && (
      <span className="text-[11px] text-muted-foreground">{pedido.prazoEntregaDias ? `${pedido.prazoEntregaDias} dias úteis` : "-"}</span>
    )}
  </span>
);

export const CelulaFinanceiro = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center">
      <span className={pedido.statusFinanceiroEfetivo === "ATRASADO" ? "font-semibold text-red-600" : ""}>{FINANCEIRO[pedido.statusFinanceiroEfetivo]}</span>
      {pedido.statusFinanceiro === "PAGO" && <Carimbo quem={pedido.pagoPor} quando={pedido.pagoEm} />}
      {pedido.pendenciaStatus === "ABERTA" && <span className="text-[11px] text-amber-700">em aberto {moeda(pedido.pendenciaValor)}</span>}
    </span>
  );

export const CelulaVendas = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Badge variant="outline" className="bg-white">
        {VENDAS[pedido.statusVendas]}
      </Badge>
      {pedido.statusVendas === "LIBERADO" && <Carimbo quem={pedido.liberadoPor} quando={pedido.liberadoEm} />}
    </span>
  );

export const CelulaExpedicao = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" || pedido.statusVendas !== "LIBERADO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center">
      {pedido.statusExpedicao === "NAO_INICIADO" ? "-" : EXPEDICAO[pedido.statusExpedicao]}
      {pedido.statusExpedicao === "EXPEDIDO" && <Carimbo quem={pedido.expedidoPor} quando={pedido.expedidoEm} />}
    </span>
  );

export const CelulaData = ({ pedido }) => data(pedido.createdAt);
