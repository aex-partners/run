import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index.js";
import { entities, settings, conversations, conversationMembers, messages, agents, skills, emailAccounts, mailAccountMembers } from "../../db/schema/index.js";
import { users } from "../../db/schema/auth.js";
import { getEntitiesForRoutines, translateEntity } from "@aex/shared";
import { slugify, serializeFields, type EntityField } from "../../db/entity-fields.js";
import { auth } from "../../auth/index.js";
import { runBackgroundQuery as runBackgroundQueryFn } from "../../ai/background-query.js";
import { getSkillsForRoutines } from "../../ai/skill-templates.js";

// Niche display names per locale (keyed by niche ID)
const NICHE_NAMES: Record<string, Record<string, string>> = {
  en: {
    retail: "Retail", "food-beverage": "Food & Beverage", services: "Professional Services",
    healthcare: "Healthcare", education: "Education", manufacturing: "Manufacturing",
    construction: "Construction", logistics: "Logistics & Transportation",
    technology: "Technology", hospitality: "Hospitality & Tourism", agriculture: "Agriculture",
  },
  "pt-BR": {
    retail: "Varejo", "food-beverage": "Alimentação e Bebidas", services: "Serviços Profissionais",
    healthcare: "Saúde", education: "Educação", manufacturing: "Indústria",
    construction: "Construção Civil", logistics: "Logística e Transporte",
    technology: "Tecnologia", hospitality: "Hotelaria e Turismo", agriculture: "Agricultura",
  },
};

