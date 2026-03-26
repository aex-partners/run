/**
 * RUN Entity Knowledge Base
 *
 * Single source of truth for all entity definitions in the system.
 * Consumed by:
 *   1. Entity creation (onboarding templates + AI tool)
 *   2. AI system prompt (semantic context for each entity)
 *   3. UI hints and descriptions
 *
 * Each entry describes WHAT the entity is, HOW it's used in business context,
 * and its RELATIONSHIPS with other entities. The AI uses this to understand
 * business intent and map user language to the right data structures.
 */

import type { EntityFieldType, EntityFieldOption } from "../types/index.js";

export interface FieldDefinition {
  name: string;
  type: EntityFieldType;
  required?: boolean;
  options?: EntityFieldOption[];
  currencyCode?: string;
  relationshipEntity?: string;
  /** What this field represents in business context */
  hint?: string;
}

export interface EntityKnowledge {
  /** Entity display name (e.g. "Purchase Orders") */
  name: string;
  /** One-line description for DB storage and UI */
  description: string;
  /**
   * Rich context for the AI: what this entity represents, when to use it,
   * common operations, business rules, and how it relates to other entities.
   * Written as if explaining to a new employee.
   */
  aiContext: string;
  /** Which routine template(s) this entity belongs to */
  routines: string[];
  /** Category for grouping */
  category: "sales" | "finance" | "inventory" | "hr" | "operations";
  /** Related entity names (for AI to understand connections) */
  relatedEntities: string[];
  /** Field definitions with business hints */
  fields: FieldDefinition[];
}

