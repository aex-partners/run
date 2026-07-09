export interface SnapshotView { data: string; custoTotal: number; origemRev: number }
export interface HistoricoCusto {
  execute(q: { skuId: string }): Promise<SnapshotView[]>
}
