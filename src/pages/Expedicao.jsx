import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageOpen, Search } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { Button, Card, FiltroMulti, PageHeader, Paginacao, Skeleton, Table, Tabs, Td, Th, useToast } from "../components/ui";
import AcoesPedido from "../components/pedido/AcoesPedido";
import { CelulaData, CelulaEnvio, CelulaExpedicao, CelulaNumero } from "../components/pedido/StatusCelulas";
import { data } from "../utils/format";
import { METODOS_ENVIO } from "../utils/status";

const ABAS = [
  { value: "INICIAR", label: "Iniciar Montagem" },
  { value: "MONTAGEM", label: "Em montagem" },
  { value: "PRONTOS", label: "Prontos para expedir" },
  { value: "TODOS", label: "Todos" },
];

// Miniaturas dos itens do pedido (até 4 + contador).
function MiniaturasItens({ itens }) {
  const visiveis = itens.slice(0, 4);
  return (
    <span className="inline-flex items-center gap-1">
      {visiveis.map((i) => (
        <span key={i.id} className="h-9 w-9 overflow-hidden rounded-md border border-border bg-muted" title={i.nome}>
          {i.imagemUrl && <img src={i.imagemUrl} alt="" className="h-full w-full object-cover" />}
        </span>
      ))}
      {itens.length > 4 && <span className="text-xs text-muted-foreground">+{itens.length - 4}</span>}
    </span>
  );
}

const textoBotao = (p) => (p.statusExpedicao === "EXPEDIDO" ? "Ver montagem" : p.montagemConcluidaEm ? "Expedir" : p.checklist.conferidos ? "Continuar montagem" : "Montar pedido");

export default function Expedicao() {
  const toast = useToast();
  const navigate = useNavigate();
  const [aba, setAba] = useState("INICIAR");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [expedicao, setExpedicao] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(30);
  const [dados, setDados] = useState(null);

  const carregar = useCallback(() => {
    api
      .get("/expedicao", { params: { aba, busca: buscaAplicada || undefined, expedicao: aba === "TODOS" && expedicao.length ? expedicao.join(",") : undefined, pagina, limite } })
      .then(({ data: d }) => setDados(d))
      .catch((e) => {
        toast({ titulo: "Erro ao carregar", descricao: mensagemErro(e), tipo: "erro" });
        setDados({ itens: [], total: 0, pagina: 1, paginas: 1 });
      });
  }, [aba, buscaAplicada, expedicao, pagina, limite, toast]);

  useEffect(carregar, [carregar]);
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const abrir = (p) => navigate(`/expedicao/${p.id}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        titulo="Time de expedição"
        subtitulo="Toque no pedido para montar: confira cada item, conclua a montagem e expeça com as fotos."
        extra={dados?.pendentes != null && <p className="mt-1 text-sm font-medium text-primary">{dados.pendentes} pedidos aguardando expedição</p>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          abas={ABAS.map((a) => ({ ...a, contador: dados?.contadores?.[a.value] }))}
          ativa={aba}
          onChange={(v) => {
            setAba(v);
            setPagina(1);
          }}
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar pedido ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {aba === "TODOS" && (
          <FiltroMulti titulo="Time Expedição" opcoes={{ NAO_INICIADO: "Não iniciado", MONTAGEM: "Em montagem", EXPEDIDO: "Expedido" }} valores={expedicao} onChange={setExpedicao} />
        )}
      </div>

      {/* Celular: cartões grandes, fáceis de tocar no estoque. */}
      <div className="space-y-3 md:hidden">
        {!dados && <Skeleton className="h-40" />}
        {dados?.itens.map((p) => (
          <Card key={p.id} className="p-4" onClick={() => abrir(p)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  Pedido {p.numeroFormatado} · {p.clienteNome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data(p.createdAt)} · {METODOS_ENVIO[p.metodoEnvio] || "Entrega a definir"}
                  {p.transportadoraNome && <span className="font-medium text-sky-700"> · {p.transportadoraNome}</span>}
                </p>
              </div>
              <span onClick={(e) => e.stopPropagation()}>
                <AcoesPedido pedido={p} contexto="expedicao" onAtualizado={carregar} />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <MiniaturasItens itens={p.itens} />
              <span className={p.checklist.completo ? "text-sm font-semibold text-emerald-600" : "text-sm"}>
                {p.checklist.conferidos}/{p.checklist.total} itens
              </span>
            </div>
            <Button className="mt-3 w-full" variant={p.montagemConcluidaEm && p.statusExpedicao !== "EXPEDIDO" ? "success" : "primary"}>
              <PackageOpen className="h-4 w-4" /> {textoBotao(p)}
            </Button>
          </Card>
        ))}
        {dados && !dados.itens.length && <p className="py-10 text-center text-muted-foreground">Nenhum pedido nesta etapa.</p>}
      </div>

      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>Cliente</Th>
              <Th>Data</Th>
              <Th>Itens</Th>
              <Th>Montagem</Th>
              <Th>Método de entrega</Th>
              <Th>Time Expedição</Th>
              <Th />
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {!dados && (
              <tr>
                <td colSpan={9} className="p-3">
                  <Skeleton className="h-24" />
                </td>
              </tr>
            )}
            {dados?.itens.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => abrir(p)}>
                <Td>
                  <CelulaNumero pedido={p} />
                </Td>
                <Td>{p.clienteNome}</Td>
                <Td>
                  <CelulaData pedido={p} />
                </Td>
                <Td>
                  <MiniaturasItens itens={p.itens} />
                </Td>
                <Td>
                  <span className={p.checklist.completo ? "font-semibold text-emerald-600" : ""}>
                    {p.checklist.conferidos}/{p.checklist.total}
                  </span>
                </Td>
                <Td>
                  <CelulaEnvio pedido={p} />
                </Td>
                <Td>
                  <CelulaExpedicao pedido={p} />
                </Td>
                <Td>
                  <Button size="sm" variant={p.montagemConcluidaEm && p.statusExpedicao !== "EXPEDIDO" ? "success" : "outline"}>
                    {textoBotao(p)}
                  </Button>
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <AcoesPedido pedido={p} contexto="expedicao" onAtualizado={carregar} />
                </Td>
              </tr>
            ))}
            {dados && !dados.itens.length && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground">
                  Nenhum pedido nesta etapa.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} onChange={setPagina} limite={limite} onLimite={setLimite} />}
    </div>
  );
}
