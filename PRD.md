# Product Requirements Document (PRD)
## Easy Store ERP (Fatora) — Enterprise Multi-Sector Retail & Wholesale Management System

---

## Document Metadata

| Attribute | Specification |
| :--- | :--- |
| **Product Name** | Easy Store ERP (Codename: *Fatora*) |
| **Document Version** | 2.0.0 (Comprehensive Specification) |
| **Author / Team** | Core Engineering & Product Architecture Team |
| **Target Platform** | Desktop (Windows, macOS, Linux via Tauri v2) & Web (Modern Browsers) |
| **Primary Stack** | React 19, TypeScript 5.9, Vite 7, Tailwind CSS v3.4, Radix UI (`shadcn/ui`) |
| **Persistence Stack**| Local-First Atomic JSON File Store + IndexedDB with Supabase Cloud PostgreSQL Sync |
| **Internationalization**| Bi-directional Arabic (`ar`, RTL) & English (`en`, LTR) with zero missing keys guarantee |
| **Classification** | Proprietary Commercial Software Specification |

---

## 1. Executive Summary & Vision

### 1.1 Executive Summary
**Easy Store ERP** (internally codenamed **Fatora**) is a high-performance, cross-platform, local-first Enterprise Resource Planning (ERP) and Point of Sale (POS) system engineered for small-to-medium enterprises (SMEs). The system natively unifies POS checkout, multi-warehouse inventory, customer and supplier credit ledgers, automated double-entry accounting, employee payroll & attendance, workshop/maintenance service tracking, and electronic tax invoicing (ETA / ZATCA compliant).

Built on a **Local-First Architecture**, Easy Store ERP guarantees 100% operational continuity without internet access, utilizing local atomic disk persistence and IndexedDB, while providing real-time multi-terminal cloud synchronization via Supabase when connectivity is available.

### 1.2 Vision & Core Value Proposition
To deliver an ultra-responsive, zero-maintenance, multi-sector ERP solution that eliminates cloud latency and subscription lock-in, enabling store owners to manage sales, stock, accounting, and repairs with military-grade reliability and mathematical precision.

### 1.3 Key Market Verticals & Sector Profiles
Easy Store ERP dynamically configures its UI, validation schemas, and database workflows according to the selected **Sector Profile**:
1. **General Retail & Wholesale**: Fast barcode sales, multi-tier pricing (retail/wholesale), installment plans.
2. **Supermarket & Grocery**: Integrated weight-scale barcode parsing (`21xxxxxWWWWWC`), shelf-life & expiry tracking, quick-select touch grids.
3. **Clothing & Apparel**: Multi-dimensional matrix tracking (Size, Color, Brand), variant barcoding.
4. **Electronics & Appliances**: Serial number tracking (`IMEI`/`SN`), warranty management, installment schedules.
5. **Workshop & Maintenance**: Device intake ticketing, stage workflow, technician commission tracking, repair receipt printing.
6. **Cosmetics & Pharmaceuticals**: Batch number management, expiration alerts, sub-unit packaging conversions.
7. **Distribution & Vans**: Multi-warehouse stock transfers, driver inventory tracking, field invoices.

---

## 2. Technical Architecture & System Design

### 2.1 High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                  Easy Store ERP Client                                |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             Presentation & UI Layer                             |  |
|  |   - React 19 + TypeScript + Tailwind CSS + shadcn/ui + Lucide Icons             |  |
|  |   - Bi-directional i18n Engine (Arabic RTL / English LTR)                       |  |
|  |   - Dynamic Theme Engine (CSS Custom Properties / Accent Injection)             |  |
|  +---------------------------------------------------------------------------------+  |
|                                         |                                             |
|  +---------------------------------------------------------------------------------+  |
|  |                              Business Services Layer                            |  |
|  |   - POS & Sales Engine           - VAT / Tax Central Engine (Egypt ETA / ZATCA) |  |
|  |   - Inventory & Warehousing      - Double-Entry Journal Generator               |  |
|  |   - Customer / Supplier Ledgers  - HR, Payroll & Attendance Processor           |  |
|  |   - Workshop / Maintenance       - AI Copilot (Online Gemini + Offline NLP)     |  |
|  |   - Hardware License Engine      - Spreadsheet Invoice Visual Designer          |  |
|  +---------------------------------------------------------------------------------+  |
|                                         |                                             |
|  +---------------------------------------------------------------------------------+  |
|  |                            Data Access & Persistence                            |  |
|  |   - IDataRepository Interface (In-Memory Reactive Cache)                         |  |
|  |   - Tauri FS Plugin (Atomic JSON file write on desktop: app_data/state.json)    |  |
|  |   - Browser Fallback (IndexedDB / idb storage)                                  |  |
|  +---------------------------------------------------------------------------------+  |
+------------------------------------------+--------------------------------------------+
                                           | Async WebSocket Sync / Force Sync
                                           v
