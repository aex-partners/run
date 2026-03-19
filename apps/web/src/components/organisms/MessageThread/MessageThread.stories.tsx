import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { MessageThread } from './MessageThread'

const mockMessages = [
  { id: '1', role: 'user' as const, content: 'What is the status of order #1047?', author: 'You', timestamp: '14:32', date: 'Today', readStatus: 'read' as const },
  { id: '2', role: 'ai' as const, content: 'Order **#1047** from *Acme Ltd* is currently **being separated** in stock. Estimated dispatch: **today at 17:00**.', author: 'RUN AI', timestamp: '14:32', date: 'Today' },
  { id: '3', role: 'user' as const, content: 'Can you move up the delivery to before 3pm?', author: 'You', timestamp: '14:33', date: 'Today', readStatus: 'read' as const },
  {
    id: '4',
    role: 'ai' as const,
    content: 'I checked with the logistics team. It is possible to move dispatch to **14:45**, but it will require approval from the stock manager.',
    author: 'RUN AI',
    timestamp: '14:33',
    date: 'Today',
    actionCard: { question: 'Request approval to move dispatch of order #1047 to 14:45?' },
  },
]

const longThreadMessages = [
  { id: '0a', role: 'ai' as const, content: 'Welcome back! How can I help?', author: 'RUN AI', timestamp: '09:00', date: 'Yesterday' },
  { id: '0b', role: 'user' as const, content: 'Just checking in.', author: 'You', timestamp: '09:01', date: 'Yesterday', readStatus: 'read' as const },
  ...mockMessages,
  { id: '5', role: 'user' as const, content: 'Yes, please request it.', author: 'You', timestamp: '14:34', date: 'Today', readStatus: 'delivered' as const },
  { id: '6', role: 'ai' as const, content: 'Request sent to Carlos Mendes (Stock Manager). You will receive a notification once approved.', author: 'RUN AI', timestamp: '14:34', date: 'Today' },
  { id: '7', role: 'user' as const, content: 'Thank you!', author: 'You', timestamp: '14:35', date: 'Today', readStatus: 'read' as const },
  { id: '8', role: 'ai' as const, content: 'You are welcome! Let me know if you need anything else.', author: 'RUN AI', timestamp: '14:35', date: 'Today' },
]

const replyMessages = [
  { id: '1', role: 'ai' as const, content: 'Order **#1047** has been dispatched. Tracking: **TRK-44821**.', author: 'RUN AI', timestamp: '15:00', date: 'Today' },
  { id: '2', role: 'user' as const, content: 'When will it arrive?', author: 'You', timestamp: '15:02', date: 'Today', readStatus: 'read' as const, replyTo: { author: 'RUN AI', content: 'Order #1047 has been dispatched. Tracking: TRK-44821.' } },
  { id: '3', role: 'ai' as const, content: 'Estimated arrival is **Thursday before noon**.', author: 'RUN AI', timestamp: '15:02', date: 'Today' },
]

