// Vista de LISTAGEM do centro de trabalho: carrega `nome`/`setor` além do custo. Deliberadamente
// SEPARADA de RoteiroCentroView (que é o centro DENTRO de um roteiro custeado, onde só o custo por
// minuto importa): sem nome nem setor, o id do centro fica impossível de achar depois de criado —
// que é exatamente o buraco que esta in-port tapa.
export interface CentroView {
  id: string
  nome: string
  setor: string
  custoMinMod: number | null
}

export interface ListarCentros {
  execute(): Promise<CentroView[]>
}
