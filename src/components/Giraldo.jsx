import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mic, Minus, Package, Plus, Send, ShoppingCart, Square, X } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { cx } from "./ui";
import { BotaoWhatsapp } from "./Whatsapp";
import { moeda, moedaUnitaria } from "../utils/format";
import { lerCheckout, pedirAoCheckout } from "../utils/giraldoPonte";

const CHAVE_CONVERSA = "girakids_giraldo_conversa";
const CHAVE_ESTADO = "girakids_giraldo_estado";
const CHAVE_ABERTO = "girakids_giraldo_aberto";

const ler = (chave, padrao) => {
  try {
    return JSON.parse(sessionStorage.getItem(chave)) ?? padrao;
  } catch {
    return padrao;
  }
};
const gravar = (chave, valor) => {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: a conversa vale só nesta tela
  }
};

const BALAO_VISIVEL_MS = 10000;
const BALAO_INTERVALO_MS = 45000;

const BOAS_VINDAS = {
  role: "assistant",
  content: "Olá! Eu sou o Giraldo 😊 Me conta o que você quer comprar — pode digitar ou tocar no microfone e falar.",
  sugestoes: ["Bolinhas pula-pula", "Brinquedos encapsulados", "Pelúcias", "Ver meu carrinho"],
};

// Escolhas que o Giraldo já fez com o cliente (o checkout aproveita).
// eslint-disable-next-line react-refresh/only-export-components
export const lerEscolhasGiraldo = () => ler(CHAVE_ESTADO, {});

