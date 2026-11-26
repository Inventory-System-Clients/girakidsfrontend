import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, CreditCard, Lock } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { Button, Card, Spinner } from "../components/ui";
import { moeda } from "../utils/format";
import { BotaoWhatsapp, useWhatsappComercial } from "../components/Whatsapp";

// Formulário de cartão da própria SumUp (os dados do cartão vão direto para
// a SumUp, nunca passam pelo nosso servidor).
const SDK_SUMUP = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
let sdkPromessa = null;
const RECUSADO = "O pagamento não foi aprovado pelo banco do cartão. Confira os dados, o limite disponível para o parcelamento ou tente outro cartão.";
const carregarSdk = () => {
  if (window.SumUpCard) return Promise.resolve(window.SumUpCard);
  sdkPromessa ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SUMUP;
    s.async = true;
    s.onload = () => (window.SumUpCard ? resolve(window.SumUpCard) : reject(new Error("SDK")));
    s.onerror = () => {
      sdkPromessa = null;
      reject(new Error("SDK"));
    };
    document.head.appendChild(s);
  });
  return sdkPromessa;
};

// Link de pagamento com cartão parcelado (SumUp): abre sem login e cobra no
// número de parcelas escolhido no pedido (a página hospedada da SumUp só
// cobra à vista).
export default function PagarCartao() {
  const { id, assinatura } = useParams();
  const base = `/publico/pagar-cartao/${id}/${assinatura}`;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const montado = useRef(null);
  const whatsapp = useWhatsappComercial();

  const buscar = useCallback(
    () =>
      api
        .get(base)
        .then(({ data }) => setDados(data))
        .catch((e) => setErro(mensagemErro(e, "Não foi possível abrir o pagamento."))),
    [base],
  );

  useEffect(() => {
    buscar();
  }, [buscar]);

  const carregar = () => {
    setErro("");
    setAviso("");
    setDados(null);
    buscar();
  };

  // Confere na SumUp (pelo nosso servidor). Devolve PAGO, RECUSADO,
  // EXPIRADO ou PENDENTE.
  const conferir = useCallback(async () => {
    setConferindo(true);
    try {
      const { data } = await api.post(`${base}/consultar`);
      if (data.pago) setDados(data);
      return data.pago ? "PAGO" : data.situacao || "PENDENTE";
    } catch {
      return "PENDENTE";
    } finally {
      setConferindo(false);
    }
  }, [base]);

  // Recusado: abre um formulário novo (checkout novo) mantendo o aviso.
  const novaTentativa = useCallback(
    (mensagem) =>
      api
        .get(base)
        .then(({ data }) => {
          setDados(data);
          setAviso(mensagem);
        })
        .catch((e) => setErro(mensagemErro(e, "Não foi possível abrir o pagamento."))),
    [base],
  );

  const conferirManual = async () => {
    const situacao = await conferir();
    if (situacao === "RECUSADO" || situacao === "EXPIRADO") novaTentativa(RECUSADO);
    else if (situacao === "PENDENTE") setAviso("Ainda não recebemos a confirmação deste pagamento. Se você não concluiu o pagamento, preencha o cartão abaixo.");
  };

  // Monta o formulário da SumUp com as parcelas fixas do pedido.
  useEffect(() => {
    if (!dados?.checkoutId || dados.pago || dados.cancelado) return undefined;
    let ativo = true;
    carregarSdk()
      .then((SumUpCard) => {
        if (!ativo) return;
        montado.current?.unmount?.();
        montado.current = SumUpCard.mount({
          id: "sumup-card",
          checkoutId: dados.checkoutId,
          locale: "pt-BR",
          currency: "BRL",
          amount: Number(dados.total).toFixed(2),
          installments: dados.parcelas,
          showSubmitButton: true,
          onResponse: async (tipo, corpo) => {
            if (tipo === "sent") setAviso("");
            if (tipo === "error") setAviso(`Não foi possível processar o cartão${corpo?.message ? ` (${corpo.message})` : ""}. Confira os dados e tente de novo.`);
            if (tipo !== "success" && tipo !== "fail") return;
            // "success" da SumUp só quer dizer que a tentativa foi recebida,
            // não que foi aprovada: o resultado vem da consulta ao checkout.
            setAviso("Conferindo o pagamento com o banco...");
            for (let i = 0; i < 8; i += 1) {
              const situacao = await conferir();
              if (situacao === "PAGO") return;
              if (situacao === "RECUSADO" || situacao === "EXPIRADO" || (tipo === "fail" && i >= 1)) {
                novaTentativa(RECUSADO);
                return;
              }
              await new Promise((r) => setTimeout(r, 2500));
            }
            setAviso("O banco ainda não confirmou o pagamento. Se a compra não aparecer no seu cartão, clique em \"Conferir pagamento\" ou fale com o nosso comercial.");
          },
        });
      })
      .catch(() => ativo && setErro("Não foi possível carregar o formulário de pagamento. Recarregue a página."));
    return () => {
      ativo = false;
      montado.current?.unmount?.();
      montado.current = null;
    };
  }, [dados?.checkoutId, dados?.pago, dados?.cancelado, dados?.total, dados?.parcelas, conferir, novaTentativa]);

  const valorParcela = dados ? Number(dados.total) / dados.parcelas : 0;

  return (
    <div className="toy-pattern-bg min-h-[calc(100dvh-4rem)] px-4 py-10">
      <Card className="mx-auto max-w-lg p-6 sm:p-8">
        {erro ? (
          <div className="text-center">
            <p className="text-red-700">{erro}</p>
            <Button variant="outline" className="mt-4" onClick={carregar}>
              Tentar de novo
            </Button>
          </div>
        ) : !dados ? (
          <Spinner className="mx-auto my-10 h-8 w-8" />
        ) : dados.pago ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-500" />
            <h1 className="mt-3 text-2xl font-extrabold text-emerald-600">Pagamento confirmado!</h1>
            <p className="mt-2 text-muted-foreground">
              Pedido <strong>{dados.numeroFormatado}</strong> · {moeda(dados.total)}. Obrigado{dados.clienteNome ? `, ${dados.clienteNome}` : ""}! Seu pedido segue para montagem e envio.
            </p>
          </div>
        ) : dados.cancelado ? (
          <p className="text-center text-muted-foreground">Este pedido foi cancelado. Fale com o nosso comercial.</p>
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <CreditCard className="h-5 w-5 text-primary" /> Pagamento com cartão de crédito
            </h1>
            <p className="mt-1 text-muted-foreground">
              Olá{dados.clienteNome ? `, ${dados.clienteNome}` : ""}! Pedido <strong>{dados.numeroFormatado}</strong>
            </p>
            <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-extrabold text-emerald-700">
                {dados.parcelas > 1 ? `${dados.parcelas}x de ${moeda(valorParcela)}` : moeda(dados.total)}
              </p>
              {dados.parcelas > 1 && <p className="text-sm text-emerald-900">Total {moeda(dados.total)}</p>}
            </div>
            {aviso && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}
            <div id="sumup-card" className="mt-4 min-h-40" />
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Pagamento processado com segurança pela SumUp.
            </p>
            <Button variant="ghost" className="mt-2 w-full" loading={conferindo} onClick={conferirManual}>
              Conferir pagamento
            </Button>
          </>
        )}
        {!dados?.pago && whatsapp && (
          <BotaoWhatsapp telefone={whatsapp} className="mt-4 w-full py-3" texto={`Olá! Preciso de ajuda para pagar o pedido nº ${dados?.numeroFormatado || ""} da Gira Kids.`}>
            Falar com o comercial no WhatsApp
          </BotaoWhatsapp>
        )}
      </Card>
    </div>
  );
}
