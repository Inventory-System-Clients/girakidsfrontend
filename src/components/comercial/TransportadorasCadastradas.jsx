import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Search, Truck } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton, Textarea, useToast } from "../ui";
import { UFS, data, mascaraCnpj, mascaraTelefone } from "../../utils/format";

const digitos = (v) => String(v || "").replace(/\D/g, "");

// Confere os dígitos verificadores do CNPJ.
const cnpjValido = (valor) => {
  const d = digitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(d.slice(0, 12));
  const d2 = dv(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
};

// O que falta (ou está errado) para a transportadora sair certa na nota fiscal.
const pendenciasNota = (t) => {
  const faltam = [];
  const doc = digitos(t.documento);
  if (!doc) faltam.push("CNPJ");
  else if (doc.length === 14 && !cnpjValido(doc)) faltam.push("CNPJ inválido");
  else if (doc.length !== 14 && doc.length !== 11) faltam.push("CNPJ incompleto");
  if (!t.inscricaoEstadual) faltam.push("Inscrição estadual");
  if (!t.endereco) faltam.push("Endereço");
  if (!t.cidade) faltam.push("Cidade");
  if (!t.estado) faltam.push("UF");
  return faltam;
};

function TransportadoraForm({ transportadora, onFechar, onSalvo }) {
  const toast = useToast();
  const [t, setT] = useState(() => ({ ativo: true, ...(transportadora || {}) }));
  const [salvando, setSalvando] = useState(false);
  const set = (campo) => (e) => setT({ ...t, [campo]: e.target.value });
  const doc = digitos(t.documento);
  const erroCnpj = doc.length === 14 && !cnpjValido(doc) ? "CNPJ inválido: confira os números." : doc && doc.length !== 14 && doc.length !== 11 ? "CNPJ incompleto." : null;
  const pendencias = pendenciasNota(t);

  const salvar = async () => {
    setSalvando(true);
    try {
      if (transportadora?.id) await api.put(`/transportadoras/cadastradas/${transportadora.id}`, t);
      else await api.post("/transportadoras/cadastradas", t);
      toast({ titulo: transportadora?.id ? "Transportadora atualizada" : "Transportadora cadastrada" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={transportadora?.id ? `Editar ${transportadora.nome}` : "Nova transportadora"}
      descricao="Razão social, CNPJ, inscrição estadual e endereço vão no bloco de transporte da nota fiscal. Confira com o cartão CNPJ da transportadora."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={salvando} disabled={!t.nome?.trim() || Boolean(erroCnpj)}>
            {transportadora?.id ? "Salvar alterações" : "Cadastrar transportadora"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados da nota fiscal</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Razão social" obrigatorio className="sm:col-span-2" dica="Exatamente como no cartão CNPJ.">
              <Input value={t.nome || ""} onChange={set("nome")} />
            </Field>
            <Field label="CNPJ" erro={erroCnpj}>
              <Input inputMode="numeric" value={t.documento ? mascaraCnpj(t.documento) : ""} onChange={(e) => setT({ ...t, documento: e.target.value })} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Inscrição estadual" dica='Só números, ou "ISENTO".'>
              <Input value={t.inscricaoEstadual || ""} onChange={set("inscricaoEstadual")} />
            </Field>
            <Field label="Endereço" className="sm:col-span-2" dica="Rua, número e bairro.">
              <Input value={t.endereco || ""} onChange={set("endereco")} maxLength={200} />
            </Field>
            <Field label="Cidade">
              <Input value={t.cidade || ""} onChange={set("cidade")} />
            </Field>
            <Field label="UF">
              <Select value={t.estado || ""} onChange={set("estado")}>
                <option value="">-</option>
                {Object.keys(UFS).map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Contato</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contato principal">
              <Input value={t.contato || ""} onChange={set("contato")} />
            </Field>
            <Field label="Telefone">
              <Input value={t.telefone || ""} onChange={(e) => setT({ ...t, telefone: mascaraTelefone(e.target.value) })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={t.email || ""} onChange={set("email")} />
            </Field>
            <Field label="Status">
              <Select value={t.ativo ? "1" : "0"} onChange={(e) => setT({ ...t, ativo: e.target.value === "1" })}>
                <option value="1">Ativa</option>
                <option value="0">Inativa (não aparece no checkout)</option>
              </Select>
            </Field>
            <Field label="Observações internas" className="sm:col-span-2">
              <Textarea value={t.observacoes || ""} onChange={set("observacoes")} />
            </Field>
          </div>
        </div>

        {pendencias.length > 0 ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Para a nota sair completa, falta: {pendencias.join(", ")}.
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Dados da nota fiscal completos.
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function TransportadorasCadastradas() {
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativas");
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data: resposta } = await api.get("/transportadoras/cadastradas");
      setLista(resposta);
    } catch (error) {
      setLista([]);
      toast({ titulo: "Erro ao carregar transportadoras", descricao: mensagemErro(error), tipo: "erro" });
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = digitos(busca);
    return (lista || []).filter((t) => {
      if (filtro === "ativas" && !t.ativo) return false;
      if (filtro === "pendentes" && !pendenciasNota(t).length) return false;
      if (!termo) return true;
      return (
        String(t.nome || "").toLowerCase().includes(termo) ||
        String(t.cidade || "").toLowerCase().includes(termo) ||
        (termoDigitos && digitos(t.documento).includes(termoDigitos))
      );
    });
  }, [lista, busca, filtro]);

  const totalPendentes = (lista || []).filter((t) => pendenciasNota(t).length).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade" />
        </div>
        <Select className="w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="ativas">Ativas</option>
          <option value="todas">Todas</option>
          <option value="pendentes">Com dados faltando ({totalPendentes})</option>
        </Select>
        <Button onClick={() => setEditando({})}>
          <Plus className="h-4 w-4" /> Nova transportadora
        </Button>
      </div>

      {lista === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card">
          <EmptyState icon={Truck} titulo="Nenhuma transportadora encontrada" descricao={lista.length ? "Mude a busca ou o filtro." : "Cadastre a primeira transportadora."} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtradas.map((t) => {
            const pendencias = pendenciasNota(t);
            return (
              <div key={t.id} className={`card flex flex-col gap-3 ${t.ativo ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold leading-tight text-gray-900">{t.nome}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{t.documento ? `CNPJ ${mascaraCnpj(t.documento)}` : "Sem CNPJ"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditando(t)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                </div>
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-gray-500">IE</dt>
                  <dd className="text-gray-800">{t.inscricaoEstadual || "-"}</dd>
                  <dt className="text-gray-500">Endereço</dt>
                  <dd className="text-gray-800">
                    {[t.endereco, t.cidade && `${t.cidade}${t.estado ? `/${t.estado}` : ""}`].filter(Boolean).join(" · ") || t.estado || "-"}
                  </dd>
                  {(t.telefone || t.contato) && (
                    <>
                      <dt className="text-gray-500">Contato</dt>
                      <dd className="text-gray-800">{[t.contato, t.telefone].filter(Boolean).join(" · ")}</dd>
                    </>
                  )}
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  {pendencias.length ? (
                    <Badge variant="warning">
                      <AlertTriangle className="h-3 w-3" /> Falta: {pendencias.join(", ")}
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> Pronta para nota
                    </Badge>
                  )}
                  {!t.ativo && <Badge>Inativa</Badge>}
                  <span className="ml-auto text-xs text-gray-500">
                    {t.pedidos ? `${t.pedidos} pedido${t.pedidos > 1 ? "s" : ""} · último em ${data(t.ultimoPedido)}` : "Nenhum pedido ainda"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <TransportadoraForm
          transportadora={editando.id ? editando : null}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
