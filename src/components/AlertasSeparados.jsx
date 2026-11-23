import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, PackageX, Truck } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui";
import PedidoDetalhes from "./pedido/PedidoDetalhes";
import { METODOS_ENVIO } from "../utils/status";

const INTERVALO = 5 * 60000;
const CHAVE_ABERTO = "alertasSeparadosAberto";

const diasParado = (desde) => Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000);

// O que falta fazer para o pedido sair.
const proximoPasso = (p) =>
  p.metodoEnvio === "TRANSPORTADORA"
    ? `pedir coleta${p.transportadoraNome ? ` na ${p.transportadoraNome}` : " na transportadora"}`
    : p.metodoEnvio === "PAC" || p.metodoEnvio === "SEDEX"
      ? "fazer a etiqueta dos Correios"
      : "combinar o envio";

// Faixa no topo para os admins: pedidos já separados e não expedidos há mais
// de 3 dias (precisam de coleta na transportadora ou etiqueta dos Correios).
export default function AlertasSeparados() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_ABERTO) !== "0";
    } catch {
      return true;
    }
  });
  const [ver, setVer] = useState(null);
  const habilitado = usuario?.role === "ADMIN";

  const carregar = useCallback(() => {
    if (!habilitado) return;
    api
      .get("/expedicao/alertas-separados")
      .then(({ data }) => setDados(data))
      .catch(() => {});
  }, [habilitado]);

  useEffect(() => {
    carregar();
    if (!habilitado) return undefined;
    const t = setInterval(carregar, INTERVALO);
    return () => clearInterval(t);
  }, [carregar, habilitado]);

  const pedidos = dados?.pedidos || [];
  if (!habilitado || !pedidos.length) return null;

  const alternar = () => {
    setAberto(!aberto);
    try {
      localStorage.setItem(CHAVE_ABERTO, aberto ? "0" : "1");
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };

  return (
    <div className="no-print border-b border-red-200 bg-red-50">
      <div className="container-app py-2">
        <button type="button" onClick={alternar} className="flex items-center gap-2 text-left text-sm font-semibold text-red-900">
          <PackageX className="h-4 w-4 shrink-0" />
          {pedidos.length === 1 ? "1 pedido separado está parado" : `${pedidos.length} pedidos separados estão parados`} há mais de {dados.dias} dias sem expedir — peça a coleta ou faça a etiqueta
          {aberto ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
        {aberto && (
          <div className="mt-2 space-y-2 pb-1">
            {pedidos.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm">
                    <strong>Pedido {p.numeroFormatado}</strong> · {p.clienteNome}{" "}
                    <span className="font-semibold text-red-700">· separado há {diasParado(p.montagemConcluidaEm)} dias</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5" />
                    {METODOS_ENVIO[p.metodoEnvio] || "Envio"}
                    {p.transportadoraNome && p.metodoEnvio === "TRANSPORTADORA" ? ` · ${p.transportadoraNome}` : ""}
                    {p.destino ? ` · ${p.destino}` : ""}
                    <span className="font-medium text-red-800">· Falta {proximoPasso(p)}</span>
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setVer(p.id)}>
                  Ver pedido
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <PedidoDetalhes pedidoId={ver} onFechar={() => setVer(null)} />
    </div>
  );
}
