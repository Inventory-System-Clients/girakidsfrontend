import { cx } from "../ui";
import { carimbo, data, moeda } from "../../utils/format";
import { COR_STATUS, EXPEDICAO, FINANCEIRO, FORMAS_PAGAMENTO, METODOS_ENVIO, VENDAS } from "../../utils/status";

const Pilula = ({ cor, children }) => <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm", cor)}>{children}</span>;

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
    {pedido.metodoEnvio === "TRANSPORTADORA" ? (
      <span className="max-w-32 truncate text-[11px] font-medium text-sky-700" title={pedido.transportadoraNome || ""}>
        {pedido.transportadoraNome || "a definir"}
      </span>
    ) : (
      ["PAC", "SEDEX"].includes(pedido.metodoEnvio) && (
        <span className="text-[11px] text-muted-foreground">{pedido.prazoEntregaDias ? `${pedido.prazoEntregaDias} dias úteis` : "-"}</span>
      )
    )}
  </span>
);

export const CelulaFinanceiro = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center">
      <Pilula cor={COR_STATUS.financeiro[pedido.statusFinanceiroEfetivo]}>{FINANCEIRO[pedido.statusFinanceiroEfetivo]}</Pilula>
      {pedido.statusFinanceiro === "PAGO" && <Carimbo quem={pedido.pagoPor} quando={pedido.pagoEm} />}
      {pedido.pendenciaStatus === "ABERTA" && <span className="text-[11px] font-semibold text-amber-800">em aberto {moeda(pedido.pendenciaValor)}</span>}
    </span>
  );

export const CelulaVendas = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Pilula cor={COR_STATUS.vendas[pedido.statusVendas]}>{VENDAS[pedido.statusVendas]}</Pilula>
      {pedido.statusVendas === "LIBERADO" && <Carimbo quem={pedido.liberadoPor} quando={pedido.liberadoEm} />}
    </span>
  );

export const CelulaExpedicao = ({ pedido }) =>
  pedido.tipo === "ORCAMENTO" || pedido.statusVendas !== "LIBERADO" ? (
    "-"
  ) : (
    <span className="inline-flex flex-col items-center">
      {pedido.statusExpedicao === "NAO_INICIADO" ? (
        "-"
      ) : pedido.statusExpedicao === "MONTAGEM" && pedido.montagemConcluidaEm ? (
        <Pilula cor={COR_STATUS.expedicao.MONTADO}>Montagem concluída</Pilula>
      ) : (
        <Pilula cor={COR_STATUS.expedicao[pedido.statusExpedicao]}>{EXPEDICAO[pedido.statusExpedicao]}</Pilula>
      )}
      {pedido.statusExpedicao === "EXPEDIDO" && <Carimbo quem={pedido.expedidoPor} quando={pedido.expedidoEm} />}
    </span>
  );

export const CelulaData = ({ pedido }) => data(pedido.createdAt);
