import { createContext } from 'react'

/**
 * Tipo da view ativa (table/kanban/gallery...). Provido pelo ViewHost e lido pelo
 * chrome/TableView p/ escopar a "view padrão" do usuário POR TIPO de view.
 * undefined = fora do host (ex: grid de logs embutido).
 */
export const ViewKeyContext = createContext<string | undefined>(undefined)
