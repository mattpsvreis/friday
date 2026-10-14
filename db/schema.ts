import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const entryStatusEnum = pgEnum("entry_status", [
  "unconfirmed",
  "confirmed",
]);

export const entryDirectionEnum = pgEnum("entry_direction", [
  "income",
  "expense",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "cash",
  "credit_card",
  "other",
  "transfer",
  "card_payment",
]);

export const importTypeEnum = pgEnum("import_type", ["extrato", "fatura"]);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  passwordHash: text("password_hash"),
  monthEndDay: integer("month_end_day").notNull().default(28),
  defaultBillPaymentDay: integer("default_bill_payment_day")
    .notNull()
    .default(10),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const balanceSnapshots = pgTable("balance_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  spendableCents: integer("spendable_cents").notNull().default(0),
  savedCents: integer("saved_cents").notNull().default(0),
  asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  kind: entryDirectionEnum("kind").notNull().default("expense"),
  color: text("color").notNull().default("#39ff14"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const creditCards = pgTable("credit_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  bank: text("bank").notNull().default(""),
  last4: text("last4").notNull().default(""),
  limitCents: integer("limit_cents").notNull().default(0),
  cycleCloseDay: integer("cycle_close_day").notNull().default(4),
  paymentDueDay: integer("payment_due_day").notNull().default(11),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: importTypeEnum("type").notNull(),
  filename: text("filename").notNull(),
  warnings: text("warnings").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  creditCardId: uuid("credit_card_id")
    .notNull()
    .references(() => creditCards.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
    onDelete: "set null",
  }),
  merchant: text("merchant").notNull(),
  purchaseDate: date("purchase_date").notNull(),
  totalCents: integer("total_cents").notNull(),
  installmentCount: integer("installment_count").notNull().default(1),
  status: entryStatusEnum("status").notNull().default("unconfirmed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const installments = pgTable("installments", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  ofTotal: integer("of_total").notNull(),
  amountCents: integer("amount_cents").notNull(),
  cycleCloseDate: date("cycle_close_date").notNull(),
});

export const recurringRules = pgTable("recurring_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  direction: entryDirectionEnum("direction").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  method: paymentMethodEnum("method").notNull().default("other"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  creditCardId: uuid("credit_card_id").references(() => creditCards.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  direction: entryDirectionEnum("direction").notNull(),
  method: paymentMethodEnum("method").notNull().default("other"),
  status: entryStatusEnum("status").notNull().default("confirmed"),
  amountCents: integer("amount_cents").notNull(),
  occursOn: date("occurs_on").notNull(),
  description: text("description").notNull().default(""),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  creditCardId: uuid("credit_card_id").references(() => creditCards.id, {
    onDelete: "set null",
  }),
  recurringRuleId: uuid("recurring_rule_id").references(
    () => recurringRules.id,
    { onDelete: "set null" },
  ),
  importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
    onDelete: "set null",
  }),
  autoGenerated: boolean("auto_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