const meta: Meta<typeof MessageThread> = {
  title: 'Organisms/MessageThread',
  component: MessageThread,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    onSend: { action: 'sent' },
    isTyping: { control: 'boolean' },
    showAuthor: { control: 'boolean' },
  },
  args: { onSend: fn() },
  decorators: [(Story) => <div style={{ height: 500, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof MessageThread>

export const Default: Story = {
  args: { messages: mockMessages, placeholder: 'Message RUN AI...' },
}

export const Empty: Story = {
  args: { messages: [] },
}

export const LongThread: Story = {
  args: { messages: longThreadMessages },
}

export const WithDateSeparators: Story = {
  args: { messages: longThreadMessages },
}

export const WithReplyQuotes: Story = {
  args: { messages: replyMessages },
}

export const TypingIndicator: Story = {
  args: {
    messages: mockMessages,
    placeholder: 'Message RUN AI...',
    isTyping: true,
  },
}

export const GroupWithAuthor: Story = {
  args: {
    messages: [
      { id: '1', role: 'ai' as const, content: 'I just sent the purchase order.', author: 'Maria Silva', timestamp: '14:20', date: 'Today' },
      { id: '2', role: 'ai' as const, content: 'Looks good, I will review it.', author: 'Carlos Mendes', timestamp: '14:22', date: 'Today' },
      { id: '3', role: 'user' as const, content: 'Thanks everyone.', author: 'You', timestamp: '14:25', date: 'Today', readStatus: 'read' as const },
    ],
    showAuthor: true,
  },
}

export const EmptyWithTyping: Story = {
  args: { messages: [], isTyping: true },
}

export const WithReasoningAndChainOfThought: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Quais os 5 produtos com maior margem?', author: 'You', timestamp: '10:00', date: 'Today', readStatus: 'read' as const },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Analisei a tabela de produtos e calculei a margem bruta para cada item. Aqui estao os top 5:\n\n1. **Widget Premium** - 68%\n2. **Sensor IoT** - 62%\n3. **Modulo GPS** - 58%\n4. **Placa Controladora** - 54%\n5. **Kit Automacao** - 51%',
        author: 'RUN AI',
        timestamp: '10:01',
        date: 'Today',
        reasoning: {
          content: 'Preciso consultar a tabela de produtos, calcular preco_venda - custo para cada um, ordenar por margem decrescente e retornar os top 5.',
        },
        chainOfThought: {
          steps: [
            { id: '1', label: 'Consultar tabela de produtos', status: 'complete' as const },
            { id: '2', label: 'Calcular margem bruta', status: 'complete' as const },
            { id: '3', label: 'Ordenar por margem decrescente', status: 'complete' as const },
            { id: '4', label: 'Formatar resposta', status: 'complete' as const },
          ],
        },
        sources: [
          { id: '1', name: 'produtos', description: 'Catalogo de produtos com precos e custos' },
          { id: '2', name: 'categorias', description: 'Categorias de produtos' },
        ],
      },
    ],
  },
}

export const WithPlanAndQueue: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Importar a planilha de fornecedores que enviei.', author: 'You', timestamp: '11:00', date: 'Today', readStatus: 'read' as const },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Iniciando a importacao da planilha. Vou validar os dados e inserir no sistema.',
        author: 'RUN AI',
        timestamp: '11:01',
        date: 'Today',
        plan: {
          title: 'Importar fornecedores',
          description: 'Processando planilha Excel com dados de fornecedores.',
          steps: [
            { id: '1', label: 'Ler arquivo Excel', status: 'complete' as const },
            { id: '2', label: 'Validar formato', status: 'complete' as const },
            { id: '3', label: 'Inserir registros', status: 'active' as const },
            { id: '4', label: 'Verificar duplicatas', status: 'pending' as const },
          ],
        },
        queue: {
          sections: [
            {
              title: 'Validacoes',
              items: [
                { id: '1', content: 'CNPJ valido', completed: true },
                { id: '2', content: 'Endereco completo', completed: true },
                { id: '3', content: 'Email unico', completed: false },
              ],
            },
          ],
        },
      },
    ],
  },
}

export const WithInlineTask: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Faz backup do banco de dados.', author: 'You', timestamp: '08:00', date: 'Today', readStatus: 'read' as const },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Backup iniciado. Exportando todas as tabelas.',
        author: 'RUN AI',
        timestamp: '08:01',
        date: 'Today',
        inlineTask: {
          title: 'Backup do banco de dados',
          status: 'in-progress' as const,
          progress: { current: 4, total: 7 },
          files: [
            { name: 'pedidos.sql', type: 'application/sql' },
            { name: 'clientes.sql', type: 'application/sql' },
            { name: 'produtos.sql', type: 'application/sql' },
            { name: 'schema.json', type: 'application/json' },
          ],
        },
      },
    ],
  },
}

