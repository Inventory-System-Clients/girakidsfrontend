import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Eye,
  FileDown,
  FileText,
  HandCoins,
  ListChecks,
  Pencil,
  Plus,
  Truck,
  Undo2,
  Upload,
  Send,
} from "lucide-react";
import api, { enviarArquivo, mensagemErro } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Badge, Button, Checkbox, Dialog, Field, Input, RowMenu, Select, Textarea, useConfirm, useToast } from "../ui";
import PedidoDetalhes from "./PedidoDetalhes";
import SeletorTransportadora from "../checkout/SeletorTransportadora";
import { FotosUpload } from "./Fotos";
import { NovoCustoDialog } from "../../pages/comercial/CustosPosVenda";
import { EditorMescla } from "../../pages/Checkout";
import { data, hojeISO, lerNumero, moeda } from "../../utils/format";
import { FORMAS_PAGAMENTO, METODOS_ENVIO, nomeForma } from "../../utils/status";
import { gerarPdfPedido } from "../../utils/pdf";

const FORMAS = Object.keys(FORMAS_PAGAMENTO);

const SelectForma = ({ value, onChange, incluirMescla = false }) => (
  <Select value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Selecione o método</option>
    {FORMAS.filter((f) => incluirMescla || f !== "MESCLA").map((f) => (
      <option key={f} value={f}>
        {FORMAS_PAGAMENTO[f].label}
      </option>
    ))}
  </Select>
);