+---------------------------------------------------------------------------------------+
|                                Supabase Cloud Backend                                 |
|  - PostgreSQL 15+ Engine with Row Level Security (RLS)                                |
|  - Multi-Tenant Schema (teams, team_members, team_data)                               |
|  - Realtime Change Data Capture (CDC) over WebSockets                                 |
+---------------------------------------------------------------------------------------+
```

### 2.2 Technology Stack

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend Framework** | React `19.2.0`, React DOM `19.2.0`, TypeScript `5.9.3`, Vite `7.2.4` |
| **Desktop Runtime** | Tauri `v2.11.1` (Rust backend with `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-os`) |
| **State & Data Store** | Local-First In-Memory Repository with IndexedDB (`idb`) and Atomic File Store |
| **Cloud Database / Auth**| Supabase JS Client `2.112.3` (PostgreSQL, Realtime subscriptions, Auth) |
| **UI Components & Icons**| Radix UI Primitives (40+ headless components), Lucide React `0.562.0` |
| **Styling & Theming** | Tailwind CSS `3.4.19`, `tailwind-merge`, `clsx`, `tailwindcss-animate` |
| **Internationalization**| `i18next 26.3.4`, `react-i18next 17.0.8`, `i18next-browser-languagedetector` |
| **Forms & Validation** | React Hook Form `7.70.0`, Zod `4.3.5`, `@hookform/resolvers` |
| **Data Viz & Charts** | Recharts `2.15.4` |
| **Reporting & Export** | `xlsx 0.18.5` (Excel Engine), `jspdf 4.2.1` (PDF Generation), `jszip 3.10.1` |
| **Hardware & Peripherals**| `jsbarcode 3.12.3`, Native Browser Print API, Weight-scale Barcode Parser |
| **AI Integration** | Google Gemini API (`@google/genai` client-side REST) + Custom Rule-Based NLP Parser |
| **Testing & Quality** | Vitest `2.1.9`, ESLint `9.39.1`, Custom i18n validator (`scripts/check-i18n.mjs`) |

---

## 3. User Roles, Security & Granular Access Control (RBAC)

### 3.1 Role Hierarchy & Personas

The system supports built-in immutable system roles alongside user-created custom roles:

1. **Owner (`owner`)**: System superuser with unconditional privileges across all modules, company settings, team management, cryptographic licensing, and database resets.
2. **Admin (`admin`)**: Operational manager authorized to configure inventory, customers, suppliers, staff, cash accounts, and run financial audits.
3. **Manager (`manager`)**: Branch supervisor with permissions to manage inventory levels, approve payroll drafts, and inspect operational reports.
4. **Accountant (`accountant`)**: Financial specialist with full access to ledgers, journal entries, balance sheets, treasury reconciliation, and tax filings.
5. **Sales / Cashier (`sales` / `cashier`)**: POS front-desk operator restricted to item lookup, fast checkout, invoice issuance, and basic returns.
6. **Warehouse Specialist (`warehouse`)**: Logistics officer handling stock intake, inter-warehouse transfers, physical audits, and bundle assemblies.
7. **Purchasing Agent (`purchasing`)**: Supply-chain manager handling purchase invoices, supplier credit balances, and cost allocations.
8. **Customer Service / Technician (`customer_service` / `employee`)**: Front-desk and repair staff managing workshop receipts, device intake, and repair diagnostics.

### 3.2 Granular Permissions Matrix

Permissions are structured per module with four explicit CRUD actions: `view`, `create`, `edit`, and `delete`.

```typescript
export type PermissionModule =
  | 'dashboard' | 'inventory' | 'sales'     | 'customers'
  | 'returns'   | 'exchange'  | 'purchases' | 'expenses'
  | 'treasury'  | 'reports'   | 'hr'        | 'settings'  | 'users';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
