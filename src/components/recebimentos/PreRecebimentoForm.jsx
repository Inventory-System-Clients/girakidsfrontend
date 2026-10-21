import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from "../ui";
import { lerNumero } from "../../utils/format";
import { DESTINOS, Miniatura, ProdutoBusca, un } from "./comum";
import { FornecedorForm } from "./Fornecedores";

const destinoPadrao = (p) => (p.ehCapsula ? "CAPSULA" : p.controlaMontagem ? "SEM_CAPSULA" : "PRONTO");

// Novo/editar pré-recebimento ou recebimento direto ("direto": já entra no
// estoque, sem link para o fornecedor).
export default function PreRecebimentoForm({ pre, direto, inicial, fornecedores, onFornecedorCriado, onFechar, onSalvo }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    fornecedorId: pre?.fornecedorId || inicial?.fornecedorId || "",
    previsaoEntrega: pre?.previsaoEntrega || "",
    observacao: pre?.observacao || inicial?.observacao || "",
  }));
  const [itens, setItens] = useState(() =>
    (pre?.itens || inicial?.itens || []).map((i) => ({
      produtoId: i.produtoId,
      nome: i.produtoNome || i.nome,
      sku: i.produtoSku || i.sku,
      imagemUrl: i.imagemUrl,
      controlaMontagem: i.controlaMontagem ?? i.destino === "SEM_CAPSULA",
      destino: i.destino,
      quantidade: String(i.quantidadeSolicitada ?? i.quantidade ?? ""),
      custo: i.custoUnitario != null ? String(i.custoUnitario).replace(".", ",") : "",
    })),
  );
  const [novoFornecedor, setNovoFornecedor] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (c) => (e) => setForm({ ...form, [c]: e.target.value });
  const setItem = (i, campo, valor) => setItens((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  const adicionar = (p) => {
    const destino = destinoPadrao(p);
    if (itens.some((i) => i.produtoId === p.id && i.destino === destino)) {
      toast({ titulo: "Produto já está na lista", tipo: "aviso" });
      return;
    }
    setItens((l) => [...l, { produtoId: p.id, nome: p.nome, sku: p.sku, imagemUrl: p.imagemUrl, controlaMontagem: p.controlaMontagem, destino, quantidade: "", custo: "" }]);
  };

  const validos = itens.filter((i) => lerNumero(i.quantidade) > 0);
  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = {
        ...form,
        fornecedorId: form.fornecedorId || null,
        direto: Boolean(direto),
        itens: itens.map((i) => ({ produtoId: i.produtoId, destino: i.destino, quantidadeSolicitada: lerNumero(i.quantidade), custoUnitario: i.custo ? lerNumero(i.custo) : null })),
      };
      const { data } = pre?.id ? await api.put(`/recebimentos/${pre.id}`, corpo) : await api.post("/recebimentos", corpo);
      toast({
        titulo: direto ? "Recebimento lançado" : pre?.id ? "Pré-recebimento atualizado" : "Pré-recebimento criado",
        descricao: direto ? "As quantidades já entraram no estoque." : pre?.id ? undefined : "Envie o link ao fornecedor para ele informar as quantidades.",
      });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Não foi possível salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo={direto ? "Receber mercadoria agora" : pre?.id ? `Editar pré-recebimento nº ${pre.numero}` : "Novo pré-recebimento"}
      descricao={
        direto
          ? "Lança direto no estoque o que chegou (sem link para o fornecedor)."
          : "Monte a compra; o fornecedor recebe um link para informar quanto de cada item vai entregar."
      }
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant={direto ? "success" : "info"} loading={salvando} disabled={!validos.length || validos.length !== itens.length} onClick={salvar}>
            {direto ? "Dar entrada no estoque" : pre?.id ? "Salvar alterações" : "Criar e gerar link"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fornecedor" className="sm:col-span-2">
            <div className="flex gap-2">
              <Select value={form.fornecedorId} onChange={set("fornecedorId")} className="flex-1">
                <option value="">Sem fornecedor definido</option>
                {fornecedores.filter((f) => f.ativo || f.id === form.fornecedorId).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={() => setNovoFornecedor(true)}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </div>
          </Field>
          {!direto && (
            <Field label="Previsão de entrega">
              <Input type="date" value={form.previsaoEntrega} onChange={set("previsaoEntrega")} />
            </Field>
          )}
          <Field label="Observação" className="sm:col-span-3">
            <Textarea rows={2} value={form.observacao} onChange={set("observacao")} placeholder="Ex.: pedido feito por WhatsApp em 20/10, pagamento 50% adiantado" />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Itens</p>
          <ProdutoBusca onEscolher={adicionar} placeholder="Adicionar produto, brinquedo ou cápsula..." />
          {!itens.length && <p className="py-6 text-center text-sm text-muted-foreground">Busque acima e adicione os itens da compra.</p>}
          <div className="mt-2 space-y-2">
            {itens.map((i, idx) => (
              <div key={`${i.produtoId}${idx}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border p-2 sm:grid-cols-[auto_1fr_11rem_8rem_8rem_auto]">
                <Miniatura src={i.imagemUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.nome}</p>
                  <p className="text-xs text-muted-foreground">SKU {i.sku}</p>
                </div>
                <button type="button" className="rounded p-1.5 text-red-600 hover:bg-red-50 sm:order-last" onClick={() => setItens((l) => l.filter((_, j) => j !== idx))} aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
                <Select className="col-span-3 h-9 sm:col-span-1" value={i.destino} onChange={(e) => setItem(idx, "destino", e.target.value)}>
                  {Object.entries(DESTINOS)
                    .filter(([k]) => k !== "SEM_CAPSULA" || i.controlaMontagem)
                    .map(([k, d]) => (
                      <option key={k} value={k}>
                        {d.label}
                      </option>
                    ))}
                </Select>
                <Input
                  className="col-span-2 h-9 sm:col-span-1"
                  inputMode="numeric"
                  placeholder={direto ? "Qtd. recebida" : "Qtd. pedida"}
                  value={i.quantidade}
                  onChange={(e) => setItem(idx, "quantidade", e.target.value.replace(/[^\d.]/g, ""))}
                />
                <Input className="h-9" inputMode="decimal" placeholder="Custo un. (R$)" value={i.custo} onChange={(e) => setItem(idx, "custo", e.target.value)} />
              </div>
            ))}
          </div>
          {itens.length > 0 && (
            <p className="mt-2 text-right text-sm text-muted-foreground">
              {itens.length} item(ns) · {un(itens.reduce((s, i) => s + lerNumero(i.quantidade), 0))} unidades
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            "Brinquedo sem cápsula" só aparece para produtos com montagem configurada (aba Montagem). Quantidades em unidades.
          </p>
        </div>
      </div>
      {novoFornecedor && (
        <FornecedorForm
          onFechar={() => setNovoFornecedor(false)}
          onSalvo={(f) => {
            setNovoFornecedor(false);
            onFornecedorCriado?.(f);
            setForm((x) => ({ ...x, fornecedorId: f.id }));
          }}
        />
      )}
    </Dialog>
  );
}
