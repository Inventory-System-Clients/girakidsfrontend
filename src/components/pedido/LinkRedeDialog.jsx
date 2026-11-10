/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Check, CheckCircle2, Copy, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Button, Dialog, Field, Input, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { data, hojeISO, moeda } from "../../utils/format";

// Link de pagamento da Rede, gerado pela equipe no portal da Rede: o site
// deixa os dados prontos para copiar, a equipe cria o link lá e cola aqui, e
// o cliente passa a ver o botão "Pagar com cartão" no pedido.
export const PORTAL_REDE = "https://meu.userede.com.br/link-pagamento";
export const FORMAS_LINK_REDE = ["CREDITO_LINK", "LINK_PAGAMENTO"];
const LIMITE_REDE = 15000;

export const aceitaLinkRede = (pedido) =>
  FORMAS_LINK_REDE.includes(pedido?.formaPagamento) ||
  (pedido?.formaPagamento === "MESCLA" && (pedido.composicaoPagamento || []).some((l) => FORMAS_LINK_REDE.includes(l.metodo)));

export const linkRedeVencido = (pedido) => !!pedido?.pagamentoExpiraEm && new Date(pedido.pagamentoExpiraEm) < new Date();

// Valor que ainda falta pagar no cartão (com a taxa das parcelas) e o limite
// de parcelas que o cliente escolheu.
export const dadosLinkRede = (pedido) => {
  if (pedido.formaPagamento === "MESCLA") {
    const linha = (pedido.composicaoPagamento || []).find((l) => FORMAS_LINK_REDE.includes(l.metodo));
    const abertas = (pedido.parcelas || []).filter((p) => p.status === "ABERTA" && FORMAS_LINK_REDE.includes(p.metodoPrevisto));
    const valor = abertas.length ? abertas.reduce((s, p) => s + Number(p.valor), 0) : Number(linha?.valorCobrado ?? linha?.valor ?? 0);
    return { valor: Math.round(valor * 100) / 100, parcelas: Number(linha?.parcelas) || 1 };
  }
  const valor = Math.max(0, Number(pedido.total) - Number(pedido.totalRecebido || 0));
  return { valor: Math.round(valor * 100) / 100, parcelas: Number(pedido.parcelasCartao) || 1 };
};

const somarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const valorRede = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LinhaCopiar({ rotulo, valor, copiar = valor, dica }) {
  const [copiado, setCopiado] = useState(false);
  const toast = useToast();
  const copiarTexto = () =>
    navigator.clipboard
      ?.writeText(String(copiar))
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      })
      .catch(() => toast({ titulo: "Não foi possível copiar", tipo: "erro" }));
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="truncate font-semibold">{valor}</p>
        {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      </div>
      {copiar != null && (
        <Button size="sm" variant={copiado ? "success" : "outline"} onClick={copiarTexto} aria-label={`Copiar ${rotulo}`}>
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      )}
    </div>
  );
}