// Sub-niche display names per locale (keyed by niche ID -> sub-niche ID)
const SUB_NICHE_NAMES: Record<string, Record<string, Record<string, string>>> = {
  en: {
    retail: { clothing: "Clothing & Apparel", electronics: "Electronics", grocery: "Grocery & Supermarket", furniture: "Furniture & Home Decor", pharmacy: "Pharmacy & Drugstore", pet: "Pet Shop", sports: "Sports & Outdoors", beauty: "Beauty & Cosmetics", bookstore: "Bookstore & Stationery", jewelry: "Jewelry & Accessories", autoparts: "Auto Parts", convenience: "Convenience Store", ecommerce: "E-commerce" },
    "food-beverage": { restaurant: "Restaurant", cafe: "Cafe & Coffee Shop", bakery: "Bakery & Confectionery", bar: "Bar & Pub", fastFood: "Fast Food", foodTruck: "Food Truck", catering: "Catering", brewery: "Brewery & Winery", mealPrep: "Meal Prep & Delivery", iceCream: "Ice Cream & Desserts" },
    services: { accounting: "Accounting & Bookkeeping", legal: "Legal & Law Firm", consulting: "Consulting", marketing: "Marketing & Advertising", recruitment: "Recruitment & Staffing", insurance: "Insurance", realEstate: "Real Estate", architecture: "Architecture & Design", financial: "Financial Advisory", translation: "Translation & Localization" },
    healthcare: { clinic: "Medical Clinic", dental: "Dental Practice", veterinary: "Veterinary Clinic", psychology: "Psychology & Therapy", physiotherapy: "Physiotherapy & Rehabilitation", laboratory: "Laboratory & Diagnostics", homecare: "Home Care", nutrition: "Nutrition & Dietetics", optometry: "Optometry & Eye Care", alternativeMedicine: "Alternative & Integrative Medicine" },
    education: { school: "School (K-12)", university: "University & College", languageSchool: "Language School", onlineCourses: "Online Courses & E-learning", tutoring: "Tutoring & Test Prep", vocational: "Vocational & Technical Training", earlyChildhood: "Early Childhood & Daycare", musicArts: "Music & Arts School", corporate: "Corporate Training", driving: "Driving School" },
    manufacturing: { foodProcessing: "Food Processing", textile: "Textile & Garment", metalwork: "Metalwork & Machining", plastics: "Plastics & Packaging", woodwork: "Woodwork & Furniture", chemical: "Chemical & Pharmaceutical", electronics: "Electronics Assembly", automotive: "Automotive Parts", printing: "Printing & Publishing", construction: "Construction Materials" },
    construction: { residential: "Residential Construction", commercial: "Commercial Construction", renovation: "Renovation & Remodeling", electrical: "Electrical Services", plumbing: "Plumbing & HVAC", painting: "Painting & Finishing", roofing: "Roofing & Waterproofing", landscaping: "Landscaping", demolition: "Demolition & Earthwork", solarInstall: "Solar Panel Installation" },
    logistics: { freight: "Freight & Cargo", lastMile: "Last Mile Delivery", warehouse: "Warehousing & Storage", moving: "Moving & Relocation", courier: "Courier & Express", fleet: "Fleet Management", customs: "Customs Brokerage", coldChain: "Cold Chain & Refrigerated", rideshare: "Ride-share & Taxi", maritime: "Maritime & Shipping" },
    technology: { saas: "SaaS", webDev: "Web Development", mobileDev: "Mobile App Development", itServices: "IT Services & Support", cybersecurity: "Cybersecurity", dataAnalytics: "Data & Analytics", aiMl: "AI & Machine Learning", iot: "IoT & Hardware", gamedev: "Game Development", cloudHosting: "Cloud & Hosting" },
    hospitality: { hotel: "Hotel & Resort", hostel: "Hostel & Guesthouse", travelAgency: "Travel Agency", tourOperator: "Tour Operator", eventVenue: "Event Venue", camping: "Camping & Glamping", spa: "Spa & Wellness Center", themepark: "Theme Park & Attractions", vacation: "Vacation Rental", ecotourism: "Ecotourism" },
    agriculture: { cropFarming: "Crop Farming", livestock: "Livestock & Ranching", dairy: "Dairy Farming", poultry: "Poultry", aquaculture: "Aquaculture & Fisheries", organic: "Organic Farming", agribusiness: "Agribusiness & Trading", irrigation: "Irrigation & Equipment", forestry: "Forestry & Timber", horticulture: "Horticulture & Nursery" },
  },
  "pt-BR": {
    retail: { clothing: "Roupas e Vestuário", electronics: "Eletrônicos", grocery: "Supermercado e Mercearia", furniture: "Móveis e Decoração", pharmacy: "Farmácia e Drogaria", pet: "Pet Shop", sports: "Esportes e Lazer", beauty: "Beleza e Cosméticos", bookstore: "Livraria e Papelaria", jewelry: "Joalheria e Acessórios", autoparts: "Autopeças", convenience: "Loja de Conveniência", ecommerce: "E-commerce" },
    "food-beverage": { restaurant: "Restaurante", cafe: "Cafeteria", bakery: "Padaria e Confeitaria", bar: "Bar e Pub", fastFood: "Fast Food", foodTruck: "Food Truck", catering: "Buffet e Catering", brewery: "Cervejaria e Vinícola", mealPrep: "Marmitas e Delivery", iceCream: "Sorveteria e Sobremesas" },
    services: { accounting: "Contabilidade", legal: "Advocacia e Jurídico", consulting: "Consultoria", marketing: "Marketing e Publicidade", recruitment: "Recrutamento e Seleção", insurance: "Seguros", realEstate: "Imobiliária", architecture: "Arquitetura e Design", financial: "Assessoria Financeira", translation: "Tradução e Localização" },
    healthcare: { clinic: "Clínica Médica", dental: "Odontologia", veterinary: "Clínica Veterinária", psychology: "Psicologia e Terapia", physiotherapy: "Fisioterapia e Reabilitação", laboratory: "Laboratório e Diagnósticos", homecare: "Home Care", nutrition: "Nutrição e Dietética", optometry: "Ótica e Oftalmologia", alternativeMedicine: "Medicina Alternativa e Integrativa" },
    education: { school: "Escola (Ensino Fundamental e Médio)", university: "Universidade e Faculdade", languageSchool: "Escola de Idiomas", onlineCourses: "Cursos Online e EAD", tutoring: "Reforço Escolar e Preparatório", vocational: "Ensino Técnico e Profissionalizante", earlyChildhood: "Educação Infantil e Creche", musicArts: "Escola de Música e Artes", corporate: "Treinamento Corporativo", driving: "Autoescola" },
    manufacturing: { foodProcessing: "Processamento de Alimentos", textile: "Têxtil e Confecção", metalwork: "Metalurgia e Usinagem", plastics: "Plásticos e Embalagens", woodwork: "Marcenaria e Móveis", chemical: "Química e Farmacêutica", electronics: "Montagem Eletrônica", automotive: "Peças Automotivas", printing: "Gráfica e Editorial", construction: "Materiais de Construção" },
    construction: { residential: "Construção Residencial", commercial: "Construção Comercial", renovation: "Reforma e Remodelação", electrical: "Serviços Elétricos", plumbing: "Hidráulica e HVAC", painting: "Pintura e Acabamento", roofing: "Telhados e Impermeabilização", landscaping: "Paisagismo", demolition: "Demolição e Terraplanagem", solarInstall: "Instalação de Painéis Solares" },
    logistics: { freight: "Frete e Carga", lastMile: "Entrega Last Mile", warehouse: "Armazenagem e Estoque", moving: "Mudanças e Transporte", courier: "Motoboy e Entregas Rápidas", fleet: "Gestão de Frota", customs: "Despachante Aduaneiro", coldChain: "Cadeia Fria e Refrigerado", rideshare: "Transporte de Passageiros", maritime: "Marítimo e Naval" },
    technology: { saas: "SaaS", webDev: "Desenvolvimento Web", mobileDev: "Desenvolvimento Mobile", itServices: "Serviços de TI e Suporte", cybersecurity: "Cibersegurança", dataAnalytics: "Dados e Analytics", aiMl: "IA e Machine Learning", iot: "IoT e Hardware", gamedev: "Desenvolvimento de Jogos", cloudHosting: "Cloud e Hospedagem" },
    hospitality: { hotel: "Hotel e Resort", hostel: "Hostel e Pousada", travelAgency: "Agência de Viagens", tourOperator: "Operadora de Turismo", eventVenue: "Espaço de Eventos", camping: "Camping e Glamping", spa: "Spa e Centro de Bem-estar", themepark: "Parque Temático e Atrações", vacation: "Aluguel de Temporada", ecotourism: "Ecoturismo" },
    agriculture: { cropFarming: "Agricultura de Grãos", livestock: "Pecuária", dairy: "Laticínios", poultry: "Avicultura", aquaculture: "Aquicultura e Pesca", organic: "Agricultura Orgânica", agribusiness: "Agronegócio e Comércio", irrigation: "Irrigação e Equipamentos", forestry: "Silvicultura e Madeira", horticulture: "Horticultura e Viveiro" },
  },
};