export const WithConfirmationStates: Story = {
  args: {
    messages: [
      {
        id: '1',
        role: 'ai' as const,
        content: 'Transferir R$ 15.000 para fornecedor?',
        author: 'RUN AI',
        timestamp: '09:00',
        date: 'Today',
        confirmation: {
          title: 'Transferir R$ 15.000 para Silva & Cia?',
          description: 'Pagamento referente NF #4521.',
          state: 'requested' as const,
          onApprove: fn(),
          onReject: fn(),
        },
      },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Transferencia anterior foi aprovada.',
        author: 'RUN AI',
        timestamp: '09:05',
        date: 'Today',
        confirmation: {
          title: 'Transferencia aprovada',
          state: 'accepted' as const,
        },
      },
      {
        id: '3',
        role: 'ai' as const,
        content: 'Esta transferencia foi rejeitada.',
        author: 'RUN AI',
        timestamp: '09:10',
        date: 'Today',
        confirmation: {
          title: 'Transferencia rejeitada pelo gerente',
          state: 'rejected' as const,
        },
      },
      {
        id: '4',
        role: 'ai' as const,
        content: 'Aguardando aprovacao.',
        author: 'RUN AI',
        timestamp: '09:15',
        date: 'Today',
        confirmation: {
          title: 'Aguardando aprovacao do diretor',
          state: 'pending' as const,
        },
      },
    ],
  },
}

export const WithSuggestions: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'O que voce pode fazer?', author: 'You', timestamp: '10:00', date: 'Today', readStatus: 'read' as const },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Posso ajudar com diversas tarefas do ERP. Escolha uma opcao ou digite sua pergunta.',
        author: 'RUN AI',
        timestamp: '10:01',
        date: 'Today',
        suggestions: {
          options: ['Ver estoque', 'Listar pedidos', 'Gerar relatorio', 'Consultar NF-e'],
          onSelect: fn(),
        },
      },
    ],
  },
}

export const UserMessageWithAttachments: Story = {
  args: {
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: 'Segue a planilha de produtos para importar.',
        author: 'You',
        timestamp: '11:00',
        date: 'Today',
        readStatus: 'read' as const,
        attachments: [
          { id: '1', fileName: 'produtos-eletronicos.xlsx', fileSize: '2.4 MB', fileType: 'application/spreadsheet' },
          { id: '2', fileName: 'fotos-catalogo.zip', fileSize: '15 MB', fileType: 'application/zip' },
        ],
      },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Recebi a planilha. Vou processar os dados agora.',
        author: 'RUN AI',
        timestamp: '11:01',
        date: 'Today',
      },
    ],
  },
}

export const WithPromptInputAttachments: Story = {
  args: {
    messages: [
      { id: '1', role: 'ai' as const, content: 'Como posso ajudar?', author: 'RUN AI', timestamp: '10:00', date: 'Today' },
    ],
    promptAttachments: [
      { id: '1', fileName: 'relatorio.pdf', fileSize: '2.4 MB', fileType: 'application/pdf' },
      { id: '2', fileName: 'dados.csv', fileSize: '540 KB', fileType: 'text/csv' },
    ],
    onAttachmentAdd: fn(),
    onAttachmentRemove: fn(),
    micState: 'idle' as const,
    onMicClick: fn(),
  },
}

export const WithReactions: Story = {
  args: {
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: 'Vamos fechar o pedido hoje!',
        author: 'You',
        timestamp: '14:00',
        date: 'Today',
        readStatus: 'read' as const,
        reactions: [
          { emoji: '\u{1F44D}', count: 3, reacted: true },
          { emoji: '\u2764\uFE0F', count: 1, reacted: false },
        ],
      },
      {
        id: '2',
        role: 'ai' as const,
        content: 'Pedido **#1089** confirmado! Total: **R$ 24.500,00**.',
        author: 'RUN AI',
        timestamp: '14:01',
        date: 'Today',
        reactions: [
          { emoji: '\u{1F389}', count: 5, reacted: true },
          { emoji: '\u{1F525}', count: 2, reacted: false },
          { emoji: '\u{1F44F}', count: 1, reacted: true },
        ],
      },
    ],
    onReact: fn(),
  },
}

export const PinnedMessages: Story = {
  args: {
    messages: [
      { id: '1', role: 'ai' as const, content: 'Reuniao de alinhamento toda segunda as 10h.', author: 'RUN AI', timestamp: '09:00', date: 'Today', pinned: true },
      { id: '2', role: 'user' as const, content: 'Anotado, obrigado!', author: 'You', timestamp: '09:05', date: 'Today', readStatus: 'read' as const },
      { id: '3', role: 'ai' as const, content: 'Meta do trimestre: **R$ 500k** em vendas.', author: 'RUN AI', timestamp: '09:10', date: 'Today', pinned: true },
    ],
    onPin: fn(),
  },
}

