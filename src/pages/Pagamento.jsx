import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock, CreditCard, FileDown, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Spinner, useToast } from "../components/ui";
import { moeda } from "../utils/format";
import { FORMAS_PAGAMENTO, nomeForma } from "../utils/status";
import { gerarPdfPedido } from "../utils/pdf";
import LinkRedeDialog, { aceitaLinkRede, linkRedeVencido } from "../components/pedido/LinkRedeDialog";
import { BotaoWhatsapp, useWhatsappComercial } from "../components/Whatsapp";

// Tela pós-checkout: mostra o pedido salvo e, se o pagamento for online,
// o QR Code/link do banco configurado e atualiza o status sozinha.
export default function Pagamento() {
  const { id } = useParams();
  const { interno, showroom, pode } = useAuth();
  const toast = useToast();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [qrImagem, setQrImagem] = useState("");
  const [gerando, setGerando] = useState(false);
  const [linkRede, setLinkRede] = useState(false);
  const whatsappComercial = useWhatsappComercial();
  const online = pedido && ["PIX_ONLINE", "CREDITO_ONLINE", "DEBITO_ONLINE"].includes(pedido.formaPagamento);
  // Cobrança aberta numa maquininha (SumUp/Stone/Point).
  const naMaquininha = pedido && pedido.statusFinanceiro !== "PAGO" && /^(point|reader|stone):/.test(pedido.pagamentoReferencia || "");

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
    if (!(online || naMaquininha) || pedido?.statusFinanceiro === "PAGO" || !pedido?.pagamentoReferencia) return undefined;
    const t = setInterval(consultar, naMaquininha ? 4000 : 8000);
    return () => clearInterval(t);
  }, [online, naMaquininha, pedido?.statusFinanceiro, pedido?.pagamentoReferencia, consultar]);

  // Crédito link: o comercial gera o link na Rede; enquanto ele não chega (ou
  // até o pagamento ser confirmado) a tela se atualiza sozinha.
  const comLinkRede = pedido && !online && aceitaLinkRede(pedido) && pedido.statusVendas !== "CANCELADO";
  const linkRedeAtivo = comLinkRede && pedido.pagamentoLink && !linkRedeVencido(pedido);
  useEffect(() => {
    if (!comLinkRede || pedido?.statusFinanceiro === "PAGO") return undefined;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api.get(`/pedidos/${id}`).then(({ data }) => setPedido(data)).catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, [comLinkRede, pedido?.statusFinanceiro, id]);

  const cancelarMaquininha = async () => {
    try {
      const { data } = await api.post(`/pagamentos/pedidos/${id}/maquininha/cancelar`);
      setPedido(data);
      toast({ titulo: "Cobrança retirada da maquininha" });
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

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
        {naMaquininha && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <Smartphone className="mx-auto h-10 w-10 animate-pulse text-blue-600" />
            <p className="mt-2 font-semibold text-blue-900">Aguardando o pagamento na maquininha...</p>
            <p className="text-sm text-blue-900">Assim que o cliente pagar, o pedido é confirmado e liberado sozinho.</p>
            {(interno || showroom) && (
              <Button variant="danger-outline" size="sm" className="mt-3" onClick={cancelarMaquininha}>
                Cancelar cobrança na maquininha
              </Button>
            )}
          </div>
        )}
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
        {!pago && linkRedeAtivo && (
          <div className="mt-6 space-y-2">
            <a href={pedido.pagamentoLink} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="success" className="w-full" size="lg">
                <CreditCard className="h-4 w-4" /> Pagar com cartão
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Abre a página segura da Rede (Itaú) em outra aba
              {pedido.pagamentoExpiraEm ? `. O link vale até ${new Date(pedido.pagamentoExpiraEm).toLocaleDateString("pt-BR")}` : ""}.
            </p>
          </div>
        )}
        {!pago && comLinkRede && !linkRedeAtivo && !interno && (
          <p className="mt-6 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">
            {pedido.pagamentoLink
              ? `O link de pagamento venceu. Fale com o comercial no WhatsApp abaixo para receber um novo link do pedido ${pedido.numeroFormatado}.`
              : `Estamos gerando o link de pagamento do pedido ${pedido.numeroFormatado}: o botão "Pagar com cartão" aparece aqui assim que ficar pronto. Se preferir, fale com o comercial no WhatsApp abaixo.`}
          </p>
        )}
        {!pago && comLinkRede && interno && pode("VENDAS", "FINANCEIRO") && (
          <Button variant={linkRedeAtivo ? "outline" : "primary"} className="mt-4 w-full" onClick={() => setLinkRede(true)}>
            <CreditCard className="h-4 w-4" /> {pedido.pagamentoLink ? "Link de pagamento Rede" : "Gerar link na Rede"}
          </Button>
        )}
        {linkRede && <LinkRedeDialog pedido={pedido} onFechar={() => setLinkRede(false)} onFeito={(d) => setPedido(d)} />}
        <p className="mt-6 text-sm text-muted-foreground">
          {pago
            ? "Seu pagamento foi recebido. O pedido segue para montagem e envio."
            : (online || naMaquininha) && pedido.pagamentoReferencia
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
          {!pago && (online || naMaquininha) && pedido.pagamentoReferencia && (
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
          {!showroom && (
            <Link to={interno ? "/historico-pedidos" : "/meus-pedidos"}>
              <Button variant="ghost" className="w-full">
                {interno ? "Ir para o histórico de pedidos" : "Ver meus pedidos"}
              </Button>
            </Link>
          )}
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