// Routine display names per locale (keyed by routine ID)
const ROUTINE_NAMES: Record<string, Record<string, string>> = {
  en: {
    "lead-capture": "Lead Capture", "sales-pipeline": "Sales Pipeline", "quotation-mgmt": "Quotation Management",
    "customer-crm": "Customer CRM", "order-processing": "Order Processing", "commission-tracking": "Commission Tracking",
    "accounts-receivable": "Accounts Receivable", "accounts-payable": "Accounts Payable", "cash-flow": "Cash Flow",
    "expense-tracking": "Expense Tracking", "tax-management": "Tax Management", "budget-planning": "Budget Planning",
    "stock-control": "Stock Control", "purchase-orders": "Purchase Orders", "supplier-mgmt": "Supplier Management",
    "product-catalog": "Product Catalog", "warehouse-mgmt": "Warehouse Management", "inventory-audit": "Inventory Audit",
    "employee-registry": "Employee Registry", "time-attendance": "Time & Attendance", "payroll": "Payroll",
    "leave-mgmt": "Leave Management", "recruitment": "Recruitment", "training": "Training & Development",
    "project-mgmt": "Project Management", "service-tickets": "Service Tickets", "scheduling": "Scheduling",
    "quality-control": "Quality Control", "fleet-tracking": "Fleet Tracking", "document-mgmt": "Document Management",
    "maintenance": "Maintenance", "compliance": "Compliance",
  },
  "pt-BR": {
    "lead-capture": "Captação de Leads", "sales-pipeline": "Pipeline de Vendas", "quotation-mgmt": "Gestão de Orçamentos",
    "customer-crm": "CRM de Clientes", "order-processing": "Processamento de Pedidos", "commission-tracking": "Controle de Comissões",
    "accounts-receivable": "Contas a Receber", "accounts-payable": "Contas a Pagar", "cash-flow": "Fluxo de Caixa",
    "expense-tracking": "Controle de Despesas", "tax-management": "Gestão Tributária", "budget-planning": "Planejamento Orçamentário",
    "stock-control": "Controle de Estoque", "purchase-orders": "Ordens de Compra", "supplier-mgmt": "Gestão de Fornecedores",
    "product-catalog": "Catálogo de Produtos", "warehouse-mgmt": "Gestão de Armazém", "inventory-audit": "Inventário Físico",
    "employee-registry": "Cadastro de Funcionários", "time-attendance": "Ponto e Presença", "payroll": "Folha de Pagamento",
    "leave-mgmt": "Gestão de Férias", "recruitment": "Recrutamento", "training": "Treinamento e Desenvolvimento",
    "project-mgmt": "Gestão de Projetos", "service-tickets": "Chamados de Atendimento", "scheduling": "Agendamento",
    "quality-control": "Controle de Qualidade", "fleet-tracking": "Rastreamento de Frota", "document-mgmt": "Gestão de Documentos",
    "maintenance": "Manutenção", "compliance": "Conformidade",
  },
};

