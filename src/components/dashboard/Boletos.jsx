import { useEffect, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, MetricCard, PeriodoPicker, Segmented, Skeleton, Table, Td, Textarea, Th, useToast } from "../ui";
import SelectBanco from "../pedido/SelectBanco";
import { contemTexto, data, hojeISO, inicioMesISO, moeda } from "../../utils/format";

const fimDoMes = () => {
  const [ano, mes] = hojeISO().split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
};

// Confirma o recebimento de um boleto: a parcela de boleto ou, sem parcela,
// o saldo do pedido (só o financeiro; não libera a expedição).
function ConfirmarBoleto({ linha, onFechar, onFeito }) {
  const [dataRec, setDataRec] = useState(hojeISO());
  const [banco, setBanco] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();

  const confirmar = async () => {
    setEnviando(true);
    try {
      if (linha.parcelaId) {
        await api.put(`/pedidos/${linha.pedidoId}/parcelas/${linha.parcelaId}`, { acao: "CONFIRMAR", metodoRecebido: "BOLETO", recebidaEm: dataRec, banco: banco || undefined, observacao: observacao || undefined });
      } else {
        await api.post(`/pedidos/${linha.pedidoId}/confirmar-pagamento`, { metodo: "BOLETO", data: dataRec, banco: banco || undefined, observacao, liberar: false });
      }
      toast({ titulo: "Boleto confirmado", descricao: `Pedido ${linha.numeroFormatado} · ${moeda(linha.valor)}` });
      onFeito();
    } catch (error) {
      toast({ titulo: "Não foi possível confirmar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Confirmar boleto · Pedido ${linha.numeroFormatado}`}
      descricao={`${linha.clienteNome} · ${moeda(linha.valor)}${linha.parcelaNumero ? ` (parcela ${linha.parcelaNumero})` : ""} · venc. ${data(linha.vencimento)}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="success" loading={enviando} onClick={confirmar}>
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data do pagamento">
            <Input type="date" value={dataRec} onChange={(e) => setDataRec(e.target.value)} />
          </Field>
          <Field label="Banco que recebeu" dica="Use o + para cadastrar outro banco">
            <SelectBanco value={banco} onChange={setBanco} />
          </Field>
        </div>
        <Field label="Observação (opcional)">
          <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Field>
        <p className="text-xs text-muted-foreground">Registra o recebimento como Boleto. Quando o pedido fica todo pago, ele sai desta lista. A expedição não é alterada.</p>
      </div>
    </Dialog>
  );
}

// Financeiro → Boletos: boletos ainda não pagos, pelo vencimento (padrão: o
// mês atual) ou pela data do pedido.
export default function Boletos() {
  const [periodo, setPeriodo] = useState({ inicio: inicioMesISO(), fim: fimDoMes() });
  const [por, setPor] = useState("vencimento");
  const [busca, setBusca] = useState("");
  const [d, setD] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [recarregar, setRecarregar] = useState(0);
  const toast = useToast();

  useEffect(() => {
    setD(null);
    api
      .get("/dashboard/boletos", { params: { ...periodo, por } })
      .then(({ data: r }) => setD(r))
      .catch((e) => {
        toast({ titulo: "Erro ao carregar boletos", descricao: mensagemErro(e), tipo: "erro" });
        setD({ linhas: [], total: 0, vencidos: 0, pedidos: 0 });
      });
  }, [periodo, por, recarregar, toast]);

  const linhas = (d?.linhas || []).filter((l) => !busca || contemTexto(`${l.numeroFormatado} ${l.numero} ${l.clienteNome}`, busca));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodoPicker inicio={periodo.inicio} fim={periodo.fim} onChange={setPeriodo} />
        <Segmented value={por} onChange={setPor} opcoes={[{ value: "vencimento", label: "Pelo vencimento" }, { value: "pedido", label: "Pela data do pedido" }]} />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Pedido ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pedidos com boleto aguardando confirmação do pagamento. Parcelas de boleto contam pelo vencimento de cada uma; pedido em boleto sem parcela usa a data do pedido.
      </p>
      {!d ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard className="border-red-200! bg-red-50!" titulo="Boletos aguardando" valor={moeda(d.total)} detalhe={`${d.linhas.length} ${d.linhas.length === 1 ? "boleto" : "boletos"} de ${d.pedidos} ${d.pedidos === 1 ? "pedido" : "pedidos"}`} />
            <MetricCard titulo="Já vencidos" valor={moeda(d.vencidos)} detalhe="Vencimento antes de hoje" />
            <MetricCard titulo="A vencer" valor={moeda(d.total - d.vencidos)} />
          </div>
          {!linhas.length ? (
            <EmptyState icon={CheckCircle2} titulo="Nenhum boleto aguardando" descricao="Não há boleto em aberto neste período." />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    {["Pedido", "Cliente", "Data do pedido", "Vencimento", "Valor do boleto", "Total do pedido", ""].map((c) => (
                      <Th key={c}>{c}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={`${l.pedidoId}-${l.parcelaId || "saldo"}`} className="hover:bg-muted/40">
                      <Td className="font-semibold">
                        {l.numeroFormatado}
                        {l.parcelaNumero && <span className="block text-xs font-normal text-muted-foreground">parcela {l.parcelaNumero}</span>}
                      </Td>
                      <Td className="text-left">{l.clienteNome}</Td>
                      <Td>{data(l.dataPedido)}</Td>
                      <Td>
                        <span className={l.vencido ? "font-semibold text-red-700" : ""}>{data(l.vencimento)}</span>
                        {l.vencido && <Badge variant="danger" className="ml-1">Vencido</Badge>}
                        {l.semVencimento && <span className="block text-xs text-muted-foreground">sem parcela (data do pedido)</span>}
                      </Td>
                      <Td className="font-semibold">{moeda(l.valor)}</Td>
                      <Td>{moeda(l.totalPedido)}</Td>
                      <Td>
                        <Button size="sm" variant="success" onClick={() => setConfirmando(l)}>
                          <CheckCircle2 className="h-4 w-4" /> Marcar como pago
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}
      {confirmando && (
        <ConfirmarBoleto
          linha={confirmando}
          onFechar={() => setConfirmando(null)}
          onFeito={() => {
            setConfirmando(null);
            setRecarregar((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
