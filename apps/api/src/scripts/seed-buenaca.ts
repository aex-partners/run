import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../../.env") });

const { db } = await import("../db/index.js");
const { users, entities, entityRecords, settings } = await import("../db/schema/index.js");
const { eq } = await import("drizzle-orm");

async function seedBuenaca() {
  console.log("Seeding Buenaça data...");

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@aex.app"))
    .limit(1);

  if (!admin) {
    console.error("Admin user not found. Run db:seed first.");
    process.exit(1);
  }

  const userId = admin.id;

  // --- Company Profile ---
  await db
    .insert(settings)
    .values({
      key: "company_profile",
      value: JSON.stringify({
        name: "Buenaça Indumentária Gaúcha",
        cnpj: "18.001.592/0001-21",
        type: "retail",
        processes: ["vendas", "estoque", "e-commerce", "atendimento", "financeiro"],
        address: "Rua Gaspar Martins, 639 Sl 1 - Centro, Panambi - RS",
        phone: "(55) 3375-2795",
        whatsapp: "555533752795",
        email: "buenacagaucha@gmail.com",
        website: "buenaca.com.br",
        instagram: "@buenaca",
        facebook: "buenacaartigosgauchos",
        notes: "Loja de indumentária gaúcha tradicional desde 2013. Venda online via Nuvemshop e loja física em Panambi/RS.",
      }),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify({
          name: "Buenaça Indumentária Gaúcha",
          cnpj: "18.001.592/0001-21",
          type: "retail",
          processes: ["vendas", "estoque", "e-commerce", "atendimento", "financeiro"],
          address: "Rua Gaspar Martins, 639 Sl 1 - Centro, Panambi - RS",
          phone: "(55) 3375-2795",
          whatsapp: "555533752795",
          email: "buenacagaucha@gmail.com",
          website: "buenaca.com.br",
          instagram: "@buenaca",
          facebook: "buenacaartigosgauchos",
          notes: "Loja de indumentária gaúcha tradicional desde 2013. Venda online via Nuvemshop e loja física em Panambi/RS.",
        }),
        updatedAt: new Date(),
      },
    });
  console.log("Company profile saved.");

  // --- Helper: upsert entity ---
  async function upsertEntity(
    slug: string,
    name: string,
    description: string,
    aiContext: string,
    fields: { id: string; name: string; slug: string; type: string; required?: boolean; options?: string[] }[],
  ) {
    const [existing] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.slug, slug))
      .limit(1);

    if (existing) {
      await db
        .update(entities)
        .set({ name, description, aiContext, fields: JSON.stringify(fields), updatedAt: new Date() })
        .where(eq(entities.id, existing.id));
      await db.delete(entityRecords).where(eq(entityRecords.entityId, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await db.insert(entities).values({ id, name, slug, description, aiContext, fields: JSON.stringify(fields), createdBy: userId });
    return id;
  }

  // --- Categorias ---
  const categoriaId = await upsertEntity(
    "categorias", "Categorias", "Categorias de produtos da loja",
    "Categorias de produtos da Buenaça. Cada categoria pertence a um público (Masculino, Feminino, Infantil ou Unissex). As principais categorias são: Bombachas, Boinas/Chapéus, Calçados, Camisas, Camisetas, Casacos, Cintos/Guaiacas, Lenços, Saias e Vestidos Prenda.",
    [
      { id: crypto.randomUUID(), name: "Nome", slug: "nome", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Público", slug: "publico", type: "select", required: true, options: ["Masculino", "Feminino", "Infantil", "Unissex"] },
      { id: crypto.randomUUID(), name: "Descrição", slug: "descricao", type: "text" },
    ],
  );

  const categorias = [
    { nome: "Bombachas", publico: "Masculino", descricao: "Bombachas Castelhana, Campeira, Tropeira e Social" },
    { nome: "Boinas e Chapéus", publico: "Masculino", descricao: "Boinas gaúchas e chapéus tradicionais" },
    { nome: "Calçados", publico: "Masculino", descricao: "Botas e alpargatas gaúchas" },
    { nome: "Camisas", publico: "Masculino", descricao: "Camisas tradicionais e sociais" },
    { nome: "Camisetas", publico: "Masculino", descricao: "Camisetas com estampas gaúchas" },
    { nome: "Casacos", publico: "Masculino", descricao: "Casacos e ponchos masculinos" },
    { nome: "Cintos e Guaiacas", publico: "Masculino", descricao: "Cintos de couro e guaiacas tradicionais" },
    { nome: "Lenços", publico: "Masculino", descricao: "Lenços gaúchos tradicionais" },
    { nome: "Bombachas Femininas", publico: "Feminino", descricao: "Bombachas Campesina, Castelhana e Guapa" },
    { nome: "Saias", publico: "Feminino", descricao: "Saias gaúchas tradicionais" },
    { nome: "Chapéus Femininos", publico: "Feminino", descricao: "Chapéus femininos tradicionais" },
    { nome: "Camisas Femininas", publico: "Feminino", descricao: "Camisas e blusas femininas" },
    { nome: "Casacos Femininos", publico: "Feminino", descricao: "Casacos e ponchos femininos" },
    { nome: "Calçados Femininos", publico: "Feminino", descricao: "Botas e alpargatas femininas" },
    { nome: "Bombachas Infantis", publico: "Infantil", descricao: "Bombachas para guris e gurias" },
    { nome: "Vestidos Prenda", publico: "Infantil", descricao: "Vestidos de prenda para gurias" },
    { nome: "Chapéus Infantis", publico: "Infantil", descricao: "Chapéus e bonés infantis" },
    { nome: "Camisetas Infantis", publico: "Infantil", descricao: "Camisetas infantis com estampas gaúchas" },
    { nome: "Calçados Infantis", publico: "Infantil", descricao: "Botas e alpargatas infantis" },
  ];

  for (const cat of categorias) {
    await db.insert(entityRecords).values({ id: crypto.randomUUID(), entityId: categoriaId, data: JSON.stringify(cat), createdBy: userId });
  }
  console.log(`${categorias.length} categorias inseridas.`);

  // --- Produtos ---
  const produtoId = await upsertEntity(
    "produtos", "Produtos", "Catálogo de produtos da loja",
    "Produtos da Buenaça Indumentária Gaúcha. Inclui bombachas (vários modelos), boinas, chapéus, camisas, camisetas, casacos, cintos, guaiacas, lenços, saias, vestidos prenda, calçados e acessórios. Preços em Reais.",
    [
      { id: crypto.randomUUID(), name: "Nome", slug: "nome", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Categoria", slug: "categoria", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Público", slug: "publico", type: "select", required: true, options: ["Masculino", "Feminino", "Infantil", "Unissex"] },
      { id: crypto.randomUUID(), name: "Preço", slug: "preco", type: "number", required: true },
      { id: crypto.randomUUID(), name: "Descrição", slug: "descricao", type: "text" },
      { id: crypto.randomUUID(), name: "Tamanhos", slug: "tamanhos", type: "text" },
      { id: crypto.randomUUID(), name: "Estoque", slug: "estoque", type: "number" },
      { id: crypto.randomUUID(), name: "Status", slug: "status", type: "select", options: ["Ativo", "Inativo", "Esgotado"] },
    ],
  );

  const produtos = [
    { nome: "Bombacha Castelhana Masculina", categoria: "Bombachas", publico: "Masculino", preco: 230, descricao: "Bombacha castelhana tradicional, tecido rústico", tamanhos: "38, 40, 42, 44, 46, 48, 50", estoque: 45, status: "Ativo" },
    { nome: "Bombacha Campeira Masculina", categoria: "Bombachas", publico: "Masculino", preco: 230, descricao: "Bombacha campeira para uso no campo", tamanhos: "38, 40, 42, 44, 46, 48, 50", estoque: 38, status: "Ativo" },
    { nome: "Bombacha Tropeira Masculina", categoria: "Bombachas", publico: "Masculino", preco: 230, descricao: "Bombacha tropeira estilo tradicional", tamanhos: "38, 40, 42, 44, 46, 48, 50", estoque: 30, status: "Ativo" },
    { nome: "Bombacha Social Masculina", categoria: "Bombachas", publico: "Masculino", preco: 260, descricao: "Bombacha social para eventos e festas", tamanhos: "38, 40, 42, 44, 46, 48, 50", estoque: 25, status: "Ativo" },
    { nome: "Boina Gaúcha Preta", categoria: "Boinas e Chapéus", publico: "Masculino", preco: 89, descricao: "Boina gaúcha tradicional em feltro preto", tamanhos: "P, M, G, GG", estoque: 60, status: "Ativo" },
    { nome: "Boina Gaúcha Marrom", categoria: "Boinas e Chapéus", publico: "Masculino", preco: 89, descricao: "Boina gaúcha tradicional em feltro marrom", tamanhos: "P, M, G, GG", estoque: 40, status: "Ativo" },
    { nome: "Chapéu Campeiro", categoria: "Boinas e Chapéus", publico: "Masculino", preco: 129, descricao: "Chapéu campeiro em feltro", tamanhos: "P, M, G, GG", estoque: 20, status: "Ativo" },
    { nome: "Camisa Gaúcha Xadrez", categoria: "Camisas", publico: "Masculino", preco: 149, descricao: "Camisa xadrez tradicional manga longa", tamanhos: "P, M, G, GG, XG", estoque: 35, status: "Ativo" },
    { nome: "Camisa Gaúcha Lisa", categoria: "Camisas", publico: "Masculino", preco: 139, descricao: "Camisa lisa manga longa para pilcha", tamanhos: "P, M, G, GG, XG", estoque: 28, status: "Ativo" },
    { nome: "Camiseta Exclusiva Buenaça", categoria: "Camisetas", publico: "Masculino", preco: 99, descricao: "Camiseta com estampa exclusiva Buenaça", tamanhos: "P, M, G, GG, XG", estoque: 80, status: "Ativo" },
    { nome: "Casaco de Lã Gaúcho", categoria: "Casacos", publico: "Masculino", preco: 289, descricao: "Casaco de lã estilo gaúcho tradicional", tamanhos: "P, M, G, GG", estoque: 15, status: "Ativo" },
    { nome: "Poncho Gaúcho", categoria: "Casacos", publico: "Masculino", preco: 349, descricao: "Poncho de lã tradicional gaúcho", tamanhos: "Único", estoque: 12, status: "Ativo" },
    { nome: "Cinto de Couro Gaúcho", categoria: "Cintos e Guaiacas", publico: "Masculino", preco: 119, descricao: "Cinto de couro legítimo com fivela gaúcha", tamanhos: "90, 95, 100, 105, 110, 115", estoque: 50, status: "Ativo" },
    { nome: "Guaiaca Gaúcha", categoria: "Cintos e Guaiacas", publico: "Masculino", preco: 159, descricao: "Guaiaca de couro com bolsos laterais", tamanhos: "90, 95, 100, 105, 110", estoque: 22, status: "Ativo" },
    { nome: "Lenço Gaúcho Vermelho", categoria: "Lenços", publico: "Masculino", preco: 39, descricao: "Lenço gaúcho vermelho tradicional", tamanhos: "Único", estoque: 100, status: "Ativo" },
    { nome: "Lenço Gaúcho Branco", categoria: "Lenços", publico: "Masculino", preco: 39, descricao: "Lenço gaúcho branco", tamanhos: "Único", estoque: 80, status: "Ativo" },
    { nome: "Bota Gaúcha Masculina", categoria: "Calçados", publico: "Masculino", preco: 299, descricao: "Bota gaúcha em couro legítimo", tamanhos: "38, 39, 40, 41, 42, 43, 44", estoque: 18, status: "Ativo" },
    { nome: "Alpargata Gaúcha Masculina", categoria: "Calçados", publico: "Masculino", preco: 79, descricao: "Alpargata gaúcha tradicional", tamanhos: "38, 39, 40, 41, 42, 43, 44", estoque: 40, status: "Ativo" },
    { nome: "Bombacha Guapa Feminina", categoria: "Bombachas Femininas", publico: "Feminino", preco: 189, descricao: "Bombacha feminina modelo Guapa, corte moderno", tamanhos: "36, 38, 40, 42, 44, 46", estoque: 35, status: "Ativo" },
    { nome: "Bombacha Campesina Feminina", categoria: "Bombachas Femininas", publico: "Feminino", preco: 230, descricao: "Bombacha feminina modelo Campesina", tamanhos: "36, 38, 40, 42, 44, 46", estoque: 28, status: "Ativo" },
    { nome: "Bombacha Castelhana Feminina", categoria: "Bombachas Femininas", publico: "Feminino", preco: 230, descricao: "Bombacha feminina modelo Castelhana", tamanhos: "36, 38, 40, 42, 44, 46", estoque: 22, status: "Ativo" },
    { nome: "Saia Gaúcha Longa", categoria: "Saias", publico: "Feminino", preco: 179, descricao: "Saia gaúcha longa para pilcha feminina", tamanhos: "P, M, G, GG", estoque: 20, status: "Ativo" },
    { nome: "Camiseta Exclusiva Feminina", categoria: "Camisetas", publico: "Feminino", preco: 99, descricao: "Camiseta feminina com estampa exclusiva Buenaça", tamanhos: "P, M, G, GG", estoque: 50, status: "Ativo" },
    { nome: "Camisa Feminina Pilcha", categoria: "Camisas Femininas", publico: "Feminino", preco: 149, descricao: "Camisa feminina para pilcha", tamanhos: "P, M, G, GG", estoque: 25, status: "Ativo" },
    { nome: "Bota Gaúcha Feminina", categoria: "Calçados Femininos", publico: "Feminino", preco: 279, descricao: "Bota gaúcha feminina em couro", tamanhos: "34, 35, 36, 37, 38, 39", estoque: 15, status: "Ativo" },
    { nome: "Chapéu Feminino Gaúcho", categoria: "Chapéus Femininos", publico: "Feminino", preco: 119, descricao: "Chapéu feminino em feltro", tamanhos: "P, M, G", estoque: 18, status: "Ativo" },
    { nome: "Bombacha Infantil Guri", categoria: "Bombachas Infantis", publico: "Infantil", preco: 149, descricao: "Bombacha infantil para meninos", tamanhos: "2, 4, 6, 8, 10, 12, 14", estoque: 40, status: "Ativo" },
    { nome: "Bombacha Infantil Guria", categoria: "Bombachas Infantis", publico: "Infantil", preco: 149, descricao: "Bombacha infantil para meninas", tamanhos: "2, 4, 6, 8, 10, 12, 14", estoque: 35, status: "Ativo" },
    { nome: "Vestido Prenda Infantil", categoria: "Vestidos Prenda", publico: "Infantil", preco: 199, descricao: "Vestido de prenda infantil completo", tamanhos: "2, 4, 6, 8, 10, 12, 14", estoque: 20, status: "Ativo" },
    { nome: "Chapéu Infantil Gaúcho", categoria: "Chapéus Infantis", publico: "Infantil", preco: 69, descricao: "Chapéu infantil em feltro", tamanhos: "P, M, G", estoque: 30, status: "Ativo" },
    { nome: "Camiseta Infantil Buenaça", categoria: "Camisetas Infantis", publico: "Infantil", preco: 69, descricao: "Camiseta infantil com estampa Buenaça", tamanhos: "2, 4, 6, 8, 10, 12, 14", estoque: 45, status: "Ativo" },
    { nome: "Alpargata Infantil", categoria: "Calçados Infantis", publico: "Infantil", preco: 59, descricao: "Alpargata gaúcha infantil", tamanhos: "24, 26, 28, 30, 32, 34", estoque: 35, status: "Ativo" },
    { nome: "Lenço Infantil", categoria: "Lenços", publico: "Infantil", preco: 29, descricao: "Lenço gaúcho infantil", tamanhos: "Único", estoque: 60, status: "Ativo" },
  ];

  for (const prod of produtos) {
    await db.insert(entityRecords).values({ id: crypto.randomUUID(), entityId: produtoId, data: JSON.stringify(prod), createdBy: userId });
  }
  console.log(`${produtos.length} produtos inseridos.`);

  // --- Clientes ---
  const clienteId = await upsertEntity(
    "clientes", "Clientes", "Cadastro de clientes da loja",
    "Clientes da Buenaça. A maioria é do RS. Incluem pessoas físicas e CTGs. Compram na loja física e online.",
    [
      { id: crypto.randomUUID(), name: "Nome", slug: "nome", type: "text", required: true, unique: true },
      { id: crypto.randomUUID(), name: "Email", slug: "email", type: "email" },
      { id: crypto.randomUUID(), name: "Telefone", slug: "telefone", type: "phone" },
      { id: crypto.randomUUID(), name: "Cidade", slug: "cidade", type: "text" },
      { id: crypto.randomUUID(), name: "Estado", slug: "estado", type: "text" },
      { id: crypto.randomUUID(), name: "CPF/CNPJ", slug: "cpf-cnpj", type: "text", unique: true },
      { id: crypto.randomUUID(), name: "Observações", slug: "observacoes", type: "text" },
    ],
  );

  const clientes = [
    { nome: "João Pedro Machado", email: "joao.machado@email.com", telefone: "(55) 99912-3456", cidade: "Panambi", estado: "RS", "cpf-cnpj": "012.345.678-90", observacoes: "Cliente desde 2018, compra bombachas todo ano" },
    { nome: "Maria Eduarda Silva", email: "meduarda@email.com", telefone: "(55) 99934-5678", cidade: "Ijuí", estado: "RS", "cpf-cnpj": "023.456.789-01", observacoes: "Compra vestidos prenda para as filhas" },
    { nome: "CTG Porteira do Rio Grande", email: "ctgporteira@email.com", telefone: "(55) 3333-4444", cidade: "Cruz Alta", estado: "RS", "cpf-cnpj": "12.345.678/0001-90", observacoes: "Compra em quantidade para peões e prendas. Pede desconto especial." },
    { nome: "Ana Clara Ferreira", email: "anaclara.f@email.com", telefone: "(51) 99876-5432", cidade: "Porto Alegre", estado: "RS", "cpf-cnpj": "034.567.890-12", observacoes: "Compra online, frete para capital" },
    { nome: "Carlos Alberto Reis", email: "carlosreis@email.com", telefone: "(55) 99845-6789", cidade: "Santa Rosa", estado: "RS", "cpf-cnpj": "045.678.901-23", observacoes: "Patrão de CTG, compra grandes lotes" },
    { nome: "Fernanda Oliveira", email: "fernanda.oli@email.com", telefone: "(54) 99756-7890", cidade: "Passo Fundo", estado: "RS", "cpf-cnpj": "056.789.012-34", observacoes: "Professora de dança, compra saias e bombachas femininas" },
    { nome: "CTG Sentinela do Planalto", email: "sentinela.ctg@email.com", telefone: "(55) 3344-5566", cidade: "Carazinho", estado: "RS", "cpf-cnpj": "23.456.789/0001-01", observacoes: "Pedido anual para Semana Farroupilha" },
    { nome: "Lucas Gabriel Santos", email: "lucas.santos@email.com", telefone: "(55) 99923-4567", cidade: "Panambi", estado: "RS", "cpf-cnpj": "067.890.123-45", observacoes: "Cliente local, frequente na loja física" },
    { nome: "Rafaela Brum Costa", email: "rafaela.brum@email.com", telefone: "(51) 99812-3456", cidade: "Canoas", estado: "RS", "cpf-cnpj": "078.901.234-56", observacoes: "Compra online, cliente recorrente" },
    { nome: "Pedro Henrique Lopes", email: "pedro.lopes@email.com", telefone: "(47) 99934-5678", cidade: "Blumenau", estado: "SC", "cpf-cnpj": "089.012.345-67", observacoes: "Gaúcho morando em SC, compra pela internet" },
    { nome: "Juliana Macedo", email: "jumacedo@email.com", telefone: "(55) 99867-8901", cidade: "Santo Ângelo", estado: "RS", "cpf-cnpj": "090.123.456-78", observacoes: "Compra para toda a família" },
    { nome: "Antônio de Souza", email: "antonio.souza@email.com", telefone: "(55) 99778-9012", cidade: "Condor", estado: "RS", "cpf-cnpj": "101.234.567-89", observacoes: "Produtor rural, compra bombachas campeiras" },
  ];

  for (const cli of clientes) {
    await db.insert(entityRecords).values({ id: crypto.randomUUID(), entityId: clienteId, data: JSON.stringify(cli), createdBy: userId });
  }
  console.log(`${clientes.length} clientes inseridos.`);

  // --- Pedidos ---
  const pedidoId = await upsertEntity(
    "pedidos", "Pedidos", "Pedidos de venda da loja",
    "Pedidos de venda da Buenaça. Podem ser feitos na loja física ou online. Status: Pendente > Pago > Preparando > Enviado > Entregue. Pagamento por Pix (com desconto), cartão (até 12x sem juros) ou boleto.",
    [
      { id: crypto.randomUUID(), name: "Número", slug: "numero", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Cliente", slug: "cliente", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Data", slug: "data", type: "date", required: true },
      { id: crypto.randomUUID(), name: "Itens", slug: "itens", type: "text", required: true },
      { id: crypto.randomUUID(), name: "Total", slug: "total", type: "number", required: true },
      { id: crypto.randomUUID(), name: "Status", slug: "status", type: "select", required: true, options: ["Pendente", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"] },
      { id: crypto.randomUUID(), name: "Pagamento", slug: "pagamento", type: "select", options: ["Pix", "Cartão", "Boleto"] },
      { id: crypto.randomUUID(), name: "Observações", slug: "observacoes", type: "text" },
    ],
  );

  const pedidos = [
    { numero: "BUE-2025-001", cliente: "João Pedro Machado", data: "2025-03-01", itens: "1x Bombacha Castelhana Masculina (42), 1x Lenço Gaúcho Vermelho", total: 269, status: "Entregue", pagamento: "Pix", observacoes: "Retirou na loja" },
    { numero: "BUE-2025-002", cliente: "Maria Eduarda Silva", data: "2025-03-03", itens: "2x Vestido Prenda Infantil (6, 10)", total: 398, status: "Entregue", pagamento: "Cartão", observacoes: "Enviado para Ijuí" },
    { numero: "BUE-2025-003", cliente: "CTG Porteira do Rio Grande", data: "2025-03-05", itens: "10x Bombacha Castelhana Masculina, 10x Lenço Gaúcho Vermelho, 5x Bombacha Guapa Feminina", total: 3645, status: "Entregue", pagamento: "Boleto", observacoes: "Pedido para Semana Farroupilha, desconto de 10%" },
    { numero: "BUE-2025-004", cliente: "Ana Clara Ferreira", data: "2025-03-06", itens: "1x Bombacha Guapa Feminina (38), 1x Camiseta Exclusiva Feminina (M)", total: 288, status: "Enviado", pagamento: "Cartão", observacoes: "Frete para Porto Alegre" },
    { numero: "BUE-2025-005", cliente: "Carlos Alberto Reis", data: "2025-03-07", itens: "5x Bombacha Campeira Masculina, 5x Boina Gaúcha Preta", total: 1595, status: "Preparando", pagamento: "Pix", observacoes: "Compra para peões da estância" },
    { numero: "BUE-2025-006", cliente: "Fernanda Oliveira", data: "2025-03-08", itens: "3x Saia Gaúcha Longa (P, M, G), 2x Bombacha Campesina Feminina (38, 40)", total: 997, status: "Pago", pagamento: "Cartão", observacoes: "Para alunas de dança" },
    { numero: "BUE-2025-007", cliente: "Lucas Gabriel Santos", data: "2025-03-10", itens: "1x Poncho Gaúcho, 1x Boina Gaúcha Marrom (G)", total: 438, status: "Entregue", pagamento: "Pix", observacoes: "Retirou na loja" },
    { numero: "BUE-2025-008", cliente: "Pedro Henrique Lopes", data: "2025-03-11", itens: "1x Bombacha Tropeira Masculina (44), 1x Cinto de Couro Gaúcho (100), 1x Camiseta Exclusiva Buenaça (G)", total: 448, status: "Enviado", pagamento: "Cartão", observacoes: "Frete para Blumenau/SC" },
    { numero: "BUE-2025-009", cliente: "CTG Sentinela do Planalto", data: "2025-03-12", itens: "8x Bombacha Castelhana Masculina, 6x Bombacha Guapa Feminina, 4x Vestido Prenda Infantil, 15x Lenço Gaúcho Vermelho", total: 4559, status: "Pendente", pagamento: "Boleto", observacoes: "Orçamento para Semana Farroupilha 2025, aguardando aprovação" },
    { numero: "BUE-2025-010", cliente: "Juliana Macedo", data: "2025-03-13", itens: "1x Bombacha Infantil Guri (8), 1x Bombacha Infantil Guria (6), 1x Chapéu Infantil Gaúcho (P), 2x Lenço Infantil", total: 425, status: "Pendente", pagamento: "Pix", observacoes: "Aguardando confirmação Pix" },
    { numero: "BUE-2025-011", cliente: "Antônio de Souza", data: "2025-03-13", itens: "2x Bombacha Campeira Masculina (46, 48), 1x Alpargata Gaúcha Masculina (42)", total: 539, status: "Pendente", pagamento: "Pix", observacoes: "" },
    { numero: "BUE-2025-012", cliente: "Rafaela Brum Costa", data: "2025-03-13", itens: "1x Camisa Feminina Pilcha (M), 1x Chapéu Feminino Gaúcho (M)", total: 268, status: "Pendente", pagamento: "Cartão", observacoes: "Frete para Canoas/RS" },
  ];

  for (const ped of pedidos) {
    await db.insert(entityRecords).values({ id: crypto.randomUUID(), entityId: pedidoId, data: JSON.stringify(ped), createdBy: userId });
  }
  console.log(`${pedidos.length} pedidos inseridos.`);

  // --- Fornecedores ---
  const fornecedorId = await upsertEntity(
    "fornecedores", "Fornecedores", "Fornecedores de matéria-prima e produtos",
    "Fornecedores da Buenaça. Incluem confecções de bombachas, fabricantes de chapéus/boinas, curtumes para couro, tecelagens para ponchos. A maioria é do RS e SC.",
    [
      { id: crypto.randomUUID(), name: "Nome", slug: "nome", type: "text", required: true },
      { id: crypto.randomUUID(), name: "CNPJ", slug: "cnpj", type: "text" },
      { id: crypto.randomUUID(), name: "Contato", slug: "contato", type: "text" },
      { id: crypto.randomUUID(), name: "Telefone", slug: "telefone", type: "phone" },
      { id: crypto.randomUUID(), name: "Email", slug: "email", type: "email" },
      { id: crypto.randomUUID(), name: "Cidade", slug: "cidade", type: "text" },
      { id: crypto.randomUUID(), name: "Produtos", slug: "produtos", type: "text" },
      { id: crypto.randomUUID(), name: "Observações", slug: "observacoes", type: "text" },
    ],
  );

  const fornecedores = [
    { nome: "Confecções Gaúchas Ltda", cnpj: "11.222.333/0001-44", contato: "Roberto Menezes", telefone: "(51) 3222-3333", email: "contato@confgauchas.com.br", cidade: "São Leopoldo/RS", produtos: "Bombachas masculinas e femininas, camisas", observacoes: "Fornecedor principal de bombachas. Prazo 30/60 dias." },
    { nome: "Chapelaria Tradição", cnpj: "22.333.444/0001-55", contato: "Marcos Almeida", telefone: "(54) 3344-5566", email: "vendas@chapelaria.com.br", cidade: "Caxias do Sul/RS", produtos: "Boinas, chapéus em feltro e palha", observacoes: "Melhor qualidade de boinas da região" },
    { nome: "Curtume Fronteira", cnpj: "33.444.555/0001-66", contato: "José Carlos", telefone: "(55) 3355-6677", email: "vendas@curtumefronteira.com.br", cidade: "São Borja/RS", produtos: "Cintos, guaiacas, matéria-prima em couro", observacoes: "Couro de qualidade para cintos e guaiacas" },
    { nome: "Calçados Campeiros", cnpj: "44.555.666/0001-77", contato: "Paulo Ferreira", telefone: "(51) 3366-7788", email: "comercial@calcadoscampeiros.com.br", cidade: "Novo Hamburgo/RS", produtos: "Botas gaúchas, alpargatas", observacoes: "Prazo 45 dias. Entrega rápida." },
    { nome: "Tecelagem Serra Gaúcha", cnpj: "55.666.777/0001-88", contato: "Ana Paula Rech", telefone: "(54) 3377-8899", email: "tecelagem@serragaucha.com.br", cidade: "Farroupilha/RS", produtos: "Ponchos, lenços, tecidos para saias", observacoes: "Ponchos de lã artesanais, boa qualidade" },
  ];

  for (const forn of fornecedores) {
    await db.insert(entityRecords).values({ id: crypto.randomUUID(), entityId: fornecedorId, data: JSON.stringify(forn), createdBy: userId });
  }
  console.log(`${fornecedores.length} fornecedores inseridos.`);

  console.log("\nSeed Buenaça completo!");
  process.exit(0);
}

seedBuenaca().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
