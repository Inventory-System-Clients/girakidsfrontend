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

  const conferir = useCallback(async () => {
    setConferindo(true);
    try {
      const { data } = await api.post(`${base}/consultar`);
      if (data.pago) setDados(data);
      return data.pago;
    } catch {
      return false;
    } finally {
      setConferindo(false);
    }
  }, [base]);

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
          onResponse: async (tipo) => {
            if (tipo === "success") {
              setAviso("");
              // A SumUp pode levar alguns segundos para fechar a transação.
              for (let i = 0; i < 5; i += 1) {
                if (await conferir()) return;
                await new Promise((r) => setTimeout(r, 2000));
              }
              setAviso("Pagamento enviado. Estamos aguardando a confirmação do banco — você pode fechar esta página.");
            } else if (tipo === "fail" || tipo === "error") {
              setAviso("O pagamento não foi aprovado. Confira os dados do cartão ou tente outro cartão.");
            }
          },
        });
      })
      .catch(() => ativo && setErro("Não foi possível carregar o formulário de pagamento. Recarregue a página."));
    return () => {
      ativo = false;
      montado.current?.unmount?.();
      montado.current = null;
    };
  }, [dados?.checkoutId, dados?.pago, dados?.cancelado, dados?.total, dados?.parcelas, conferir]);

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
            <Button variant="ghost" className="mt-2 w-full" loading={conferindo} onClick={conferir}>
              Já paguei — conferir pagamento
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
