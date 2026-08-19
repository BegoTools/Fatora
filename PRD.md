# Product Requirement Document (PRD)
## Easy Store ERP (Fatora) — Next-Generation Multi-Sector Retail & Wholesale ERP System

---

## 1. Executive Summary & Vision

### 1.1 Executive Summary
**Easy Store ERP** (internally code-named *Fatora*) is a high-performance, cross-platform, local-first Enterprise Resource Planning (ERP) and Point of Sale (POS) application. Engineered for small to medium-sized retail stores, pharmacies, supermarkets, electronics centers, apparel outlets, and maintenance workshops, Easy Store ERP provides offline-first reliability paired with seamless real-time cloud synchronization via Supabase.

### 1.2 Vision Statement
To empower business owners with a hyper-responsive, multi-sector ERP solution that streamlines point-of-sale operations, inventory tracking, customer credit ledgers, double-entry accounting, payroll, and maintenance management while requiring zero ongoing maintenance overhead.

---

## 2. System Architecture & Tech Stack

### 2.1 Technology Stack Overview
* **Frontend Framework**: React 18, TypeScript (Strict Mode), Vite 7.
* **Styling & UI Design**: Tailwind CSS v3.4 (with custom CSS design tokens), `shadcn/ui` components, Lucide Icons, and dynamic theme injectors.
* **Desktop Runtime**: Tauri v2 (Rust backend wrapper) for native OS access, direct hardware printing support, and local database management.
* **Local Persistence Layer**: Local-first architecture utilizing IndexedDB and local storage with fallback to JSON repositories.
* **Cloud Database & Sync Engine**: Supabase (PostgreSQL), with Realtime WebSocket sync, Row Level Security (RLS), and Team-based Multi-tenancy migration support.
* **Internationalization**: Bilingual core engine (Arabic - `ar` & English - `en`) with complete Right-to-Left (RTL) and Left-to-Right (LTR) support.
* **Export & Reporting Engine**: Native client-side PDF and Excel export using `xlsx` / `exceljs` engines.

### 2.2 System Architecture Diagram
```
+-------------------------------------------------------------------+
|                        Easy Store ERP Client                      |
|                                                                   |
|  +-------------------+  +-------------------+  +---------------+  |
|  |   POS & Checkout  |  | Inventory & Unit  |  |  Customer DB  |  |
|  |     Engine        |  |    Conversions    |  |  & Ledger     |  |
|  +---------+---------+  +---------+---------+  +-------+-------+  |
|            |                      |                    |          |
|  +---------v----------------------v--------------------v-------+  |
|  |                Double-Entry Accounting Engine               |  |
|  +--------------------------------+----------------------------+  |
|                                   |                               |
|  +--------------------------------v----------------------------+  |
|  |               IDataRepository / Local State                 |  |
|  |            (IndexedDB / Offline First Storage)              |  |
|  +--------------------------------+----------------------------+  |
+-----------------------------------|-------------------------------+
                                    | Auto Sync Engine
                                    v
+-------------------------------------------------------------------+
|                      Supabase Cloud Backend                       |
|          PostgreSQL Database + Realtime Sync + RLS Policies       |
+-------------------------------------------------------------------+
```

---

## 3. User Roles & Permission Matrix (RBAC)

### 3.1 Role Hierarchy
Easy Store ERP features a granular Role-Based Access Control (RBAC) framework supporting built-in system roles as well as custom organization-defined roles:

1. **Owner**: Unrestricted full access to system settings, team management, financial accounts, manual adjustments, and system resets.
2. **Admin**: Operational superuser with privileges to manage inventory, customers, suppliers, staff, and system configuration.
3. **Manager**: Branch/store operational oversight, inventory adjustments, approval of payroll drafts, and reporting access.
4. **Accountant**: Full access to financial ledgers, double-entry journal entries, audit logs, treasury reconciliation, and tax filings.
5. **Sales / Cashier**: Fast POS checkout, invoice printing, customer lookup, and basic returns processing.
6. **Warehouse Specialist**: Stock intake, inventory audits, stock transfers, bundle assembly/disassembly.
7. **Purchasing Agent**: Supplier balance management, purchase order generation, and stock intake pricing.
8. **Customer Service / Maintenance Tech**: Device intake, repair work-order tracking, customer status updates.

### 3.2 Granular Permission Matrix

| Module | Can View | Can Create | Can Edit | Can Delete | Allowed Roles |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **POS / Sales** | Yes | Yes | Admin/Owner | Owner Only | All Roles |
| **Inventory Management** | Yes | Admin/Manager | Admin/Manager | Owner Only | Owner, Admin, Manager, Warehouse |
| **Customer Credit Ledger**| Yes | Yes | Admin/Owner | Owner Only | Owner, Admin, Accountant, Sales |
| **Manual Adjustments** | Yes | Owner/Admin | Owner/Admin | Never | Owner, Admin (with audit reason) |
| **Treasury & Safe** | Accountant+| Accountant+| Owner Only | Never | Owner, Admin, Accountant |
| **Double-Entry Journals** | Accountant+| Accountant+| Owner Only | Never | Owner, Accountant |
| **HR & Payroll** | Admin+ | Admin+ | Admin+ | Owner Only | Owner, Admin, Manager |
| **Settings & Branding** | Admin+ | Admin+ | Admin+ | Owner Only | Owner, Admin |

