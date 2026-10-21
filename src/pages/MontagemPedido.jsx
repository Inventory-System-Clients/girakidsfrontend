import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, FileDown, PackageCheck, Truck, Undo2 } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { Badge, Button, Card, Field, Spinner, Textarea, cx, useConfirm, useToast } from "../components/ui";
import { FotosUpload } from "../components/pedido/Fotos";
import { BotaoWhatsapp } from "../components/Whatsapp";
import { carimbo, mascaraDocumento, pesoKg } from "../utils/format";
import { METODOS_ENVIO, nomeForma } from "../utils/status";
import { gerarPdfPedido } from "../utils/pdf";

const Linha = ({ rotulo, children }) =>
  children ? (
    <p className="text-sm">
      <span className="text-muted-foreground">{rotulo}: </span>
      <span className="font-medium">{children}</span>
    </p>
  ) : null;

// Tela de montagem: carrega o pedido, a pessoa toca em cada item conforme
// separa; com todos conferidos, conclui a montagem e depois expede com as
// fotos do pedido e da transportadora.
export default function MontagemPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const [pedido, setPedido] = useState(null);
  const [obs, setObs] = useState("");
  const [salvandoItem, setSalvandoItem] = useState(null);
  const [acao, setAcao] = useState("");

  const aplicar = useCallback((d) => {
    setPedido(d);
    setObs((atual) => (atual === "" ? d.observacoesExpedicao || "" : atual));
  }, []);

  useEffect(() => {
    api
      .get(`/pedidos/${id}`)
      .then(({ data }) => aplicar(data))
      .catch((e) => toast({ titulo: "Erro ao carregar pedido", descricao: mensagemErro(e), tipo: "erro" }));
  }, [id, aplicar, toast]);

  if (!pedido) return <Spinner className="mx-auto mt-24 h-8 w-8" />;

  const expedido = pedido.statusExpedicao === "EXPEDIDO";
  const concluida = Boolean(pedido.montagemConcluidaEm);
  const { conferidos, total, completo } = pedido.checklist;

  const marcar = async (item) => {
    if (expedido || salvandoItem) return;
    const conferido = !item.conferido;
    setSalvandoItem(item.id);
    setPedido((p) => ({ ...p, itens: p.itens.map((i) => (i.id === item.id ? { ...i, conferido } : i)) }));
    try {
      const { data } = await api.put(`/expedicao/${pedido.id}/itens/${item.id}`, { conferido });
      aplicar(data);
    } catch (error) {
      toast({ titulo: "Erro ao atualizar item", descricao: mensagemErro(error), tipo: "erro" });
      const { data } = await api.get(`/pedidos/${pedido.id}`);
      aplicar(data);
    } finally {
      setSalvandoItem(null);
    }
  };

  const executar = async (nome, fn, sucesso) => {
    setAcao(nome);
    try {
      const { data } = await fn();
      aplicar(data);
      if (sucesso) toast({ titulo: sucesso });
      return true;
    } catch (error) {
      toast({ titulo: "Não foi possível concluir", descricao: mensagemErro(error), tipo: "erro" });
      return false;
    } finally {
      setAcao("");
    }
  };

  const salvarFotos = (campo) => (fotos) => {
    setPedido((p) => ({ ...p, [campo]: fotos }));
    api
      .put(`/expedicao/${pedido.id}/fotos`, { [campo]: fotos })
      .then(({ data }) => setPedido((p) => ({ ...data, [campo]: p[campo] })))
      .catch((e) => toast({ titulo: "Erro ao salvar fotos", descricao: mensagemErro(e), tipo: "erro" }));
  };

  const expedir = async () => {
    if (!pedido.imagensExpedicao?.length) {
      const ok = await confirmar({ titulo: "Expedir sem foto do pedido?", mensagem: "Nenhuma foto do pedido foi anexada. Deseja expedir mesmo assim?", confirmar: "Expedir" });
      if (!ok) return;
    }
    const ok = await executar("expedir", () => api.post(`/expedicao/${pedido.id}/expedir`, { observacoes: obs }), "Pedido expedido com sucesso");
    if (ok) navigate("/expedicao");
  };

  const desfazer = async () => {
    const ok = await confirmar({ titulo: "Desfazer montagem?", mensagem: "Todos os itens voltam para não conferidos e o pedido volta para 'Iniciar Montagem'.", perigo: true, confirmar: "Desfazer" });
    if (ok) executar("desfazer", () => api.post(`/expedicao/${pedido.id}/desfazer`), "Montagem desfeita");
  };

  const progresso = Math.round((conferidos / Math.max(1, total)) * 100);
  const endereco = [pedido.rua, pedido.numeroEndereco, pedido.complemento, pedido.bairro, pedido.cidade && `${pedido.cidade}/${pedido.estado || ""}`, pedido.cep && `CEP ${pedido.cep}`]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-4xl px-3 pt-4 pb-32 sm:px-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate("/expedicao")}>
          <ArrowLeft className="h-4 w-4" /> Expedição
        </Button>
        <Button variant="outline" size="sm" onClick={() => gerarPdfPedido(pedido)}>
          <FileDown className="h-4 w-4" /> PDF
        </Button>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">Montagem · Pedido {pedido.numeroFormatado}</h1>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge variant={expedido ? "success" : concluida ? "info" : conferidos ? "warning" : "default"}>
            {expedido ? "Expedido" : concluida ? "Montagem concluída" : conferidos ? "Em montagem" : "Não iniciada"}
          </Badge>
          <Badge variant="outline">{METODOS_ENVIO[pedido.metodoEnvio] || "Entrega a definir"}</Badge>
          <Badge variant="outline">{nomeForma(pedido.formaPagamento)}</Badge>
        </div>
      </div>

      <Card className="mb-4 grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cliente e entrega</p>
          <Linha rotulo="Cliente">{pedido.clienteNome}</Linha>
          <Linha rotulo="Telefone">{pedido.clienteTelefone}</Linha>
          <Linha rotulo="Documento">{pedido.documento && mascaraDocumento(pedido.documento)}</Linha>
          <Linha rotulo="Endereço">{endereco}</Linha>
          <Linha rotulo="Prazo">{pedido.prazoEntregaDias ? `${pedido.prazoEntregaDias} dias úteis` : null}</Linha>
          <Linha rotulo="Peso total">{pesoKg(pedido.pesoTotalGramas)}</Linha>
        </div>
        <div className="space-y-1">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Transportadora e documentos</p>
          <Linha rotulo="Transportadora">{pedido.transportadoraNome || "Nenhuma vinculada"}</Linha>
          <Linha rotulo="Telefone transportadora">{pedido.transportadora?.telefone}</Linha>
          <Linha rotulo="Obs. transportadora">{pedido.transportadoraObs}</Linha>
          {pedido.transportadora?.telefone && (
            <BotaoWhatsapp variante="contorno" className="py-1 text-xs" telefone={pedido.transportadora.telefone} texto={`Olá! Aqui é da Gira Kids, sobre a coleta do pedido ${pedido.numeroFormatado}.`}>
              WhatsApp da transportadora
            </BotaoWhatsapp>
          )}
          <Linha rotulo="Nota fiscal">{pedido.notaFiscalNumero}</Linha>
          <Linha rotulo="Rastreio">{pedido.codigoRastreio}</Linha>
          <Linha rotulo="Liberado por">{pedido.liberadoPor && `${pedido.liberadoPor} · ${carimbo(pedido.liberadoEm)}`}</Linha>
        </div>
        {(pedido.observacoes || pedido.observacaoLiberacao) && (
          <div className="space-y-2 rounded-lg bg-amber-50 p-3 sm:col-span-2">
            {pedido.observacoes && (
              <p className="text-sm">
                <span className="font-semibold">Observações do pedido: </span>
                {pedido.observacoes}
              </p>
            )}
            {pedido.observacaoLiberacao && (
              <p className="text-sm">
                <span className="font-semibold">Observação do time de vendas: </span>
                {pedido.observacaoLiberacao}
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="sticky top-16 z-10 -mx-3 mb-3 bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold">Itens conferidos</span>
          <span className="font-bold">
            {conferidos} de {total}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-muted">
          <div className={cx("h-2.5 rounded-full transition-all", completo ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progresso}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {pedido.itens.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={expedido}
            onClick={() => marcar(item)}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition active:scale-[0.99]",
              item.conferido ? "border-emerald-400 bg-emerald-50/60" : "border-border hover:border-primary/40",
            )}
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
              {item.imagemUrl && <img src={item.imagemUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.nome}</p>
              <p className="text-xs text-muted-foreground">
                {item.categoria}
                {item.sku && ` · SKU ${item.sku}`}
              </p>
              <p className="mt-1 text-sm">
                <strong>{item.quantidade}</strong> {item.quantidade === 1 ? "embalagem" : "embalagens"} × {item.unidadesPacote} un. = <strong>{item.quantidade * item.unidadesPacote} un.</strong>
              </p>
              {item.conferido && item.conferidoPor && (
                <p className="text-[11px] text-emerald-700">
                  Conferido por {item.conferidoPor} · {carimbo(item.conferidoEm)}
                </p>
              )}
            </div>
            {salvandoItem === item.id ? (
              <Spinner className="h-8 w-8" />
            ) : item.conferido ? (
              <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-9 w-9 shrink-0 text-slate-300" />
            )}
          </button>
        ))}
      </div>

      <Card className="mt-4 p-4">
        <Field label="Observações da expedição" dica="Informações internas da logística (aparecem em Ver pedido).">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações internas da expedição..." />
        </Field>
        <Button
          variant="outline"
          className="mt-2"
          loading={acao === "obs"}
          onClick={() => executar("obs", () => api.put(`/expedicao/${pedido.id}/observacoes`, { observacoes: obs }), "Observações salvas")}
        >
          Salvar observações
        </Button>
      </Card>

      {(concluida || expedido) && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <PackageCheck className="mr-1 inline h-4 w-4" />
            Montagem concluída por <strong>{pedido.montagemConcluidaPor}</strong> · {carimbo(pedido.montagemConcluidaEm)}
            {expedido && (
              <>
                <br />
                <Truck className="mr-1 inline h-4 w-4" />
                Expedido por <strong>{pedido.expedidoPor}</strong> · {carimbo(pedido.expedidoEm)}
              </>
            )}
          </p>
          <FotosUpload titulo="Fotos do pedido" descricao="Pedido montado/embalado." fotos={pedido.imagensExpedicao || []} onChange={salvarFotos("imagensExpedicao")} />
          <FotosUpload titulo="Fotos da transportadora" descricao="Coleta, entrega na transportadora ou comprovante." fotos={pedido.imagensTransportadora || []} onChange={salvarFotos("imagensTransportadora")} />
        </div>
      )}

      {!expedido && conferidos > 0 && (
        <button type="button" onClick={desfazer} className="mt-4 inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
          <Undo2 className="h-4 w-4" /> Desfazer montagem
        </button>
      )}

      {!expedido && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-4xl">
            {!concluida ? (
              <Button
                size="lg"
                variant="success"
                className="w-full"
                disabled={!completo}
                loading={acao === "concluir"}
                onClick={() => executar("concluir", () => api.post(`/expedicao/${pedido.id}/concluir-montagem`, { observacoes: obs }), "Montagem concluída")}
              >
                <PackageCheck className="h-5 w-5" />
                {completo ? "Concluir montagem" : `Confira todos os itens (${conferidos}/${total})`}
              </Button>
            ) : (
              <Button size="lg" variant="success" className="w-full" loading={acao === "expedir"} onClick={expedir}>
                <Truck className="h-5 w-5" /> Expedir pedido
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