export const ENTITY_KNOWLEDGE: EntityKnowledge[] = [
  // ── Sales ──────────────────────────────────────────────────────────

  {
    name: "Leads",
    description: "Potential customers captured from various channels before they become paying customers.",
    aiContext:
      "A Lead is a person or company that has shown interest but hasn't bought yet. " +
      "Leads come from sources like website forms, referrals, social media, cold calls, or events. " +
      "The typical flow is: capture lead > qualify > convert to Customer + create a Deal. " +
      "When a user says 'new lead' or 'someone contacted us', create a Lead record. " +
      "When they say 'this lead is now a customer', help them create a Customer record from the Lead data.",
    routines: ["lead-capture"],
    category: "sales",
    relatedEntities: ["Customers", "Deals"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Full name of the lead or company name" },
      { name: "Email", type: "email", hint: "Primary contact email" },
      { name: "Phone", type: "phone", hint: "Primary contact phone" },
      { name: "Source", type: "select", options: [{ value: "Website", label: "Website" }, { value: "Referral", label: "Referral" }, { value: "Social Media", label: "Social Media" }, { value: "Cold Call", label: "Cold Call" }, { value: "Event", label: "Event" }, { value: "Other", label: "Other" }], hint: "How the lead found us" },
      { name: "Status", type: "status", options: [{ value: "New", label: "New", color: "#6b7280" }, { value: "Contacted", label: "Contacted", color: "#2563eb" }, { value: "Qualified", label: "Qualified", color: "#16a34a" }, { value: "Unqualified", label: "Unqualified", color: "#dc2626" }], hint: "Current qualification stage" },
      { name: "Notes", type: "long_text", hint: "Free-form notes about interactions" },
    ],
  },

  {
    name: "Deals",
    description: "Active sales opportunities tracked through pipeline stages until closed.",
    aiContext:
      "A Deal represents a specific sales opportunity with an expected value and close date. " +
      "Deals move through stages: Prospecting > Qualification > Proposal > Negotiation > Closed Won/Lost. " +
      "Each Deal is usually tied to a Customer or Lead. " +
      "When a user says 'new opportunity', 'potential sale', or 'deal worth X', create a Deal. " +
      "When they say 'we closed it' or 'they signed', update the stage to Closed Won. " +
      "Deals are the core of revenue forecasting: sum of open deals by expected close date.",
    routines: ["sales-pipeline"],
    category: "sales",
    relatedEntities: ["Customers", "Leads", "Quotations", "Commissions"],
    fields: [
      { name: "Title", type: "text", required: true, hint: "Short description of the opportunity" },
      { name: "Value", type: "currency", currencyCode: "BRL", hint: "Expected revenue amount" },
      { name: "Stage", type: "status", options: [{ value: "Prospecting", label: "Prospecting", color: "#6b7280" }, { value: "Qualification", label: "Qualification", color: "#d97706" }, { value: "Proposal", label: "Proposal", color: "#2563eb" }, { value: "Negotiation", label: "Negotiation", color: "#d97706" }, { value: "Closed Won", label: "Closed Won", color: "#16a34a" }, { value: "Closed Lost", label: "Closed Lost", color: "#dc2626" }], hint: "Pipeline stage" },
      { name: "Contact", type: "text", hint: "Primary contact name or customer" },
      { name: "Expected Close", type: "date", hint: "When we expect to close this deal" },
      { name: "Notes", type: "long_text", hint: "Deal notes, meeting summaries, next steps" },
    ],
  },

  {
    name: "Quotations",
    description: "Formal price proposals sent to clients before they confirm an order.",
    aiContext:
      "A Quotation (also called quote, proposal, or estimate) is a formal document with prices sent to a client. " +
      "The lifecycle is: Draft > Sent > Accepted/Rejected/Expired. " +
      "An accepted Quotation usually becomes an Order. " +
      "When a user says 'send a quote', 'price proposal', or 'estimate for the client', create a Quotation. " +
      "When they say 'the client accepted', update status and suggest creating an Order from it.",
    routines: ["quotation-mgmt"],
    category: "sales",
    relatedEntities: ["Customers", "Orders", "Deals"],
    fields: [
      { name: "Number", type: "text", required: true, hint: "Quote reference number" },
      { name: "Client", type: "text", required: true, hint: "Client or company name" },
      { name: "Date", type: "date", required: true, hint: "Issue date" },
      { name: "Valid Until", type: "date", hint: "Expiration date" },
      { name: "Total", type: "currency", currencyCode: "BRL", hint: "Total quoted amount" },
      { name: "Status", type: "status", options: [{ value: "Draft", label: "Draft", color: "#6b7280" }, { value: "Sent", label: "Sent", color: "#2563eb" }, { value: "Accepted", label: "Accepted", color: "#16a34a" }, { value: "Rejected", label: "Rejected", color: "#dc2626" }, { value: "Expired", label: "Expired", color: "#dc2626" }], hint: "Current status" },
      { name: "Notes", type: "long_text", hint: "Terms, conditions, special notes" },
    ],
  },

  {
    name: "Customers",
    description: "Active customers with contact information and business relationship history.",
    aiContext:
      "A Customer is a person or company that has a business relationship with us. " +
      "Customers are the most referenced entity: Orders, Quotations, Receivables, and Tickets all link back to a Customer. " +
      "When a user mentions a person or company by name in a business context, check if they exist as a Customer first. " +
      "Segments help differentiate service levels: Individual (B2C), Small Business, Enterprise (B2B). " +
      "When a user says 'register this client', 'new customer', or a Lead is converted, create a Customer record.",
    routines: ["customer-crm"],
    category: "sales",
    relatedEntities: ["Leads", "Orders", "Quotations", "Receivables", "Tickets"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Customer or company name" },
      { name: "Email", type: "email", hint: "Primary contact email" },
      { name: "Phone", type: "phone", hint: "Primary contact phone" },
      { name: "Company", type: "text", hint: "Company name (if contact is an individual within a company)" },
      { name: "Address", type: "text", hint: "Full address" },
      { name: "Segment", type: "select", options: [{ value: "Individual", label: "Individual" }, { value: "Small Business", label: "Small Business" }, { value: "Enterprise", label: "Enterprise" }], hint: "Customer segment for service level" },
      { name: "Notes", type: "long_text", hint: "Relationship notes, preferences" },
    ],
  },

  {
    name: "Orders",
    description: "Sales orders tracking the lifecycle from placement through delivery.",
    aiContext:
      "An Order (sales order) represents a confirmed purchase by a customer. " +
      "The lifecycle is: Pending > Processing > Shipped > Delivered (or Cancelled). " +
      "Orders are created after a Quotation is accepted, or directly when a customer buys. " +
      "Each Order reduces available Inventory and generates a Receivable (money owed to us). " +
      "When a user says 'new order', 'the client confirmed', or 'ship this', work with the Orders entity. " +
      "When they ask about revenue, query Orders with status Delivered and sum the Total field.",
    routines: ["order-processing"],
    category: "sales",
    relatedEntities: ["Customers", "Quotations", "Inventory", "Receivables", "Commissions"],
    fields: [
      { name: "Number", type: "text", required: true, hint: "Order reference number" },
      { name: "Customer", type: "text", required: true, hint: "Customer name" },
      { name: "Date", type: "date", required: true, hint: "Order date" },
      { name: "Total", type: "currency", currencyCode: "BRL", hint: "Order total amount" },
      { name: "Status", type: "status", options: [{ value: "Pending", label: "Pending", color: "#d97706" }, { value: "Processing", label: "Processing", color: "#2563eb" }, { value: "Shipped", label: "Shipped", color: "#2563eb" }, { value: "Delivered", label: "Delivered", color: "#16a34a" }, { value: "Cancelled", label: "Cancelled", color: "#dc2626" }], hint: "Fulfillment status" },
      { name: "Tracking", type: "text", hint: "Shipping tracking number" },
      { name: "Notes", type: "long_text", hint: "Special instructions, delivery notes" },
    ],
  },

  {
    name: "Commissions",
    description: "Sales commission calculations tied to deals and salespeople.",
    aiContext:
      "Commissions track how much a salesperson earns from a closed Deal or Order. " +
      "Typically calculated as a percentage (Rate) of the Deal value (Amount). " +
      "The flow is: Deal closes > Commission record created > Approved by manager > Paid in payroll. " +
      "When a user asks 'how much does X earn in commissions' or 'calculate commission', query this entity.",
    routines: ["commission-tracking"],
    category: "sales",
    relatedEntities: ["Deals", "Orders", "Employees", "Payroll"],
    fields: [
      { name: "Salesperson", type: "text", required: true, hint: "Name of the salesperson" },
      { name: "Deal", type: "text", hint: "Related deal or order reference" },
      { name: "Amount", type: "currency", currencyCode: "BRL", required: true, hint: "Commission amount" },
      { name: "Rate", type: "number", hint: "Commission rate percentage" },
      { name: "Date", type: "date", hint: "Commission date" },
      { name: "Status", type: "status", options: [{ value: "Pending", label: "Pending", color: "#d97706" }, { value: "Approved", label: "Approved", color: "#16a34a" }, { value: "Paid", label: "Paid", color: "#16a34a" }], hint: "Payment status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────

  {
    name: "Receivables",
    description: "Money owed to the company by customers, tracked by invoice.",
    aiContext:
      "Accounts Receivable (Receivables) tracks money that customers owe us. " +
      "Each record represents an invoice sent to a customer. " +
      "Statuses: Open (unpaid), Partial (partially paid), Paid (fully settled), Overdue (past due date). " +
      "When a user says 'the client paid', update the Paid Amount and Status. " +
      "When they ask 'how much are we owed' or 'overdue invoices', query Receivables filtered by status. " +
      "Receivables are generated from Orders or can be created manually for services.",
    routines: ["accounts-receivable"],
    category: "finance",
    relatedEntities: ["Customers", "Orders", "Cash Flow"],
    fields: [
      { name: "Invoice", type: "text", required: true, hint: "Invoice number" },
      { name: "Customer", type: "text", required: true, hint: "Customer name" },
      { name: "Amount", type: "currency", currencyCode: "BRL", required: true, hint: "Total invoice amount" },
      { name: "Due Date", type: "date", required: true, hint: "Payment due date" },
      { name: "Status", type: "status", options: [{ value: "Open", label: "Open", color: "#6b7280" }, { value: "Partial", label: "Partial", color: "#d97706" }, { value: "Paid", label: "Paid", color: "#16a34a" }, { value: "Overdue", label: "Overdue", color: "#dc2626" }], hint: "Payment status" },
      { name: "Paid Amount", type: "currency", currencyCode: "BRL", hint: "Amount received so far" },
      { name: "Notes", type: "long_text", hint: "Payment terms, partial payment notes" },
    ],
  },

  {
    name: "Payables",
    description: "Money the company owes to vendors and suppliers.",
    aiContext:
      "Accounts Payable (Payables) tracks what we owe to suppliers and vendors. " +
      "Each record represents a bill or invoice from a supplier. " +
      "The mirror of Receivables: they owe us (Receivables), we owe them (Payables). " +
      "When a user says 'we received a bill', 'pay the supplier', or 'vendor invoice', use Payables. " +
      "When they ask 'how much do we owe', query Payables with Open/Overdue status.",
    routines: ["accounts-payable"],
    category: "finance",
    relatedEntities: ["Suppliers", "Purchase Orders", "Cash Flow"],
    fields: [
      { name: "Bill", type: "text", required: true, hint: "Bill or invoice number" },
      { name: "Vendor", type: "text", required: true, hint: "Vendor or supplier name" },
      { name: "Amount", type: "currency", currencyCode: "BRL", required: true, hint: "Total bill amount" },
      { name: "Due Date", type: "date", required: true, hint: "Payment due date" },
      { name: "Status", type: "status", options: [{ value: "Open", label: "Open", color: "#6b7280" }, { value: "Partial", label: "Partial", color: "#d97706" }, { value: "Paid", label: "Paid", color: "#16a34a" }, { value: "Overdue", label: "Overdue", color: "#dc2626" }], hint: "Payment status" },
      { name: "Paid Amount", type: "currency", currencyCode: "BRL", hint: "Amount paid so far" },
      { name: "Notes", type: "long_text", hint: "Payment terms, bank details" },
    ],
  },

  {
    name: "Cash Flow",
    description: "Daily record of money coming in and going out of the business.",
    aiContext:
      "Cash Flow tracks every financial movement: income (money in) and expenses (money out). " +
      "The Balance field shows the running total. " +
      "When a user asks 'how's our cash flow', 'what did we spend this month', or 'income this week', query Cash Flow. " +
      "Cash Flow entries are often created automatically from Receivables (income when paid) and Payables (expense when paid), " +
      "but can also be manual entries for things like bank transfers or petty cash.",
    routines: ["cash-flow"],
    category: "finance",
    relatedEntities: ["Receivables", "Payables", "Expenses"],
    fields: [
      { name: "Date", type: "date", required: true, hint: "Transaction date" },
      { name: "Description", type: "long_text", required: true, hint: "What the transaction is for" },
      { name: "Type", type: "select", required: true, options: [{ value: "Income", label: "Income" }, { value: "Expense", label: "Expense" }], hint: "Money in or money out" },
      { name: "Category", type: "text", hint: "Classification (e.g. Sales, Rent, Utilities)" },
      { name: "Amount", type: "currency", currencyCode: "BRL", required: true, hint: "Transaction amount" },
      { name: "Balance", type: "currency", currencyCode: "BRL", hint: "Running balance after this entry" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Expenses",
    description: "Business expenses categorized for tracking and reimbursement.",
    aiContext:
      "Expenses track individual business costs like travel, office supplies, software subscriptions. " +
      "Different from Cash Flow: Expenses focus on categorization and approval, Cash Flow on the actual money movement. " +
      "When a user says 'I spent X on Y', 'expense report', or 'reimburse me', create an Expense. " +
      "The Receipt checkbox tracks whether a receipt/proof was attached.",
    routines: ["expense-tracking"],
    category: "finance",
    relatedEntities: ["Cash Flow", "Budgets"],
    fields: [
      { name: "Date", type: "date", required: true, hint: "When the expense occurred" },
      { name: "Description", type: "long_text", required: true, hint: "What was purchased" },
      { name: "Category", type: "select", options: [{ value: "Travel", label: "Travel" }, { value: "Office", label: "Office" }, { value: "Software", label: "Software" }, { value: "Marketing", label: "Marketing" }, { value: "Utilities", label: "Utilities" }, { value: "Other", label: "Other" }], hint: "Expense category" },
      { name: "Amount", type: "currency", currencyCode: "BRL", required: true, hint: "Amount spent" },
      { name: "Paid By", type: "text", hint: "Who paid (employee name or company card)" },
      { name: "Receipt", type: "checkbox", hint: "Whether a receipt is attached" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Tax Obligations",
    description: "Tax deadlines, filings, and payment tracking.",
    aiContext:
      "Tax Obligations track what taxes the company needs to pay, when, and whether they've been filed. " +
      "When a user asks about taxes, deadlines, or filing status, query this entity. " +
      "Important for compliance: overdue taxes can result in penalties.",
    routines: ["tax-management"],
    category: "finance",
    relatedEntities: ["Cash Flow"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Tax name (e.g. VAT, Income Tax)" },
      { name: "Type", type: "text", required: true, hint: "Tax type" },
      { name: "Period", type: "text", hint: "Filing period (e.g. Q1 2026, March 2026)" },
      { name: "Due Date", type: "date", hint: "Filing/payment deadline" },
      { name: "Amount", type: "currency", currencyCode: "BRL", hint: "Tax amount" },
      { name: "Status", type: "status", options: [{ value: "Pending", label: "Pending", color: "#d97706" }, { value: "Filed", label: "Filed", color: "#2563eb" }, { value: "Paid", label: "Paid", color: "#16a34a" }], hint: "Filing status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Budgets",
    description: "Departmental budget allocations with planned vs actual tracking.",
    aiContext:
      "Budgets track planned spending by department/area vs actual spending. " +
      "Variance = Planned - Actual (positive means under budget, negative means over). " +
      "When a user asks 'are we on budget', 'how much did marketing spend', or 'budget status', query Budgets. " +
      "Budgets are typically set per period (monthly, quarterly, yearly).",
    routines: ["budget-planning"],
    category: "finance",
    relatedEntities: ["Expenses", "Cash Flow"],
    fields: [
      { name: "Department", type: "text", required: true, hint: "Department or cost center" },
      { name: "Period", type: "text", required: true, hint: "Budget period (e.g. Q1 2026)" },
      { name: "Planned", type: "currency", currencyCode: "BRL", required: true, hint: "Budgeted amount" },
      { name: "Actual", type: "currency", currencyCode: "BRL", hint: "Amount spent so far" },
      { name: "Variance", type: "currency", currencyCode: "BRL", hint: "Planned minus Actual" },
      { name: "Status", type: "status", options: [{ value: "Draft", label: "Draft", color: "#6b7280" }, { value: "Active", label: "Active", color: "#16a34a" }, { value: "Closed", label: "Closed", color: "#6b7280" }], hint: "Budget status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  // ── Inventory ──────────────────────────────────────────────────────

  {
    name: "Inventory",
    description: "Current stock levels for products with minimum stock alerts.",
    aiContext:
      "Inventory tracks how much of each product we have in stock. " +
      "Min Stock triggers alerts when quantity drops below it. " +
      "When a user asks 'how much do we have', 'stock of X', or 'what's running low', query Inventory. " +
      "Inventory decreases when Orders are shipped and increases when Purchase Orders are received. " +
      "When quantity < min_stock, proactively warn the user about low stock.",
    routines: ["stock-control"],
    category: "inventory",
    relatedEntities: ["Products", "Purchase Orders", "Orders", "Warehouses"],
    fields: [
      { name: "Product", type: "text", required: true, hint: "Product name" },
      { name: "SKU", type: "text", hint: "Stock keeping unit code" },
      { name: "Quantity", type: "number", required: true, hint: "Current stock quantity" },
      { name: "Min Stock", type: "number", hint: "Minimum stock level (alert threshold)" },
      { name: "Location", type: "text", hint: "Storage location or warehouse" },
      { name: "Last Updated", type: "date", hint: "Last stock update date" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Purchase Orders",
    description: "Orders placed with suppliers to replenish inventory.",
    aiContext:
      "A Purchase Order (PO) is what we send to a Supplier to buy products or materials. " +
      "The opposite of a sales Order: we're the buyer, not the seller. " +
      "Lifecycle: Draft > Sent > Confirmed > Received (or Cancelled). " +
      "When received, it increases Inventory and creates a Payable. " +
      "When a user says 'order from supplier', 'buy more stock', or 'restock X', create a Purchase Order.",
    routines: ["purchase-orders"],
    category: "inventory",
    relatedEntities: ["Suppliers", "Inventory", "Payables"],
    fields: [
      { name: "Number", type: "text", required: true, hint: "PO reference number" },
      { name: "Supplier", type: "text", required: true, hint: "Supplier name" },
      { name: "Date", type: "date", required: true, hint: "Order date" },
      { name: "Total", type: "currency", currencyCode: "BRL", hint: "Total order amount" },
      { name: "Status", type: "status", options: [{ value: "Draft", label: "Draft", color: "#6b7280" }, { value: "Sent", label: "Sent", color: "#2563eb" }, { value: "Confirmed", label: "Confirmed", color: "#2563eb" }, { value: "Received", label: "Received", color: "#16a34a" }, { value: "Cancelled", label: "Cancelled", color: "#dc2626" }], hint: "Order status" },
      { name: "Delivery Date", type: "date", hint: "Expected delivery date" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Suppliers",
    description: "Vendor database with contact information and payment terms.",
    aiContext:
      "Suppliers (vendors) are companies or individuals we buy from. " +
      "Every Purchase Order references a Supplier. Payables track what we owe them. " +
      "When a user mentions a vendor, supplier, or asks 'who do we buy X from', check Suppliers.",
    routines: ["supplier-mgmt"],
    category: "inventory",
    relatedEntities: ["Purchase Orders", "Payables", "Products"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Supplier or company name" },
      { name: "Contact", type: "text", hint: "Contact person name" },
      { name: "Email", type: "email", hint: "Contact email" },
      { name: "Phone", type: "phone", hint: "Contact phone" },
      { name: "Address", type: "text", hint: "Business address" },
      { name: "Payment Terms", type: "text", hint: "e.g. Net 30, COD, 50% upfront" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Products",
    description: "Product catalog with pricing, costs, and categorization.",
    aiContext:
      "Products are what the company sells (or buys to resell). " +
      "Price = what we charge customers. Cost = what we pay suppliers. Margin = Price - Cost. " +
      "Products appear in Orders, Quotations, Inventory, and Purchase Orders. " +
      "When a user asks 'what do we sell', 'product list', or 'how much does X cost', query Products. " +
      "Active checkbox determines if the product is currently available for sale.",
    routines: ["product-catalog"],
    category: "inventory",
    relatedEntities: ["Inventory", "Orders", "Quotations", "Purchase Orders"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Product name" },
      { name: "SKU", type: "text", hint: "Stock keeping unit code" },
      { name: "Category", type: "text", hint: "Product category" },
      { name: "Price", type: "currency", currencyCode: "BRL", hint: "Selling price" },
      { name: "Cost", type: "currency", currencyCode: "BRL", hint: "Purchase/production cost" },
      { name: "Description", type: "long_text", hint: "Product description" },
      { name: "Active", type: "checkbox", hint: "Whether product is currently for sale" },
    ],
  },

  {
    name: "Warehouses",
    description: "Storage locations with capacity tracking.",
    aiContext:
      "Warehouses represent physical storage locations. " +
      "Used for inventory organization when a company has multiple storage sites. " +
      "Capacity and Used fields help plan space allocation.",
    routines: ["warehouse-mgmt"],
    category: "inventory",
    relatedEntities: ["Inventory", "Inventory Audits"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Warehouse name or code" },
      { name: "Location", type: "text", hint: "Physical address" },
      { name: "Capacity", type: "number", hint: "Total storage capacity (units)" },
      { name: "Used", type: "number", hint: "Currently used capacity" },
      { name: "Manager", type: "text", hint: "Warehouse manager" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Inventory Audits",
    description: "Scheduled physical inventory counts and discrepancy tracking.",
    aiContext:
      "Inventory Audits are periodic physical counts to verify that actual stock matches system records. " +
      "Discrepancies field tracks the number of items where physical count doesn't match the system. " +
      "When a user says 'count the stock', 'inventory check', or 'audit the warehouse', use this entity.",
    routines: ["inventory-audit"],
    category: "inventory",
    relatedEntities: ["Inventory", "Warehouses"],
    fields: [
      { name: "Date", type: "date", required: true, hint: "Audit date" },
      { name: "Location", type: "text", required: true, hint: "Warehouse or area audited" },
      { name: "Auditor", type: "text", hint: "Person performing the audit" },
      { name: "Status", type: "status", options: [{ value: "Planned", label: "Planned", color: "#6b7280" }, { value: "In Progress", label: "In Progress", color: "#d97706" }, { value: "Completed", label: "Completed", color: "#16a34a" }], hint: "Audit status" },
      { name: "Discrepancies", type: "number", hint: "Number of items with count differences" },
      { name: "Notes", type: "long_text" },
    ],
  },

  // ── HR ─────────────────────────────────────────────────────────────

  {
    name: "Employees",
    description: "Employee records with contact info, department, and employment status.",
    aiContext:
      "Employees are people who work for the company. " +
      "Referenced by Attendance, Payroll, Leave Requests, Commissions, and many other entities. " +
      "When a user mentions a person's name in an HR context, check Employees first. " +
      "Status tracks: Active (working), On Leave (temporary absence), Terminated (no longer employed).",
    routines: ["employee-registry"],
    category: "hr",
    relatedEntities: ["Attendance", "Payroll", "Leave Requests", "Commissions"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Employee full name" },
      { name: "Email", type: "email", required: true, hint: "Work email" },
      { name: "Phone", type: "phone", hint: "Contact phone" },
      { name: "Department", type: "text", hint: "Department name" },
      { name: "Position", type: "text", hint: "Job title" },
      { name: "Hire Date", type: "date", hint: "Employment start date" },
      { name: "Status", type: "status", options: [{ value: "Active", label: "Active", color: "#16a34a" }, { value: "On Leave", label: "On Leave", color: "#d97706" }, { value: "Terminated", label: "Terminated", color: "#dc2626" }], hint: "Employment status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Attendance",
    description: "Daily time tracking with clock-in/out and hours worked.",
    aiContext:
      "Attendance records daily work hours for each employee. " +
      "Clock In/Out are text fields (e.g. '08:30', '17:45') since we don't have a time type. " +
      "Hours is calculated or manually entered. " +
      "When a user asks 'who was absent today', 'hours worked this week', filter by date and status.",
    routines: ["time-attendance"],
    category: "hr",
    relatedEntities: ["Employees", "Payroll"],
    fields: [
      { name: "Employee", type: "text", required: true, hint: "Employee name" },
      { name: "Date", type: "date", required: true, hint: "Work date" },
      { name: "Clock In", type: "text", hint: "Clock-in time (HH:MM)" },
      { name: "Clock Out", type: "text", hint: "Clock-out time (HH:MM)" },
      { name: "Hours", type: "number", hint: "Total hours worked" },
      { name: "Status", type: "status", options: [{ value: "Present", label: "Present", color: "#16a34a" }, { value: "Absent", label: "Absent", color: "#dc2626" }, { value: "Late", label: "Late", color: "#d97706" }, { value: "Half Day", label: "Half Day", color: "#d97706" }], hint: "Attendance status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Payroll",
    description: "Monthly salary processing with base pay, deductions, and net pay.",
    aiContext:
      "Payroll processes salary payments for employees. " +
      "Each record represents one employee's pay for one period. " +
      "Net Pay = Base Salary - Deductions. " +
      "Lifecycle: Draft (being prepared) > Processed (calculated) > Paid (money sent). " +
      "When a user asks about salaries, pay, or 'run payroll', use this entity.",
    routines: ["payroll"],
    category: "hr",
    relatedEntities: ["Employees", "Attendance", "Commissions"],
    fields: [
      { name: "Employee", type: "text", required: true, hint: "Employee name" },
      { name: "Period", type: "text", required: true, hint: "Pay period (e.g. March 2026)" },
      { name: "Base Salary", type: "currency", currencyCode: "BRL", required: true, hint: "Gross salary amount" },
      { name: "Deductions", type: "currency", currencyCode: "BRL", hint: "Total deductions (taxes, benefits)" },
      { name: "Net Pay", type: "currency", currencyCode: "BRL", hint: "Take-home pay" },
      { name: "Status", type: "status", options: [{ value: "Draft", label: "Draft", color: "#6b7280" }, { value: "Processed", label: "Processed", color: "#2563eb" }, { value: "Paid", label: "Paid", color: "#16a34a" }], hint: "Processing status" },
      { name: "Payment Date", type: "date", hint: "Actual payment date" },
    ],
  },

  {
    name: "Leave Requests",
    description: "Employee time-off requests with approval workflow.",
    aiContext:
      "Leave Requests track when employees ask for time off. " +
      "Types: Vacation, Sick, Personal, Maternity, Other. " +
      "Days is typically End Date - Start Date. " +
      "When a user says 'I need a day off', 'vacation request', or 'sick leave', create a Leave Request.",
    routines: ["leave-mgmt"],
    category: "hr",
    relatedEntities: ["Employees", "Attendance"],
    fields: [
      { name: "Employee", type: "text", required: true, hint: "Employee name" },
      { name: "Type", type: "select", options: [{ value: "Vacation", label: "Vacation" }, { value: "Sick", label: "Sick" }, { value: "Personal", label: "Personal" }, { value: "Maternity", label: "Maternity" }, { value: "Other", label: "Other" }], hint: "Leave type" },
      { name: "Start Date", type: "date", required: true, hint: "First day of leave" },
      { name: "End Date", type: "date", required: true, hint: "Last day of leave" },
      { name: "Days", type: "number", hint: "Total leave days" },
      { name: "Status", type: "status", options: [{ value: "Pending", label: "Pending", color: "#d97706" }, { value: "Approved", label: "Approved", color: "#16a34a" }, { value: "Rejected", label: "Rejected", color: "#dc2626" }], hint: "Approval status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Candidates",
    description: "Job applicants tracked through the hiring pipeline.",
    aiContext:
      "Candidates are people applying for open positions. " +
      "The hiring pipeline: Applied > Screening > Interview > Offer > Hired/Rejected. " +
      "When a candidate is Hired, they should be converted to an Employee record. " +
      "When a user says 'new applicant', 'interview scheduled', or 'we hired someone', use Candidates.",
    routines: ["recruitment"],
    category: "hr",
    relatedEntities: ["Employees"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Candidate full name" },
      { name: "Email", type: "email", hint: "Contact email" },
      { name: "Phone", type: "phone", hint: "Contact phone" },
      { name: "Position", type: "text", required: true, hint: "Position they applied for" },
      { name: "Source", type: "text", hint: "Where they found the job (LinkedIn, referral, etc.)" },
      { name: "Stage", type: "status", options: [{ value: "Applied", label: "Applied", color: "#6b7280" }, { value: "Screening", label: "Screening", color: "#d97706" }, { value: "Interview", label: "Interview", color: "#d97706" }, { value: "Offer", label: "Offer", color: "#2563eb" }, { value: "Hired", label: "Hired", color: "#16a34a" }, { value: "Rejected", label: "Rejected", color: "#dc2626" }], hint: "Pipeline stage" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Training Programs",
    description: "Employee training and certification programs.",
    aiContext:
      "Training Programs track internal or external training for employees. " +
      "Certification checkbox indicates if the training results in a formal certification. " +
      "When a user asks about training, skill development, or certifications, use this entity.",
    routines: ["training"],
    category: "hr",
    relatedEntities: ["Employees"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Training program name" },
      { name: "Instructor", type: "text", hint: "Trainer name" },
      { name: "Start Date", type: "date", hint: "Training start date" },
      { name: "End Date", type: "date", hint: "Training end date" },
      { name: "Participants", type: "number", hint: "Number of participants" },
      { name: "Status", type: "status", options: [{ value: "Planned", label: "Planned", color: "#6b7280" }, { value: "Active", label: "Active", color: "#2563eb" }, { value: "Completed", label: "Completed", color: "#16a34a" }], hint: "Program status" },
      { name: "Certification", type: "checkbox", hint: "Leads to a certification" },
      { name: "Notes", type: "long_text" },
    ],
  },

  // ── Operations ─────────────────────────────────────────────────────

  {
    name: "Projects",
    description: "Project tracking with milestones, deadlines, and budget control.",
    aiContext:
      "Projects represent major work initiatives with a defined scope, timeline, and budget. " +
      "When a user says 'new project', 'project status', or 'are we on schedule', use Projects. " +
      "Budget field helps track project profitability (compare with actual expenses).",
    routines: ["project-mgmt"],
    category: "operations",
    relatedEntities: ["Customers", "Employees", "Tickets"],
    fields: [
      { name: "Name", type: "text", required: true, hint: "Project name" },
      { name: "Client", type: "text", hint: "Client this project is for" },
      { name: "Start Date", type: "date", hint: "Project start" },
      { name: "Deadline", type: "date", hint: "Project deadline" },
      { name: "Budget", type: "currency", currencyCode: "BRL", hint: "Total project budget" },
      { name: "Status", type: "status", options: [{ value: "Planning", label: "Planning", color: "#6b7280" }, { value: "Active", label: "Active", color: "#16a34a" }, { value: "On Hold", label: "On Hold", color: "#d97706" }, { value: "Completed", label: "Completed", color: "#16a34a" }, { value: "Cancelled", label: "Cancelled", color: "#dc2626" }], hint: "Project status" },
      { name: "Owner", type: "text", hint: "Project manager/owner" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Tickets",
    description: "Customer support and service requests with priority tracking.",
    aiContext:
      "Tickets (support tickets, service requests) track customer issues and requests. " +
      "Priority levels: Low, Medium, High, Critical. Critical means business-impacting. " +
      "When a user says 'customer complaint', 'support request', 'bug report', or 'issue', create a Ticket. " +
      "When they ask about open issues or response times, query Tickets.",
    routines: ["service-tickets"],
    category: "operations",
    relatedEntities: ["Customers", "Projects", "Employees"],
    fields: [
      { name: "Title", type: "text", required: true, hint: "Short description of the issue" },
      { name: "Customer", type: "text", hint: "Customer who reported it" },
      { name: "Priority", type: "priority", options: [{ value: "Low", label: "Low", color: "#2563eb" }, { value: "Medium", label: "Medium", color: "#d97706" }, { value: "High", label: "High", color: "#ea580c" }, { value: "Critical", label: "Critical", color: "#dc2626" }], hint: "Urgency level" },
      { name: "Status", type: "status", options: [{ value: "Open", label: "Open", color: "#6b7280" }, { value: "In Progress", label: "In Progress", color: "#d97706" }, { value: "Waiting", label: "Waiting", color: "#d97706" }, { value: "Resolved", label: "Resolved", color: "#16a34a" }, { value: "Closed", label: "Closed", color: "#16a34a" }], hint: "Resolution status" },
      { name: "Assigned To", type: "text", hint: "Person responsible" },
      { name: "Created Date", type: "date", hint: "When the ticket was created" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Appointments",
    description: "Scheduled meetings, bookings, and client appointments.",
    aiContext:
      "Appointments track scheduled meetings and bookings. " +
      "When a user says 'schedule a meeting', 'book an appointment', or 'what's on my calendar', use Appointments. " +
      "No Show status helps track clients who don't attend.",
    routines: ["scheduling"],
    category: "operations",
    relatedEntities: ["Customers", "Employees"],
    fields: [
      { name: "Title", type: "text", required: true, hint: "Appointment title/purpose" },
      { name: "Client", type: "text", hint: "Client name" },
      { name: "Date", type: "date", required: true, hint: "Appointment date" },
      { name: "Time", type: "text", hint: "Start time (HH:MM)" },
      { name: "Duration", type: "text", hint: "Duration (e.g. 30min, 1h)" },
      { name: "Status", type: "status", options: [{ value: "Scheduled", label: "Scheduled", color: "#6b7280" }, { value: "Confirmed", label: "Confirmed", color: "#2563eb" }, { value: "Completed", label: "Completed", color: "#16a34a" }, { value: "Cancelled", label: "Cancelled", color: "#dc2626" }, { value: "No Show", label: "No Show", color: "#dc2626" }], hint: "Appointment status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Inspections",
    description: "Quality control inspections with pass/fail results.",
    aiContext:
      "Inspections are quality checks performed on products or batches during manufacturing or receiving. " +
      "Result: Pass (meets standards), Fail (rejected), Conditional (minor issues). " +
      "When a user asks about quality, defects, or inspection results, use this entity.",
    routines: ["quality-control"],
    category: "operations",
    relatedEntities: ["Products", "Inventory"],
    fields: [
      { name: "Product", type: "text", required: true, hint: "Product or batch inspected" },
      { name: "Date", type: "date", required: true, hint: "Inspection date" },
      { name: "Inspector", type: "text", hint: "Person who performed the inspection" },
      { name: "Result", type: "status", options: [{ value: "Pass", label: "Pass", color: "#16a34a" }, { value: "Fail", label: "Fail", color: "#dc2626" }, { value: "Conditional", label: "Conditional", color: "#d97706" }], hint: "Inspection result" },
      { name: "Defects", type: "number", hint: "Number of defects found" },
      { name: "Batch", type: "text", hint: "Batch or lot number" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Vehicles",
    description: "Company fleet with driver assignments and maintenance tracking.",
    aiContext:
      "Vehicles tracks the company fleet: cars, trucks, vans. " +
      "When a user asks about fleet, drivers, mileage, or vehicle maintenance, use this entity.",
    routines: ["fleet-tracking"],
    category: "operations",
    relatedEntities: ["Maintenance Orders", "Employees"],
    fields: [
      { name: "Plate", type: "text", required: true, hint: "License plate number" },
      { name: "Model", type: "text", hint: "Vehicle make and model" },
      { name: "Driver", type: "text", hint: "Assigned driver" },
      { name: "Mileage", type: "number", hint: "Current odometer reading" },
      { name: "Fuel Type", type: "select", options: [{ value: "Gasoline", label: "Gasoline" }, { value: "Diesel", label: "Diesel" }, { value: "Electric", label: "Electric" }, { value: "Hybrid", label: "Hybrid" }], hint: "Fuel type" },
      { name: "Last Maintenance", type: "date", hint: "Date of last service" },
      { name: "Status", type: "status", options: [{ value: "Available", label: "Available", color: "#16a34a" }, { value: "In Use", label: "In Use", color: "#2563eb" }, { value: "Maintenance", label: "Maintenance", color: "#d97706" }], hint: "Current availability" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Documents",
    description: "Business document registry with expiration tracking.",
    aiContext:
      "Documents tracks important business files: contracts, certificates, policies. " +
      "Expiry Date is critical for compliance: expired contracts or certificates need renewal. " +
      "When a user asks about contracts, documents, or 'what expires soon', query Documents.",
    routines: ["document-mgmt"],
    category: "operations",
    relatedEntities: ["Compliance Items"],
    fields: [
      { name: "Title", type: "text", required: true, hint: "Document title" },
      { name: "Category", type: "select", options: [{ value: "Contract", label: "Contract" }, { value: "Certificate", label: "Certificate" }, { value: "Report", label: "Report" }, { value: "Invoice", label: "Invoice" }, { value: "Policy", label: "Policy" }, { value: "Other", label: "Other" }], hint: "Document type" },
      { name: "Date", type: "date", hint: "Document date" },
      { name: "Owner", type: "text", hint: "Person responsible" },
      { name: "Expiry Date", type: "date", hint: "When the document expires" },
      { name: "Status", type: "status", options: [{ value: "Draft", label: "Draft", color: "#6b7280" }, { value: "Active", label: "Active", color: "#16a34a" }, { value: "Expired", label: "Expired", color: "#dc2626" }, { value: "Archived", label: "Archived", color: "#6b7280" }], hint: "Document status" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Maintenance Orders",
    description: "Equipment and facility maintenance scheduling and cost tracking.",
    aiContext:
      "Maintenance Orders track service work on equipment, vehicles, or facilities. " +
      "Types: Preventive (scheduled), Corrective (fixing a problem), Emergency (urgent). " +
      "When a user says 'the machine broke', 'schedule maintenance', or 'repair needed', create a Maintenance Order.",
    routines: ["maintenance"],
    category: "operations",
    relatedEntities: ["Vehicles", "Employees"],
    fields: [
      { name: "Equipment", type: "text", required: true, hint: "Equipment or asset name" },
      { name: "Type", type: "select", options: [{ value: "Preventive", label: "Preventive" }, { value: "Corrective", label: "Corrective" }, { value: "Emergency", label: "Emergency" }], hint: "Maintenance type" },
      { name: "Date", type: "date", required: true, hint: "Scheduled/actual date" },
      { name: "Assigned To", type: "text", hint: "Technician or team" },
      { name: "Status", type: "status", options: [{ value: "Planned", label: "Planned", color: "#6b7280" }, { value: "In Progress", label: "In Progress", color: "#d97706" }, { value: "Completed", label: "Completed", color: "#16a34a" }], hint: "Work status" },
      { name: "Cost", type: "currency", currencyCode: "BRL", hint: "Maintenance cost" },
      { name: "Notes", type: "long_text" },
    ],
  },

  {
    name: "Compliance Items",
    description: "Regulatory requirements and compliance deadline tracking.",
    aiContext:
      "Compliance Items track regulatory requirements the company must meet. " +
      "Non-Compliant status is critical and may need immediate attention. " +
      "When a user asks about regulations, compliance status, or audits, use this entity.",
    routines: ["compliance"],
    category: "operations",
    relatedEntities: ["Documents"],
    fields: [
      { name: "Requirement", type: "text", required: true, hint: "What is required" },
      { name: "Regulation", type: "text", hint: "Governing regulation or law" },
      { name: "Due Date", type: "date", hint: "Compliance deadline" },
      { name: "Responsible", type: "text", hint: "Person responsible" },
      { name: "Status", type: "status", options: [{ value: "Compliant", label: "Compliant", color: "#16a34a" }, { value: "Non-Compliant", label: "Non-Compliant", color: "#dc2626" }, { value: "In Progress", label: "In Progress", color: "#d97706" }, { value: "Pending Review", label: "Pending Review", color: "#d97706" }], hint: "Compliance status" },
      { name: "Last Review", type: "date", hint: "Date of last review" },
      { name: "Notes", type: "long_text" },
    ],
  },
];

// ── Lookup helpers ───────────────────────────────────────────────────

/** Build a map from entity name to its knowledge entry */
export function getKnowledgeMap(): Map<string, EntityKnowledge> {
  return new Map(ENTITY_KNOWLEDGE.map((k) => [k.name, k]));
}

/** Get entity templates for a set of routine IDs (for onboarding) */
export function getEntitiesForRoutines(routineIds: string[]): EntityKnowledge[] {
  const seen = new Set<string>();
  const result: EntityKnowledge[] = [];
  for (const ek of ENTITY_KNOWLEDGE) {
    if (seen.has(ek.name)) continue;
    if (ek.routines.some((r) => routineIds.includes(r))) {
      seen.add(ek.name);
      result.push(ek);
    }
  }
  return result;
}

/**
 * Build AI context block for a set of entity names.
 * Returns a string suitable for injection into the system prompt.
 */
export function buildEntityContextForAI(entityNames: string[]): string {
  const map = getKnowledgeMap();
  const lines: string[] = [];

  for (const name of entityNames) {
    const k = map.get(name);
    if (!k) continue;
    const fieldList = k.fields.map((f) => `${f.name}:${f.type}`).join(", ");
    const related = k.relatedEntities.length > 0
      ? ` Related: ${k.relatedEntities.join(", ")}.`
      : "";
    lines.push(`### ${k.name}\n${k.aiContext}${related}\nFields: ${fieldList}`);
  }

  return lines.join("\n\n");
}
