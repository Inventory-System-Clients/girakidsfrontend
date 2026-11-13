import { useState } from "react";
import { Navbar } from "../../components/Header";
import { Footer } from "../../components/Header";
import {
  PageHeader,
  AlertBox,
  Badge,
  ConfirmDialog,
} from "../../components/comercial/UIComponents";
import api from "../../services/api";
import EmitirNotaDialog from "../../components/pedido/EmitirNotaDialog";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatarData = (valor) =>
  valor ? new Date(valor).toLocaleDateString("pt-BR") : "-";

const formatarDataHora = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR") : "-";

const formatarPeso = (gramas) =>
  gramas
    ? `${(gramas / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`
    : "-";

const dataLocal = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const hoje = new Date();
const PERIODO_PADRAO = {
  inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
  fim: dataLocal(hoje),
};

const parseNumero = (valor) => {
  const numero = Number(String(valor || "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const CAMPOS_DESTINATARIO = [
  { campo: "nome", rotulo: "Nome do destinatário", classe: "sm:col-span-2" },
  { campo: "cep", rotulo: "CEP" },
  { campo: "logradouro", rotulo: "Logradouro", classe: "sm:col-span-2" },
  { campo: "numero", rotulo: "Número" },
  { campo: "complemento", rotulo: "Complemento" },
  { campo: "bairro", rotulo: "Bairro" },
  { campo: "cidade", rotulo: "Cidade" },
  { campo: "telefone", rotulo: "Celular" },
  { campo: "email", rotulo: "E-mail" },
  { campo: "documento", rotulo: "CPF/CNPJ" },
];

const baixarArquivos = (arquivos) => {
  arquivos.forEach((arquivo, indice) => {
    setTimeout(() => {
      const bytes = Uint8Array.from(atob(arquivo.base64), (c) => c.charCodeAt(0));
      // A API dos Correios devolve a declaração de conteúdo em HTML.
      const url = URL.createObjectURL(new Blob([bytes], { type: arquivo.mime || "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo.nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, indice * 400);
  });
};

// Itens do pedido + caixas sugeridas pela Calculadora de Pedidos, acima dos
// dados de envio (não precisa voltar ao Time de Vendas para ver o pedido).
function BotaoVolume({ v, totalVolumes, onUsar, br, cor = "blue" }) {
  const estilos = {
    blue: "border-blue-300 hover:bg-blue-100 text-blue-900",
    green: "border-emerald-300 hover:bg-emerald-100 text-emerald-900",
  };
  return (
    <button type="button" className={`w-full rounded-md border bg-white px-3 py-2 text-left text-sm ${estilos[cor]}`} onClick={() => onUsar(v)}>
      <span className="font-bold">
        {v.volumes}× {br(v.altura)} × {br(v.largura)} × {br(v.comprimento)} cm
      </span>
      {totalVolumes > 1 && v.pesoKg >= 0.1 ? <span> · cerca de {br(v.pesoKg)} kg cada</span> : null}
    </button>
  );
}

// Texto de onde veio a caixa aprendida.
const origemAprendida = (a) => {
  if (a.mesmoPedido) return "Caixa usada na postagem deste pedido.";
  const quem = [a.pedidoNumero && `pedido ${a.pedidoNumero}`, a.por && `por ${a.por}`].filter(Boolean).join(", ");
  return `Um pedido ${a.parecida ? "parecido" : "com o mesmo conteúdo"}${a.descricao ? ` (${a.descricao})` : ""} foi postado nesta caixa${quem ? ` (${quem})` : ""}.`;
};

function ItensEVolumes({ pedido, onUsar, onEsquecer, esquecendo }) {
  const itens = pedido.itens || [];
  const volumes = pedido.volumesSugeridos || [];
  const totalVolumes = volumes.reduce((s, v) => s + v.volumes, 0);
  const br = (n) => String(n).replace(".", ",");
  const aprendida = pedido.caixaAprendida;
  const calculados = pedido.volumesCalculados || [];
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Itens do pedido ({itens.length})</h3>
        {!itens.length ? (
          <p className="text-sm text-gray-500">Pedido sem itens.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {itens.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                {i.imagemUrl ? (
                  <img src={i.imagemUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{i.nome}</p>
                  <p className="text-xs text-gray-500">
                    {[i.sku, i.categoria].filter(Boolean).join(" · ")}
                    {i.unidadesPacote > 1 ? ` · pacote com ${i.unidadesPacote} un.` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900">
                  {i.quantidade} {i.unidadesPacote > 1 ? (i.quantidade === 1 ? "pacote" : "pacotes") : "un."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aprendida ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <h3 className="text-lg font-bold text-emerald-900 mb-1">✅ Caixa aprendida{aprendida.parecida ? " (pedido parecido)" : ""}</h3>
          <p className="text-xs text-emerald-800 mb-3">
            {origemAprendida(aprendida)}
            {aprendida.vezes > 1 ? ` Confirmada em ${aprendida.vezes} postagens.` : ""} As medidas já foram preenchidas.
          </p>
          <div className="space-y-2">
            {volumes.map((v, n) => (
              <BotaoVolume key={n} v={v} totalVolumes={totalVolumes} onUsar={onUsar} br={br} cor="green" />
            ))}
          </div>
          {calculados.length > 0 && (
            <div className="mt-3 border-t border-emerald-200 pt-3">
              <p className="text-xs text-emerald-800 mb-2">Conta da Calculadora de Pedidos (se precisar):</p>
              <div className="space-y-2">
                {calculados.map((v, n) => (
                  <BotaoVolume key={n} v={v} totalVolumes={calculados.reduce((s, c) => s + c.volumes, 0)} onUsar={onUsar} br={br} />
                ))}
              </div>
            </div>
          )}
          <button type="button" className="mt-3 text-xs font-semibold text-red-700 underline disabled:opacity-50" disabled={esquecendo} onClick={onEsquecer}>
            {esquecendo ? "Esquecendo..." : "Esquecer esta caixa (estava errada)"}
          </button>
        </div>
      ) : (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-lg font-bold text-blue-900 mb-1">Caixas sugeridas</h3>
        <p className="text-xs text-blue-800 mb-3">
          Pela Calculadora de Pedidos: {totalVolumes} {totalVolumes === 1 ? "volume" : "volumes"}. Medidas em cm (A × L × C). Clique para preencher as
          medidas da cotação.
        </p>
        {!volumes.length ? (
          <p className="text-sm text-blue-900">Sem sugestão para este pedido.</p>
        ) : (
          <div className="space-y-2">
            {volumes.map((v, n) => (
              <BotaoVolume key={n} v={v} totalVolumes={totalVolumes} onUsar={onUsar} br={br} />
            ))}
            {totalVolumes > 1 && (
              <p className="text-xs text-blue-800">
                Mais de um volume: cada caixa é uma postagem nos Correios. Cote e grave uma de cada vez com as medidas e o peso dela.
              </p>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-blue-800">
          Caixa errada? Digite as medidas certas: ao gravar a postagem, o sistema aprende e sugere essa caixa nos próximos pedidos com o mesmo conteúdo ou parecido.
        </p>
      </div>
      )}
    </div>
  );
}

export function Correios() {
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState(PERIODO_PADRAO.inicio);
  const [fim, setFim] = useState(PERIODO_PADRAO.fim);
  const [pedidos, setPedidos] = useState(null);
  const [temMais, setTemMais] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  const [pedido, setPedido] = useState(null);
  const [abrindoId, setAbrindoId] = useState("");
  const [destinatario, setDestinatario] = useState(null);
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [servicos, setServicos] = useState(null);
  const [servicoId, setServicoId] = useState("");
  const [cotando, setCotando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [confirmarGravar, setConfirmarGravar] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [baixandoPdfId, setBaixandoPdfId] = useState("");
  // Nota fiscal do pedido aberto (a postagem vai com a NF).
  const [emitirNota, setEmitirNota] = useState(false);
  const [esquecendo, setEsquecendo] = useState(false);

  const buscar = async (event) => {
    event?.preventDefault();
    try {
      setBuscando(true);
      setError("");
      const response = await api.get("/correios/pedidos", {
        params: { nome, inicio, fim },
      });
      setPedidos(response.data.pedidos || []);
      setTemMais(Boolean(response.data.temMais));
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao buscar pedidos da loja.");
    } finally {
      setBuscando(false);
    }
  };

  const abrirPedido = async (item) => {
    try {
      setAbrindoId(item.id);
      setError("");
      setResultado(null);
      setServicos(null);
      setServicoId("");
      const response = await api.get(`/correios/pedidos/${item.id}`);
      const dados = response.data;
      setPedido(dados);
      setDestinatario(dados.destinatario);
      setPeso(
        dados.pesoGramas
          ? (dados.pesoGramas / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })
          : "",
      );
      // Caixa aprendida (mesmo conteúdo já postado): medidas já preenchidas.
      const aprendida = dados.caixaAprendida && dados.volumesSugeridos?.[0];
      const br = (n) => String(n).replace(".", ",");
      setAltura(aprendida ? br(aprendida.altura) : "");
      setLargura(aprendida ? br(aprendida.largura) : "");
      setComprimento(aprendida ? br(aprendida.comprimento) : "");
      setTimeout(() => {
        document.getElementById("painel-postagem")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao abrir o pedido.");
    } finally {
      setAbrindoId("");
    }
  };

  const fecharPedido = () => {
    setPedido(null);
    setDestinatario(null);
    setServicos(null);
    setResultado(null);
  };

  const alterarCampo = (campo, valor) => {
    setDestinatario((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "cep") setServicos(null);
  };

  const carga = () => ({
    cep: destinatario?.cep,
    pesoGramas: Math.round(parseNumero(peso) * 1000),
    altura: parseNumero(altura),
    largura: parseNumero(largura),
    comprimento: parseNumero(comprimento),
  });

  const dimensoesPreenchidas =
    parseNumero(peso) > 0 &&
    parseNumero(altura) > 0 &&
    parseNumero(largura) > 0 &&
    parseNumero(comprimento) > 0;

  const cotar = async () => {
    if (!dimensoesPreenchidas) {
      setError("Preencha peso, altura, largura e comprimento para cotar.");
      return;
    }
    try {
      setCotando(true);
      setError("");
      const response = await api.post("/correios/cotacao", carga());
      const lista = response.data.servicos || [];
      setServicos(lista);
      // Pré-seleciona o serviço que o cliente escolheu no checkout.
      const metodo = pedido?.metodoEnvio;
      const preferido =
        lista.find((s) => s.disponivel && metodo && s.nome.toUpperCase() === metodo) ||
        lista.find((s) => s.disponivel);
      setServicoId(preferido?.id || "");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cotar o frete nos Correios.");
    } finally {
      setCotando(false);
    }
  };

  const gravar = async (forcar = false) => {
    try {
      setGravando(true);
      setError("");
      const response = await api.post("/correios/postagens", {
        pedidoId: pedido.id,
        destinatario,
        carga: carga(),
        servicoId,
        forcar,
      });
      setResultado(response.data);
      baixarArquivos(response.data.arquivos || []);
      buscar();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.postagem) {
        setPedido((atual) => ({ ...atual, postagem: err.response.data.postagem }));
      }
      setError(err.response?.data?.error || "Erro ao gravar a postagem nos Correios.");
    } finally {
      setGravando(false);
    }
  };

  const baixarDeNovo = async (postagem) => {
    try {
      setBaixandoPdfId(postagem.id);
      setError("");
      const response = await api.get(`/correios/postagens/${postagem.id}/pdfs`);
      baixarArquivos(response.data.arquivos || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao baixar os PDFs.");
    } finally {
      setBaixandoPdfId("");
    }
  };

  const esquecerCaixa = async () => {
    if (!pedido?.caixaAprendida?.assinatura) return;
    if (!window.confirm("Esquecer esta caixa? Os próximos pedidos com este conteúdo (ou parecido) voltam a usar a conta da Calculadora de Pedidos.")) return;
    try {
      setEsquecendo(true);
      await api.post("/correios/caixas-aprendidas/esquecer", { assinatura: pedido.caixaAprendida.assinatura });
      const { data: dados } = await api.get(`/correios/pedidos/${pedido.id}`);
      setPedido(dados);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao esquecer a caixa.");
    } finally {
      setEsquecendo(false);
    }
  };

  const servicoEscolhido = servicos?.find((s) => s.id === servicoId);

  // Preenche as medidas com uma caixa sugerida (o peso continua o do pedido).
  const usarVolume = (v) => {
    const br = (n) => String(n).replace(".", ",");
    setAltura(br(v.altura));
    setLargura(br(v.largura));
    setComprimento(br(v.comprimento));
    setServicos(null);
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      {emitirNota && pedido && <EmitirNotaDialog pedidoId={pedido.id} onFechar={() => setEmitirNota(false)} />}

      <main className="container-app px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Correios"
          subtitle="Pedidos da loja Gira Kids → postagem nos Correios com etiqueta e declaração em PDF"
          icon="📮"
        />

        {error && (
          <div className="mb-6">
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          </div>
        )}

        <form onSubmit={buscar} className="card-gradient mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nome do cliente
              </label>
              <input
                className="input-field w-full"
                placeholder="Digite o nome (ou deixe vazio para ver todos)"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">De</label>
              <input
                type="date"
                className="input-field w-full"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Até</label>
              <input
                type="date"
                className="input-field w-full"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn-primary" disabled={buscando}>
              {buscando ? "Buscando pedidos..." : "🔎 Buscar pedidos"}
            </button>
          </div>
        </form>

        {pedidos && (
          <section className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"}
              </h2>
              {temMais && (
                <p className="text-xs text-amber-700">
                  Muitos resultados: mostrando os mais recentes. Refine o nome ou o período.
                </p>
              )}
            </div>
            {pedidos.length === 0 ? (
              <p className="text-gray-600">Nenhum pedido encontrado nesse período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Pedido</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Destino</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Envio</th>
                      <th className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-500">Peso</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pedidos.map((item) => (
                      <tr
                        key={item.id}
                        className={pedido?.id === item.id ? "bg-amber-50" : ""}
                      >
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          #{item.numero || "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatarData(item.data)}</td>
                        <td className="px-3 py-2">{item.cliente}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {item.cidade}
                          {item.uf ? ` - ${item.uf}` : ""}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.metodoEnvioNome}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {formatarPeso(item.pesoGramas)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {item.postagem ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="success" size="sm">
                                Postado {item.postagem.etiqueta || ""}
                              </Badge>
                              <button
                                type="button"
                                className="btn-secondary text-xs px-2 py-1"
                                onClick={() => abrirPedido(item)}
                                disabled={abrindoId === item.id}
                              >
                                Abrir
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1"
                              onClick={() => abrirPedido(item)}
                              disabled={abrindoId === item.id}
                            >
                              {abrindoId === item.id ? "Abrindo..." : "Postar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {pedido && destinatario && (
          <section id="painel-postagem" className="card-gradient">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  Pedido #{pedido.numero} · {pedido.cliente}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {formatarDataHora(pedido.data)} · {pedido.metodoEnvioNome}
                  {pedido.prazoEntregaDias ? ` · ${pedido.prazoEntregaDias} dias úteis` : ""}
                  {" · "}
                  {formatarPeso(pedido.pesoGramas)}
                </p>
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={fecharPedido}>
                Fechar
              </button>
            </div>

            {pedido.postagem && !resultado && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-bold text-emerald-900">
                  ✅ Este pedido já foi postado nos Correios
                </p>
                <p className="text-sm text-emerald-800 mt-1">
                  Etiqueta {pedido.postagem.etiqueta || "-"} · {pedido.postagem.servico}
                  {pedido.postagem.valorFrete ? ` · ${formatarMoeda(pedido.postagem.valorFrete)}` : ""}
                  {" · "}
                  {formatarDataHora(pedido.postagem.criadoEm)}
                  {pedido.postagem.criadoPor ? ` por ${pedido.postagem.criadoPor}` : ""}
                </p>
                <button
                  type="button"
                  className="btn-primary text-sm mt-3"
                  onClick={() => baixarDeNovo(pedido.postagem)}
                  disabled={baixandoPdfId === pedido.postagem.id}
                >
                  {baixandoPdfId === pedido.postagem.id
                    ? "Baixando..."
                    : "⬇️ Baixar etiqueta e declaração de novo"}
                </button>
              </div>
            )}

            {resultado && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-bold text-emerald-900">
                  ✅ Postagem gravada nos Correios — etiqueta {resultado.etiqueta || "-"}
                </p>
                <p className="text-sm text-emerald-800 mt-1">
                  {resultado.servico?.nome} · {formatarMoeda(resultado.servico?.valor)}. Caixa {altura} × {largura} × {comprimento} cm guardada para os próximos pedidos com o mesmo conteúdo ou parecido.{" "}
                  {resultado.arquivos?.length
                    ? `Baixando ${resultado.arquivos.length} PDF(s): ${resultado.arquivos.map((a) => a.nome).join(", ")}.`
                    : ""}
                </p>
                {resultado.errosPdf?.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      ⚠️ {resultado.arquivos?.some((a) => a.tipo === "etiqueta") ? "Um arquivo não veio." : "A etiqueta ainda não veio dos Correios."} A postagem já está gravada; não grave de novo.
                    </p>
                    <p className="mt-1 text-xs text-amber-800">{resultado.errosPdf.join(" ")}</p>
                    {resultado.postagemId && (
                      <button
                        type="button"
                        className="btn-primary mt-2"
                        disabled={baixandoPdfId === resultado.postagemId}
                        onClick={() => baixarDeNovo({ id: resultado.postagemId })}
                      >
                        {baixandoPdfId === resultado.postagemId ? "Baixando..." : "⬇️ Baixar etiqueta de novo"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <ItensEVolumes pedido={pedido} onUsar={usarVolume} onEsquecer={esquecerCaixa} esquecendo={esquecendo} />

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Dados de entrega</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Endereço do pedido: <strong>{pedido.enderecoOriginal || "-"}</strong>
                  {pedido.observacoes ? (
                    <>
                      {" "}· Observações: <strong>{pedido.observacoes}</strong>
                    </>
                  ) : null}
                  . Confira número e complemento.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {CAMPOS_DESTINATARIO.map(({ campo, rotulo, classe }) => (
                    <div key={campo} className={classe || ""}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {rotulo}
                      </label>
                      <input
                        className="input-field w-full"
                        value={destinatario[campo] || ""}
                        onChange={(event) => alterarCampo(campo, event.target.value)}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">UF</label>
                    <select
                      className="input-field w-full"
                      value={destinatario.uf || ""}
                      onChange={(event) => alterarCampo("uf", event.target.value)}
                    >
                      <option value="">--</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Pacote</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Peso (kg)
                    </label>
                    <input
                      className="input-field w-full"
                      inputMode="decimal"
                      value={peso}
                      onChange={(event) => {
                        setPeso(event.target.value);
                        setServicos(null);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Altura", altura, setAltura],
                      ["Largura", largura, setLargura],
                      ["Compr.", comprimento, setComprimento],
                    ].map(([rotulo, valor, setter]) => (
                      <div key={rotulo}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          {rotulo} (cm)
                        </label>
                        <input
                          className="input-field w-full"
                          inputMode="numeric"
                          value={valor}
                          onChange={(event) => {
                            setter(event.target.value);
                            setServicos(null);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Conteúdo
                    </label>
                    <input className="input-field w-full bg-gray-100" value="BRINQUEDOS" readOnly />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={cotar}
                    disabled={cotando || !dimensoesPreenchidas}
                  >
                    {cotando ? "Cotando nos Correios..." : "💲 Cotar frete"}
                  </button>
                </div>

                {servicos && (
                  <div className="mt-4 space-y-2">
                    {servicos.map((servico) => (
                      <label
                        key={servico.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${
                          servico.disponivel
                            ? servicoId === servico.id
                              ? "border-primary bg-white"
                              : "border-gray-200 bg-white cursor-pointer"
                            : "border-gray-100 bg-gray-50 text-gray-400"
                        }`}
                        title={servico.erro || ""}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="servico"
                            disabled={!servico.disponivel}
                            checked={servicoId === servico.id}
                            onChange={() => setServicoId(servico.id)}
                          />
                          <span className="font-semibold">{servico.nome}</span>
                        </span>
                        <span className="whitespace-nowrap">
                          {servico.disponivel
                            ? `${formatarMoeda(servico.valor)} · ${servico.prazoDias}d`
                            : "indisponível"}
                        </span>
                      </label>
                    ))}

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="btn-secondary w-full py-3"
                        onClick={() => setEmitirNota(true)}
                      >
                        🧾 Gerar NF
                      </button>
                      <button
                        type="button"
                        className="btn-primary w-full py-3"
                        disabled={!servicoEscolhido || gravando}
                        onClick={() => setConfirmarGravar(true)}
                      >
                        {gravando ? "Gravando nos Correios..." : "📦 Gravar e baixar PDFs"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        isOpen={confirmarGravar}
        onClose={() => setConfirmarGravar(false)}
        onConfirm={() => gravar(Boolean(pedido?.postagem))}
        title={pedido?.postagem ? "⚠️ Postar de novo?" : "Gravar postagem nos Correios"}
        message={
          pedido?.postagem
            ? `Este pedido JÁ foi postado (etiqueta ${pedido.postagem.etiqueta || "-"}). Gravar de novo cria OUTRA pré-postagem nos Correios. Continuar?`
            : `Criar a pré-postagem ${servicoEscolhido?.nome || ""} (${formatarMoeda(servicoEscolhido?.valor)}) para ${destinatario?.nome || ""}, CEP ${destinatario?.cep || ""}? A etiqueta e a declaração de conteúdo serão baixadas.`
        }
        confirmText={pedido?.postagem ? "Sim, postar de novo" : "Gravar"}
        type={pedido?.postagem ? "danger" : "primary"}
      />

      <Footer />
    </div>
  );
}