---

## 4. Core Product Modules & Requirements

### 4.1 POS & Sales Processing Module
* **Instant Barcode Reader Integration**: Support for standard 1D/2D scanners, multi-barcode item binding, and auto-focus scan mode.
* **Flexible Unit Conversions**: Automatic price and inventory calculation across primary and secondary packaging (e.g., Box -> Strip -> Piece).
* **Multi-Payment Settlement**: Support for Cash, Card, Mobile Wallet, Credit (Debt), and Installments on a single checkout flow.
* **Customer Debt Lookup**: Real-time retrieval of customer credit limit, current running balance, and unpaid invoice counts during checkout.
* **Automated VAT Calculation**: Item-level and invoice-level Value Added Tax (VAT) computations (Prices inclusive or exclusive of VAT).
* **Reprint Last Invoice**: One-touch shortcut to print the latest transaction or a specific customer’s last invoice without re-opening history screens.

### 4.2 Customer Statement & Credit Ledger
* **Chronological Ledger View**: Detailed line-item breakdown showing Debit (مدين), Credit (دائن), Running Balance (رصيد متراكم), and Transaction Reason.
* **Supported Ledger Transactions**: Sales Invoices, Customer Payments, Returns, Exchanges, Manual Credit/Debit Notes, and Manual Adjustments.
* **Audit-Backed Manual Adjustments**: Mandatory text reason required for any manual ledger balance adjustment (Debit/Credit).
* **Date Range Filtering & Export**: Period-based statement filtering (From Date -> To Date) with instant export to PDF or Excel.

### 4.3 Inventory Management & Item Media
* **Item Properties**: Barcode, extra barcodes, Arabic & English names, category, unit, sub-units (factor conversions), cost price, wholesale price, retail price, profit margin %, stock quantity, min stock alert level, tax settings.
* **Item Image Support**: Optional local base64/blob image attachment per item for UI grid display and catalog presentation.
* **Batch & Expiry Date Tracking**: Optional sector-specific expiration date tracking with automated low-stock and near-expiry alerts.
* **Inventory Export / Audit**: One-click complete or filtered inventory list export to `.xlsx` format.

### 4.4 Purchases & Supplier Relations
* **Supplier Accounts**: Running balance tracking for suppliers, credit terms, and transaction logs.
* **Purchase Invoices**: Stock intake entry with line-item discounts, freight/shipping cost allocation, line-item VAT, and payment status tracking.

### 4.5 Treasury, Cash Safes & Banking
* **Multi-Account Treasury**: Support for Cash Safes (خزينة), Bank Accounts, and Mobile Wallets.
* **Cash Audit & Reconciliation**: Periodic physical cash counting against book balances, recording surpluses or deficits with auto-generated journal entries.

### 4.6 HR, Attendance & Payroll
* **Staff Directory & Job Profiles**: Employee profile maintenance, job titles, base salary, and commission percentage setup.
* **Daily Attendance & Shifts**: Check-in and check-out logs with status categorization (Present, Late, Absent, Leave, Holiday).
* **Salary Calculation**: Automated monthly payroll computations factoring in base pay, sales commissions, bonuses, deductions, and loan repayments.
* **Employee Advances (Salaf)**: Loan request logging, approval, partial repayment tracking, and auto-deduction from payroll.

### 4.7 Workshop & Maintenance Module
* **Device Intake Receipts**: Generation of receipt slips containing serial numbers, customer details, reported faults, and estimated repair costs.
* **Status Workflow**: Stage progression (`Received` -> `Under Inspection` -> `Ready` -> `Delivered` -> `Cancelled`).
* **Technician Commissions**: Allocation of repair labor fees and technician commission split per receipt.

---

## 5. Database Schema & Data Models

### 5.1 Core Types & Interfaces (TypeScript)

