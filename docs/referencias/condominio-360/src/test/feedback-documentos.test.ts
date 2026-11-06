import { describe, expect, it } from "vitest";
import { feedbacksVisiveis, proximoProtocoloFeedback, type Feedback } from "@/lib/feedback";
import { ehDuplicado, novaVersao, podeVerDocumento, docStore } from "@/lib/documentos";

const fb = (autor: string, condominio = "Condomínio Vila Gaudí") => ({ autor, condominio } as Feedback);

describe("Feedback do Portal", () => {
  it("protocolo é sequencial", () => {
    expect(proximoProtocoloFeedback(["FB-2026-0001", "FB-2026-0002"], 2026)).toBe("FB-2026-0003");
    expect(proximoProtocoloFeedback(["FB-2026-0009"], 2027)).toBe("FB-2027-0001");
  });
  it("síndico só vê feedbacks do condomínio quando habilitado", () => {
    const lista = [fb("Ana"), fb("Carlos"), fb("Zé", "Outro")];
    const quem = { autor: "Elton", sindico: true, condominio: "Condomínio Vila Gaudí" };
    expect(feedbacksVisiveis(lista, quem, false)).toHaveLength(0);
    expect(feedbacksVisiveis(lista, quem, true)).toHaveLength(2);
    expect(feedbacksVisiveis(lista, { autor: "Ana", sindico: false, condominio: "Condomínio Vila Gaudí" }, true)).toHaveLength(1);
  });
});

describe("Central de Documentos", () => {
  it("morador só vê documentos públicos", () => {
    expect(podeVerDocumento({ confidencialidade: "Público", perfis: [] }, "morador")).toBe(true);
    expect(podeVerDocumento({ confidencialidade: "Interno", perfis: ["morador"] }, "morador")).toBe(false);
  });
  it("detecta duplicidade por nome e tamanho", () => {
    expect(ehDuplicado([{ nome: "Ata.pdf", tamanho: 10 }], "ata.PDF", 10)).toBe(true);
    expect(ehDuplicado([{ nome: "Ata.pdf", tamanho: 10 }], "Ata.pdf", 11)).toBe(false);
  });
  it("nova versão preserva histórico", () => {
    const d = docStore.get().lista[0]!;
    const n = novaVersao(d, { nome: "v2.pdf", tamanho: 1, url: "x" }, "Elton");
    expect(n.versao).toBe(2);
    expect(n.historico[0]!.nome).toBe(d.nome);
  });
});