```

| System Module | View | Create | Edit | Delete | Default Permitted Roles |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Dashboard** | ✅ | ❌ | ❌ | ❌ | All Authenticated Users |
| **Sales & POS** | ✅ | ✅ | Admin, Owner | Owner Only | Cashier, Sales, Manager, Admin, Owner |
| **Inventory** | ✅ | Manager+ | Manager+ | Owner Only | Warehouse, Manager, Admin, Owner |
| **Customers & Ledgers**| ✅ | Sales+ | Admin+ | Owner Only | Sales, Accountant, Manager, Admin, Owner |
| **Customer Manual Adjust**| ✅ | Admin+ | Admin+ | ❌ (Append-Only) | Admin, Owner (Mandatory Audit Reason) |
| **Purchases & Suppliers** | ✅ | Purchasing+| Purchasing+| Owner Only | Purchasing, Manager, Admin, Owner |
| **Returns & Exchanges** | ✅ | Sales+ | Admin+ | Owner Only | Sales, Cashier, Manager, Admin, Owner |
| **Treasury & Safes** | ✅ | Accountant+| Owner Only | ❌ (Strict Audit) | Accountant, Admin, Owner |
| **Double-Entry Journals**| ✅ | Accountant+| Owner Only | ❌ (Strict Audit) | Accountant, Owner |
| **HR & Payroll** | ✅ | Manager+ | Admin+ | Owner Only | Manager, Admin, Owner |
| **Workshop / Maintenance**| ✅ | Tech+ | Tech+ | Admin+ | Technician, Sales, Manager, Admin, Owner |
| **Reports & Analytics** | ✅ | ❌ | ❌ | ❌ | Manager, Accountant, Admin, Owner |
| **System Settings** | ✅ | Admin+ | Admin+ | Owner Only | Admin, Owner |
| **Users & Permissions** | ✅ | Owner Only | Owner Only | Owner Only | Owner Only |

### 3.3 Security & Authentication Architecture
* **Local Authentication**: Uses salted SHA-256 password hashing stored within the encrypted IndexedDB / file cache.
* **Cloud Authentication**: Seamless integration with Supabase Auth (`supabase.auth.signInWithPassword`), maintaining synchronized user session tokens.
* **Tenant Isolation**: Cloud synchronization enforces Row-Level Security (RLS) policies scoped by `team_id`. Members can only read and mutate state records matching their team association.

---

## 4. Core Functional Modules & Detailed Requirements

### 4.1 Point of Sale (POS) & Checkout Engine

#### 4.1.1 Barcode & Item Identification
* **Multi-Barcode Mapping**: Items can have multiple mapped barcodes (e.g., manufacturer barcode, custom internal SKU, alternative packaging barcode).
* **Weight-Scale Barcode Parsing**: Natively parses standard retail scale barcodes (`21CCCCCWWWWWC` or `22CCCCCWWWWWC`), extracting product code and embedded weight/price dynamically.
* **Quick-Access Grid**: Touch-optimized grid with category filtering and visual item badges for fast cashier selection.

#### 4.1.2 Sub-Unit Packaging & Conversion
* Supports multi-level packaging hierarchies (e.g., `1 Carton = 10 Strips = 100 Pieces`).
* Dynamic calculation of sale price and stock deductions according to selected unit factor.

#### 4.1.3 Multi-Payment Settlement
* Flexible single-invoice payment splits across **Cash**, **Card**, **Mobile Wallet**, **Customer Credit (Debit)**, and **Installments**.
* Down payment (`downPayment`) handling with automated net calculation.

#### 4.1.4 Customer Debt & Previous Balance On-Invoice Integration
* Real-time lookup of customer credit balance and credit limit warning during checkout.
* **Previous Balance Binding**: Invoices automatically retrieve the customer's prior unpaid balance (`previousBalance`) and link the reference invoice (`previousBalanceInvoiceRef`).
* **Settlement Formula**:
  $$\text{Net Amount} = \text{Invoice Total} + \text{Previous Balance} - \text{Down Payment}$$

#### 4.1.5 Unified Printing Engine
* **Single Component Design**: A unified printing pipeline powers POS checkout printing, invoice history reprints, and customer receipt lookups.
* Supports **A4 Standard Invoices** and **80mm / 58mm Thermal Receipts**.
* Instant **"Reprint Last Invoice"** shortcut on the main header without navigating away from the active screen.

---

### 4.2 Customer Statement & Credit Ledger Module

#### 4.2.1 Chronological Transaction Ledger
* Real-time ledger showing: `Date`, `Transaction Type`, `Reference No.`, `Debit (مدين)`, `Credit (دائن)`, `Running Balance (الرصيد المتراكم)`, and `Audit Reason`.
* Supported transaction types:
  - Sales Invoices (`invoice`)
  - Customer Payments (`payment`)
  - Manual Balance Adjustments (`adjustment`)
  - Sales Returns (`return`)
  - Item Exchanges (`exchange`)
  - Credit Notes (`credit_note`) & Debit Notes (`debit_note`)

#### 4.2.2 Audit-Backed Manual Adjustments
* Any manual balance change requires an explicit, mandatory text reason entered by the administrator, logged permanently into the immutable audit trail.

#### 4.2.3 Export & Statements
* Date-range filtering (`from_date` to `to_date`).
* Instant export of customized customer account statements to **Excel (.xlsx)** or **PDF**.

---

### 4.3 Inventory, Multi-Warehouse & Item Media

#### 4.3.1 Product Master Data
* **Attributes**: Barcode, extra barcodes array, Arabic & English names, category, base unit, sub-units with conversion factors, purchase cost, wholesale price, retail price, profit margin %, stock quantity, minimum stock alert threshold, tax flags (`taxable`, `taxRateOverride`, `pricesIncludeVat`), manufacturer/brand, and serial numbers.
* **Item Media**: Optional client-side image attachment (stored locally as base64/blob) displayed across catalog grids and POS lookup modals.

#### 4.3.2 Multi-Warehouse & Logistics
* **Multi-Warehouse Support**: Management of multiple storage facilities (Main Store, Sub-branch, Van, Warehouse 1).
* **Inter-Warehouse Stock Transfers**: Tracking transfer requests (`TRF-XXXXXX`), item quantities, serialized items, source, and destination warehouses.
* **Bundle Assembly & Disassembly**: Creating compound products (kits/bundles) from raw material items with automated stock deduction of components and stock increment of parent items.

#### 4.3.3 Auditing, Expiry & Export
* **Expiry Date Tracking**: Batch and expiry management with automated near-expiry notifications.
* **Barcode Physical Audit**: Fast scanning audit mode to reconcile physical quantities against system records.
* **Inventory Export**: Read-only instant export of full or category-filtered inventory to `.xlsx` format.

---

### 4.4 Purchases & Supplier Management

* **Supplier Directory**: Contact information, credit terms, and running supplier balance ledger.
* **Purchase Invoices**: Multi-line stock intake with purchase prices, line discounts, shipping/freight cost allocation, line-level VAT, payment statuses (`paid`, `partial`, `unpaid`, `credit`), and payment method selection.
* **Automatic Inventory Update**: Immediate increment of warehouse stock upon purchase confirmation.
* **Supplier Payments**: Direct treasury payout logging linked to supplier accounts.

---

### 4.5 Returns & Exchanges Module

* **Sales Returns**: Return processing linked to original invoice ID or as a standalone return. Auto-replenishes item stock, processes cash refund or customer credit adjustment, and generates double-entry refund journals.
* **Exchanges**: Unified workflow allowing simultaneous return of defective/exchanged items and selection of new purchase items, automatically calculating the net price difference and settlement terms.

---

### 4.6 Treasury, Banking & Cash Safes

* **Multi-Account Infrastructure**: Support for Physical Safes (خزائن), Bank Accounts, and Digital Mobile Wallets.
* **Transaction Categorization**: Income, Expenses, Inter-Account Transfers, Capital Additions, Owner Drawings, Cheques, Loans, and Tax Payments.
* **Cash Audit & Physical Reconciliation (`CashAuditModal`)**:
  - Periodic physical cash counting against book ledger balances.
  - Automated detection of **Matched**, **Surplus (زيادة)**, or **Deficit (عجز)**.
  - One-click posting of balancing journal entries to cash shortage/surplus expense accounts.

---

### 4.7 Double-Entry Accounting & Financial Engine

#### 4.7.1 Automated Journal Entry Generation
Every commercial action triggers balanced double-entry accounting records (`totalDebit === totalCredit`):

$$\sum \text{Debit} = \sum \text{Credit}$$

| Triggering Event | Debit Account (DR) | Credit Account (CR) |
| :--- | :--- | :--- |
| **Cash Sale** | Cash Safe / Bank Account | Sales Revenue Account |
| **Credit Sale** | Accounts Receivable (Customer) | Sales Revenue Account |
| **Customer Payment Received** | Cash Safe / Bank Account | Accounts Receivable (Customer) |
| **Purchase on Credit** | Inventory Asset Account | Accounts Payable (Supplier) |
| **Purchase Paid via Bank** | Inventory Asset Account | Bank Account |
| **Salary Payment** | Payroll Expense Account | Cash Safe / Bank Account |
| **Cash Audit Deficit** | Cash Shortage & Deficit Expense | Cash Safe Account |
| **Fixed Asset Depreciation** | Depreciation Expense | Accumulated Depreciation Asset |

#### 4.7.2 Financial Statements & Reports
* **General Ledger & Journal Entries Viewer**: Full chronological journal history with line memos.
* **Trial Balance (ميزان المراجعة)**: Verification of account debit/credit equilibrium.
* **Income Statement / P&L (قائمة الدخل)**: Calculation of Gross Profit, Operating Expenses, Net Operating Profit.
* **Balance Sheet (الميزانية العمومية)**: Assets = Liabilities + Owner's Equity.

---

### 4.8 HR, Attendance & Payroll Management

* **Employee Profiles**: Personal data, job titles, departments, base salary, sales commission rate %, hire date, linked system user account.
* **Attendance Tracking**: Daily check-in / check-out with status classification (`Present`, `Absent`, `Late`, `Leave`, `Holiday`).
* **Payroll Calculation Engine**:
  $$\text{Net Salary} = \text{Base Salary} + \text{Sales Commissions} + \text{Bonuses} - \text{Deductions} - \text{Social Insurance} - \text{Loan Advances}$$
* **Employee Advances (Salaf)**: Loan request logging, approval workflow, partial repayment tracking, and automated deduction during monthly payroll processing.

---

### 4.9 Workshop & Maintenance Service Module

* **Device Intake Receipts**: Generation of official maintenance receipt tickets recording customer information, device brand/model, serial number, reported fault, technician assigned, estimated cost, and advance deposit paid.
* **Workflow Lifecycle Progression**:
  $$\text{Received} \longrightarrow \text{Under Inspection} \longrightarrow \text{Ready for Pickup} \longrightarrow \text{Delivered} \ (\text{or } \text{Cancelled})$$
* **Technician Commissions**: Automatic computation and allocation of repair labor fees to technician earnings.
* **Printable Service Slips**: Thermal or A4 repair claim tickets for customers with terms & conditions footer.

---

### 4.10 AI Copilot & Natural Language Assistant

* **Dual-Engine Architecture**:
  1. **Cloud AI (Google Gemini API)**: Generates deep business insights, executive summaries, inventory trend forecasts, and conversational responses.
  2. **Local Rule-Based NLP Engine (`localParser.ts`)**: 100% offline natural language parser capable of executing actions (e.g., adding customers, looking up sales figures, checking stock levels) without requiring an internet connection or API key.
* **In-App AI Chat Drawer**: Accessible from any screen with context-aware shortcuts.

---

### 4.11 Central Tax & E-Invoicing Engine

* **VAT Calculation Rules**:
  - Supports both **Tax Inclusive** and **Tax Exclusive** item pricing.
  - Per-item tax overrides and tax-exempt items.
  - Automatic deduction of reverse-charge / withholding tax (1% Egyptian WHT on commercial supplies).
* **Egyptian Tax Authority (ETA) E-Invoicing Simulation**:
  - Compliant canonical JSON document hashing (SHA-256) and simulated digital signatures.
  - Document status tracking (`Submitted`, `Valid`, `Rejected`).
* **ZATCA / ETA TLV QR Code Generator**:
  - Generates standard Tag-Length-Value (TLV) Base64 encoded QR codes on all sales invoices containing Seller Name, VAT Registration Number, Timestamp, Total Amount, and VAT Total.

---

## 5. Official Sales Invoice Layout Specification (`شكل_الفواتير.xlsx`)

The official sales invoice layout strictly complies with the design specification defined in `شكل_الفواتير.xlsx` and is powered by the visual `InvoiceSpreadsheetDesigner`.

```
+---------------------------------------------------------------------------------------+
|  [ LOGO ]       COMPANY NAME / اسم الشركة                       INVOICE # / رقم الفاتورة:  |
|                 Phone: {{Company_Phone}}                       INV-2026-0001           |
|                 Tax ID: {{Tax_Registration_No}}                 Date: {{Date_Time}}     |
+---------------------------------------------------------------------------------------+
|  Client Name / اسم العميل: {{Client_Name}}          Seller / البائع: {{Seller_Name}}    |
|  Management / الإدارة:     {{Admin_Name}}           Partners: {{Owner_1}} / {{Owner_2}} |
+---------------------------------------------------------------------------------------+
| Code / الكود | Product / الصنف       | Qty / الكمية | Unit Price / السعر | Total / الإجمالي |
+--------------+----------------------+--------------+--------------------+------------------+
| {{Code}}     | {{Item_Name}}        | {{Qty}}      | {{Price}}          | {{Line_Total}}   |
+--------------+----------------------+--------------+--------------------+------------------+
|                                                    Subtotal / الإجمالي: | {{Subtotal}}     |
|                                                    Tax (VAT) / الضريبة: | {{Tax_Amount}}   |
|                                                    Previous / سابق:     | {{Prev_Balance}} |
|                                                    Deposit / مدفوع:     | {{Down_Payment}} |
|                                                    NET DUE / الصافي:    | {{Net_Amount}}   |
+---------------------------------------------------------------------------------------+
| Terms & Thank You: {{Thank_You_Message}}                                               |
+---------------------------------------------------------------------------------------+
```

### 5.1 Dynamic Data Binding Placeholders

| Variable Placeholder | Data Source Mapping | Description |
| :--- | :--- | :--- |
| `{{Company_Name}}` | `state.company.nameAr` / `name` | Registered business trade name |
| `{{Company_Phone}}` | `state.company.phone` | Primary company contact number |
| `{{Invoice_Number}}` | `saleInvoice.invoiceNumber` | Unique sequential invoice identifier |
| `{{Date_Time}}` | `saleInvoice.createdAt` | Formatted timestamp of sale issuance |
| `{{Client_Name}}` | `saleInvoice.customerName` | Customer name or "Cash Customer" |
| `{{Seller_Name}}` | `saleInvoice.createdBy` | Cashier/salesperson who issued the bill |
| `{{Owner_Name_1/2}}` | `state.company.ownerName1/2` | Custom owner/partner names from settings |
| `{{Item_Code}}` | `item.barcode` | Primary barcode or SKU |
| `{{Item_Name}}` | `item.nameAr` / `item.name` | Product designation in active language |
| `{{Item_Qty}}` | `saleItem.quantity` | Quantity sold in selected unit |
| `{{Item_Price}}` | `saleItem.unitPrice` | Billed unit price |
| `{{Item_Total}}` | `saleItem.total` | Net line total after line discount |
| `{{Total_Amount}}` | `saleInvoice.total` | Total amount of current invoice items |
| `{{Previous_Balance}}` | `saleInvoice.previousBalance`| Customer outstanding debt prior to sale |
| `{{Down_Payment}}` | `saleInvoice.paid` / `downPayment`| Upfront payment collected at checkout |
| `{{Net_Amount}}` | `saleInvoice.netAmount` | Grand settlement total including prior debt |

---

## 6. Comprehensive Data Models & Database Schemas

### 6.1 Core TypeScript Interfaces

```typescript
export interface Item {
  id: string;
  barcode: string;
  barcodes: string[];
  name: string;
  nameAr: string;
  categoryId: string;
  unit: string;
  subUnits: ItemSubUnit[];
  purchasePrice: number;
  salePrice: number;
  wholesalePrice: number;
  profitMargin?: number;
  stockQuantity: number;
  minStockLevel: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  image?: string; // base64 / blob
  taxable?: boolean;
  taxRateOverride?: number;
  pricesIncludeVat?: boolean;
  size?: string;
  color?: string;
  manufacturer?: string;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  previousBalance?: number;
  previousBalanceInvoiceRef?: string;
  downPayment?: number;
  netAmount?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  extraCharges: ExtraCharge[];
  createdAt: string;
  createdBy: string;
  pricesIncludeVat?: boolean;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalInclTax?: number;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'invoice' | 'payment' | 'adjustment' | 'return' | 'exchange' | 'credit_note' | 'debit_note';
  amount: number;
  direction: 'debit' | 'credit';
  reason?: string;
  relatedInvoiceId?: string;
  relatedInvoiceNumber?: string;
  createdAt: string;
  createdBy: string;
}

