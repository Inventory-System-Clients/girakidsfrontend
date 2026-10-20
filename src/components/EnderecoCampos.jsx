import { Field, Input, Segmented, Select } from "./ui";
import { UFS, buscarCep, mascaraCep, mascaraCpf, mascaraCnpj, mascaraTelefone, somenteDigitos } from "../utils/format";

// Campos de contato + endereço reaproveitados no cadastro, perfil, usuários e
// checkout. "valor" usa as chaves: nome, email, documento, telefone, cep, rua,
// numero, complemento, bairro, cidade, estado.
export default function EnderecoCampos({ valor, onChange, mostrarContato = true, obrigatorio = true, desabilitado }) {
  const set = (campo) => (e) => onChange({ ...valor, [campo]: e?.target ? e.target.value : e });
  const tipoDoc = valor.documentoTipo || (somenteDigitos(valor.documento).length > 11 ? "CNPJ" : "CPF");

  const aoMudarCep = async (e) => {
    const cep = mascaraCep(e.target.value);
    const novo = { ...valor, cep };
    onChange(novo);
    if (somenteDigitos(cep).length === 8) {
      const end = await buscarCep(cep);
      if (end) onChange({ ...novo, rua: end.rua || novo.rua, bairro: end.bairro || novo.bairro, cidade: end.cidade || novo.cidade, estado: end.estado || novo.estado });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {mostrarContato && (
        <>
          <Field label="Nome completo" obrigatorio={obrigatorio} className="sm:col-span-2">
            <Input value={valor.nome || ""} onChange={set("nome")} disabled={desabilitado} placeholder="Digite o nome completo" />
          </Field>
          <Field label="Email" obrigatorio={obrigatorio}>
            <Input type="email" value={valor.email || ""} onChange={set("email")} disabled={desabilitado} placeholder="email@exemplo.com" />
          </Field>
          <Field label="Telefone" obrigatorio={obrigatorio}>
            <Input value={valor.telefone || ""} onChange={(e) => onChange({ ...valor, telefone: mascaraTelefone(e.target.value) })} disabled={desabilitado} placeholder="(00) 00000-0000" />
          </Field>
          <div className="sm:col-span-2">
            <span className="label">
              Documento {obrigatorio && <span className="text-primary">*</span>}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Segmented
                value={tipoDoc}
                onChange={(t) => onChange({ ...valor, documentoTipo: t, documento: "" })}
                opcoes={[
                  { value: "CPF", label: "CPF" },
                  { value: "CNPJ", label: "CNPJ" },
                ]}
              />
              <Input
                value={valor.documento ? (tipoDoc === "CPF" ? mascaraCpf(valor.documento) : mascaraCnpj(valor.documento)) : ""}
                onChange={(e) => onChange({ ...valor, documentoTipo: tipoDoc, documento: somenteDigitos(e.target.value) })}
                disabled={desabilitado}
                placeholder={tipoDoc === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
              />
            </div>
          </div>
        </>
      )}
      <Field label="CEP" obrigatorio={obrigatorio}>
        <Input value={valor.cep ? mascaraCep(valor.cep) : ""} onChange={aoMudarCep} disabled={desabilitado} placeholder="00000-000" />
      </Field>
      <Field label="Número" obrigatorio={obrigatorio}>
        <Input value={valor.numero || ""} onChange={set("numero")} disabled={desabilitado} placeholder="Número" />
      </Field>
      <Field label="Rua" obrigatorio={obrigatorio} className="sm:col-span-2">
        <Input value={valor.rua || ""} onChange={set("rua")} disabled={desabilitado} placeholder="Nome da rua" />
      </Field>
      <Field label="Complemento">
        <Input value={valor.complemento || ""} onChange={set("complemento")} disabled={desabilitado} placeholder="Apto, bloco, etc (opcional)" />
      </Field>
      <Field label="Bairro" obrigatorio={obrigatorio}>
        <Input value={valor.bairro || ""} onChange={set("bairro")} disabled={desabilitado} placeholder="Nome do bairro" />
      </Field>
      <Field label="Cidade" obrigatorio={obrigatorio}>
        <Input value={valor.cidade || ""} onChange={set("cidade")} disabled={desabilitado} placeholder="Nome da cidade" />
      </Field>
      <Field label="Estado" obrigatorio={obrigatorio}>
        <Select value={valor.estado || ""} onChange={set("estado")} disabled={desabilitado}>
          <option value="">UF</option>
          {Object.entries(UFS).map(([uf, nome]) => (
            <option key={uf} value={uf}>
              {nome}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
