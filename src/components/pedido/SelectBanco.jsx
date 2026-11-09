import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Button, Input, Select, useToast } from "../ui";

// Banco que recebeu o pagamento (Bancos GK, Banco Leonardo, Rede parceiro
// Itau...). "+ Novo banco" cria e já deixa escolhido.
export default function SelectBanco({ value, onChange }) {
  const [bancos, setBancos] = useState([]);
  const [novo, setNovo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get("/financeiro/bancos").then(({ data }) => setBancos(data)).catch(() => {});
  }, []);

  const criar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post("/financeiro/bancos", { nome: novo });
      setBancos(data.bancos);
      onChange(data.nome);
      setNovo(null);
      toast({ titulo: "Banco cadastrado", descricao: data.nome });
    } catch (error) {
      toast({ titulo: "Não foi possível cadastrar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  if (novo !== null) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder="Nome do banco"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && novo.trim()) criar();
            if (e.key === "Escape") setNovo(null);
          }}
        />
        <Button variant="outline" onClick={() => setNovo(null)}>
          Voltar
        </Button>
        <Button loading={salvando} disabled={novo.trim().length < 2} onClick={criar}>
          Salvar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione o banco...</option>
        {bancos.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </Select>
      <Button variant="outline" size="icon" onClick={() => setNovo("")} aria-label="Novo banco" title="Cadastrar novo banco">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