export interface MaintenanceReceipt {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  deviceModel?: string;
  serialNumber?: string;
  reportedFault: string;
  expectedCost: number;
  depositPaid: number;
  technicianName: string;
  technicianCommission: number;
  status: 'received' | 'under_inspection' | 'ready' | 'delivered' | 'cancelled';
  receivedDate: string;
  expectedDeliveryDate: string;
  deliveredDate?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}
```

### 6.2 Supabase PostgreSQL Cloud Schema (Extract)

```sql
-- Team Tenancy & Cloud Synchronization Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'employee',
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_data (
    team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
    state_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.team_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can access their team data"
ON public.team_data
FOR ALL
USING (
    team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
);
```

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Performance & Responsiveness
* **Barcode Scan Latency**: POS scan-to-cart latency must be under **50 milliseconds**.
* **Startup Time**: Cold startup of the desktop Tauri application must complete in under **1.2 seconds**.
* **Memory Footprint**: Client memory usage should remain below **180 MB** during standard operations.
* **Large Dataset Handling**: Product search and customer autocomplete must maintain 60 FPS scrolling for catalogs with up to **50,000 items**.

### 7.2 Reliability & Offline Resilience
* **Zero Cloud Dependency**: Every operational transaction (Sales, Returns, Inventory, HR, Reports) executes locally without network connectivity.
* **Atomic File Writes**: Disk persistence uses atomic temp-file write and rename strategies to prevent file corruption on unexpected power outages.
* **Automatic Conflict Resolution**: Background sync resolves differences using timestamped vector comparison (`updated_at`).

### 7.3 Internationalization & Usability
* **100% Bilingual Coverage**: Arabic (`ar`) and English (`en`) with zero missing translation strings, verified in CI/CD via `scripts/check-i18n.mjs`.
* **Directionality & RTL**: Flawless layout mirroring for Right-to-Left (Arabic) and Left-to-Right (English) typography.
* **Keyboard Accessibility**: Full keyboard POS shortcuts (`F1` Help, `F2` New Invoice, `F9` Pay Cash, `F10` Print, `ESC` Close Modal).

### 7.4 Security & Data Privacy
* **Hardware Licensing**: Cryptographic hardware license activation bound to device CPU/disk identifiers with HMAC-SHA256 signature verification.
* **Data Sanitization**: All imports (JSON/Excel) and database writes pass through strict **Zod** schema validators.
* **Data Export Isolation**: All report generation and Excel/PDF exports operate in strict **Read-Only Mode** on the database state.

---

## 8. Quality Assurance & Verification Matrix

### 8.1 Automated Test Suites

| Test Suite File | Scope & Tested Functionality |
| :--- | :--- |
| `src/services/tax.test.ts` | VAT engine, inclusive/exclusive calculations, reverse charge 1% |
| `src/services/license.test.ts` | Machine ID generation, offline license validation, tampering detection |
| `src/services/excel.test.ts` | Excel workbook generation, column formatting, customer statement export |
| `src/services/ai/localParser.test.ts` | Offline rule-based NLP intent classification and entity extraction |
| `src/services/ai/actions.test.ts` | Execution of parsed natural language business commands |
| `src/context/recalcCustomerBalances.test.ts` | Accurate customer running balance re-computation across transaction logs |
| `src/components/invoice/invoiceSpreadsheetTemplate.test.ts` | Spreadsheet template grid initialization and variable placeholders |
| `src/db/migrate.test.ts` | Database schema migrations and backwards-compatibility verification |

### 8.2 Build & Lint Validation Commands

```bash
# Verify 100% translation coverage
npm run check:i18n

# Type-check all TypeScript files in strict mode
npm run typecheck

# Execute Vitest automated unit and integration tests
npm run test

# Run ESLint validation
npm run lint

# Production build bundle
npm run build
```

---

## 9. Appendix: Non-Negotiable System Principles

1. **Mandatory Audit Trail**: No customer balance or stock quantity can be adjusted manually without capturing a mandatory user-entered explanation stored in the audit log.
2. **Single Reusable Printing Engine**: All invoice output channels (new POS checkout, history reprint, customer view) must consume the unified invoice document component.
3. **Floating-Point Precision Guarantee**: All monetary calculations must use centralized 2-decimal rounding functions (`round2`) with `Number.EPSILON` correction to eliminate floating-point arithmetic errors.
4. **Local Data Privacy**: Item media, local accounts, and transaction records remain strictly stored on the local client disk unless cloud synchronization is explicitly activated by the Owner.