/** Build the kickoff message in the user's selected language */
function buildKickoffMessage(input: {
  orgName: string;
  website?: string;
  niche?: string;
  subNiche?: string;
  language?: string;
  selectedRoutines?: string[];
}): string {
  const lang = input.language?.startsWith("pt") ? "pt-BR" : "en";
  const nicheNames = NICHE_NAMES[lang] ?? NICHE_NAMES.en;
  const subNicheNames = SUB_NICHE_NAMES[lang] ?? SUB_NICHE_NAMES.en;
  const routineNames = ROUTINE_NAMES[lang] ?? ROUTINE_NAMES.en;

  const nicheName = input.niche ? (nicheNames[input.niche] ?? input.niche) : undefined;
  const subNicheName = input.niche && input.subNiche
    ? (subNicheNames[input.niche]?.[input.subNiche] ?? input.subNiche)
    : undefined;

  const parts: string[] = [];

  if (lang === "pt-BR") {
    parts.push(`Acabei de configurar o AEX Run para ${input.orgName}.`);
    if (input.website) parts.push(`Nosso site é ${input.website}.`);
    if (nicheName) parts.push(`Trabalhamos com ${nicheName}${subNicheName ? ` (${subNicheName})` : ""}.`);
    if (input.selectedRoutines && input.selectedRoutines.length > 0) {
      const names = input.selectedRoutines.map((id) => routineNames[id] ?? id);
      parts.push(`Selecionamos estas rotinas: ${names.join(", ")}.`);
    }
    parts.push("Faça agora uma análise completa da nossa empresa:");
    parts.push("1. Acesse nosso site e analise o que fazemos, nossos produtos/serviços, público-alvo e posicionamento.");
    parts.push("2. Pesquise nossas redes sociais (Instagram, Facebook, LinkedIn) via web_search (ex: 'site:instagram.com buenaca'). NÃO acesse perfis diretamente (são bloqueados). Busque posts individuais que aparecem nos resultados.");
    parts.push("3. Busque informações complementares sobre a empresa na internet (CNPJ, endereço, avaliações).");
    parts.push("4. Salve tudo que aprendeu sobre a empresa usando a ferramenta save_knowledge com scope 'company'. Salve: o que a empresa vende, quem são os clientes, onde atua, e qualquer informação relevante.");
    parts.push("5. Com base em tudo isso, se apresente explicando como o AEX Run pode ajudar especificamente o nosso negócio.");
  } else {
    parts.push(`I just set up AEX Run for ${input.orgName}.`);
    if (input.website) parts.push(`Our website is ${input.website}.`);
    if (nicheName) parts.push(`We work in ${nicheName}${subNicheName ? ` (${subNicheName})` : ""}.`);
    if (input.selectedRoutines && input.selectedRoutines.length > 0) {
      const names = input.selectedRoutines.map((id) => routineNames[id] ?? id);
      parts.push(`We selected these routines: ${names.join(", ")}.`);
    }
    parts.push("Analyze our company now:");
    parts.push("1. Visit our website and analyze what we do, our products/services, target audience and positioning.");
    parts.push("2. Search for our social media (Instagram, Facebook, LinkedIn) via web_search (e.g. 'site:instagram.com companyname'). Do NOT access profiles directly (they block scraping). Look for individual posts in search results.");
    parts.push("3. Search for additional company info (registration, address, reviews).");
    parts.push("4. Save everything you learn about the company using the save_knowledge tool with scope 'company'. Save: what the company sells, who the customers are, where it operates, and any relevant info.");
    parts.push("5. Based on all this, introduce yourself explaining how AEX Run can specifically help our business.");
  }

  return parts.join(" ");
}

