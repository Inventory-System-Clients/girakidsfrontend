import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  CalendarClock,
  Copy,
  ImagePlus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  cx,
  useConfirm,
  useToast,
} from "../ui";
import { dataHora } from "../../utils/format";

// Listas pequenas de clientes (até 20) para novidades, promoções e vídeos no
// WhatsApp: o sistema recomenda quem mais faz pedidos, a IA escreve a
// mensagem e o envio sai pela fila (um por vez, com pausa entre eles).
const MAX = 20;

const STATUS = {
  RASCUNHO: { label: "Rascunho", variant: "default" },
  AGENDADA: { label: "Agendada", variant: "info" },
  ENVIANDO: { label: "Enviando", variant: "warning" },
  CONCLUIDA: { label: "Enviada", variant: "success" },
  CANCELADA: { label: "Cancelada", variant: "danger" },
};
const STATUS_ENVIO = {
  FILA: { label: "Na fila", variant: "info" },
  ENVIANDO: { label: "Enviando", variant: "warning" },
  ENVIADO: { label: "Enviada", variant: "success" },
  ERRO: { label: "Erro", variant: "danger" },
  DESCARTADA: { label: "Não enviada", variant: "default" },
};
const PERIODOS = [
  { dias: 30, label: "Últimos 30 dias" },
  { dias: 60, label: "Últimos 60 dias" },
  { dias: 90, label: "Últimos 90 dias" },
  { dias: 180, label: "Últimos 6 meses" },
  { dias: 365, label: "Último ano" },
];
const OBJETIVOS = [
  { id: "NOVIDADE", label: "Produto novo" },
  { id: "PROMOCAO", label: "Promoção / desconto" },
  { id: "REPOSICAO", label: "Voltou ao estoque" },
  { id: "VIDEO", label: "Vídeo do produto" },
  { id: "OUTRO", label: "Outro" },
];
const RODAPE =
  "_Para não receber mais nossas novidades por aqui, responda SAIR._";
const FILTRO_GERAL = {
  tipo: "GERAL",
  categoria: "",
  produtoId: null,
  produtoNome: "",
};

// "Quem mais compra: Pelúcias" / "...: Pelúcia Unicórnio" / "Todos os produtos".
const descreverFiltro = (f) =>
  f?.tipo === "CATEGORIA"
    ? `Categoria ${f.categoria}`
    : f?.tipo === "PRODUTO"
      ? `Produto ${f.produtoNome || ""}`.trim()
      : "Todos os produtos";

const VAZIA = {
  id: null,
  nome: "",
  produtoNome: "",
  detalhes: "",
  texto: "",
  midiaArquivoId: null,
  midiaTipo: null,
  midiaNome: null,
  clientes: [],
  status: "RASCUNHO",
};

const urlArquivo = (id) => `${api.defaults.baseURL}/arquivos/${id}`;

