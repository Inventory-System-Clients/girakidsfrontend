import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { FiltroMulti, PageHeader, Paginacao, Skeleton, Table, Tabs, Td, Th, useToast } from "../components/ui";
import AcoesPedido from "../components/pedido/AcoesPedido";
import { CelulaData, CelulaEnvio, CelulaExpedicao, CelulaNumero } from "../components/pedido/StatusCelulas";

const ABAS = [
  { value: "INICIAR", label: "Iniciar Montagem" },
  { value: "MONTAGEM", label: "Montagem pedido" },
  { value: "TODOS", label: "Todos" },
];

export default function Expedicao() {
  const toast = useToast();
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
      .then(({ data }) => setDados(data))
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        titulo="Time de expedição"
        subtitulo="Visualize e gerencie pedidos que foram liberados para expedição"
        extra={dados?.pendentes != null && <p className="mt-1 text-sm font-medium text-primary">{dados.pendentes} pedidos aguardando expedição</p>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          abas={ABAS}
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
          <FiltroMulti titulo="Time Expedição" opcoes={{ NAO_INICIADO: "Não iniciado", MONTAGEM: "Montagem Pedido", EXPEDIDO: "Expedido" }} valores={expedicao} onChange={setExpedicao} />
        )}
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Número</Th>
            <Th>Cliente</Th>
            <Th>Data</Th>
            <Th>Montagem</Th>
            <Th>Método de entrega</Th>
            <Th>Time Expedição</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {!dados && (
            <tr>
              <td colSpan={7} className="p-3">
                <Skeleton className="h-24" />
              </td>
            </tr>
          )}
          {dados?.itens.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td>
                <CelulaNumero pedido={p} />
              </Td>
              <Td>{p.clienteNome}</Td>
              <Td>
                <CelulaData pedido={p} />
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
                <AcoesPedido pedido={p} contexto="expedicao" onAtualizado={carregar} />
              </Td>
            </tr>
          ))}
          {dados && !dados.itens.length && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-muted-foreground">
                Nenhum pedido nesta etapa.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} onChange={setPagina} limite={limite} onLimite={setLimite} />}
    </div>
  );
}