// Liberar para expedição / confirmar pagamento / quitar pendência.
function LiberarDialog({ pedido, modo, onFechar, onFeito }) {
  const [observacao, setObservacao] = useState("");
  const [metodo, setMetodo] = useState(pedido.formaPagamento === "A_DEFINIR" ? "" : pedido.formaPagamento);
  const [dataRec, setDataRec] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const liberar = modo === "liberar";
  const quitar = pedido.pendenciaStatus === "ABERTA";

  const enviar = async () => {
    setEnviando(true);
    try {
      const { data: d } = liberar
        ? await api.post(`/pedidos/${pedido.id}/liberar`, { observacao })
        : await api.post(`/pedidos/${pedido.id}/confirmar-pagamento`, { observacao, metodo: metodo || undefined, data: dataRec });
      toast({ titulo: liberar ? "Pedido liberado para expedição" : quitar ? "Pendência quitada" : "Pagamento confirmado" });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Não foi possível concluir", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`${liberar ? "Liberar para expedição" : quitar ? "Quitar pendência" : "Confirmar pagamento"} · Pedido ${pedido.numeroFormatado}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant={liberar ? "info" : "success"} loading={enviando} onClick={enviar}>
            {liberar ? "Liberar para expedição" : quitar ? "Quitar pendência" : "Confirmar pagamento"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Entrega: </span>
            <strong>{METODOS_ENVIO[pedido.metodoEnvio] || "A definir"}</strong>
            {pedido.metodoEnvio === "TRANSPORTADORA" && (
              <>
                {" · "}
                <strong className="text-sky-700">{pedido.transportadoraNome || "transportadora ainda não escolhida"}</strong>
              </>
            )}
          </p>
          {(pedido.transportadoraCotacao || pedido.transportadoraCotacaoCom) && (
            <p className="text-xs text-muted-foreground">
              Cotação{pedido.transportadoraCotacao && ` nº ${pedido.transportadoraCotacao}`}
              {pedido.transportadoraCotacaoCom && ` com ${pedido.transportadoraCotacaoCom}`}
            </p>
          )}
          {pedido.transportadoraObs && <p className="text-xs text-muted-foreground">Obs.: {pedido.transportadoraObs}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-muted-foreground">Total do pedido</span>
          <span className="text-right font-semibold">{moeda(pedido.total)}</span>
          <span className="text-muted-foreground">Já recebido</span>
          <span className="text-right">{moeda(pedido.totalRecebido)}</span>
          <span className="text-muted-foreground">Saldo em aberto</span>
          <span className="text-right font-semibold text-primary">{moeda(pedido.total - pedido.totalRecebido)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {liberar
            ? pedido.statusFinanceiro === "PAGO"
              ? "O estoque será reservado agora e o pedido ficará disponível para montagem pela expedição."
              : "O estoque será reservado agora e o pedido ficará disponível para montagem pela expedição. O saldo fica como recebimento manual em aberto para o Time Financeiro."
            : pedido.statusVendas === "AGUARDANDO"
              ? "Ao confirmar, o pagamento é registrado e o pedido é liberado para a expedição (o estoque é reservado)."
              : quitar
                ? "A reserva de estoque já foi feita; agora será quitada apenas a pendência financeira."
                : "Ao confirmar, apenas o status financeiro do pedido será atualizado. A expedição não será alterada."}
        </p>
        {!liberar && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Método recebido">
              <SelectForma value={metodo} onChange={setMetodo} />
            </Field>
            <Field label="Data do recebimento">
              <Input type="date" value={dataRec} onChange={(e) => setDataRec(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label={`${liberar ? "Observação da liberação" : "Observação da quitação"} (opcional)`} dica="Pode deixar em branco">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function RecebimentoDialog({ pedido, onFechar, onFeito }) {
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState("");
  const [dataRec, setDataRec] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const saldo = pedido.total - pedido.totalRecebido;
  const abertas = pedido.parcelas.some((p) => p.status === "ABERTA");

  const enviar = async () => {
    setEnviando(true);
    try {
      const { data: d } = await api.post(`/pedidos/${pedido.id}/recebimentos`, { valor: lerNumero(valor), metodo, data: dataRec, observacao });
      toast({ titulo: "Recebimento registrado" });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro ao registrar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Registrar recebimento · Pedido ${pedido.numeroFormatado}`}
      descricao="Lance apenas o valor que o cliente pagou agora. O sistema acumula os recebimentos e mantém o valor-alvo do pedido separado das parcelas."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={enviando} disabled={abertas || saldo <= 0 || !metodo || lerNumero(valor) <= 0} onClick={enviar}>
            Registrar recebimento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-muted-foreground">Já recebido</span>
          <span className="text-right">{moeda(pedido.totalRecebido)}</span>
          <span className="text-muted-foreground">Saldo em aberto</span>
          <span className="text-right font-semibold">{moeda(saldo)}</span>
        </div>
        {abertas && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Este pedido possui parcelas em aberto. Confirme a próxima parcela no fluxo de parcelas para não contar o mesmo pagamento duas vezes.</p>}
        {saldo <= 0 && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">O valor-alvo já foi alcançado. Não há saldo para novo lançamento.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor recebido agora">
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Método usado">
            <SelectForma value={metodo} onChange={setMetodo} />
          </Field>
          <Field label="Data do recebimento">
            <Input type="date" value={dataRec} onChange={(e) => setDataRec(e.target.value)} />
          </Field>
        </div>
        <Field label="Observação (opcional)">
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pagamento referente à primeira parcela" />
        </Field>
      </div>
    </Dialog>
  );
}

function ParcelasDialog({ pedido: inicial, onFechar, onFeito }) {
  const [pedido, setPedido] = useState(inicial);
  const [nova, setNova] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const toast = useToast();
  const comprometido = pedido.parcelas.filter((p) => p.status !== "CANCELADA").reduce((s, p) => s + p.valor, 0);
  const disponivel = pedido.total - comprometido;

  const executar = async (fn, sucesso) => {
    try {
      const { data: d } = await fn();
      setPedido(d);
      onFeito(d, false);
      toast({ titulo: sucesso });
      return true;
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
      return false;
    }
  };

  return (
    <Dialog aberto onFechar={onFechar} tamanho="lg" titulo={`Controle de parcelas · Pedido ${pedido.numeroFormatado}`} descricao="O valor-alvo é o limite do pedido; parcelas abertas apenas reservam a parte que ainda será recebida.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total do pedido", pedido.total],
            ["Total recebido", pedido.totalRecebido],
            ["Saldo em aberto", pedido.total - pedido.totalRecebido],
            ["Disponível para novas parcelas", disponivel],
          ].map(([r, v]) => (
            <div key={r} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">{r}</p>
              <p className="font-semibold">{moeda(v)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {pedido.parcelas.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="font-semibold">Parcela {p.numero}</span>
              <span>{moeda(p.valor)}</span>
              <span className="text-muted-foreground">
                {nomeForma(p.metodoRecebido || p.metodoPrevisto)} · venc. {data(p.vencimento)}
              </span>
              <Badge variant={p.status === "RECEBIDA" ? "success" : p.status === "CANCELADA" ? "default" : "warning"}>
                {p.status === "RECEBIDA" ? `Recebida em ${data(p.recebidaEm)}` : p.status === "CANCELADA" ? "Cancelada" : "Em aberto"}
              </Badge>
              {p.status === "ABERTA" && (
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="success" onClick={() => setConfirmando({ parcela: p, metodo: p.metodoPrevisto || "", data: hojeISO() })}>
                    Confirmar parcela
                  </Button>
                  <Button size="sm" variant="danger-outline" onClick={() => executar(() => api.put(`/pedidos/${pedido.id}/parcelas/${p.id}`, { acao: "CANCELAR" }), "Parcela cancelada")}>
                    Cancelar
                  </Button>
                </span>
              )}
            </div>
          ))}
          {!pedido.parcelas.length && <p className="text-sm text-muted-foreground">Nenhuma parcela cadastrada.</p>}
        </div>
        {confirmando && (
          <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-[1fr_10rem_auto]">
            <Field label={`Método recebido (parcela ${confirmando.parcela.numero})`}>
              <SelectForma value={confirmando.metodo} onChange={(m) => setConfirmando({ ...confirmando, metodo: m })} />
            </Field>
            <Field label="Data do recebimento">
              <Input type="date" value={confirmando.data} onChange={(e) => setConfirmando({ ...confirmando, data: e.target.value })} />
            </Field>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Voltar
              </Button>
              <Button
                variant="success"
                onClick={async () => {
                  const ok = await executar(
                    () => api.put(`/pedidos/${pedido.id}/parcelas/${confirmando.parcela.id}`, { acao: "CONFIRMAR", metodoRecebido: confirmando.metodo, recebidaEm: confirmando.data }),
                    "Parcela confirmada",
                  );
                  if (ok) setConfirmando(null);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
        {nova ? (
          <div className="grid gap-3 rounded-lg border border-border bg-slate-50 p-3 sm:grid-cols-4">
            <Field label="Valor da parcela" dica={`Você pode distribuir até ${moeda(disponivel)}`}>
              <Input value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
            </Field>
            <Field label="Método previsto">
              <SelectForma value={nova.metodoPrevisto} onChange={(m) => setNova({ ...nova, metodoPrevisto: m })} />
            </Field>
            <Field label="Vencimento">
              <Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} />
            </Field>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setNova(null)}>
                Cancelar inclusão
              </Button>
              <Button
                onClick={async () => {
                  const ok = await executar(() => api.post(`/pedidos/${pedido.id}/parcelas`, { ...nova, valor: lerNumero(nova.valor) }), "Parcela adicionada");
                  if (ok) setNova(null);
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" disabled={disponivel <= 0.009 || pedido.statusVendas === "CANCELADO"} onClick={() => setNova({ valor: disponivel.toFixed(2).replace(".", ","), metodoPrevisto: "BOLETO", vencimento: hojeISO() })}>
            <Plus className="h-4 w-4" /> {disponivel <= 0.009 ? "O valor-alvo já está totalmente distribuído" : "Adicionar parcela"}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function FormaPagamentoDialog({ pedido, onFechar, onFeito }) {
  const [forma, setForma] = useState(pedido.formaPagamento);
  const [parcelas, setParcelas] = useState(pedido.parcelasCartao || 1);
  const [mescla, setMescla] = useState(
    pedido.composicaoPagamento?.map((l) => ({ ...l, valor: String(l.valor).replace(".", ",") })) || [{ metodo: "PIX_PRESENCIAL", valor: "", vencimento: hojeISO() }],
  );
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const cartao = ["CREDITO_ONLINE", "CREDITO_LINK", "LINK_PAGAMENTO", "MAQUININHA"].includes(forma);

  const enviar = async () => {
    setEnviando(true);
    try {
      const { data: d } = await api.put(`/pedidos/${pedido.id}/forma-pagamento`, {
        formaPagamento: forma,
        parcelasCartao: cartao ? parcelas : null,
        composicaoPagamento: forma === "MESCLA" ? mescla.map((l) => ({ ...l, valor: lerNumero(l.valor) })) : null,
        motivo,
      });
      toast({ titulo: "Forma de pagamento alterada", descricao: `Novo total: ${moeda(d.total)}` });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro ao alterar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Alterar forma de pagamento · Pedido ${pedido.numeroFormatado}`}
      descricao="Esta alteração não confirma o recebimento nem altera a expedição. Taxas são recalculadas pela nova forma."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={enviando} disabled={!forma} onClick={enviar}>
            Salvar correção
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">
          Método atual: <strong>{nomeForma(pedido.formaPagamento)}</strong> · Total atual: <strong>{moeda(pedido.total)}</strong>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Novo método">
            <SelectForma value={forma} onChange={setForma} incluirMescla />
          </Field>
          {cartao && (
            <Field label="Parcelas">
              <Select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "À vista" : `${n}x`}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {forma === "MESCLA" && (
          <>
            <p className="text-sm text-muted-foreground">Informe como o total será dividido. Cada forma pode ter seu próprio vencimento.</p>
            <EditorMescla linhas={mescla} onChange={setMescla} total={pedido.total} formas={FORMAS} />
          </>
        )}
        <Field label="Motivo (opcional)">
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

// Escolhe/troca a transportadora com as mesmas sugestões do checkout (as que
// atendem a UF do cliente), mais nº da cotação e com quem foi cotado.
function TransportadoraDialog({ pedido, onFechar, onFeito }) {
  const [selecionada, setSelecionada] = useState(pedido.transportadoraId ? { id: pedido.transportadoraId, nome: pedido.transportadoraNome } : null);
  const [obs, setObs] = useState(pedido.transportadoraObs || "");
  const [cotacao, setCotacao] = useState({ numero: pedido.transportadoraCotacao || "", com: pedido.transportadoraCotacaoCom || "" });
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: d } = await api.put(`/pedidos/${pedido.id}/transportadora`, {
        transportadora: selecionada,
        observacoes: obs,
        cotacao: cotacao.numero,
        cotacaoCom: cotacao.com,
      });
      toast({ titulo: selecionada ? "Transportadora atualizada" : "Transportadora removida do pedido" });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`${pedido.transportadoraNome ? "Alterar" : "Escolher"} transportadora · Pedido ${pedido.numeroFormatado}`}
      descricao={`Transportadoras que atendem ${pedido.cidade ? `${pedido.cidade}/` : ""}${pedido.estado || "o endereço do cliente"}. Nº da cotação e contato são opcionais.`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <SeletorTransportadora
        uf={pedido.estado}
        cidade={pedido.cidade}
        pesoGramas={pedido.pesoTotalGramas}
        selecionada={selecionada}
        onSelecionar={setSelecionada}
        observacao={obs}
        onObservacao={setObs}
        cotacao={cotacao}
        onCotacao={setCotacao}
      />
    </Dialog>
  );
}

function NotaFiscalDialog({ pedido, onFechar, onFeito }) {
  const [numero, setNumero] = useState(pedido.notaFiscalNumero || "");
  const [url, setUrl] = useState(pedido.notaFiscalUrl || "");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const anexar = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      setUrl(await enviarArquivo(arquivo, "notas"));
    } catch (error) {
      toast({ titulo: "Erro ao enviar arquivo", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  const salvar = async () => {
    try {
      const { data: d } = await api.put(`/pedidos/${pedido.id}/nota-fiscal`, { numero, url });
      toast({ titulo: "Nota fiscal salva" });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Nota fiscal · Pedido ${pedido.numeroFormatado}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={enviando}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Número da nota">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </Field>
        <Field label="Arquivo (PDF ou imagem)">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> {enviando ? "Enviando..." : url ? "Substituir arquivo" : "Selecionar arquivo"}
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => anexar(e.target.files?.[0])} />
          </label>
        </Field>
        {url && (
          <a className="text-sm text-primary underline" href={url} target="_blank" rel="noreferrer">
            Abrir arquivo anexado
          </a>
        )}
      </div>
    </Dialog>
  );
}

function ExpedirDialog({ pedido, onFechar, onFeito }) {
  const [fotosPedido, setFotosPedido] = useState(pedido.imagensExpedicao || []);
  const [fotosTransportadora, setFotosTransportadora] = useState(pedido.imagensTransportadora || []);
  const [obs, setObs] = useState(pedido.observacoesExpedicao || "");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const confirmar = async () => {
    setEnviando(true);
    try {
      const { data: d } = await api.post(`/expedicao/${pedido.id}/expedir`, {
        imagensExpedicao: fotosPedido,
        imagensTransportadora: fotosTransportadora,
        observacoes: obs,
      });
      toast({ titulo: "Pedido expedido com sucesso" });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro ao expedir pedido", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Expedir pedido ${pedido.numeroFormatado}`}
      descricao="Anexe as fotos do pedido e da transportadora (câmera ou galeria, várias de cada) e as observações da expedição."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="success" loading={enviando} onClick={confirmar}>
            Confirmar Expedição
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FotosUpload titulo="Fotos do pedido" descricao="Pedido montado/embalado." fotos={fotosPedido} onChange={setFotosPedido} />
        <FotosUpload titulo="Fotos da transportadora" descricao="Coleta, entrega na transportadora ou comprovante." fotos={fotosTransportadora} onChange={setFotosTransportadora} />
        <Field label="Observações da expedição">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações sobre a expedição..." />
        </Field>
      </div>
    </Dialog>
  );
}

function EditarPedidoDialog({ pedido, onFechar, onFeito }) {
  const [itens, setItens] = useState(pedido.itens.map((i) => ({ produtoId: i.produtoId, nome: i.nome, quantidade: i.quantidade, precoUnitario: String(i.precoUnitario).replace(".", ","), unidades: i.unidadesPacote })));
  const [desconto, setDesconto] = useState(String(pedido.desconto).replace(".", ","));
  const [frete, setFrete] = useState(String(pedido.frete).replace(".", ","));
  const [adicional, setAdicional] = useState(String(pedido.freteAdicional).replace(".", ","));
  const [obs, setObs] = useState(pedido.observacoes || "");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (busca.length < 2) return setResultados([]);
    const t = setTimeout(() => api.get("/produtos/busca", { params: { busca } }).then(({ data: d }) => setResultados(d)), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const salvar = async () => {
    setEnviando(true);
    try {
      const { data: d } = await api.put(`/pedidos/${pedido.id}`, {
        itens: itens.filter((i) => i.produtoId && Number(i.quantidade) > 0).map((i) => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade), precoUnitario: lerNumero(i.precoUnitario) })),
        desconto: lerNumero(desconto),
        frete: lerNumero(frete),
        freteAdicional: lerNumero(adicional),
        observacoes: obs,
      });
      toast({ titulo: "Pedido atualizado", descricao: `Novo total: ${moeda(d.total)}` });
      onFeito(d);
    } catch (error) {
      toast({ titulo: "Erro ao editar pedido", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={`Editar pedido ${pedido.numeroFormatado}`}
      descricao={pedido.estoqueBaixado ? "O estoque reservado será ajustado automaticamente." : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={enviando} onClick={salvar}>
            Salvar alterações
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left">Produto</th>
              <th>Emb.</th>
              <th>Preço un.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((i, idx) => (
              <tr key={idx} className="border-t border-border/60">
                <td className="py-2">{i.nome}</td>
                <td className="w-20">
                  <Input className="h-8 text-center" value={i.quantidade} onChange={(e) => setItens(itens.map((x, j) => (j === idx ? { ...x, quantidade: e.target.value.replace(/\D/g, "") } : x)))} />
                </td>
                <td className="w-28">
                  <Input className="h-8 text-right" value={i.precoUnitario} onChange={(e) => setItens(itens.map((x, j) => (j === idx ? { ...x, precoUnitario: e.target.value } : x)))} />
                </td>
                <td className="w-10 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setItens(itens.filter((_, j) => j !== idx))} aria-label="Remover">
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="relative">
          <Input placeholder="Adicionar produto: buscar por nome ou SKU..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {resultados.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setItens([...itens, { produtoId: p.id, nome: p.nome, quantidade: 1, precoUnitario: String(p.precoVenda).replace(".", ","), unidades: p.unidadesPacote }]);
                    setBusca("");
                  }}
                >
                  {p.nome} <span className="text-muted-foreground">· SKU {p.sku} · estoque {p.estoque}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Desconto">
            <Input value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </Field>
          <Field label="Frete">
            <Input value={frete} onChange={(e) => setFrete(e.target.value)} />
          </Field>
          <Field label="Custo adicional">
            <Input value={adicional} onChange={(e) => setAdicional(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

// Menu de ações da linha + diálogos. contexto: "vendas" | "orcamento" |
// "expedicao" | "leitura".
export default function AcoesPedido({ pedido, contexto = "vendas", onAtualizado }) {
  const { pode } = useAuth();
  const navigate = useNavigate();
  const confirmar = useConfirm();
  const toast = useToast();
  const [dialogo, setDialogo] = useState(null);
  const [verId, setVerId] = useState(null);

  const feito = (d, fechar = true) => {
    onAtualizado?.(d);
    if (fechar) setDialogo(null);
  };

  const baixarPdf = async () => {
    const { data: d } = await api.get(`/pedidos/${pedido.id}`);
    gerarPdfPedido(d);
  };

  const comCompleto = async (nome) => {
    const { data: d } = await api.get(`/pedidos/${pedido.id}`);
    setDialogo({ nome, pedido: d });
  };

  const cancelar = async () => {
    const motivo = await confirmar({
      titulo: `Cancelar pedido ${pedido.numeroFormatado}?`,
      mensagem: "O pedido será cancelado e o estoque reservado será devolvido.",
      confirmar: "Cancelar Pedido",
      cancelar: "Voltar",
      perigo: true,
      campo: { label: "Motivo do cancelamento", obrigatorio: true },
    });
    if (!motivo) return;
    try {
      const { data: d } = await api.post(`/pedidos/${pedido.id}/cancelar`, { motivo });
      toast({ titulo: "Pedido cancelado com sucesso", descricao: "O pedido foi cancelado e o estoque foi restaurado quando necessário." });
      feito(d);
    } catch (error) {
      toast({ titulo: "Erro ao cancelar o pedido", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const gerarPedido = async () => {
    const ok = await confirmar({ titulo: `Gerar pedido do orçamento ${pedido.numeroFormatado}?`, mensagem: "Um novo pedido será criado com os mesmos itens, cliente, entrega e pagamento." });
    if (!ok) return;
    try {
      const { data: d } = await api.post(`/orcamentos/${pedido.id}/gerar-pedido`);
      toast({ titulo: "Pedido gerado", descricao: `Pedido ${d.numeroFormatado} criado a partir do orçamento.` });
      feito(d);
    } catch (error) {
      toast({ titulo: "Erro ao gerar pedido", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const desfazer = async () => {
    const ok = await confirmar({ titulo: "Desfazer montagem?", mensagem: "Todos os itens voltam para não conferidos e o pedido volta para 'Iniciar Montagem'.", perigo: true, confirmar: "Desfazer" });
    if (!ok) return;
    try {
      const { data: d } = await api.post(`/expedicao/${pedido.id}/desfazer`);
      toast({ titulo: "Montagem desfeita" });
      feito(d);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const ativo = pedido.statusVendas !== "CANCELADO";
  const expedido = pedido.statusExpedicao === "EXPEDIDO";
  const financeiro = pode("VENDAS", "FINANCEIRO");
  const itens =
    contexto === "orcamento"
      ? [
          { label: "Ver orçamento", icone: Eye, onClick: () => setVerId(pedido.id) },
          { label: "Baixar PDF", icone: FileDown, onClick: baixarPdf },
          pode("VENDAS") && !pedido.pedidoGeradoId && { label: "Gerar pedido", icone: Send, onClick: gerarPedido },
        ]
      : contexto === "expedicao"
        ? [
            { label: "Ver pedido", icone: Eye, onClick: () => setVerId(pedido.id) },
            { label: "Baixar PDF", icone: FileDown, onClick: baixarPdf },
            { label: expedido ? "Ver montagem e fotos" : "Montar pedido", icone: ListChecks, onClick: () => navigate(`/expedicao/${pedido.id}`) },
            pedido.checklist?.conferidos > 0 && !expedido && { label: "Desfazer montagem", icone: Undo2, onClick: desfazer },
            !expedido && { label: "Expedir", icone: Truck, disabled: !pedido.checklist?.completo, onClick: () => comCompleto("expedir") },
            { label: "Alterar transportadora", icone: Truck, onClick: () => comCompleto("transportadora") },
            { label: "Nota fiscal", icone: FileText, onClick: () => comCompleto("nota") },
          ]
        : [
            { label: "Ver pedido", icone: Eye, onClick: () => setVerId(pedido.id) },
            { label: "Baixar PDF", icone: FileDown, onClick: baixarPdf },
            contexto === "vendas" && ativo && !expedido && pode("VENDAS") && { label: "Editar pedido", icone: Pencil, onClick: () => comCompleto("editar") },
            contexto === "vendas" && ativo && pedido.statusVendas === "AGUARDANDO" && financeiro && { label: "Liberar para expedição", icone: ClipboardCheck, cor: "font-semibold text-blue-700 hover:bg-blue-50", onClick: () => comCompleto("liberar") },
            contexto === "vendas" && ativo && pedido.statusFinanceiro === "AGUARDANDO_PAGAMENTO" && financeiro && {
              label: pedido.pendenciaStatus === "ABERTA" ? "Quitar pendência" : "Confirmar pagamento",
              icone: CheckCircle2,
              cor: "font-semibold text-emerald-700 hover:bg-emerald-50",
              onClick: () => comCompleto("pagar"),
            },
            contexto === "vendas" && ativo && pedido.statusFinanceiro === "AGUARDANDO_PAGAMENTO" && financeiro && { label: "Registrar recebimento", icone: HandCoins, onClick: () => comCompleto("recebimento") },
            contexto === "vendas" && ativo && financeiro && { label: "Controle de parcelas", icone: ListChecks, onClick: () => comCompleto("parcelas") },
            contexto === "vendas" && ativo && financeiro && { label: "Alterar forma de pagamento", icone: CreditCard, onClick: () => comCompleto("forma") },
            contexto === "vendas" && ativo && { label: "Alterar transportadora", icone: Truck, onClick: () => comCompleto("transportadora") },
            contexto === "vendas" && ativo && { label: "Nota fiscal", icone: FileText, onClick: () => comCompleto("nota") },
            contexto === "vendas" && ativo && pode("COMERCIAL", "FINANCEIRO", "VENDAS") && { label: "Custo pós-venda", icone: HandCoins, onClick: () => setDialogo({ nome: "custo", pedido }) },
            contexto === "vendas" && ativo && !expedido && pode("VENDAS") && { label: "Cancelar Pedido", icone: Ban, perigo: true, onClick: cancelar },
          ];

  const props = { pedido: dialogo?.pedido, onFechar: () => setDialogo(null), onFeito: feito };
  return (
    <>
      <RowMenu itens={itens} />
      <PedidoDetalhes pedidoId={verId} onFechar={() => setVerId(null)} />
      {dialogo?.nome === "liberar" && <LiberarDialog {...props} modo="liberar" />}
      {dialogo?.nome === "pagar" && <LiberarDialog {...props} modo="pagar" />}
      {dialogo?.nome === "recebimento" && <RecebimentoDialog {...props} />}
      {dialogo?.nome === "parcelas" && <ParcelasDialog {...props} />}
      {dialogo?.nome === "forma" && <FormaPagamentoDialog {...props} />}
      {dialogo?.nome === "transportadora" && <TransportadoraDialog {...props} />}
      {dialogo?.nome === "nota" && <NotaFiscalDialog {...props} />}
      {dialogo?.nome === "expedir" && <ExpedirDialog {...props} />}
      {dialogo?.nome === "editar" && <EditarPedidoDialog {...props} />}
      {dialogo?.nome === "custo" && <NovoCustoDialog pedido={dialogo.pedido} onFechar={() => setDialogo(null)} onSalvo={() => setDialogo(null)} />}
    </>
  );
}