const telefoneBonito = (t) => {
  const d = String(t || "").replace(/^55/, "");
  return d.length >= 10
    ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`
    : t || "-";
};

const Formatado = ({ texto }) =>
  String(texto || "")
    .split(/(\*[^*\n]+\*|_[^_\n]+_)/g)
    .map((parte, i) =>
      /^\*.+\*$/.test(parte) ? (
        <strong key={i}>{parte.slice(1, -1)}</strong>
      ) : /^_.+_$/.test(parte) ? (
        <em key={i}>{parte.slice(1, -1)}</em>
      ) : (
        parte
      ),
    );

// Quadro (JPEG pequeno) da foto ou do vídeo, para a IA "ver" o produto.
const quadroDaMidia = (src, tipo) =>
  new Promise((resolve) => {
    const desenhar = (el, w, h) => {
      try {
        const escala = Math.min(1, 768 / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * escala);
        canvas.height = Math.round(h * escala);
        canvas
          .getContext("2d")
          .drawImage(el, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(null);
      }
    };
    setTimeout(() => resolve(null), 15000);
    if (tipo === "VIDEO") {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.preload = "auto";
      v.onloadeddata = () => {
        v.currentTime = Math.min(1, (v.duration || 2) / 2);
      };
      v.onseeked = () => desenhar(v, v.videoWidth, v.videoHeight);
      v.onerror = () => resolve(null);
      v.src = src;
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => desenhar(img, img.naturalWidth, img.naturalHeight);
      img.onerror = () => resolve(null);
      img.src = src;
    }
  });

export default function ListasWhatsapp({ conectado }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [listas, setListas] = useState(null);
  const [lista, setLista] = useState(null); // em edição
  const [alterada, setAlterada] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [dias, setDias] = useState(90);
  const [semRepetir, setSemRepetir] = useState(true);
  const [sugeridos, setSugeridos] = useState([]); // ids já recomendados (para "outra lista")
  const [objetivo, setObjetivo] = useState("NOVIDADE");
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState([]);
  const [quando, setQuando] = useState("");
  const [previaLocal, setPreviaLocal] = useState(null); // blob da mídia recém-enviada
  const [filtro, setFiltro] = useState(FILTRO_GERAL); // critério da recomendação
  const [categorias, setCategorias] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosAchados, setProdutosAchados] = useState([]);
  const [publicos, setPublicos] = useState(null); // listas nichadas salvas
  const [publicoAtual, setPublicoAtual] = useState(null); // lista salva usada nesta
  const [nomePublico, setNomePublico] = useState(null); // null = campo fechado
  const arquivoRef = useRef(null);

  const carregarListas = useCallback(
    () =>
      api
        .get("/whatsapp/campanhas")
        .then(({ data }) => setListas(data))
        .catch((e) =>
          toast({
            titulo: "Erro ao carregar as listas",
            descricao: mensagemErro(e),
            tipo: "erro",
          }),
        ),
    [toast],
  );

  const carregarPublicos = useCallback(
    () =>
      api
        .get("/whatsapp/publicos")
        .then(({ data }) => setPublicos(data))
        .catch(() => setPublicos([])),
    [],
  );

  useEffect(() => {
    carregarListas();
    carregarPublicos();
    api
      .get("/whatsapp/campanhas/categorias")
      .then(({ data }) => setCategorias(data))
      .catch(() => {});
  }, [carregarListas, carregarPublicos]);

  // Lista enviando: atualiza o andamento sozinha.
  const idAberta = lista?.id;
  const statusAberta = lista?.status;
  useEffect(() => {
    if (!idAberta || !["AGENDADA", "ENVIANDO"].includes(statusAberta))
      return undefined;
    const t = setInterval(() => {
      if (alterada) return;
      api
        .get(`/whatsapp/campanhas/${idAberta}`)
        .then(({ data }) => setLista(data))
        .catch(() => {});
      carregarListas();
    }, 10000);
    return () => clearInterval(t);
  }, [idAberta, statusAberta, alterada, carregarListas]);

  const executar = async (chave, acao, sucesso) => {
    setOcupado(chave);
    try {
      const r = await acao();
      if (sucesso)
        toast(typeof sucesso === "string" ? { titulo: sucesso } : sucesso);
      return r;
    } catch (error) {
      toast({
        titulo: "Não foi possível concluir",
        descricao: mensagemErro(error),
        tipo: "erro",
      });
      return null;
    } finally {
      setOcupado("");
    }
  };

  const editar = (mudanca) => {
    setLista((l) => ({ ...l, ...mudanca }));
    setAlterada(true);
  };

  const abrir = async (id) => {
    if (
      alterada &&
      !(await confirmar({
        titulo: "Descartar alterações?",
        mensagem: "A lista aberta tem alterações não salvas.",
        confirmar: "Descartar",
      }))
    )
      return;
    const data = await executar(
      "abrir",
      async () => (await api.get(`/whatsapp/campanhas/${id}`)).data,
    );
    if (data) {
      setLista(data);
      setAlterada(false);
      setSugeridos(data.clientes.map((c) => c.usuarioId));
      setPreviaLocal(null);
      setQuando("");
      setFiltro(
        data.filtro ? { ...FILTRO_GERAL, ...data.filtro } : FILTRO_GERAL,
      );
      if (data.filtro?.dias) setDias(data.filtro.dias);
      setPublicoAtual(null);
      setNomePublico(null);
    }
  };

  const nova = async () => {
    if (
      alterada &&
      !(await confirmar({
        titulo: "Descartar alterações?",
        mensagem: "A lista aberta tem alterações não salvas.",
        confirmar: "Descartar",
      }))
    )
      return;
    setLista({ ...VAZIA });
    setAlterada(false);
    setSugeridos([]);
    setPreviaLocal(null);
    setQuando("");
    setFiltro(FILTRO_GERAL);
    setPublicoAtual(null);
    setNomePublico(null);
    return true;
  };

  const corpo = () => ({
    nome: lista.nome,
    produtoNome: lista.produtoNome,
    detalhes: lista.detalhes,
    texto: lista.texto,
    midiaArquivoId: lista.midiaArquivoId,
    clientes: lista.clientes.map((c) => ({
      usuarioId: c.usuarioId,
      pedidos: c.pedidos,
    })),
    filtro: filtroValido() ? { ...filtro, dias } : null,
  });

  // Categoria/produto escolhido (o geral sempre vale).
  const filtroValido = () =>
    filtro.tipo === "GERAL" ||
    (filtro.tipo === "CATEGORIA" && Boolean(filtro.categoria)) ||
    (filtro.tipo === "PRODUTO" && Boolean(filtro.produtoId));

  // Salva e devolve a lista salva (com id).
  const salvar = async (silencioso = false) => {
    const data = await executar(
      "salvar",
      async () =>
        (lista.id
          ? await api.put(`/whatsapp/campanhas/${lista.id}`, corpo())
          : await api.post("/whatsapp/campanhas", corpo())
        ).data,
      silencioso ? null : "Lista salva",
    );
    if (data) {
      setLista(data);
      setAlterada(false);
      carregarListas();
    }
    return data;
  };

  // ---- clientes ----
  const recomendar = async (outra) => {
    if (!filtroValido()) {
      toast({
        titulo:
          filtro.tipo === "CATEGORIA"
            ? "Escolha a categoria"
            : "Escolha o produto",
        tipo: "erro",
      });
      return;
    }
    const excluir = outra
      ? [...new Set([...sugeridos, ...lista.clientes.map((c) => c.usuarioId)])]
      : [];
    const data = await executar(
      "recomendar",
      async () =>
        (
          await api.post("/whatsapp/campanhas/recomendar", {
            dias,
            excluir,
            campanhaId: lista.id,
            semRepetirDias: semRepetir ? 7 : 0,
            filtro,
          })
        ).data,
    );
    if (!data) return;
    if (!data.clientes.length) {
      toast({
        titulo: outra
          ? "Não há mais clientes diferentes neste período"
          : filtro.tipo === "GERAL"
            ? "Nenhum cliente com pedidos neste período"
            : `Ninguém comprou ${filtro.tipo === "CATEGORIA" ? "desta categoria" : "este produto"} neste período`,
        descricao:
          "Aumente o período ou desmarque “pular quem recebeu nos últimos 7 dias”.",
        tipo: "erro",
      });
      return;
    }
    // Clientes que já receberam esta lista continuam nela (histórico).
    const enviados = new Set(
      (lista.envios || [])
        .filter((e) => e.status !== "FILA")
        .map((e) => e.usuarioId),
    );
    const fixos = lista.clientes.filter((c) => enviados.has(c.usuarioId));
    editar({
      clientes: [...fixos, ...data.clientes].slice(
        0,
        Math.max(MAX, fixos.length),
      ),
    });
    setSugeridos((s) => [
      ...new Set([...s, ...data.clientes.map((c) => c.usuarioId)]),
    ]);
    toast({
      titulo: `${data.clientes.length} clientes recomendados`,
      descricao: `Quem mais fez pedidos${filtro.tipo === "GERAL" ? "" : ` com ${filtro.tipo === "CATEGORIA" ? `a categoria ${filtro.categoria}` : filtro.produtoNome}`} (${PERIODOS.find((p) => p.dias === dias)?.label.toLowerCase() || `${dias} dias`}).`,
    });
  };

  const mudarTipoFiltro = (tipo) => {
    setFiltro({ ...FILTRO_GERAL, tipo });
    setProdutosAchados([]);
    setBuscaProduto("");
    setAlterada(true);
  };

  const buscarProduto = async (e) => {
    e?.preventDefault();
    if (buscaProduto.trim().length < 2) return;
    const data = await executar(
      "produto",
      async () =>
        (
          await api.get("/whatsapp/campanhas/produtos", {
            params: { q: buscaProduto.trim() },
          })
        ).data,
    );
    if (data) {
      setProdutosAchados(data);
      if (!data.length)
        toast({ titulo: "Nenhum produto encontrado", tipo: "erro" });
    }
  };

  const escolherProduto = (p) => {
    setFiltro({
      ...FILTRO_GERAL,
      tipo: "PRODUTO",
      produtoId: p.id,
      produtoNome: p.nome,
    });
    setProdutosAchados([]);
    setBuscaProduto("");
    setAlterada(true);
    // Ajuda a IA: o produto da recomendação vira o produto da mensagem.
    if (!lista.produtoNome) setLista((l) => ({ ...l, produtoNome: p.nome }));
  };

  // ---- listas nichadas salvas ----
  const salvarPublico = async (atualizar) => {
    if (!lista.clientes.length) {
      toast({
        titulo: "Coloque clientes na lista antes de salvar",
        tipo: "erro",
      });
      return;
    }
    if (!filtroValido()) {
      toast({ titulo: "Escolha a categoria ou o produto", tipo: "erro" });
      return;
    }
    const corpoPublico = {
      nome: atualizar
        ? publicos.find((p) => p.id === publicoAtual)?.nome
        : nomePublico,
      filtro: { ...filtro, dias },
      clientes: lista.clientes.map((c) => ({
        usuarioId: c.usuarioId,
        pedidos: c.pedidos,
        itens: c.itens,
      })),
    };
    const data = await executar(
      "publico",
      async () =>
        (atualizar
          ? await api.put(`/whatsapp/publicos/${publicoAtual}`, corpoPublico)
          : await api.post("/whatsapp/publicos", corpoPublico)
        ).data,
      atualizar ? "Lista salva atualizada" : "Lista nichada salva",
    );
    if (data) {
      setPublicoAtual(data.id);
      setNomePublico(null);
      carregarPublicos();
    }
  };

  // Coloca os clientes da lista salva na lista aberta (ou numa nova).
  const usarPublico = async (p) => {
    if (!lista && !(await nova())) return;
    if (lista && lista.status === "CANCELADA") {
      toast({
        titulo: "Abra uma lista que não esteja cancelada",
        tipo: "erro",
      });
      return;
    }
    const enviados = new Set(
      (lista?.envios || [])
        .filter((e) => e.status !== "FILA")
        .map((e) => e.usuarioId),
    );
    const fixos = (lista?.clientes || []).filter((c) =>
      enviados.has(c.usuarioId),
    );
    const ids = new Set(fixos.map((c) => c.usuarioId));
    const clientes = [
      ...fixos,
      ...p.clientes.filter((c) => !ids.has(c.usuarioId)),
    ].slice(0, Math.max(MAX, fixos.length));
    setLista((l) => ({
      ...(l || VAZIA),
      nome: l?.nome || p.nome,
      produtoNome: l?.produtoNome || p.produtoNome || "",
      clientes,
    }));
    setAlterada(true);
    setFiltro({
      tipo: p.tipo,
      categoria: p.categoria || "",
      produtoId: p.produtoId,
      produtoNome: p.produtoNome || "",
    });
    if (p.periodoDias) setDias(p.periodoDias);
    setSugeridos((s) => [
      ...new Set([...s, ...p.clientes.map((c) => c.usuarioId)]),
    ]);
    setPublicoAtual(p.id);
    setNomePublico(null);
    api.post(`/whatsapp/publicos/${p.id}/usar`).catch(() => {});
    toast({
      titulo: `Lista “${p.nome}” carregada`,
      descricao: "Confira os clientes, escreva a mensagem e envie.",
    });
  };

  const excluirPublico = async (p) => {
    if (
      !(await confirmar({
        titulo: "Excluir a lista salva?",
        mensagem: `“${p.nome}” sai das listas salvas. As listas de envio não mudam.`,
        perigo: true,
        confirmar: "Excluir",
      }))
    )
      return;
    const ok = await executar(
      "publico",
      () => api.delete(`/whatsapp/publicos/${p.id}`),
      "Lista salva excluída",
    );
    if (ok) {
      if (publicoAtual === p.id) setPublicoAtual(null);
      carregarPublicos();
    }
  };

  const buscar = async (e) => {
    e?.preventDefault();
    if (busca.trim().length < 2) return;
    const data = await executar(
      "buscar",
      async () =>
        (
          await api.get("/whatsapp/campanhas/clientes", {
            params: { q: busca.trim(), dias },
          })
        ).data,
    );
    if (data) setAchados(data);
  };

  const incluir = (c) => {
    if (lista.clientes.some((x) => x.usuarioId === c.usuarioId)) return;
    if (lista.clientes.length >= MAX) {
      toast({
        titulo: `Limite de ${MAX} clientes por lista`,
        descricao: "Remova alguém ou crie outra lista.",
        tipo: "erro",
      });
      return;
    }
    editar({ clientes: [...lista.clientes, c] });
    setSugeridos((s) => [...new Set([...s, c.usuarioId])]);
  };

  const remover = (id) =>
    editar({ clientes: lista.clientes.filter((c) => c.usuarioId !== id) });

  // ---- mídia ----
  const enviarArquivo = async (arquivo) => {
    if (!arquivo) return;
    if (arquivo.size > 16 * 1024 * 1024) {
      toast({
        titulo: "Arquivo grande demais",
        descricao: "O WhatsApp aceita até 16 MB.",
        tipo: "erro",
      });
      return;
    }
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    const data = await executar(
      "midia",
      async () =>
        (
          await api.post("/whatsapp/campanhas/midia", dados, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120000,
          })
        ).data,
      "Arquivo pronto",
    );
    if (data) {
      if (previaLocal) URL.revokeObjectURL(previaLocal);
      setPreviaLocal(URL.createObjectURL(arquivo));
      editar(data);
      if (data.midiaTipo === "VIDEO") setObjetivo("VIDEO");
    }
  };

  const tirarMidia = () => {
    if (previaLocal) URL.revokeObjectURL(previaLocal);
    setPreviaLocal(null);
    editar({ midiaArquivoId: null, midiaTipo: null, midiaNome: null });
  };

  const srcMidia = lista?.midiaArquivoId
    ? previaLocal || urlArquivo(lista.midiaArquivoId)
    : null;

  // ---- IA ----
  const gerarIA = async () => {
    const data = await executar("ia", async () => {
      const imagem = srcMidia
        ? await quadroDaMidia(srcMidia, lista.midiaTipo)
        : null;
      return (
        await api.post(
          "/whatsapp/campanhas/ia",
          {
            produtoNome: lista.produtoNome,
            detalhes: lista.detalhes,
            objetivo,
            imagem,
            midiaTipo: lista.midiaTipo,
          },
          { timeout: 90000 },
        )
      ).data;
    });
    if (data?.texto) {
      editar({ texto: data.texto });
      toast({
        titulo: "Mensagem pronta",
        descricao: "Confira e ajuste o que quiser antes de enviar.",
      });
    }
  };

  // ---- envio ----
  const programar = async (agendar) => {
    if (agendar && !quando) {
      toast({ titulo: "Escolha a data e a hora do envio", tipo: "erro" });
      return;
    }
    const qtd = lista.clientes.length;
    const ok = await confirmar({
      titulo: agendar ? "Agendar o envio?" : "Enviar agora?",
      mensagem: `${qtd} cliente${qtd === 1 ? "" : "s"} vão receber a mensagem${lista.midiaTipo ? (lista.midiaTipo === "VIDEO" ? " com o vídeo" : " com a imagem") : ""}, um por vez, com pausa de cerca de 30 a 60 segundos entre eles.`,
      confirmar: agendar ? "Agendar" : "Enviar",
    });
    if (!ok) return;
    const salva = alterada || !lista.id ? await salvar(true) : lista;
    if (!salva) return;
    const data = await executar(
      "programar",
      async () =>
        (
          await api.post(`/whatsapp/campanhas/${salva.id}/programar`, {
            quando: agendar ? new Date(quando).toISOString() : null,
          })
        ).data,
      agendar ? "Envio agendado" : "Envio iniciado",
    );
    if (data) {
      setLista(data);
      setAlterada(false);
      carregarListas();
    }
  };

  const cancelar = async () => {
    if (
      !(await confirmar({
        titulo: "Cancelar o envio?",
        mensagem: "As mensagens que ainda não saíram não serão enviadas.",
        perigo: true,
        confirmar: "Cancelar envio",
      }))
    )
      return;
    const data = await executar(
      "cancelar",
      async () =>
        (await api.post(`/whatsapp/campanhas/${lista.id}/cancelar`)).data,
      "Envio cancelado",
    );
    if (data) {
      setLista(data);
      carregarListas();
    }
  };

  const duplicar = async () => {
    const data = await executar(
      "duplicar",
      async () =>
        (await api.post(`/whatsapp/campanhas/${lista.id}/duplicar`)).data,
      {
        titulo: "Lista duplicada",
        descricao: "Mesma mensagem e mídia; escolha os clientes.",
      },
    );
    if (data) {
      setLista(data);
      setAlterada(false);
      setSugeridos([...sugeridos, ...lista.clientes.map((c) => c.usuarioId)]);
      carregarListas();
    }
  };

  const excluir = async () => {
    if (
      !(await confirmar({
        titulo: "Excluir a lista?",
        mensagem: "O histórico de envio dela também sai.",
        perigo: true,
        confirmar: "Excluir",
      }))
    )
      return;
    const ok = await executar(
      "excluir",
      () => api.delete(`/whatsapp/campanhas/${lista.id}`),
      "Lista excluída",
    );
    if (ok) {
      setLista(null);
      setAlterada(false);
      carregarListas();
    }
  };

  const envioPorCliente = Object.fromEntries(
    (lista?.envios || []).map((e) => [e.usuarioId, e]),
  );
  const programavel = lista && ["RASCUNHO", "AGENDADA"].includes(lista.status);
  const editavel = lista && lista.status !== "CANCELADA";
  const exemploNome = lista?.clientes[0]?.nome?.split(" ")[0] || "Maria";

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="h-fit space-y-5">
        <Card className="space-y-3 p-4">
          <Button className="w-full" onClick={nova}>
            <Plus className="h-4 w-4" /> Nova lista
          </Button>
          {!listas ? (
            <Skeleton className="h-40" />
          ) : !listas.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma lista ainda.
            </p>
          ) : (
            <ul className="max-h-[640px] space-y-1.5 overflow-y-auto">
              {listas.map((l) => {
                const st = STATUS[l.status] || STATUS.RASCUNHO;
                const enviadas = l.resumo?.ENVIADO || 0;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => abrir(l.id)}
                      className={cx(
                        "w-full cursor-pointer rounded-lg border p-2.5 text-left transition hover:border-primary",
                        lista?.id === l.id
                          ? "border-primary bg-primary-soft/40"
                          : "border-border",
                      )}
                    >
                      <p className="truncate text-sm font-semibold">{l.nome}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <span>
                          {l.clientes.length} cliente
                          {l.clientes.length === 1 ? "" : "s"}
                          {["ENVIANDO", "CONCLUIDA", "CANCELADA"].includes(
                            l.status,
                          )
                            ? ` · ${enviadas} enviada${enviadas === 1 ? "" : "s"}`
                            : ""}
                        </span>
                        {l.midiaTipo &&
                          (l.midiaTipo === "VIDEO" ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <ImagePlus className="h-3.5 w-3.5" />
                          ))}
                      </div>
                      {l.status === "AGENDADA" && l.agendadaPara && (
                        <p className="mt-1 text-xs text-sky-700">
                          Para {dataHora(l.agendadaPara)}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Listas nichadas salvas */}
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Bookmark className="h-4 w-4 text-primary" /> Listas salvas
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quem mais compra de uma categoria ou de um produto. Clique para
              usar numa lista de envio.
            </p>
          </div>
          {!publicos ? (
            <Skeleton className="h-20" />
          ) : !publicos.length ? (
            <p className="rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
              Recomende clientes por categoria ou produto e clique em “Salvar
              lista nichada”.
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
              {publicos.map((p) => (
                <li
                  key={p.id}
                  className={cx(
                    "flex items-start gap-1 rounded-lg border p-2",
                    publicoAtual === p.id
                      ? "border-primary bg-primary-soft/40"
                      : "border-border",
                  )}
                >
                  <button
                    type="button"
                    title="Usar esta lista"
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => usarPublico(p)}
                  >
                    <p className="truncate text-sm font-semibold">{p.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {descreverFiltro(p)} · {p.clientes.length} cliente
                      {p.clientes.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Atualizada em {dataHora(p.updatedAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    title="Excluir lista salva"
                    className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    onClick={() => excluirPublico(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!lista ? (
        <Card className="p-6">
          <EmptyState
            icon={Users}
            titulo="Listas de clientes para o WhatsApp"
            descricao="Crie uma lista com até 20 clientes que mais compram, envie novidades, promoções, fotos e vídeos com uma mensagem pronta da IA, na hora ou agendado."
          >
            <Button className="mt-3" onClick={nova}>
              <Plus className="h-4 w-4" /> Criar a primeira lista
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <Field label="Nome da lista" className="min-w-56 flex-1">
              <Input
                value={lista.nome}
                maxLength={120}
                placeholder="Ex.: Lançamento pelúcias de Natal"
                disabled={!editavel}
                onChange={(e) => editar({ nome: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {lista.status && (
                <Badge
                  variant={(STATUS[lista.status] || STATUS.RASCUNHO).variant}
                >
                  {(STATUS[lista.status] || STATUS.RASCUNHO).label}
                </Badge>
              )}
              {editavel && (
                <Button
                  variant="outline"
                  loading={ocupado === "salvar"}
                  disabled={!alterada}
                  onClick={() => salvar()}
                >
                  Salvar
                </Button>
              )}
              {lista.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Duplicar (mesma mensagem para outra lista)"
                  loading={ocupado === "duplicar"}
                  onClick={duplicar}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {lista.id && !["AGENDADA", "ENVIANDO"].includes(lista.status) && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir lista"
                  loading={ocupado === "excluir"}
                  onClick={excluir}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}
            </div>
          </Card>

          {/* Clientes */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Users className="h-5 w-5 text-primary" /> Clientes
                <span
                  className={cx(
                    "rounded-full px-2 text-xs",
                    lista.clientes.length >= MAX
                      ? "bg-amber-100 text-amber-800"
                      : "bg-muted",
                  )}
                >
                  {lista.clientes.length}/{MAX}
                </span>
              </h2>
              {editavel && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    className="h-9 w-44 text-sm"
                    value={dias}
                    onChange={(e) => setDias(Number(e.target.value))}
                  >
                    {PERIODOS.map((p) => (
                      <option key={p.dias} value={p.dias}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    loading={ocupado === "recomendar"}
                    onClick={() => recomendar(false)}
                  >
                    <Sparkles className="h-4 w-4" /> Recomendar clientes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!sugeridos.length && !lista.clientes.length}
                    loading={ocupado === "recomendar"}
                    onClick={() => recomendar(true)}
                  >
                    <RefreshCw className="h-4 w-4" /> Gerar outra lista
                  </Button>
                </div>
              )}
            </div>
            {editavel && (
              <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[220px_1fr]">
                <Field label="Recomendar quem mais compra">
                  <Select
                    value={filtro.tipo}
                    onChange={(e) => mudarTipoFiltro(e.target.value)}
                  >
                    <option value="GERAL">De todos os produtos</option>
                    <option value="CATEGORIA">De uma categoria</option>
                    <option value="PRODUTO">De um produto específico</option>
                  </Select>
                </Field>
                {filtro.tipo === "CATEGORIA" && (
                  <Field label="Categoria">
                    <Select
                      value={filtro.categoria}
                      onChange={(e) => {
                        setFiltro({ ...filtro, categoria: e.target.value });
                        setAlterada(true);
                      }}
                    >
                      <option value="">Escolha a categoria…</option>
                      {categorias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {filtro.tipo === "PRODUTO" && (
                  <Field label="Produto">
                    {filtro.produtoId ? (
                      <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <Package className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate font-medium">
                            {filtro.produtoNome}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                          onClick={() => mudarTipoFiltro("PRODUTO")}
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <form className="flex gap-2" onSubmit={buscarProduto}>
                          <Input
                            placeholder="Nome ou código (SKU) do produto"
                            value={buscaProduto}
                            onChange={(e) => setBuscaProduto(e.target.value)}
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            className="shrink-0"
                            loading={ocupado === "produto"}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </form>
                        {produtosAchados.length > 0 && (
                          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card text-sm">
                            {produtosAchados.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="w-full cursor-pointer px-3 py-2 text-left hover:bg-muted"
                                  onClick={() => escolherProduto(p)}
                                >
                                  <p className="truncate font-medium">
                                    {p.nome}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.sku}
                                    {p.categoria ? ` · ${p.categoria}` : ""}
                                  </p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Field>
                )}
              </div>
            )}
            {editavel && (
              <>
                <Checkbox
                  checked={semRepetir}
                  onChange={() => setSemRepetir((v) => !v)}
                  label="Pular quem recebeu mensagem de lista nos últimos 7 dias"
                  descricao="A recomendação traz quem mais fez pedidos no período (quantidade de pedidos, não valor). “Gerar outra lista” traz só clientes diferentes dos já sugeridos."
                />
                <form className="flex gap-2" onSubmit={buscar}>
                  <Input
                    placeholder="Incluir cliente: nome, e-mail ou celular"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="shrink-0"
                    loading={ocupado === "buscar"}
                  >
                    <Search className="h-4 w-4" /> Buscar
                  </Button>
                </form>
                {achados.length > 0 && (
                  <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                    {achados.map((c) => {
                      const ja = lista.clientes.some(
                        (x) => x.usuarioId === c.usuarioId,
                      );
                      return (
                        <li
                          key={c.usuarioId}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {telefoneBonito(c.telefone)} · {c.pedidos} pedido
                              {c.pedidos === 1 ? "" : "s"} no período
                              {c.bloqueio && (
                                <span className="text-red-600">
                                  {" "}
                                  · {c.bloqueio}
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={ja || Boolean(c.bloqueio)}
                            onClick={() => incluir(c)}
                          >
                            {ja ? "Na lista" : "Incluir"}
                          </Button>
                        </li>
                      );
                    })}
                    <li className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                        onClick={() => setAchados([])}
                      >
                        Fechar busca
                      </button>
                    </li>
                  </ul>
                )}
              </>
            )}
            {!lista.clientes.length ? (
              <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                Clique em “Recomendar clientes” ou busque clientes para montar a
                lista.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {lista.clientes.map((c, i) => {
                  const envio = envioPorCliente[c.usuarioId];
                  const st = envio ? STATUS_ENVIO[envio.status] : null;
                  const travado = envio && envio.status !== "FILA";
                  return (
                    <li
                      key={c.usuarioId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          <span className="mr-1 text-xs text-muted-foreground">
                            {i + 1}.
                          </span>
                          {c.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {telefoneBonito(c.telefone)}
                          {c.pedidos > 0 &&
                            ` · ${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"}`}
                          {c.itens > 0 &&
                            ` · ${c.itens} pct${c.itens === 1 ? "" : "s"}`}
                        </p>
                        {envio?.erro && (
                          <p className="text-xs text-red-600">{envio.erro}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {st && <Badge variant={st.variant}>{st.label}</Badge>}
                        {editavel && !travado && (
                          <button
                            type="button"
                            title="Tirar da lista"
                            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            onClick={() => remover(c.usuarioId)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {editavel && lista.clientes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {nomePublico === null ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setNomePublico(
                          filtro.tipo === "CATEGORIA" && filtro.categoria
                            ? `Quem mais compra: ${filtro.categoria}`
                            : filtro.tipo === "PRODUTO" && filtro.produtoNome
                              ? `Quem mais compra: ${filtro.produtoNome}`
                              : lista.nome || "Quem mais compra",
                        )
                      }
                    >
                      <Bookmark className="h-4 w-4" /> Salvar lista nichada
                    </Button>
                    {publicoAtual &&
                      publicos?.some((p) => p.id === publicoAtual) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={ocupado === "publico"}
                          onClick={() => salvarPublico(true)}
                          title="Grava os clientes atuais na lista salva que foi usada"
                        >
                          <RefreshCw className="h-4 w-4" /> Atualizar “
                          {publicos.find((p) => p.id === publicoAtual)?.nome}”
                        </Button>
                      )}
                    <span className="text-xs text-muted-foreground">
                      Guarda estes clientes ({descreverFiltro(filtro)}) para
                      usar em outros envios.
                    </span>
                  </>
                ) : (
                  <form
                    className="flex w-full flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      salvarPublico(false);
                    }}
                  >
                    <Input
                      className="min-w-56 flex-1"
                      autoFocus
                      maxLength={120}
                      value={nomePublico}
                      placeholder="Nome da lista salva"
                      onChange={(e) => setNomePublico(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={ocupado === "publico"}
                    >
                      <Bookmark className="h-4 w-4" /> Salvar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setNomePublico(null)}
                    >
                      Cancelar
                    </Button>
                  </form>
                )}
              </div>
            )}
          </Card>

          {/* Mensagem */}
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <Card className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-5 w-5 text-primary" /> Mensagem
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Produto">
                  <Input
                    value={lista.produtoNome || ""}
                    maxLength={200}
                    placeholder="Ex.: Pelúcia Unicórnio 25 cm"
                    disabled={!editavel}
                    onChange={(e) => editar({ produtoNome: e.target.value })}
                  />
                </Field>
                <Field label="Tipo de mensagem">
                  <Select
                    value={objetivo}
                    disabled={!editavel}
                    onChange={(e) => setObjetivo(e.target.value)}
                  >
                    {OBJETIVOS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field
                label="Informações para a IA (opcional)"
                dica="Preço, desconto, validade, quantidade por pacote… A IA só usa o que estiver aqui."
              >
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={lista.detalhes || ""}
                  disabled={!editavel}
                  placeholder="Ex.: R$ 89,90 o pacote com 10, 15% de desconto até sexta"
                  onChange={(e) => editar({ detalhes: e.target.value })}
                />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Foto ou vídeo (opcional)
                </p>
                <input
                  ref={arquivoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/3gpp"
                  className="hidden"
                  onChange={(e) => {
                    enviarArquivo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {lista.midiaArquivoId ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                    {lista.midiaTipo === "VIDEO" ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {lista.midiaNome ||
                        (lista.midiaTipo === "VIDEO" ? "Vídeo" : "Imagem")}
                    </span>
                    {editavel && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={ocupado === "midia"}
                          onClick={() => arquivoRef.current?.click()}
                        >
                          Trocar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={tirarMidia}>
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    disabled={!editavel}
                    loading={ocupado === "midia"}
                    onClick={() => arquivoRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" /> Enviar imagem ou vídeo
                  </Button>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WEBP ou vídeo MP4 de até 16 MB (limite do WhatsApp).
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Texto</p>
                  {editavel && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={ocupado === "ia"}
                      onClick={gerarIA}
                    >
                      <Sparkles className="h-4 w-4" />{" "}
                      {lista.texto
                        ? "Gerar outra com IA"
                        : "Gerar mensagem com IA"}
                    </Button>
                  )}
                </div>
                <Textarea
                  rows={9}
                  maxLength={1000}
                  value={lista.texto || ""}
                  disabled={!editavel}
                  placeholder="Escreva ou clique em “Gerar mensagem com IA”. Use {nome} onde entra o nome de cada cliente."
                  onChange={(e) => editar({ texto: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  <code>{"{nome}"}</code> vira o primeiro nome de cada cliente.
                  *texto* = negrito, _texto_ = itálico.{" "}
                  {(lista.texto || "").length}/1000
                </p>
              </div>
            </Card>

            {/* Prévia */}
            <Card className="h-fit space-y-3 p-4">
              <p className="text-sm font-semibold">Prévia no WhatsApp</p>
              <div className="rounded-xl bg-[#e5ddd5] p-3">
                <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg bg-[#dcf8c6] text-sm text-slate-800 shadow-sm">
                  {srcMidia &&
                    (lista.midiaTipo === "VIDEO" ? (
                      <video
                        src={srcMidia}
                        controls
                        className="max-h-72 w-full bg-black"
                      />
                    ) : (
                      <img
                        src={srcMidia}
                        alt=""
                        className="max-h-72 w-full object-cover"
                      />
                    ))}
                  <div className="px-3 py-2">
                    {lista.texto ? (
                      <p className="whitespace-pre-line">
                        <Formatado
                          texto={lista.texto.replaceAll("{nome}", exemploNome)}
                        />
                      </p>
                    ) : (
                      <p className="text-slate-500 italic">
                        A mensagem aparece aqui.
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-line text-xs">
                      <Formatado texto={RODAPE} />
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Envio */}
          <Card className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Send className="h-5 w-5 text-primary" /> Envio
            </h2>
            {!conectado && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                O WhatsApp não está conectado. As mensagens ficam na fila e saem
                quando o número conectar (até 12 h depois do horário marcado).
              </p>
            )}
            {lista.status === "AGENDADA" && lista.agendadaPara && (
              <p className="flex items-center gap-1.5 text-sm text-sky-800">
                <CalendarClock className="h-4 w-4" /> Agendada para{" "}
                <strong>{dataHora(lista.agendadaPara)}</strong>. Dá para mudar a
                lista e a mensagem até lá.
              </p>
            )}
            {lista.status === "ENVIANDO" && (
              <p className="text-sm text-amber-800">
                Enviando: {lista.resumo?.ENVIADO || 0} de{" "}
                {lista.clientes.length}. Clientes novos que você incluir entram
                no fim da fila.
              </p>
            )}
            {lista.status === "CONCLUIDA" && (
              <p className="text-sm text-emerald-800">
                Enviada
                {lista.concluidaEm
                  ? ` em ${dataHora(lista.concluidaEm)}`
                  : ""}: {lista.resumo?.ENVIADO || 0} entregue(s) ao WhatsApp
                {lista.resumo?.ERRO ? `, ${lista.resumo.ERRO} com erro` : ""}
                {lista.resumo?.DESCARTADA
                  ? `, ${lista.resumo.DESCARTADA} não enviada(s)`
                  : ""}
                . Incluir clientes novos e salvar envia só para eles.
              </p>
            )}
            {lista.status === "CANCELADA" && (
              <p className="text-sm text-red-700">
                Envio cancelado. Use “Duplicar” para mandar a mesma mensagem de
                novo.
              </p>
            )}

            {programavel && (
              <div className="flex flex-wrap items-end gap-3">
                <Button
                  variant="success"
                  loading={ocupado === "programar" || ocupado === "salvar"}
                  disabled={
                    !lista.clientes.length || !(lista.texto || "").trim()
                  }
                  onClick={() => programar(false)}
                >
                  <Send className="h-4 w-4" /> Enviar agora
                </Button>
                <span className="pb-2.5 text-sm text-muted-foreground">ou</span>
                <Field label="Agendar para">
                  <Input
                    type="datetime-local"
                    value={quando}
                    onChange={(e) => setQuando(e.target.value)}
                  />
                </Field>
                <Button
                  variant="outline"
                  loading={ocupado === "programar"}
                  disabled={
                    !quando ||
                    !lista.clientes.length ||
                    !(lista.texto || "").trim()
                  }
                  onClick={() => programar(true)}
                >
                  <CalendarClock className="h-4 w-4" />{" "}
                  {lista.status === "AGENDADA" ? "Reagendar" : "Agendar"}
                </Button>
              </div>
            )}
            {["AGENDADA", "ENVIANDO"].includes(lista.status) && (
              <Button
                variant="danger-outline"
                loading={ocupado === "cancelar"}
                onClick={cancelar}
              >
                <XCircle className="h-4 w-4" /> Cancelar envio
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              As mensagens saem uma por vez, com pausa variada de cerca de 30 a
              60 segundos, e no máximo {MAX} clientes por lista, para o WhatsApp
              não tratar como disparo em massa. Quem responder SAIR não recebe
              mais.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
