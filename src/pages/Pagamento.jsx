import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileDown, RefreshCw } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Spinner, useToast } from "../components/ui";
import { moeda } from "../utils/format";
import { FORMAS_PAGAMENTO, nomeForma } from "../utils/status";
import { gerarPdfPedido } from "../utils/pdf";

// Tela pós-checkout: mostra o pedido salvo e, se o pagamento for online,
// o QR Code/link do banco configurado e atualiza o status sozinha.
export default function Pagamento() {
  const { id } = useParams();
  const { interno } = useAuth();
  const toast = useToast();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const online = pedido && ["PIX_ONLINE", "CREDITO_ONLINE", "DEBITO_ONLINE"].includes(pedido.formaPagamento);

  const consultar = useCallback(async () => {
    setAtualizando(true);
    try {
      const { data } = pedido?.pagamentoReferencia ? await api.post(`/pagamentos/pedidos/${id}/consultar`) : await api.get(`/pedidos/${id}`);
      setPedido(data);
    } catch (error) {
      setErro(mensagemErro(error, "Ocorreu um erro ao buscar o pedido. Tente novamente."));
    } finally {
      setAtualizando(false);
    }
  }, [id, pedido?.pagamentoReferencia]);

  useEffect(() => {
    api.get(`/pedidos/${id}`).then(({ data }) => setPedido(data)).catch((e) => setErro(mensagemErro(e)));
  }, [id]);

  useEffect(() => {
    if (!online || pedido?.statusFinanceiro === "PAGO" || !pedido?.pagamentoReferencia) return undefined;
    const t = setInterval(consultar, 8000);
    return () => clearInterval(t);
  }, [online, pedido?.statusFinanceiro, pedido?.pagamentoReferencia, consultar]);

  if (erro) return <p className="p-10 text-center text-red-600">{erro}</p>;
  if (!pedido) return <Spinner className="mx-auto mt-20 h-8 w-8" />;
  const pago = pedido.statusFinanceiro === "PAGO";

  return (
    <div className="toy-pattern-bg min-h-[calc(100dvh-4rem)] px-4 py-10">
      <Card className="mx-auto max-w-lg p-8 text-center">
        {pago ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /> : <Clock className="mx-auto h-14 w-14 text-primary" />}
        <h1 className="mt-3 text-2xl font-bold">{pago ? "Pagamento confirmado!" : "Seu pedido foi salvo!"}</h1>
        <p className="mt-1 text-muted-foreground">
          Pedido <strong>{pedido.numeroFormatado}</strong> · {moeda(pedido.total)} · {nomeForma(pedido.formaPagamento)}
        </p>
        {!pago && online && pedido.pagamentoQrCode && (
          <div className="mt-6">
            <p className="mb-2 text-sm">Pague com o código abaixo:</p>
            <textarea readOnly className="input h-24 font-mono text-xs" value={pedido.pagamentoQrCode} />
            <Button variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(pedido.pagamentoQrCode).then(() => toast({ titulo: "Código copiado" }))}>
              Copiar código
            </Button>
          </div>
        )}
        {!pago && online && pedido.pagamentoLink && (
          <a href={pedido.pagamentoLink} target="_blank" rel="noreferrer" className="mt-4 block">
            <Button className="w-full">Ir para o pagamento</Button>
          </a>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          {pago
            ? "Seu pagamento foi recebido. O pedido segue para montagem e envio."
            : online && pedido.pagamentoReferencia
              ? "Atualizando automaticamente o status do pedido."
              : FORMAS_PAGAMENTO[pedido.formaPagamento]
                ? "Nosso time entrará em contato para confirmar os dados."
                : ""}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {!pago && online && pedido.pagamentoReferencia && (
            <Button variant="outline" loading={atualizando} onClick={consultar}>
              <RefreshCw className="h-4 w-4" /> Atualizar status
            </Button>
          )}
          <Button variant="outline" onClick={() => gerarPdfPedido(pedido)}>
            <FileDown className="h-4 w-4" /> Baixar Comprovante (PDF)
          </Button>
          <Link to={interno ? "/historico-pedidos" : "/meus-pedidos"}>
            <Button variant="ghost" className="w-full">
              {interno ? "Ir para o histórico de pedidos" : "Ver meus pedidos"}
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="w-full">
              Voltar para o catálogo
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
