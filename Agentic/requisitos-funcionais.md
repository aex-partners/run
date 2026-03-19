# AEX — Requisitos Funcionais

> AEX é um ERP AI-First, self-hosted e single-tenant, onde toda a interação acontece via chat. O usuário conversa com uma IA para executar operações de negócio — lançar pedidos de venda, disparar processos, enviar emails — sem tocar em formulários ou menus. Mas o diferencial central é que a própria estrutura de dados da empresa é criada e gerenciada pela IA: assim como no Airtable, o usuário define entidades, campos e relações falando com o sistema, e ele constrói o banco de dados em tempo real. Cada empresa instala sua própria instância e molda o sistema exatamente para o seu negócio, sem depender de módulos pré-fabricados.

---

## 1. Comunicação

- Mensagens diretas entre usuários
- Grupos com múltiplos usuários
- Histórico persistente de todas as conversas
- @menção a usuários e à IA em qualquer conversa

---

## 2. Agente de IA

- Receber mensagens e classificar: **opinião** (responde direto) ou **ação** (cria task)
- Monitorar conversas passivamente e intervir quando relevante
- Ser chamado via @menção em grupos
- Narrar execução de tasks no chat em tempo real
- Delegar tasks para agentes especializados
- Ter canal direto (DM) com cada usuário

---

## 3. Tasks

- Criar tasks a partir de linguagem natural
- Classificar tipo de task automaticamente
- Enfileirar e executar tasks
- Registrar status: pendente, em execução, concluída, falhou
- Reportar resultado no chat
- Histórico completo de todas as tasks executadas

---

## 4. Workflows

- Criar workflows via linguagem natural
- Suportar gatilhos: **temporal** (cron), **evento** (ex: pedido aprovado), **manual**
- Ativar/desativar workflows
- Executar workflows como tasks normais
- Notificar resultado nos canais configurados

---

## 5. Banco de Dados Dinâmico

- Criar entidades (tabelas) via conversa
- Definir campos e tipos via conversa
- Definir relacionamentos entre entidades
- Alterar estrutura a qualquer momento via conversa
- CRUD completo via conversa
- Visualizar dados em formato de grid/tabela

---

## 6. Usuários e Permissões

- Cadastro e autenticação de usuários
- Definir permissões por usuário ou grupo
- Controlar quais entidades/dados cada usuário acessa
- Log de quem fez o quê

---

## 7. Plugins

- Instalar plugins na instância
- Cada plugin registra ferramentas que a IA passa a usar
- Cada plugin pode registrar gatilhos para workflows
- Configurar plugins via conversa
- Marketplace interno de plugins disponíveis

---

## 8. Auditoria

- Registro de todas as ações executadas (quem, o quê, quando)
- Histórico de mudanças no schema do banco
- Histórico de execuções de workflows
- Rastreabilidade completa de tasks
