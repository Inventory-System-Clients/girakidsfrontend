/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, Field, FiltroMulti, Input, MetricCard, PageHeader, PeriodoPicker, Select, Skeleton, Table, Td, Textarea, Th, useConfirm, useToast } from "../../components/ui";
import PedidoDetalhes from "../../components/pedido/PedidoDetalhes";
import { data, hojeISO, inicioMesISO, lerNumero, moeda } from "../../utils/format";

let categoriasCache = null;
export const useCategoriasCusto = () => {
  const [categorias, setCategorias] = useState(categoriasCache || {});
  useEffect(() => {
    if (categoriasCache) return;
    api.get("/custos-extras/categorias").then(({ data: d }) => {
      categoriasCache = d;
      setCategorias(d);
    });
  }, []);
  return categorias;
};

// Formulário de custo pós-venda. Com "pedido" fixo (menu do pedido) não pede
// o número.
export function NovoCustoDialog({ pedido, onFechar, onSalvo }) {
  const toast = useToast();
  const categorias = useCategoriasCusto();
  const [form, setForm] = useState({ numeroPedido: "", categoria: "REENVIO", descricao: "", valor: "", data: hojeISO() });
  const [salvando, setSalvando] = useState(false);
  const set = (c) => (e) => setForm({ ...form, [c]: e.target.value });

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: d } = await api.post("/custos-extras", { ...form, pedidoId: pedido?.id, valor: lerNumero(form.valor) });
      toast({ titulo: "Custo registrado", descricao: `${moeda(d.valor)} no pedido ${d.pedido.numero}. Já entra na receita líquida do Time Financeiro.` });
      onSalvo(d);
    } catch (error) {
      toast({ titulo: "Erro ao registrar custo", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={pedido ? `Custo pós-venda · Pedido ${pedido.numeroFormatado}` : "Novo custo pós-venda"}
      descricao="Custos extras depois da venda (reenvio, avaria, troca, frete extra...). Somam ao custo do pedido no Time Financeiro."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} onClick={salvar} disabled={(!pedido && !form.numeroPedido) || !form.descricao.trim() || lerNumero(form.valor) <= 0}>
            Registrar custo
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!pedido && (
          <Field label="Número do pedido" obrigatorio>
            <Input value={form.numeroPedido} onChange={set("numeroPedido")} placeholder="Ex.: 63037" autoFocus />
          </Field>
        )}
        <Field label="Tipo de custo">
          <Select value={form.categoria} onChange={set("categoria")}>
            {Object.entries(categorias).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor (R$)" obrigatorio>
          <Input value={form.valor} onChange={set("valor")} placeholder="0,00" />
        </Field>
        <Field label="Data">
          <Input type="date" value={form.data} onChange={set("data")} />
        </Field>
        <Field label="O que aconteceu" obrigatorio className="sm:col-span-2">
          <Textarea value={form.descricao} onChange={set("descricao")} placeholder="Ex.: cliente recebeu 1 pacote a menos, reenviado por SEDEX" />
        </Field>
      </div>
    </Dialog>
  );
}

export default function CustosPosVenda() {
  const confirmar = useConfirm();
  const toast = useToast();
  const categorias = useCategoriasCusto();
  const [periodo, setPeriodo] = useState({ inicio: inicioMesISO(), fim: hojeISO() });
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState([]);
  const [dados, setDados] = useState(null);
  const [novo, setNovo] = useState(false);
  const [ver, setVer] = useState(null);

  const carregar = useCallback(() => {
    api.get("/custos-extras", { params: { ...periodo, busca: busca || undefined, categoria: filtroCat.join(",") || undefined } }).then(({ data: d }) => setDados(d));
  }, [periodo, busca, filtroCat]);
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const excluir = async (c) => {
    const ok = await confirmar({ titulo: "Remover custo?", mensagem: `${moeda(c.valor)} do pedido ${c.pedido.numero}.`, perigo: true, confirmar: "Remover" });
    if (!ok) return;
    try {
      await api.delete(`/custos-extras/${c.id}`);
      carregar();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader titulo="Custos pós-venda" subtitulo="Custos extras de pedidos já finalizados (reenvio, avaria, troca...). Entram como custo do pedido na receita líquida do Time Financeiro.">
        <Button onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" /> Novo custo
        </Button>
      </PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricCard titulo="Total no período" valor={moeda(dados?.total)} />
        <MetricCard titulo="Pedidos afetados" valor={dados?.pedidos ?? "..."} />
        <MetricCard
          titulo="Maior causa"
          valor={
            dados && Object.keys(dados.porCategoria).length
              ? categorias[Object.entries(dados.porCategoria).sort((a, b) => b[1] - a[1])[0][0]] || "-"
              : "-"
          }
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Nº do pedido ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <FiltroMulti titulo="Tipo" opcoes={categorias} valores={filtroCat} onChange={setFiltroCat} />
        <div className="ml-auto">
          <PeriodoPicker inicio={periodo.inicio} fim={periodo.fim} onChange={setPeriodo} />
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            {["Data", "Pedido", "Cliente", "Tipo", "O que aconteceu", "Valor", "Registrado por", ""].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!dados && (
            <tr>
              <td colSpan={8} className="p-3">
                <Skeleton className="h-20" />
              </td>
            </tr>
          )}
          {dados?.itens.map((c) => (
            <tr key={c.id}>
              <Td>{data(c.data)}</Td>
              <Td>
                <button className="font-mono text-xs text-primary underline" onClick={() => setVer(c.pedido.id)}>
                  {c.pedido.codigoLegado || c.pedido.numero}
                </button>
              </Td>
              <Td>{c.pedido.clienteNome}</Td>
              <Td>
                <Badge variant="warning">{categorias[c.categoria] || c.categoria}</Badge>
              </Td>
              <Td className="max-w-72 text-left text-sm">{c.descricao}</Td>
              <Td className="font-semibold">{moeda(c.valor)}</Td>
              <Td className="text-xs">{c.usuarioNome}</Td>
              <Td>
                <Button variant="ghost" size="icon" onClick={() => excluir(c)} aria-label="Remover">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </Td>
            </tr>
          ))}
          {dados && !dados.itens.length && (
            <tr>
              <td colSpan={8} className="py-10 text-center text-muted-foreground">
                Nenhum custo pós-venda no período.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {novo && (
        <NovoCustoDialog
          onFechar={() => setNovo(false)}
          onSalvo={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
      <PedidoDetalhes pedidoId={ver} onFechar={() => setVer(null)} />
    </div>
  );
}