export default function LinkRedeDialog({ pedido: inicial, onFechar, onFeito, onConfirmarPagamento }) {
  const [pedido, setPedido] = useState(inicial);
  const [link, setLink] = useState("");
  const [trocando, setTrocando] = useState(!inicial.pagamentoLink || linkRedeVencido(inicial));
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const { valor, parcelas } = dadosLinkRede(pedido);
  const vencimento = somarDias(hojeISO(), 2);
  const vencido = linkRedeVencido(pedido);
  const primeiroNome = String(pedido.clienteNome || "").split(" ")[0];

  const salvar = async (novo) => {
    setSalvando(true);
    try {
      const { data: d } = await api.put(`/pedidos/${pedido.id}/link-rede`, { link: novo, vencimento });
      setPedido(d);
      setLink("");
      setTrocando(!novo);
      onFeito?.(d, false);
      toast({ titulo: novo ? "Link salvo: o cliente já vê o botão de pagar" : "Link removido" });
    } catch (e) {
      toast({ titulo: "Não foi possível salvar o link", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const colar = async () => {
    try {
      const texto = (await navigator.clipboard.readText()).trim();
      if (texto) setLink(texto);
    } catch {
      toast({ titulo: "Cole com Ctrl+V no campo", tipo: "erro" });
    }
  };

  const vence = pedido.pagamentoExpiraEm ? data(pedido.pagamentoExpiraEm) : null;
  const mensagem = `Olá, ${primeiroNome}! Segue o link para pagar no cartão o pedido nº ${pedido.numeroFormatado} da Gira Kids (${moeda(valor)}${parcelas > 1 ? `, em até ${parcelas}x` : ""}):\n${pedido.pagamentoLink}\n${vence ? `O link vale até ${vence}. ` : ""}Qualquer dúvida é só chamar!`;

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Link de pagamento Rede · Pedido ${pedido.numeroFormatado}`}
      descricao={`${pedido.clienteNome} · ${moeda(valor)}${parcelas > 1 ? ` em até ${parcelas}x` : " à vista"}`}
      rodape={<Button variant="outline" onClick={onFechar}>Fechar</Button>}
    >
      <div className="space-y-5">
        {trocando ? (
          <>
            <section className="space-y-2">
              <h3 className="font-semibold">1. Crie o link no portal da Rede com estes dados</h3>
              <div className="divide-y divide-border rounded-lg border border-border">
                <LinhaCopiar rotulo="Nome do produto" valor={pedido.clienteNome} />
                <LinhaCopiar rotulo="Valor do link" valor={`R$ ${valorRede(valor)}`} copiar={valorRede(valor)} dica="Já com a taxa das parcelas" />
                <LinhaCopiar rotulo="Prazo de vencimento" valor={`2 dias (${data(vencimento)})`} copiar={null} />
                <LinhaCopiar rotulo="Descrição" valor="Deixe em branco" copiar={null} />
                <LinhaCopiar rotulo="Formas de pagamento" valor="Só Cartão de crédito (desmarque o Pix)" copiar={null} />
                <LinhaCopiar rotulo="Limite de parcelas" valor={`${parcelas}x`} copiar={null} />
              </div>
              {valor > LIMITE_REDE && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  A Rede aceita link de até {moeda(LIMITE_REDE)}. Divida o pagamento (mescla) em mais de um link.
                </p>
              )}
              {valor <= 0 && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Não há valor em aberto no cartão para este pedido.</p>}
              <a href={PORTAL_REDE} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full">
                  <ExternalLink className="h-4 w-4" /> Abrir o portal da Rede (Link de pagamento)
                </Button>
              </a>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">2. Cole aqui o link que a Rede gerou</h3>
              <div className="flex gap-2">
                <Field className="flex-1">
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." inputMode="url" autoComplete="off" />
                </Field>
                <Button variant="outline" onClick={colar}>Colar</Button>
              </div>
              <Button variant="success" className="w-full" loading={salvando} disabled={!link.trim()} onClick={() => salvar(link.trim())}>
                <CheckCircle2 className="h-4 w-4" /> Salvar link no pedido
              </Button>
              {pedido.pagamentoLink && (
                <Button variant="ghost" className="w-full" onClick={() => setTrocando(false)}>
                  Voltar ao link atual
                </Button>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Link salvo. O cliente vê o botão "Pagar com cartão" no pedido.
              </p>
              <p className="break-all font-mono text-xs">{pedido.pagamentoLink}</p>
              {vence && <p className={vencido ? "text-sm font-semibold text-red-700" : "text-sm"}>{vencido ? `Venceu em ${vence}: gere um novo link.` : `Vale até ${vence}.`}</p>}
              <div className="flex flex-wrap gap-2">
                {pedido.clienteTelefone && (
                  <BotaoWhatsapp telefone={pedido.clienteTelefone} texto={mensagem}>
                    Enviar ao cliente no WhatsApp
                  </BotaoWhatsapp>
                )}
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(mensagem).then(() => toast({ titulo: "Mensagem copiada" }))}>
                  <Copy className="h-4 w-4" /> Copiar mensagem
                </Button>
                <a href={pedido.pagamentoLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <CreditCard className="h-4 w-4" /> Abrir link
                  </Button>
                </a>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">3. Quando o cliente pagar</h3>
              <p className="text-sm text-muted-foreground">
                Na Rede, em <b>Link de pagamento → Gerenciar</b>, o link de <b>{pedido.clienteNome}</b> fica com o status <b>Pago</b>. Aí é só confirmar aqui.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={PORTAL_REDE} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4" /> Conferir na Rede
                  </Button>
                </a>
                {pedido.statusFinanceiro !== "PAGO" && onConfirmarPagamento && (
                  <Button variant="success" onClick={() => onConfirmarPagamento(pedido)}>
                    <CheckCircle2 className="h-4 w-4" /> Está pago: confirmar pagamento
                  </Button>
                )}
              </div>
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setTrocando(true)}>
                <RefreshCw className="h-4 w-4" /> Gerar outro link
              </Button>
              <Button variant="ghost" size="sm" className="text-red-700" loading={salvando} onClick={() => salvar(null)}>
                Remover link
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