export const StarredMessages: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Revisar contrato do fornecedor TechParts.', author: 'You', timestamp: '10:00', date: 'Today', readStatus: 'read' as const, starred: true },
      { id: '2', role: 'ai' as const, content: 'Contrato atual vence em **15/04/2026**. Clausula de renovacao automatica: **sim**.', author: 'RUN AI', timestamp: '10:01', date: 'Today', starred: true },
      { id: '3', role: 'user' as const, content: 'Bom saber, vou negociar antes.', author: 'You', timestamp: '10:02', date: 'Today', readStatus: 'read' as const },
    ],
    onStar: fn(),
  },
}

const forwardConversations = [
  { id: '1', name: 'RUN AI', type: 'ai' as const, lastMessage: 'How can I help?', timestamp: 'now' },
  { id: '2', name: 'Maria Silva', type: 'dm' as const, lastMessage: 'PO reviewed.', timestamp: '5m', online: true },
  { id: '3', name: 'general-support', type: 'group' as const, lastMessage: 'Ticket #204 opened.', timestamp: '1h' },
]

export const ForwardMode: Story = {
  args: {
    messages: mockMessages,
    onForward: fn(),
    conversations: forwardConversations,
  },
}

export const DeleteMode: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Envia o relatorio de vendas.', author: 'You', timestamp: '10:00', date: 'Today', readStatus: 'read' as const },
      { id: '2', role: 'ai' as const, content: 'Relatorio enviado por email.', author: 'RUN AI', timestamp: '10:01', date: 'Today' },
      { id: '3', role: 'user' as const, content: 'Mensagem errada, quero deletar.', author: 'You', timestamp: '10:05', date: 'Today', readStatus: 'read' as const },
      { id: '4', role: 'user' as const, content: 'Essa tambem.', author: 'You', timestamp: '10:06', date: 'Today', readStatus: 'delivered' as const },
    ],
    onDeleteForEveryone: fn(),
    onDeleteForMe: fn(),
  },
}

export const WithDeletedMessages: Story = {
  args: {
    messages: [
      { id: '1', role: 'user' as const, content: 'Bom dia, segue o arquivo.', author: 'You', timestamp: '09:00', date: 'Today', readStatus: 'read' as const },
      { id: '2', role: 'ai' as const, content: 'Arquivo recebido, processando.', author: 'RUN AI', timestamp: '09:01', date: 'Today' },
      { id: '3', role: 'user' as const, content: '', author: 'You', timestamp: '09:05', date: 'Today', deleted: true },
      { id: '4', role: 'ai' as const, content: 'Resultado do processamento: **42 registros** importados com sucesso.', author: 'RUN AI', timestamp: '09:10', date: 'Today' },
      { id: '5', role: 'user' as const, content: 'Obrigado!', author: 'You', timestamp: '09:12', date: 'Today', readStatus: 'read' as const },
    ],
  },
}

export const WithAudioMessage: Story = {
  args: {
    messages: [
      { id: '1', role: 'ai' as const, content: 'Como posso ajudar?', author: 'RUN AI', timestamp: '10:00', date: 'Today' },
      {
        id: '2',
        role: 'user' as const,
        content: '',
        author: 'You',
        timestamp: '10:05',
        date: 'Today',
        readStatus: 'read' as const,
        audio: {
          url: 'https://example.com/voice-note.mp3',
          duration: '0:42',
          waveform: [0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3],
          transcription: 'Preciso que voce gere o relatorio de vendas do mes passado e envie por email para a diretoria.',
        },
      },
      { id: '3', role: 'ai' as const, content: 'Entendi! Vou gerar o relatorio de vendas e enviar por email.', author: 'RUN AI', timestamp: '10:06', date: 'Today' },
    ],
    onTranscriptionEdit: fn(),
  },
}