#### Item Interface
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
  image?: string; // base64 / blob image payload
  taxable?: boolean;
  taxRateOverride?: number;
  pricesIncludeVat?: boolean;
}
```

#### Sale Invoice Interface
```typescript
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
  netAmount?: number; // Net = Total + Previous Balance - Down Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: string;
  createdBy: string;
  pricesIncludeVat?: boolean;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalInclTax?: number;
}
```

#### Customer Transaction Ledger Interface
```typescript
export type CustomerTransactionType = 
  | 'invoice' 
  | 'payment' 
  | 'adjustment' 
  | 'return' 
  | 'exchange' 
  | 'credit_note' 
  | 'debit_note';

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: CustomerTransactionType;
  amount: number;
  direction: 'debit' | 'credit';
  reason?: string;
  relatedInvoiceId?: string;
  relatedInvoiceNumber?: string;
  createdAt: string;
  createdBy: string;
}
```

---

## 6. Financial Architecture & Double-Entry Accounting Rules

### 6.1 Double-Entry Principles
Every transaction within Easy Store ERP automatically generates balanced double-entry journal entries (`totalDebit === totalCredit`):

1. **Cash Sale**:
   * Debit (`DR`): Cash Safe / Treasury Account (`amount`)
   * Credit (`CR`): Sales Revenue Account (`amount`)
2. **Credit Sale (Account Receivable)**:
   * Debit (`DR`): Accounts Receivable - Customer (`amount`)
   * Credit (`CR`): Sales Revenue Account (`amount`)
3. **Customer Payment Recieved**:
   * Debit (`DR`): Cash Safe / Bank (`amount`)
   * Credit (`CR`): Accounts Receivable - Customer (`amount`)
4. **Purchase Intake (Credit)**:
   * Debit (`DR`): Inventory Asset Account (`amount`)
   * Credit (`CR`): Accounts Payable - Supplier (`amount`)
5. **Cash Audit Deficit**:
   * Debit (`DR`): Cash Shortage & Deficit Expense (`amount`)
   * Credit (`CR`): Cash Safe / Treasury Account (`amount`)

---

## 7. Official Sales Invoice Layout Specification (`شكل_الفواتير.xlsx`)

The official sales invoice design follows the mandatory template structure defined in `شكل_الفواتير.xlsx`:

### 7.1 Header Elements
* **Company Branding**: Logo (`Logo`), Company Name, and `{{Company_Phone}}`.
* **Invoice Metadata**: `{{Invoice_Number}}` (displayed prominently), `{{Date_Time}}`.
* **Stakeholders & Staff**: `{{Owner_Name_1}}`, `{{Owner_Name_2}}`, `{{Seller_Name}}`, `{{Admin_Name}}`, and `{{Client_Name}}`.

### 7.2 Dynamic Line-Item Grid
Columns are rendered dynamically:
* `{{Item_Code}}` — Unique item barcode or SKU.
* `{{Item_Name}}` — Product designation (Bilingual support).
* `{{Item_Qty}}` — Billed quantity.
* `{{Item_Price}}` — Unit sale price.
* `{{Item_Total}}` — Line item total (`Qty * Price - Discount`).

### 7.3 Totals Footer Summary
* `{{Total_Amount}}`: Gross current invoice subtotal.
* `{{Previous_Balance}}`: Outstanding debt prior to invoice creation (`previousBalanceInvoiceRef`).
* `{{Down_Payment}}`: Deposit paid at invoice issue time (`downPayment`).
* `{{Net_Amount}}`: Final settlement total (`Total_Amount + Previous_Balance - Down_Payment`).

---

## 8. Multi-Sector Profiling Framework

Easy Store ERP supports customized sector profiles (`SectorProfile`), adjusting the active UI components and fields automatically:

| Sector Profile | Color/Size | Expiry Date | Serial Tracking | Weight Scale Barcodes | Maintenance Module |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **General Retail** | Optional | No | Optional | Optional | No |
| **Supermarket / Grocery**| No | Yes | No | Yes | No |
| **Clothing & Apparel** | Yes | No | No | No | No |
| **Electronics & Hardware**| No | No | Yes | No | Optional |
| **Maintenance Shop** | No | No | Yes | No | Yes |

---

## 9. Integration, Branding, & Export Infrastructure

### 9.1 Theming & Visual Customization
* **CSS Variable Design Tokens**: Primary dynamic accent colors injected live via `var(--primary)` and theme settings.
* **Logo Management**: Company logo uploaded via settings, stored as base64 string, rendered across app headers and printed documents.
* **Bilingual UI Customization**: Configurable invoice label overrides (English and Arabic titles, totals labels, and footer thank-you messages).

### 9.2 Data Export & Safety Rules
1. **Read-Only Database Audits**: All data export operations (Excel/PDF reports, inventory exports) perform strictly read-only queries with zero mutations.
2. **Offline-First Resilience**: All core system functions operate 100% offline. Network connection failure triggers automatic queueing of cloud sync operations without interrupting POS checkout.

---

## 10. Non-Negotiable System Principles

1. **Mandatory Audit Trail**: Any manual alteration of customer balance or inventory levels must require a recorded user-entered text reason.
2. **Single Printing Component**: All invoice printing operations (New sale, reprint last invoice, history lookup) utilize a unified print component to eliminate code duplication.
3. **Data Integrity Guarantee**: Financial calculations must prevent floating-point rounding discrepancies by enforcing standardized precision functions across totals and taxes.
4. **Local Data Privacy**: Item images and local credentials remain within the client database environment unless cloud sync is explicitly enabled by the owner.