export const settingsRouter = router({
  isSetupComplete: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "system.setupComplete"))
      .limit(1);

    return { complete: row?.value === "true" };
  }),

  completeSetup: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        orgLogo: z.string().optional(),
        accentColor: z.string().optional(),
        website: z.string().optional(),
        niche: z.string().optional(),
        subNiche: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        currencies: z.array(z.string()).optional(),
        invites: z.array(z.string()).optional(),
        onboardingPath: z.string().nullable().optional(),
        selectedRoutines: z.array(z.string()).optional(),
        emailProvider: z.enum(['smtp']).nullable().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.string().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        smtpFrom: z.string().optional(),
        smtpSecure: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const upsert = async (key: string, value: unknown) => {
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        await ctx.db
          .insert(settings)
          .values({ key, value: serialized })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: serialized, updatedAt: new Date() },
          });
      };

      // Company settings
      await upsert("company.orgName", input.orgName);
      if (input.orgLogo !== undefined) await upsert("company.orgLogo", input.orgLogo);
      if (input.accentColor !== undefined) await upsert("company.accentColor", input.accentColor);
      if (input.website !== undefined) await upsert("company.website", input.website);
      if (input.niche !== undefined) await upsert("company.niche", input.niche);
      if (input.subNiche !== undefined) await upsert("company.subNiche", input.subNiche);

      // Locale settings
      if (input.country !== undefined) await upsert("locale.country", input.country);
      if (input.language !== undefined) await upsert("locale.language", input.language);
      if (input.timezone !== undefined) await upsert("locale.timezone", input.timezone);
      if (input.currencies !== undefined) await upsert("locale.currencies", input.currencies);

      // Onboarding settings
      if (input.onboardingPath !== undefined) await upsert("onboarding.path", input.onboardingPath);
      if (input.selectedRoutines !== undefined) await upsert("onboarding.selectedRoutines", input.selectedRoutines);
      if (input.invites !== undefined) await upsert("onboarding.pendingInvites", input.invites);

      // Email: save server defaults to settings (host, port, secure only)
      if (input.smtpHost) await upsert("mail.smtp.host", input.smtpHost);
      if (input.smtpPort) await upsert("mail.smtp.port", input.smtpPort);
      if (input.smtpSecure !== undefined) await upsert("mail.smtp.secure", input.smtpSecure);

      // Email: create a mail account for the owner if SMTP credentials were provided
      if (input.emailProvider === "smtp" && input.smtpHost && input.smtpUser && input.smtpPass && input.smtpFrom) {
        // Fix #10: skip if an account with same email already exists for this user
        const [existing] = await ctx.db
          .select({ id: emailAccounts.id })
          .from(emailAccounts)
          .where(and(
            eq(emailAccounts.emailAddress, input.smtpFrom),
            eq(emailAccounts.ownerId, ctx.session.user.id),
          ))
          .limit(1);

        if (!existing) {
          const accountId = crypto.randomUUID();
          await ctx.db.insert(emailAccounts).values({
            id: accountId,
            displayName: input.orgName,
            emailAddress: input.smtpFrom,
            fromName: input.orgName,
            smtpHost: input.smtpHost,
            smtpPort: parseInt(input.smtpPort || "587", 10),
            smtpUser: input.smtpUser,
            smtpPass: input.smtpPass,
            smtpSecure: input.smtpSecure ? 1 : 0,
            isShared: 0,
            ownerId: ctx.session.user.id,
          });
          await ctx.db.insert(mailAccountMembers).values({
            accountId,
            userId: ctx.session.user.id,
            canSend: 1,
          });
        }
      }

      // Mark setup as complete
      await upsert("system.setupComplete", "true");

      // Create entities from selected routines (default path)
      if (input.onboardingPath === "default" && input.selectedRoutines && input.selectedRoutines.length > 0) {
        const locale = input.language ?? "en";
        const templates = getEntitiesForRoutines(input.selectedRoutines);
        for (const tpl of templates) {
          const translated = translateEntity(tpl, locale);
          const slug = slugify(tpl.name); // slug always from English name

          // Skip if entity already exists
          const [existing] = await ctx.db
            .select({ id: entities.id })
            .from(entities)
            .where(eq(entities.slug, slug))
            .limit(1);
          if (existing) continue;

          const fields: EntityField[] = translated.fields.map((f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            slug: slugify(f.name),
            type: f.type,
            required: f.required ?? false,
            ...(f.options && f.options.length > 0 ? { options: f.options } : {}),
            ...(f.currencyCode ? { currencyCode: f.currencyCode } : {}),
            ...(f.relationshipEntity ? { relationshipEntityName: f.relationshipEntity } : {}),
          }));

          // Build ai_context: the aiContext + related entities info (always English for AI)
          const related = tpl.relatedEntities.length > 0
            ? ` Related entities: ${tpl.relatedEntities.join(", ")}.`
            : "";
          const aiContext = `${tpl.aiContext}${related}`;

          await ctx.db.insert(entities).values({
            id: crypto.randomUUID(),
            name: translated.name,
            slug,
            description: translated.description,
            aiContext,
            fields: serializeFields(fields),
            createdBy: ctx.session.user.id,
          });
        }
      }

      // Save company profile from wizard data
      if (input.niche) {
        const companyProfile = {
          name: input.orgName,
          type: input.niche,
          processes: input.selectedRoutines ?? [],
          notes: input.subNiche || undefined,
        };
        await upsert("company_profile", companyProfile);
      }

      // Promote the setup user to owner (first user is always the owner)
      await ctx.db
        .update(users)
        .set({ role: "owner" })
        .where(eq(users.id, ctx.session.user.id));

      // Process pending invites: create users and DM conversations
      if (input.invites && input.invites.length > 0) {
        const validEmails = input.invites.filter((e) => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
        for (const email of validEmails) {
          const trimmed = email.trim();
          const namePart = trimmed.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const tempPassword = crypto.randomUUID().slice(0, 12);

          try {
            const res = await auth.api.signUpEmail({
              body: { name: namePart, email: trimmed, password: tempPassword },
            });

            if (res.user) {
              // Create DM conversation
              const dmId = crypto.randomUUID();
              await ctx.db.insert(conversations).values({
                id: dmId,
                name: namePart,
                type: "dm",
              });
              await ctx.db.insert(conversationMembers).values([
                { conversationId: dmId, userId: ctx.session.user.id },
                { conversationId: dmId, userId: res.user.id },
              ]);
            }
          } catch (err) {
            // Skip if user already exists or creation fails
            console.error(`Failed to invite ${trimmed}:`, err);
          }
        }
      }

      // Create skills from selected routines and link to Eric
      const skillIds: string[] = [];
      if (input.selectedRoutines && input.selectedRoutines.length > 0) {
        const matchingSkills = getSkillsForRoutines(input.selectedRoutines);
        for (const tpl of matchingSkills) {
          // Skip if skill already exists
          const [existing] = await ctx.db
            .select({ id: skills.id })
            .from(skills)
            .where(eq(skills.slug, tpl.slug))
            .limit(1);
          if (existing) {
            skillIds.push(existing.id);
            continue;
          }

          const skillId = crypto.randomUUID();
          await ctx.db.insert(skills).values({
            id: skillId,
            name: tpl.name,
            slug: tpl.slug,
            description: tpl.description,
            systemPrompt: tpl.systemPrompt,
            createdBy: ctx.session.user.id,
          });
          skillIds.push(skillId);
        }
      }

      // Create the default Eric agent (every installation gets Eric for free)
      const ericId = crypto.randomUUID();
      await ctx.db.insert(agents).values({
        id: ericId,
        name: "Eric",
        slug: "eric",
        description: "Your AI-powered ERP assistant. Eric helps manage tasks, query data, create entities, and automate workflows.",
        systemPrompt: "",
        skillIds: JSON.stringify(skillIds),
        isSystem: true,
        createdBy: ctx.session.user.id,
      });

      // Create the default Eric conversation
      const convId = crypto.randomUUID();
      await ctx.db.insert(conversations).values({
        id: convId,
        name: "Eric",
        type: "ai",
        agentId: ericId,
      });
      await ctx.db.insert(conversationMembers).values({
        conversationId: convId,
        userId: ctx.session.user.id,
      });

      // Send a kickoff message so Eric starts researching the company (in the user's language)
      const kickoffContent = buildKickoffMessage(input);

      const msgId = crypto.randomUUID();
      await ctx.db.insert(messages).values({
        id: msgId,
        conversationId: convId,
        authorId: ctx.session.user.id,
        content: kickoffContent,
        role: "user",
      });

      // Trigger AI analysis in background
      runBackgroundQueryFn({
        conversationId: convId,
        prompt: kickoffContent,
        userId: ctx.session.user.id,
      }).catch((err: unknown) => console.error("Setup AI kickoff error:", err));

      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);

      if (!row) return null;

      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }),

  set: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const serialized = typeof input.value === "string" ? input.value : JSON.stringify(input.value);

      await ctx.db
        .insert(settings)
        .values({
          key: input.key,
          value: serialized,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: serialized,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),
});
