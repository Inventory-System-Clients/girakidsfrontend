import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import api from "../services/api";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../components/ui";
import PedidoDetalhes from "../components/pedido/PedidoDetalhes";
import { data, moeda } from "../utils/format";
import { METODOS_ENVIO, nomeForma } from "../utils/status";

const situacao = (p) => {
  if (p.statusVendas === "CANCELADO") return ["Cancelado", "danger"];
  if (p.statusExpedicao === "EXPEDIDO") return ["Expedido", "success"];
  if (p.statusExpedicao === "MONTAGEM") return ["Em montagem", "info"];
  if (p.statusFinanceiro === "PAGO") return ["Pagamento confirmado", "success"];
  return ["Em aberto", "warning"];
};

export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState(null);
  const [temMais, setTemMais] = useState(false);
  const [ver, setVer] = useState(null);

  const carregar = (offset = 0) =>
    api.get("/pedidos/meus", { params: { offset, limite: 20 } }).then(({ data: d }) => {
      setPedidos((atual) => (offset ? [...atual, ...d] : d));
      setTemMais(d.length === 20);
    });
  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="container-app py-6">
      <PageHeader titulo="Meus Pedidos" subtitulo="Acompanhe seus pedidos realizados na Gira Kids." />
      {!pedidos && <Skeleton className="h-40" />}
      {pedidos?.length === 0 && (
        <Card>
          <EmptyState icon={Package} titulo="Nenhum pedido encontrado" descricao="Quando você finalizar um pedido, ele aparecerá aqui para consulta.">
            <Link to="/">
              <Button className="mt-3">Ver catálogo</Button>
            </Link>
          </EmptyState>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos?.map((p) => {
          const [rotulo, cor] = situacao(p);
          return (
            <Card key={p.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Pedido {p.numeroFormatado}</p>
                <Badge variant={cor}>{rotulo}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Pedido realizado em {data(p.createdAt)}</p>
              <p className="text-sm">
                {p.quantidadeItens} {p.quantidadeItens === 1 ? "item" : "itens"} · {nomeForma(p.formaPagamento)} · {METODOS_ENVIO[p.metodoEnvio] || "-"}
              </p>
              {p.codigoRastreio && <p className="text-sm">Rastreio: <strong>{p.codigoRastreio}</strong></p>}
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-lg font-bold text-primary">{moeda(p.total)}</span>
                <Button variant="outline" size="sm" onClick={() => setVer(p.id)}>
                  Ver detalhes
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {temMais && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => carregar(pedidos.length)}>
            Carregar mais pedidos
          </Button>
        </div>
      )}
      <PedidoDetalhes pedidoId={ver} onFechar={() => setVer(null)} />
    </div>
  );
}