function CartaoProduto({ produto, onAdicionar }) {
  const [qtd, setQtd] = useState(1);
  return (
    <div className="w-44 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="aspect-square bg-muted">
        {produto.imagemUrl ? (
          <img src={produto.imagemUrl} alt={produto.nome} className={cx("h-full w-full object-cover", !produto.disponivel && !produto.temImagemEsgotado && "grayscale")} />
        ) : (
          <Package className="m-auto mt-12 h-10 w-10 text-slate-300" />
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="line-clamp-2 text-xs font-semibold">{produto.nome}</p>
        <p className="text-xs">
          <span className="font-bold text-primary">{moedaUnitaria(produto.precoVenda)}</span>
          <span className="text-muted-foreground">/un</span>
        </p>
        {produto.unidadesPacote > 1 && <p className="text-[10px] text-muted-foreground">Embalagem com {produto.unidadesPacote} un. · {moeda(produto.precoVenda * produto.unidadesPacote)}</p>}
        {produto.disponivel ? (
          <div className="flex items-center gap-1 pt-1">
            <div className="flex items-center rounded-full border border-border">
              <button type="button" className="p-1" onClick={() => setQtd(Math.max(1, qtd - 1))} aria-label="Menos">
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-6 text-center text-xs font-semibold">{qtd}</span>
              <button type="button" className="p-1" onClick={() => setQtd(qtd + 1)} aria-label="Mais">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button type="button" onClick={() => onAdicionar(produto, qtd)} className="flex-1 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-white">
              Adicionar
            </button>
          </div>
        ) : (
          <p className="pt-1 text-[11px] font-semibold text-amber-700">Sem estoque</p>
        )}
      </div>
    </div>
  );
}

function Mensagem({ m, onSugestao, onAdicionar, onLogin, whatsapp }) {
  const minha = m.role === "user";
  return (
    <div className={cx("flex gap-2", minha && "justify-end")}>
      {!minha && <img src="/giraldo-rosto.png" alt="" className="mt-1 h-8 w-8 shrink-0 rounded-full" />}
      <div className={cx("max-w-[85%] space-y-2", minha && "items-end")}>
        <div className={cx("rounded-2xl px-3 py-2 text-sm whitespace-pre-line", minha ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-white shadow-sm")}>{m.content}</div>
        {m.produtos?.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {m.produtos.map((p) => (
              <CartaoProduto key={p.id} produto={p} onAdicionar={onAdicionar} />
            ))}
          </div>
        )}
        {m.whatsapp && (
          <BotaoWhatsapp telefone={whatsapp} className="w-full" texto="Olá! Estou comprando pelo site da Gira Kids com o Giraldo e gostaria de combinar a entrega por transportadora.">
            Falar com o comercial
          </BotaoWhatsapp>
        )}
        {m.login && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onLogin("/login")} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
              Entrar
            </button>
            <button type="button" onClick={() => onLogin("/registrar")} className="flex-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary">
              Criar conta
            </button>
          </div>
        )}
        {m.sugestoes?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.sugestoes.map((s) => (
              <button key={s} type="button" onClick={() => onSugestao(s)} className="rounded-full border border-primary/40 bg-white px-3 py-1 text-xs font-medium text-primary hover:bg-primary-soft">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Gravação de voz → texto (transcrição no backend).
function useGravador(onTexto, onErro) {
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef(null);
  const partes = useRef([]);
  const relogio = useRef(null);

  const parar = useCallback(() => {
    clearInterval(relogio.current);
    if (gravador.current?.state === "recording") gravador.current.stop();
    setGravando(false);
  }, []);

  const iniciar = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onErro("Seu navegador não permite gravar áudio. Digite a mensagem, por favor.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
      const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      partes.current = [];
      rec.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 2000) return;
        setTranscrevendo(true);
        try {
          const dados = new FormData();
          dados.append("audio", blob, `voz.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
          const { data } = await api.post("/assistente/transcrever", dados, { headers: { "Content-Type": "multipart/form-data" } });
          if (data.texto) onTexto(data.texto);
          else onErro("Não entendi o áudio. Pode tentar de novo?");
        } catch (error) {
          onErro(mensagemErro(error, "Não consegui ouvir agora. Pode digitar?"));
        } finally {
          setTranscrevendo(false);
        }
      };
      gravador.current = rec;
      rec.start();
      setGravando(true);
      setSegundos(0);
      relogio.current = setInterval(() => {
        setSegundos((s) => {
          if (s >= 59) parar();
          return s + 1;
        });
      }, 1000);
    } catch {
      onErro("Preciso de permissão para usar o microfone. Você também pode digitar.");
    }
  };

  useEffect(() => () => clearInterval(relogio.current), []);
  return { gravando, transcrevendo, segundos, iniciar, parar };
}

export default function Giraldo() {
  const { usuario } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const local = useLocation();
  const [aberto, setAberto] = useState(() => ler(CHAVE_ABERTO, false));
  const [mensagens, setMensagens] = useState(() => ler(CHAVE_CONVERSA, [BOAS_VINDAS]));
  const [estado, setEstado] = useState(() => ler(CHAVE_ESTADO, {}));
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  // Balão "Posso te ajudar?": aparece ao carregar, some sozinho e volta de
  // tempos em tempos. Fechado no X, fica fechado até recarregar a página
  // (estado só em memória).
  const [balao, setBalao] = useState(false);
  const noCarrinho = local.pathname === "/checkout";
  const textoBalao = noCarrinho && cart.itens.length ? "Quer ajuda para finalizar? Eu escolho a entrega e o pagamento com você 😊" : "Posso te ajudar com a sua compra? 😊";
  // Finalização pedida pelo Giraldo: ao cair na tela do pedido, ele avisa.
  const finalizandoRef = useRef(false);
  // Mudança de tela feita pelo próprio Giraldo (ele já explicou na resposta).
  const navegouRef = useRef(false);
  const [balaoDispensado, setBalaoDispensado] = useState(false);
  const jaApareceu = useRef(false);
  const [whatsapp, setWhatsapp] = useState("5511942058445");
  const fim = useRef(null);
  const carrinhoRef = useRef(cart.itens);
  carrinhoRef.current = cart.itens;

  useEffect(() => gravar(CHAVE_CONVERSA, mensagens.slice(-40)), [mensagens]);
  useEffect(() => gravar(CHAVE_ESTADO, estado), [estado]);
  useEffect(() => gravar(CHAVE_ABERTO, aberto), [aberto]);
  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, aberto, pensando]);
  useEffect(() => {
    if (aberto || balaoDispensado) {
      setBalao(false);
      return undefined;
    }
    let mostrar;
    let esconder;
    const ciclo = (espera) => {
      mostrar = setTimeout(() => {
        jaApareceu.current = true;
        setBalao(true);
        esconder = setTimeout(() => {
          setBalao(false);
          ciclo(BALAO_INTERVALO_MS);
        }, BALAO_VISIVEL_MS);
      }, espera);
    };
    // Na primeira vez aparece logo; depois de fechar o chat, espera o intervalo.
    ciclo(jaApareceu.current ? BALAO_INTERVALO_MS : 2500);
    return () => {
      clearTimeout(mostrar);
      clearTimeout(esconder);
    };
  }, [aberto, balaoDispensado]);

  const adicionarMensagem = (m) => setMensagens((lista) => [...lista, m]);

  // Ações que o Giraldo manda: carrinho, escolhas na tela do carrinho
  // (aplicadas ao vivo pela ponte com o checkout) e navegação.
  const executarAcoes = async (acoes = [], estadoBase) => {
    let novoEstado = { ...estadoBase };
    const irPara = (rota) => {
      if (window.location.pathname + window.location.search === rota) return;
      navegouRef.current = true;
      navigate(rota);
    };
    for (const a of acoes) {
      if (a.tipo === "adicionar_carrinho" && a.produto) {
        const atual = carrinhoRef.current.find((i) => i.produto.id === a.produto.id)?.quantidade || 0;
        cart.definirQuantidade(a.produto, atual + (a.quantidade || 1));
      } else if (a.tipo === "definir_quantidade" && a.produto) {
        cart.definirQuantidade(a.produto, a.quantidade || 1);
      } else if (a.tipo === "remover_carrinho" && a.produto) {
        cart.definirQuantidade(a.produto, 0);
      } else if (a.tipo === "definir_entrega") {
        novoEstado = { ...novoEstado, metodoEnvio: a.metodoEnvio };
        pedirAoCheckout({ tipo: "entrega", metodoEnvio: a.metodoEnvio });
      } else if (a.tipo === "definir_pagamento") {
        novoEstado = { ...novoEstado, formaPagamento: a.formaPagamento };
        pedirAoCheckout({ tipo: "pagamento", formaPagamento: a.formaPagamento });
      } else if (a.tipo === "definir_cep") {
        novoEstado = { ...novoEstado, cep: a.cep };
        pedirAoCheckout({ tipo: "cep", cep: a.cep });
      } else if (a.tipo === "definir_parcelas") {
        pedirAoCheckout({ tipo: "parcelas", parcelas: a.parcelas });
      } else if (a.tipo === "definir_observacao") {
        pedirAoCheckout({ tipo: "observacao", texto: a.texto });
      } else if (a.tipo === "preencher_dados") {
        pedirAoCheckout({ tipo: "dados", campo: a.campo, valor: a.valor });
      } else if (a.tipo === "abrir_carrinho" || a.tipo === "ir_checkout") {
        irPara("/checkout");
      } else if (a.tipo === "navegar" && a.rota) {
        irPara(a.rota);
      } else if (a.tipo === "mostrar_catalogo") {
        irPara(a.categoria ? `/?categoria=${encodeURIComponent(a.categoria)}` : `/?busca=${encodeURIComponent(a.busca || "")}`);
      } else if (a.tipo === "abrir_produto" && a.produtoId) {
        irPara(`/produto/${a.produtoId}`);
      } else if (a.tipo === "finalizar_pedido") {
        if (!usuario) {
          adicionarMensagem({ role: "assistant", content: "Para finalizar, entre na sua conta ou crie uma rapidinho. Seu carrinho fica guardado 😉", login: true });
          continue;
        }
        // Finaliza pela tela do carrinho (mesmas conferências do botão).
        finalizandoRef.current = true;
        irPara("/checkout");
        pedirAoCheckout({ tipo: "finalizar" });
      }
    }
    setEstado(novoEstado);
  };

  // Mudou de tela: no carrinho o Giraldo se oferece para ajudar; depois de
  // finalizar, avisa que o pedido foi criado.
  const paginaAnterior = useRef(local.pathname);
  useEffect(() => {
    const anterior = paginaAnterior.current;
    paginaAnterior.current = local.pathname;
    if (anterior === local.pathname) return;
    if (local.pathname.startsWith("/pagamento/") && finalizandoRef.current) {
      finalizandoRef.current = false;
      setEstado({});
      setMensagens((lista) => [...lista, { role: "assistant", content: "Pronto! 🎉 Seu pedido foi criado. Aqui embaixo estão os dados para pagamento. Posso ajudar em mais alguma coisa?", sugestoes: ["Quero comprar mais", "Ver meus pedidos"] }]);
      return;
    }
    if (navegouRef.current) {
      navegouRef.current = false;
      return;
    }
    if (local.pathname === "/checkout" && carrinhoRef.current.length) {
      if (!aberto) {
        if (!balaoDispensado) setBalao(true);
        return;
      }
      setMensagens((lista) => {
        const ultima = lista[lista.length - 1];
        if (ultima?.role === "assistant" && ultima.noCarrinho) return lista;
        const tela = lerCheckout();
        const sugestoes = !tela?.metodoEnvio ? ["Retirar na loja", "Correios (PAC/SEDEX)", "Transportadora"] : !tela?.formaPagamento ? ["PIX", "Cartão de crédito", "Combinar com o comercial"] : ["Pode finalizar", "Mudar a entrega"];
        return [...lista, { role: "assistant", content: "Estamos no seu carrinho 🛒 Eu posso escolher a entrega, o pagamento e preencher os dados com você. Como você quer receber?", sugestoes, noCarrinho: true }];
      });
    }
  }, [local.pathname, aberto, balaoDispensado]);

  const enviar = async (conteudo) => {
    const mensagem = String(conteudo ?? texto).trim();
    if (!mensagem || pensando) return;
    setTexto("");
    const historico = [...mensagens, { role: "user", content: mensagem }];
    setMensagens(historico);
    setPensando(true);
    try {
      const { data } = await api.post("/assistente/mensagem", {
        mensagens: historico.map(({ role, content }) => ({ role, content })),
        carrinho: carrinhoRef.current.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
        estado,
        pagina: window.location.pathname + window.location.search,
        checkout: lerCheckout(),
      });
      if (data.whatsappComercial) setWhatsapp(data.whatsappComercial);
      adicionarMensagem({
        role: "assistant",
        content: data.mensagem,
        produtos: data.produtos,
        sugestoes: data.sugestoes,
        whatsapp: data.acoes?.some((a) => a.tipo === "whatsapp_comercial"),
        login: data.acoes?.some((a) => a.tipo === "pedir_login") && !usuario,
      });
      await executarAcoes(data.acoes, estado);
    } catch (error) {
      adicionarMensagem({ role: "assistant", content: `Ops! ${mensagemErro(error, "Não consegui responder agora.")}`, sugestoes: ["Tentar de novo"] });
    } finally {
      setPensando(false);
    }
  };

  const gravador = useGravador(
    (t) => enviar(t),
    (erro) => adicionarMensagem({ role: "assistant", content: erro }),
  );

  const adicionarManual = (produto, qtd) => {
    const atual = carrinhoRef.current.find((i) => i.produto.id === produto.id)?.quantidade || 0;
    cart.definirQuantidade(produto, atual + qtd);
    enviar(`Adicionei ${qtd} ${qtd === 1 ? "embalagem" : "embalagens"} de ${produto.nome} ao carrinho.`);
  };

  const encerrar = () => {
    setMensagens([BOAS_VINDAS]);
    setEstado({});
    setAberto(false);
  };

  const irPara = (rota) => {
    navigate(rota, { state: { de: window.location.pathname } });
  };

  const quantidadeCarrinho = cart.itens.length;

  return createPortal(
    <div className="no-print">
      {!aberto && (
        <div className="fixed right-4 bottom-4 z-[45] flex flex-col items-end gap-2">
          {balao && (
            <div className="relative max-w-56 rounded-2xl rounded-br-sm border border-blue-200 bg-white px-3 py-2 text-sm shadow-lg">
              <button type="button" className="absolute -top-2 -right-2 rounded-full bg-white p-0.5 shadow" onClick={() => setBalaoDispensado(true)} aria-label="Fechar aviso">
                <X className="h-3 w-3" />
              </button>
              <strong className="text-blue-700">Olá! Eu sou o Giraldo.</strong> {textoBalao}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setAberto(true);
              setBalao(false);
            }}
            className="group relative h-16 w-16 rounded-full shadow-xl ring-4 ring-blue-600 transition hover:scale-105 sm:h-[72px] sm:w-[72px]"
            aria-label="Abrir o assistente Giraldo"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
            <img src="/giraldo-avatar.png" alt="Giraldo" className="relative h-full w-full rounded-full bg-amber-300 object-cover" />
            {quantidadeCarrinho > 0 && <span className="absolute -top-1 -left-1 rounded-full bg-primary px-1.5 text-xs font-bold text-white">{quantidadeCarrinho}</span>}
          </button>
        </div>
      )}

      {aberto && (
        <section className="fixed inset-x-0 bottom-0 z-[55] flex h-[100dvh] flex-col bg-slate-50 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[min(640px,calc(100dvh-2rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-border" aria-label="Assistente Giraldo">
          <header className="flex items-center gap-3 bg-blue-700 px-4 py-3 text-white sm:rounded-t-2xl">
            <img src="/giraldo-avatar.png" alt="" className="h-10 w-10 rounded-full bg-amber-300 ring-2 ring-white" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Giraldo</p>
              <p className="text-xs text-blue-100">Assistente de compras da Gira Kids</p>
            </div>
            <button type="button" onClick={() => navigate("/checkout")} className="relative rounded-full p-2 hover:bg-white/15" aria-label="Ver carrinho" title="Ver carrinho">
              <ShoppingCart className="h-5 w-5" />
              {quantidadeCarrinho > 0 && <span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary px-1 text-[10px] font-bold">{quantidadeCarrinho}</span>}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-full p-2 hover:bg-white/15" aria-label="Recolher" title="Recolher">
              <Minus className="h-5 w-5" />
            </button>
            <button type="button" onClick={encerrar} className="rounded-full p-2 hover:bg-white/15" aria-label="Encerrar conversa" title="Encerrar conversa">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {mensagens.map((m, i) => (
              <Mensagem
                key={i}
                m={i === mensagens.length - 1 ? m : { ...m, sugestoes: [], login: false }}
                onSugestao={(s) => (s === "Ver meu carrinho" ? navigate("/checkout") : s === "Ver meus pedidos" && usuario ? navigate("/meus-pedidos") : enviar(s))}
                onAdicionar={adicionarManual}
                onLogin={irPara}
                whatsapp={whatsapp}
              />
            ))}
            {pensando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src="/giraldo-rosto.png" alt="" className="h-8 w-8 rounded-full" />
                <span className="flex gap-1 rounded-2xl bg-white px-3 py-3 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:240ms]" />
                </span>
              </div>
            )}
            <div ref={fim} />
          </div>

          <footer className="border-t border-border bg-white p-3 sm:rounded-b-2xl">
            {gravador.gravando ? (
              <button type="button" onClick={gravador.parar} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-semibold text-white">
                <Square className="h-4 w-4 fill-white" /> Gravando 0:{String(gravador.segundos).padStart(2, "0")} — toque para enviar
              </button>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar();
                }}
              >
                <button
                  type="button"
                  onClick={gravador.iniciar}
                  disabled={pensando || gravador.transcrevendo}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white disabled:opacity-50"
                  aria-label="Falar"
                  title="Falar"
                >
                  {gravador.transcrevendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                </button>
                <textarea
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  placeholder={gravador.transcrevendo ? "Transcrevendo sua voz..." : "Digite o que você quer comprar..."}
                  className="input max-h-28 min-h-11 flex-1 resize-none py-2.5"
                />
                <button type="submit" disabled={!texto.trim() || pensando} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40" aria-label="Enviar">
                  <Send className="h-5 w-5" />
                </button>
              </form>
            )}
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {noCarrinho ? "O Giraldo preenche a tela do carrinho para você — confira antes de finalizar." : "O Giraldo usa IA e pode errar — confira o carrinho antes de finalizar."}
            </p>
          </footer>
        </section>
      )}
    </div>,
    document.body,
  );
}
