import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock, CreditCard, FileDown, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Spinner, useToast } from "../components/ui";
import { moeda } from "../utils/format";
import { FORMAS_PAGAMENTO, nomeForma } from "../utils/status";
import { gerarPdfPedido } from "../utils/pdf";
import { BotaoWhatsapp, useWhatsappComercial } from "../components/Whatsapp";

// Tela pós-checkout: mostra o pedido salvo e, se o pagamento for online,
// o QR Code/link do banco configurado e atualiza o status sozinha.
export default function Pagamento() {
  const { id } = useParams();
  const { interno } = useAuth();
  const toast = useToast();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [qrImagem, setQrImagem] = useState("");
  const [gerando, setGerando] = useState(false);
  const whatsappComercial = useWhatsappComercial();
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

  // QR Code desenhado no navegador a partir do PIX copia e cola.
  useEffect(() => {
    if (!pedido?.pagamentoQrCode) return;
    QRCode.toDataURL(pedido.pagamentoQrCode, { width: 280, margin: 1 })
      .then(setQrImagem)
      .catch(() => setQrImagem(""));
  }, [pedido?.pagamentoQrCode]);

  const gerarDeNovo = async () => {
    setGerando(true);
    try {
      const { data } = await api.post(`/pagamentos/pedidos/${id}/cobranca`);
      setPedido(data);
      toast({ titulo: "Cobrança gerada", descricao: "Use o novo código para pagar." });
    } catch (error) {
      toast({ titulo: "Não foi possível gerar a cobrança", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setGerando(false);
    }
  };

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
            <p className="mb-2 text-sm font-medium">Pague com o PIX abaixo (QR Code ou copia e cola):</p>
            {qrImagem && <img src={qrImagem} alt="QR Code PIX" className="mx-auto mb-3 h-60 w-60 rounded-lg border border-border bg-white p-2" />}
            <textarea readOnly className="input h-24 font-mono text-xs" value={pedido.pagamentoQrCode} />
            <Button variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(pedido.pagamentoQrCode).then(() => toast({ titulo: "Código copiado" }))}>
              Copiar código
            </Button>
          </div>
        )}
        {!pago && online && pedido.pagamentoLink && (
          <a href={pedido.pagamentoLink} target={pedido.formaPagamento === "PIX_ONLINE" ? "_blank" : "_self"} rel="noreferrer" className="mt-4 block">
            <Button variant={pedido.formaPagamento === "PIX_ONLINE" ? "outline" : "success"} className="w-full" size="lg">
              <CreditCard className="h-4 w-4" /> {pedido.formaPagamento === "PIX_ONLINE" ? "Abrir PIX no banco" : "Pagar com cartão"}
            </Button>
          </a>
        )}
        {!pago && online && !pedido.pagamentoReferencia && pedido.statusVendas !== "CANCELADO" && (
          <div className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Não conseguimos gerar a cobrança agora.
            <Button className="mt-2 w-full" loading={gerando} onClick={gerarDeNovo}>
              Gerar cobrança
            </Button>
          </div>
        )}
        {!pago && pedido.formaPagamento === "CREDITO_LINK" && !interno && (
          <p className="mt-6 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">
            Para pagar no cartão, fale com o comercial no WhatsApp abaixo: enviamos o link de pagamento do pedido {pedido.numeroFormatado}.
          </p>
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
          {!interno && (
            <BotaoWhatsapp
              telefone={whatsappComercial}
              className="py-3"
              texto={`Olá! Acabei de fazer o pedido nº ${pedido.numeroFormatado} (${moeda(pedido.total)}) no site da Gira Kids e gostaria de falar com o comercial.`}
            >
              Falar com o comercial no WhatsApp
            </BotaoWhatsapp>
          )}
          {!pago && online && pedido.pagamentoReferencia && (
            <Button variant="outline" loading={atualizando} onClick={consultar}>
              <RefreshCw className="h-4 w-4" /> Atualizar status
            </Button>
          )}
          {!pago && online && pedido.pagamentoReferencia && pedido.statusVendas !== "CANCELADO" && (
            <Button variant="ghost" loading={gerando} onClick={gerarDeNovo}>
              Gerar um novo {pedido.formaPagamento === "PIX_ONLINE" ? "PIX" : "link de pagamento"}
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
