import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, cx } from "../ui";
import { moeda, numero, percentual } from "../../utils/format";
import { nomeForma } from "../../utils/status";

const ROSA = "#f43f5e";
const AZUL = "#2563eb";
const VERDE = "#0f766e";
const CINZA = "#cbd5e1";
const moedaCurta = (v) => (Math.abs(v) >= 1000 ? `R$ ${numero(v / 1000, 1)} mil` : moeda(v));
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const somarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nomeMes = (chave) => new Date(`${chave}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
const quebrar = (texto, max = 22) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

// Barras horizontais com nome à esquerda (clientes, itens, formas).
function BarrasHorizontais({ dados, campo, cor, formato, rotulo = "nome", largura = 320 }) {
  return (
    <ResponsiveContainer>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formato === moeda ? moedaCurta : (v) => numero(v)} />
        <YAxis type="category" dataKey={rotulo} width={largura} tick={{ fontSize: 11 }} interval={0} tickFormatter={(v) => quebrar(String(v), 48)} />
        <Tooltip formatter={(v) => formato(v)} />
        <Bar dataKey={campo} fill={cor} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Cada tipo de gráfico: título, explicação, resumo opcional e o desenho.
const TIPOS = [
  {
    id: "semana",
    titulo: "Pedidos por dia da semana",
    descricao: "Quantidade, receita bruta e receita líquida dos pedidos do período, pelo dia em que foram tirados.",
    render: (d) => (
      <ResponsiveContainer>
        <ComposedChart data={d.semana}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="q" tick={{ fontSize: 12 }} allowDecimals={false} />
          <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
          <Tooltip formatter={(v, n) => (n === "Pedidos" ? v : moeda(v))} />
          <Legend />
          <Bar yAxisId="q" dataKey="pedidos" name="Pedidos" fill={CINZA} radius={[4, 4, 0, 0]} />
          <Line yAxisId="v" dataKey="bruta" name="Receita bruta" stroke={ROSA} strokeWidth={2} dot />
          <Line yAxisId="v" dataKey="liquida" name="Receita líquida" stroke={VERDE} strokeWidth={2} dot />
        </ComposedChart>
      </ResponsiveContainer>
    ),
  },
  {
    id: "diasReceita",
    titulo: "Dias da semana com mais receita",
    descricao: "Dias da semana do maior para o menor faturamento no período.",
    render: (d) => {
      const dados = [...d.semana].filter((x) => x.pedidos).sort((a, b) => b.bruta - a.bruta);
      return (
        <ResponsiveContainer>
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
            <Tooltip formatter={(v, n) => (n === "Receita bruta" ? moeda(v) : v)} labelFormatter={(l) => l} />
            <Bar dataKey="bruta" name="Receita bruta" radius={[4, 4, 0, 0]}>
              {dados.map((x, i) => (
                <Cell key={x.dia} fill={i === 0 ? ROSA : "#fda4af"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    },
  },
  {
    id: "semanas",
    titulo: "Semanas do período que mais vendemos",
    descricao: "Receita bruta de cada semana (segunda a domingo) dentro do período selecionado; a de maior venda fica destacada.",
    render: (d) => {
      const dados = d.graficos.semanas.map((s) => {
        const inicio = s.segunda < d.periodo.inicio ? d.periodo.inicio : s.segunda;
        const domingo = somarDias(s.segunda, 6);
        const fim = domingo > d.periodo.fim ? d.periodo.fim : domingo;
        return { ...s, rotulo: `${ddmm(inicio)} a ${ddmm(fim)}` };
      });
      const maior = Math.max(...dados.map((x) => x.bruta));
      return (
        <ResponsiveContainer>
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="v" tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
            <YAxis yAxisId="q" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v, n) => (n === "Pedidos" ? v : moeda(v))} />
            <Legend />
            <Bar yAxisId="v" dataKey="bruta" name="Receita bruta" radius={[4, 4, 0, 0]}>
              {dados.map((x) => (
                <Cell key={x.segunda} fill={x.bruta === maior ? ROSA : "#fda4af"} />
              ))}
            </Bar>
            <Line yAxisId="q" dataKey="pedidos" name="Pedidos" stroke="#64748b" strokeWidth={2} dot />
          </ComposedChart>
        </ResponsiveContainer>
      );
    },
  },
  {
    id: "comparativo",
    titulo: "Mês atual x mês passado",
    descricao: "Vendas acumuladas dia a dia deste mês até hoje, comparadas com o mês passado até o mesmo dia. Não depende do período selecionado.",
    resumo: (d) => {
      const c = d.graficos.comparativo;
      return (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="capitalize">{nomeMes(c.mesAtual)}</span> até dia {c.dia}: <b>{moeda(c.totalAtual)}</b>
          </span>
          <span>
            <span className="capitalize">{nomeMes(c.mesAnterior)}</span> até dia {c.dia}: <b>{moeda(c.totalAnterior)}</b>
          </span>
          {c.variacao != null && (
            <span className={cx("font-semibold", c.variacao >= 0 ? "text-emerald-700" : "text-red-700")}>
              {c.variacao >= 0 ? "+" : ""}
              {percentual(c.variacao)} {c.variacao >= 0 ? "acima" : "abaixo"} do mês passado
            </span>
          )}
        </div>
      );
    },
    render: (d) => {
      const c = d.graficos.comparativo;
      return (
        <ResponsiveContainer>
          <LineChart data={c.dias}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
            <Tooltip formatter={(v) => moeda(v)} labelFormatter={(l) => `Até o dia ${l}`} />
            <Legend />
            <Line dataKey="atual" name={`${nomeMes(c.mesAtual)} (atual)`} stroke={ROSA} strokeWidth={2.5} dot={false} />
            <Line dataKey="anterior" name={`${nomeMes(c.mesAnterior)} (passado)`} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    },
  },
  {
    id: "clientes",
    titulo: "Top 7 clientes do período",
    descricao: "Clientes que mais compraram (receita bruta) nos pedidos do período.",
    render: (d) => (
      <BarrasHorizontais
        dados={d.graficos.topClientes.map((c) => ({ ...c, nome: `${c.nome} (${c.pedidos} ped.)` }))}
        campo="bruta"
        cor={AZUL}
        formato={moeda}
      />
    ),
  },
  {
    id: "itens",
    titulo: "Itens mais vendidos no período",
    descricao: "Top 10 em quantidade nos pedidos tirados no período, expedidos ou não.",
    render: (d) => <BarrasHorizontais dados={d.topQuantidade.slice(0, 10)} campo="pacotes" cor={VERDE} formato={(v) => `${numero(v)} un.`} />,
  },
  {
    id: "horas",
    titulo: "Horários com mais pedidos",
    descricao: "Em que hora do dia os pedidos do período foram tirados. Bom para escalar atendimento e disparar campanhas no horário certo.",
    render: (d) => {
      const comPedido = d.graficos.horas.filter((h) => h.pedidos);
      const ini = Math.min(...comPedido.map((h) => h.hora), 8);
      const fim = Math.max(...comPedido.map((h) => h.hora), 18);
      const dados = d.graficos.horas.filter((h) => h.hora >= ini && h.hora <= fim).map((h) => ({ ...h, rotulo: `${h.hora}h` }));
      return (
        <ResponsiveContainer>
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="q" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} tickFormatter={moedaCurta} width={90} />
            <Tooltip formatter={(v, n) => (n === "Pedidos" ? v : moeda(v))} />
            <Legend />
            <Bar yAxisId="q" dataKey="pedidos" name="Pedidos" fill={AZUL} radius={[4, 4, 0, 0]} />
            <Line yAxisId="v" dataKey="bruta" name="Receita bruta" stroke={ROSA} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    },
  },
  {
    id: "formas",
    titulo: "Receita por forma de pagamento",
    descricao: "Como os clientes pagaram os pedidos do período (receita bruta).",
    render: (d) => (
      <BarrasHorizontais
        dados={d.graficos.formas.map((f) => ({ ...f, nome: `${nomeForma(f.forma)} (${f.pedidos})` }))}
        campo="bruta"
        cor="#7c3aed"
        formato={moeda}
        largura={220}
      />
    ),
  },
  {
    id: "novos",
    titulo: "Clientes novos x recorrentes",
    descricao: "Recorrente = já tinha comprado antes do período. Mostra se a receita vem de clientes que voltam ou de novos.",
    resumo: (d) => {
      const { novos, recorrentes } = d.graficos.clientes;
      const total = novos.bruta + recorrentes.bruta;
      return (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Novos: <b>{novos.clientes}</b> clientes, {novos.pedidos} pedidos, {moeda(novos.bruta)} {total ? `(${percentual((novos.bruta / total) * 100)})` : ""} · ticket {moeda(novos.pedidos ? novos.bruta / novos.pedidos : 0)}
          </span>
          <span>
            Recorrentes: <b>{recorrentes.clientes}</b> clientes, {recorrentes.pedidos} pedidos, {moeda(recorrentes.bruta)} {total ? `(${percentual((recorrentes.bruta / total) * 100)})` : ""} · ticket {moeda(recorrentes.pedidos ? recorrentes.bruta / recorrentes.pedidos : 0)}
          </span>
        </div>
      );
    },
    // Participação (%) de cada grupo em clientes, pedidos e receita: mesma escala.
    render: (d) => {
      const { novos, recorrentes } = d.graficos.clientes;
      const pct = (a, b) => (a + b ? (a / (a + b)) * 100 : 0);
      const dados = [
        { nome: "Clientes", novos: pct(novos.clientes, recorrentes.clientes), recorrentes: pct(recorrentes.clientes, novos.clientes) },
        { nome: "Pedidos", novos: pct(novos.pedidos, recorrentes.pedidos), recorrentes: pct(recorrentes.pedidos, novos.pedidos) },
        { nome: "Receita", novos: pct(novos.bruta, recorrentes.bruta), recorrentes: pct(recorrentes.bruta, novos.bruta) },
      ];
      return (
        <ResponsiveContainer>
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => percentual(v)} />
            <Legend />
            <Bar dataKey="novos" name="Novos" fill={AZUL} radius={[4, 4, 0, 0]} />
            <Bar dataKey="recorrentes" name="Recorrentes" fill={ROSA} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    },
  },
];

const CHAVE = "girakids.graficoResumo";

// Gráfico grande do Resumo: clicar no título troca o tipo de gráfico.
export default function GraficoResumo({ d }) {
  const [tipoId, setTipoId] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) || "semana";
    } catch {
      return "semana";
    }
  });
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const tipo = TIPOS.find((t) => t.id === tipoId) || TIPOS[0];

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => !caixa.current?.contains(e.target) && setAberto(false);
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const escolher = (id) => {
    setTipoId(id);
    setAberto(false);
    try {
      localStorage.setItem(CHAVE, id);
    } catch {
      // sem armazenamento: só não lembra a escolha
    }
  };

  return (
    <section>
      <div ref={caixa} className="relative inline-block">
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="flex items-center gap-1.5 rounded-md text-lg font-semibold hover:text-primary"
          title="Clique para trocar o gráfico"
        >
          {tipo.titulo}
          <ChevronDown className={cx("h-5 w-5 transition-transform", aberto && "rotate-180")} />
        </button>
        {aberto && (
          <div className="absolute left-0 z-20 mt-1 w-80 rounded-lg border border-border bg-white p-1 shadow-lg">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => escolher(t.id)}
                className={cx("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50", t.id === tipo.id && "font-semibold text-primary")}
              >
                {t.titulo}
                {t.id === tipo.id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{tipo.descricao}</p>
      <Card className="p-4">
        {tipo.resumo && <div className="mb-3">{tipo.resumo(d)}</div>}
        <div className="h-80">{tipo.render(d)}</div>
      </Card>
    </section>
  );
}
