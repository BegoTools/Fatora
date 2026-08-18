# Fatora ERP — تقرير التدقيق المدمج (Antigravity + Super Z)

> **المشروع:** [BegoTools/Fatora](https://github.com/BegoTools/Fatora)
> **التاريخ:** 2026-07-24
> **المنصة:** React 19 + TypeScript + Vite 7 + Tauri 2 + IndexedDB + Tailwind + shadcn/ui
> **حجم الكود:** ~10,466 سطر TS/TSX (src/) — 14 صفحة، 18 service، 7 مكون معقد
> **الحالة بعد الفحص:** ✅ Build ينجح، ✅ 57/57 اختبار ينجح، ❌ 2 خطأ ESLint، ❌ 77+ مشكلة موزعة على Bug / UX / A11Y / Security / i18n / Performance / Data-Integrity

---

## 1. ملخص تنفيذي

المشروع **Fatora** هو نظام ERP/POS تجزئة مكتوب بالكامل في المتصفح (client-side only) باستخدام React + Tauri + IndexedDB. الفكرة ممتازة والتنفيذ العام جيد: بنية واضحة، TypeScript صارم، اختبارات unit، i18n مدقق بسكريبت `check-i18n.mjs`، وميزات شاملة (POS، مشتريات، مرتجعات، صرف، خزينة، موارد بشرية، تقارير، AI Assistant عبر Gemini).

لكن الفحص المزدوج (Antigravity تشغيلياً + Super Z كود+تشغيل) كشف **مشاكل جوهرية في تكامل البيانات المالية**:
- أرقام الفواتير تتصادم عند الحذف وتتجاهل الـprefix.
- دفعات بطاقة/محفظة تذهب كلها لحساب "الخزنة النقدية" بدلاً من حساباتها الصحيحة.
- دفع الموردين، رواتب الموظفين، السلف، تحصيل الديون — **لا تُنشئ أي حركة في الخزينة**. الكاش "يختفي" من النظام.
- نسبة العمولة في الرواتب مضروبة في 10 بالخطأ (موظف راتبه 5000 بعمولة 5% يستلم 2500 عمولة بدلاً من 250).
- أربعة مودالات كاملة (صيانة، جرد خزينة، صيانة قاعدة بيانات، فاتورة إلكترونية) **مكتوبة بالعربية فقط** ولا تتغير عند تمرير اللغة للإنجليزية.
- كلمات السر مشفرة بـSHA-256 بدون iterations — قابلة للكسر بسهولة.
- مفتاح Gemini API يُخزَّن plaintext في localStorage ويُمرَّر في URL.

الـAntigravity لاحظ مشاكل UI سطحية (زر Save غير مفهرس، مشكلة كتابة العربية حرف-بحرف، مفتاح i18n ناقص واحد). تقرير Super Z الكودي كشف ما تحت السطح.

---

## 2. منهجية الفحص

| الجانب | الأداة/الأسلوب |
|---|---|
| تشغيل المشروع | `npm install`, `npm run dev` على المنفذ 3000 |
| فحص الكود | قراءة كل صفحة (14) + كل service (18) + كل context (3) + مكونات معقدة |
| فحص البناء | `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` |
| فحص i18n | `node scripts/check-i18n.mjs` + grep يدوي على `t(\`...\${...}\`)` |
| اختبار تشغيلي | `agent-browser` (Playwright) لتسجيل owner → إضافة عميل → صنف → مبيعات → مرتجع → مصروفات → خزينة → تقارير → HR → Settings → AI chat |
| لقطات شاشة | 15 لقطة محفوظة في `/home/z/my-project/screenshots/` |
| فحص أمني | مراجعة `auth.ts`, `license.ts`, `gemini.ts`, `idb.ts` |
| فحص تكامل مالي | تتبع تدفق الكاش عبر `AppContext.tsx`, `Treasury.tsx`, `Purchases.tsx`, `HR.tsx`, `financials.ts`, `journal.ts` |

---

## 3. المشاكل المؤكدة تشغيلياً (Reproduced Live)

> هذه المشاكل لاحظناها فعلاً أثناء التشغيل في المتصفح، بصور كدليل.

### 3.1 مشكلة مفتاح i18n ناقص — `expenses.cat.Returns`

**الحالة:** بعد إجراء عملية بيع (Soda Can بـ15 ج.م) ثم عمل return بكاش ريفاند 15 ج.م، فتحنا صفحة Expenses.

**النتيجة:**
- بطاقة "Top Category" تعرض: `⟨missing:expenses.cat.Returns⟩`
- صف المصروف في الجدول، عمود Category: `⟨missing:expenses.cat.Returns⟩`

**السبب:** `src/context/AppContext.tsx:307` ينشئ حركة بقيمة الـrefund مع `category: 'Returns'`، لكن `src/i18n.ts` لا يحتوي مفتاح `expenses.cat.Returns` (لا في EN ولا AR). سكريبت `check-i18n.mjs` لا يلتقطه لأن الـkey ديناميكي عبر `t(\`expenses.cat.${tr.category}\`)` في `Expenses.tsx:131,186` وغير مُدرج في `DYNAMIC_ENUM_SOURCES`.

**نفس المشكلة موجودة لـ `expenses.cat.Exchange`** — `AppContext.tsx:336` يستخدم `category: 'Exchange'` لكن الـkey غير موجود. Antigravity لم يلتقطها لأنهم عملوا exchange بفارق سعر = 0 (الـtransaction لا يُنشأ إلا لو `ex.paid !== 0`).

📸 لقطة: `10-expenses-after-return.png`

### 3.2 مشكلة تقرير Reports بتاريخ ثابت 2025

**الحالة:** فتحنا صفحة Reports بتاريخ اليوم 2026-07-24.

**النتيجة:** كل البطاقات الأربعة (SALES SUMMARY, PURCHASE ORDERS, PROFIT, Margin) = 0، والرسوم البيانية فارغة. السبب أن `dateFrom` مثبتة على `2025-01-01` و`dateTo` على `2025-12-31` (سنة 2025 كاملة)، ولا يوجد فيها أي بيانات.

**السبب:** `src/pages/Reports.tsx:17-18`:
```ts
const [dateFrom, setDateFrom] = useState('2025-01-01');
const [dateTo, setDateTo] = useState('2025-12-31');
```

### 3.3 مشكلة لاصق عربي في Reports — `الورش والصيانة`

**الحالة:** نفس الصفحة في الوضع الإنجليزي.

**النتيجة:** زر تبويب "Workshops & Maintenance" يعرض نصاً عربياً `الورش والصيانة` رغم أن اللغة الحالية English.

**السبب:** `src/pages/Reports.tsx:80`:
```ts
{ id: 'maintenance', label: 'الورش والصيانة', icon: <Wrench ... /> }
```
بدلاً من `t('reports.maintenance')` — والمفتاح نفسه غير موجود في i18n.ts.

### 3.4 مشكلة رأس مكرر في جدول المستخدمين (Settings)

**الحالة:** Settings → Users & Permissions.

**النتيجة:** الجدول يعرض عمودين بكلمة "NAME":
```
NAME | EMAIL | NAME | ROLE | STATUS | ACTIONS
```

**السبب:** `src/pages/Settings.tsx:545` يستخدم `t('common.name')` = "Name"، و `Settings.tsx:547` يستخدم `t('hr.employeeName')` الذي يترجم أيضاً إلى "Name" في EN و"الاسم" في AR. نفس الكلمة، رغم أن العمود الثالث يمثل "الموظف المرتبط".

### 3.5 مشكلة colSpan خاطئ

`src/pages/Settings.tsx:554`: حالة `users.length === 0` تستخدم `colSpan={5}` لكن الجدول فعلياً به 6 أعمدة — العمود السادس يظهر فارغاً.

### 3.6 Dashboard — KPI "Today's Sales" يعرض +12% وهمية

`src/pages/Dashboard.tsx:89`: `change: '+12%'` hardcoded. لا يوجد حساب فعلي لنسبة التغيير.

### 3.7 Dashboard — قائمة Revenue Overview ديكورية

`src/pages/Dashboard.tsx:166-170`: dropdown بثلاثة خيارات (This Week / Month / Year) لكن الـstate لا يتغير، والرسم دائماً يعرض آخر 7 أيام (line 32: `last7Days`).

### 3.8 Dashboard — زر "View All" بدون onClick

`src/pages/Dashboard.tsx:287`: `<button className="...">{t('dashboard.alerts.viewAll')}</button>` بلا `onClick`.

### 3.9 Inventory — ترتيب حقول الـAdd Item modal مضلل

الترتيب الفعلي في `src/pages/Inventory.tsx:528-549`:
1. Purchase Price
2. Sale Price + Apply button
3. **Profit Margin %** (مع زر Apply بينه وبين السابق)
4. Stock
5. Min Stock Level

أثناء الاختبار التشغيلي بالفعل وقعت في هذا الفخ ووضعت قيمة الـstock (50) في حقل Profit Margin، فظهر الصنف بـstock = 0 و "Out of Stock".

📸 لقطة: `06-inventory-with-item.png` (تظهر "0 / 0" و "Out of Stock")

### 3.10 Inventory — ترتيب حقول الفئة الجديدة (AR قبل EN)

`src/pages/Inventory.tsx:517-526`: حقل "New category name (AR)" يظهر قبل "New category name (EN)". بالنسبة لمستخدم إنجليزي هذا عكس المتوقع، ويسبب إدخال بيانات في الحقل الخطأ.

### 3.11 ESLint Errors (2)

```
src/components/maintenance/MaintenanceView.tsx:23:14
  Error: Cannot call impure function during render
  `Date.now` is an impure function.

src/services/financials.ts:85:28
  Error: Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

### 3.12 تحذير Build — Inventory chunk 541 KB

```
dist/assets/Inventory-CodapA42.js   541.20 kB │ gzip: 165.34 kB
```
يحتاج code-splitting (xlsx + jsbarcode يجب أن يُحمَّلا ديناميكياً).

### 3.13 AI Chat يعمل (إيجابي)

✅ سألنا AI Assistant: "What is the total sales today?" — أجاب: "Total sales is 15 EGP across 1 invoices." الإجابة صحيحة (بعت Soda Can بـ15 ج.م). تكامل Gemini فعّال، والمحرك المحلي (localParser.ts) يشتغل حتى بدون API key.

ملاحظة صغيرة: "1 invoices" بدلاً من "1 invoice" — خطأ قواعدي بسيط في صياغة رد الـAI.

📸 لقطة: `14-ai-chat-working.png`

---

## 4. مشاكل إضافية من فحص الكود (Super Z فقط)

> Antigravity لم يفحص الكود بعمق؛ هذه كلها جديدة من Super Z.

### 4.1 BUG — Critical (Data Integrity)

| ID | الموقع | الوصف |
|---|---|---|
| B1 | `src/db/index.ts:265-267` | `generateInvoiceNumber(_prefix, count)` **يتجاهل الـprefix** ويرجع `(count+1).toString()`. كل أرقام الفواتير مجرد أرقام صحيحة ("1"، "2"…). وعند حذف فاتورة، `count` ينخفض → **أرقام مكررة**. |
| B2 | `src/services/ai/actions.ts:152,157-158,212,217-218` | AI-created purchases/sales تستخدم `total = subtotal - discount + shippingCost` (بدون extraCharges) وIDs مثل `pur-${Date.now()}` / `INV-${Date.now()}` — تتصادم مع باقي التطبيق. |
| B3 | `src/context/AppContext.tsx:227-246` | **Card & wallet payments تذهب دائماً لحساب "safe" (كاش).** الشرط `paymentMethod !== 'installment'` dead code. البطاقة يجب أن تذهب لحساب bank، والمحفظة لحساب wallet. |
| B4 | `src/context/AppContext.tsx:392-403` + `src/pages/Purchases.tsx:103-121` | **دفع المورد لا يخصم من أي حساب خزينة.** `ADD_PURCHASE` لا يلمس treasury؛ `handlePayInvoice` يخصم فقط `supplier.balance`. الكاش يخرج من الشركة بدون أن يُسجَّل. |
| B5 | `src/context/AppContext.tsx:472-490` | **الرواتب والسلف وسداد السلف لا تنشئ treasury transactions.** دفع الرواتب = صفر حركة مالية. |
| B6 | `src/pages/Sales.tsx:244-266` | **`handleCollectPayment` يحدّث `paid`/`remaining` في الفاتورة فقط**، بدون treasury transaction ولا تحديث safe balance. تحصيل دين = صفر حركة. |
| B7 | `src/pages/HR.tsx:185` | **معادلة العمولة `Math.round(baseSalary * (rate/100) * 10)` — الـ`*10` تجعل العمولة أكبر 10 أضعاف.** راتب 5000 بعمولة 5% → 2500 بدلاً من 250. |
| B8 | `src/pages/Purchases.tsx:60,84` | `total = subtotal + shippingCost` — **extraCharges محذوفة** من total وremaining وsupplier.balance، رغم أن UI يعرض grandTotal صحيح. |
| B9 | `src/pages/Sales.tsx:292` | **Pagination مكسور:** `salesInvoices.slice(-invoicesPerPage * currentPage).reverse()`. صفحة 2 تعرض آخر 20 فاتورة (تتضمن العشرة في صفحة 1). |
| B10 | `src/pages/Treasury.tsx:45` | `transactions.sort(...)` **يُعدِّل array الـstate الأصلي** (no copy first) — قد يسبب React inconsistency. |
| B11 | `src/pages/Treasury.tsx:108-109` | **Transfers تُحسَب مرتين:** `totalIncome` يشمل `transfer_in` و`totalExpense` يشمل `transfer_out`. تحويل 1000 ج.م يظهر +1000 income و−1000 expense. |
| B12 | `src/services/journal.ts:44-48` | قيود غير متوازنة (`totalDebit ≠ totalCredit`) تُسجَّل مع `console.warn` فقط — **القيد يُحفظ رغم عدم التوازن.** |
| B13 | `src/services/tax.ts:47` vs `Sales.tsx:150` | **تفسير discount مختلف:** tax.ts يعتبره per-unit، Sales.tsx يعتبره per-line. للكميات > 1 النتائج تختلف. |
| B14 | `src/services/einvoice.ts:70-91,65` | XML مبنية بـstring interpolation **بدون XML escaping**. إذا احتوى invoiceNumber/company.name/taxId على `<>&"` الفاتورة الإلكترونية تفسد. كذلك `invoice.taxAmount` لا يُحسب في Sales.tsx → QR code دائماً 0 tax. |
| B15 | `src/components/Layout.tsx:272` | **RTL + collapsed sidebar يكسر الـlayout:** override الـRTL `md:mr-[280px] md:ml-0` يتفوق على collapsed `md:ml-[72px] md:mr-0`، فيبقى الهامش 280px حتى مطوي. |
| B16 | `src/pages/HR.tsx:418` | **زر "Pay" في payroll الموافق عليه بدون onClick** — نفس علة Dashboard "View All". الموظف يمكنه الموافقة لكن لا يمكنه الدفع. |
| B17 | `src/services/ai/localParser.ts:297` | `totalProfit = totalSales - totalPurchases` — **هذا ليس ربحاً.** يشمل مخزون لم يُبَع بعد. |
| B18 | `src/services/financials.ts:140-143` | Income statement تستخدم **إهلاك السنة كاملاً** بغض النظر عن فترة التقرير. تقرير Q1 يشمل 12 شهر إهلاك. |
| B19 | `src/services/financials.ts:124` | COGS يستخدم **سعر الشراء الحالي** وليس السعر التاريخي وقت البيع. |
| B20 | `src/pages/Returns.tsx:31,35` | Return total = `unitPrice * qty` — **يتجاهل discount الأصلي**. قد يرجع أكثر مما دفع العميل. ولا يوجد تحقق من qty ≤ الكمية الأصلية، ولا منع مرتجع مكرر. |
| B21 | `src/pages/Exchange.tsx:31,34` | نفس B20: exchange totals تتجاهل discount الأصلي؛ ولا توجد مقارنة بالمخزون المتاح. |

### 4.2 BUG — High

| ID | الموقع | الوصف |
|---|---|---|
| B22 | `AppContext.tsx:261-266` | `UPDATE_SALE` يطبق فرق الـpaid على "safe" **بغض النظر عن طريقة الدفع الأصلية أو الجديدة**. |
| B23 | `AppContext.tsx:388` | Audit log محدود بـ1000 entry — **مدخلات قديمة تُحذف بصمت**. مخالف للامتثال. |
| B24 | `Sales.tsx:144` | `const items = cart.map(...)` **يُظلِّل** `items` القادم من `state.data`. |
| B25 | `HR.tsx:201-203` | `payrollRecords.find(p => p.id === id)!` — non-null assertion. لو حُذف السجل بين render والنقر، التطبيق ي crash. |
| B26 | `HR.tsx:145-147` | `handleRepayAdvance` لا ينشئ treasury transaction. وفوق ذلك، نموذج السلف (line 514) يسمح بتعديل `repaidAmount` مباشرة. |
| B27 | `Treasury.tsx:76-106` | `handleTransfer` يُرسِل `ADD_TRANSACTION` مرتين منفصلتين — لو فشل أحدهما، الدفاتر لا تتوازن. |
| B28 | `Treasury.tsx:81` | رصيد غير كافٍ → `return` صامت. الزر لا يُعطَّل ولا toast. |
| B29 | `Customers.tsx:60-72` | `saveCustomer` (edit) **لا ينشئ audit log**، لكن `deleteCustomer` ينشئ. عدم اتساق. |
| B30 | `Expenses.tsx:90-93` | تعديل مصروف = `DELETE_TRANSACTION` ثم `ADD_TRANSACTION` — **غير ذري**. لو crash بينهما، المصروف يُفقد. |
| B31 | `invoicePrint.ts:83` | `@import url('https://fonts.googleapis.com/...')` — **يتطلب إنترنت**. ERP offline لن يحمّل الخطوط. |
| B32 | `invoicePrint.ts:222` | `window.open('', '_blank')` — لو البوب أب محظور، `if (!w) return` صامت. |
| B33 | `license.ts:154` | `atob(payloadB64)` لا يتعامل مع URL-safe base64 (`-`/`_`). الترخيص بأحرف URL-safe يفشل. |

### 4.3 UX — مشاكل تجربة المستخدم

| ID | الموقع | الوصف |
|---|---|---|
| U1 | `HR.tsx:269` | Year dropdown مثبت `[2024, 2025, 2026]` — **لا يعمل في 2027.** |
| U2 | `HR.tsx:271` | زر "Generate Payroll" labelه `{t('common.add')}` ("Add"). لا يوضح أنه "Generate Payroll". |
| U3 | `HR.tsx:597` | Password hint يعيد استخدام `t('settings.errWeakPassword')` (رسالة خطأ) كـhint. |
| U4 | `HR.tsx:164-169` | `handleCheckOut` يصمت لو لا يوجد سجل check-in. |
| U5 | `HR.tsx:91` | `toast.error(t('settings.errEmailExists'))` — حتى لو الخطأ weak_password. |
| U6 | `MaintenanceView.tsx:22-24` | `expectedDeliveryDate` بدون setter — **المستخدم لا يستطيع تغييرها**. |
| U7 | `Customers.tsx:137-193` | Account statement running balance يبدأ من 0، لكن الـheader يعرض `accountCustomer.balance` — **عدم تطابق مرئي**. |
| U8 | `Treasury.tsx:225` | `filteredTransactions.slice(0, 20)` — **截断 صامت عند 20**. لا يوجد pagination ولا "Show all". |
| U9 | `Settings.tsx:487,514,521-525` | **نص AI Settings مضلل:** placeholder يقول "System API key loaded automatically & securely" لكن لا يوجد system key (gemini.ts صريح بذلك). Status يعرض "System key active 🔒" حتى لو لا يوجد key. Model label `gemini-flash-latest` — ليس model حقيقي. |
| U10 | `Settings.tsx:84-90` | `handleSaveApiKey` لا يفعل شيئاً لو الـkey فارغ. لا toast. |
| U11 | `Purchases.tsx:41`, `Treasury.tsx:31`, `HR.tsx:47`, `Reports.tsx:20` | `formatCurrency` بدون `maximumFractionDigits: 2` — قد يعرض 3+ خانات عشرية. |
| U12 | `Sales.tsx:552` | Checkout يُعطَّل عندما `paidAmount < cartTotal`، لكن لو يوجد `previousBalance` يجب الدفع `grandTotalDue`. يسمح بدفع جزئي بدون تحذير. |
| U13 | `Sales.tsx:144-151` | `discount` لكل صنف = 0 دائماً (line 90) و**غير قابل للتعديل في cart UI**. ميزة ميتة. |
| U14 | `Sales.tsx:218-222` | عند تعديل فاتورة وصنفها محذوف، **صنف وهمي** يُنشأ بصمت (`stockQuantity: 0`) بدون تحذير. |
| U15 | `Layout.tsx:253,260` | Language/theme toggle labels hardcoded (English/العربية، Light/Dark) — غير i18n. |
| U16 | `Layout.tsx:324-328` | Notification badge `w-4 h-4` لا يتسع لـ"10+" — النص يفيض. |

### 4.4 A11Y — إتاحة

| ID | الوصف |
|---|---|
| A1 | `Sales.tsx` أزرار pagination/remove/actions أيقونات بدون `aria-label`. |
| A2 | `Customers.tsx`, `HR.tsx`, `Purchases.tsx` أزرار actions تستخدم `title=` فقط بدون `aria-label`. |
| A3 | `Layout.tsx` sidebar icons (collapsed) + Help button + notifications bell + profile avatar بدون `aria-label`. Tooltip يظهر hover فقط — keyboard users لا يرونه. |
| A4 | **كل المودالات** (Sales, Purchases, Customers, HR, Settings) — لا focus trapping، لا Escape handler، نقر الـbackdrop لا يُغلق. المشروع عنده `@/components/ui/dialog` لكن غير مُستخدم. |
| A5 | `Layout.tsx:152,161` `<img src={logo} alt="">` — alt فارغ. |
| A6 | `invoicePrint.ts:161` `<title>&nbsp;</title>` — نافذة الطباعة بدون عنوان有意义. |

### 4.5 SECURITY — أمني

| ID | الموقع | الوصف |
|---|---|---|
| S1 | `auth.ts:29-33` | **SHA-256 بدون iterations لكلمات السر** — يُكسر بسرعة. يجب PBKDF2 ≥100k أو Argon2. |
| S2 | `auth.ts:117,222` | مقارنة hash بـ`!==` — **timing attack**. |
| S3 | `auth.ts:119` | Session = `account.id` في IndexedDB — **بدون expiry ولا rotation**. |
| S4 | `auth.ts` | **لا rate limiting على login** — brute-force ممكن. |
| S5 | `auth.ts:77` | كلمة السر أقل من 6 أحرف — ضعيفة لـERP. |
| S6 | `gemini.ts:33,42,94` | **API key في localStorage plaintext** + يُمرَّر في URL query. |
| S7 | `license.ts:28-29,59` | Trial start + license info في localStorage — يمكن التلاعب بمدة الـtrial. **Signing secret hardcoded في source** — أي صاحب source يستطيع صناعة license. |
| S8 | `license.ts:159` | مقارنة signature بـ`!==` — not constant-time. |
| S9 | `license.ts:283-286` | `_resetTrialForTesting` **مُصدَّرة في production bundle** — يمكن استدعاؤها من console. |
| S10 | `Settings.tsx:161-170` + `db/index.ts:248-256` | `importState(importText)` يفعل `JSON.parse` بدون schema validation — ملف backup خبيث يمكنه حقن state (مثلاً محو كل البيانات عند الحفظ التالي). |
| S11 | `einvoice.ts:70-91` | XML injection (انظر B14). |
| S12 | `auth.ts:90,167` | User ID = `Date.now()` + 4-char random — ~1.3B احتمال فقط. استخدم `crypto.randomUUID()`. |

### 4.6 I18N — ترجمة

| ID | الوصف |
|---|---|
| I1 | `MaintenanceView.tsx` — **المكون كامل hardcoded عربي**. لا يتغير عند EN. |
| I2 | `CashAuditModal.tsx` — نفس المشكلة. |
| I3 | `DatabaseMaintenanceModal.tsx` — نفس المشكلة. |
| I4 | `SimulatedEInvoiceModal.tsx` — نفس المشكلة. |
| I5 | `AppContext.tsx:628,699` — نصوص عربية ثابتة في toast و loading screen. |
| I6 | `Settings.tsx:676-683,689-695,702-708` — عناوين section backup ثابتة بالعربية. |
| I7 | `ai/actions.ts:160,169,220,229` — fallbacks عربية ثابتة في فواتير AI. |
| I8 | `ai/localParser.ts:304-353` — `"EGP"` / `"جنيه"` بدلاً من `state.company.currencySymbol`. |
| I9 | `Treasury.tsx:86,95` — "Transfer to/from" hardcoded English. |
| I10 | `MaintenanceView.tsx:188-189,235` — `"ج.م"` ثابت. |
| I11 | `CashAuditModal.tsx` — `"ج.م"` في 6 أماكن. |
| I12 | `Reports.tsx:80` — مفتاح `reports.maintenance` ناقص (انظر 3.3). |

### 4.7 PERFORMANCE

| ID | الوصف |
|---|---|
| P1 | `Sales.tsx:48-57` — `filteredProducts` useMemo يعتمد على `activeItems` الذي يُعاد حسابه كل render (not memoized). |
| P2 | `Dashboard.tsx:47-78` — `salesByCategory` و`itemSalesMap` بدون useMemo، O(n×m) لكل render. |
| P3 | `Customers.tsx:32-38` — `stats()` تُستدعى لكل عميل في كل render. |
| P4 | `financials.ts:140-143,213-215` — `calculateAssetDepreciation` يُستدعى مرتين لكل asset. |
| P5 | `HR.tsx:39` — `roleLabel` يستدعي `roles.find(...)` مرتين. |
| P6 | `Inventory.tsx:122` — `inventoryValue` بدون useMemo. |
| P7 | `MaintenanceView.tsx:27-34` — `getTechnicianLedger` + `filteredReceipts` بدون useMemo. |

### 4.8 دقة الأرقام النقدية (Floating Point)

استخدام floating point بدون rounding بعد الجمع/الطرح في:
- `Treasury.tsx:42,105,106,108,109` (totalBalance, totalIncome, totalExpense, newPaid, newRemaining)
- `HR.tsx:107,187,225` (outstandingAdvances, netSalary, monthPayroll sum)
- `Reports.tsx:35,40,43,63,64,73` (months[k].sales, .profit, inventoryValue, inventoryRetailValue, totalPayroll)
- `financials.ts` (trial balance totals)
- `ai/localParser.ts:295-299`, `ai/actions.ts:145,149,152,154,210,212,214`
- `Sales.tsx:62-64`, `Returns.tsx:35`, `Exchange.tsx:34,35`, `Expenses.tsx:54,55`

**التوصية:** مَرِّر كل حسابات الكاش عبر `round2` (موجود بالفعل في `src/services/tax.ts`) بعد كل جمع/طرح.

---

## 5. مقارنة سريعة بين التقريرين

| البند | Antigravity | Super Z |
|---|---|---|
| اختبار تسجيل owner | ✅ | ✅ |
| إضافة عميل (John Doe) | ✅ | ✅ |
| إضافة صنف (Soda Can) | ✅ (لاحظ مشكلة كتابة العربية) | ✅ (استخدمت `fill` بدلاً من `type`) |
| Purchase Order + Pay | ✅ | ✅ |
| POS Sale | ✅ | ✅ |
| Return | ✅ | ✅ (التقط missing key) |
| Exchange | ✅ (بفارق 0) | ✅ + لاحظ مشكلة Exchange key |
| Expenses | ✅ (التقط missing key) | ✅ (تأكيد + صورة) |
| Treasury | ✅ | ✅ |
| Reports | ❌ لم يفحص | ✅ (التقط تاريخ 2025 + لاصق عربي) |
| HR | ❌ لم يفحص | ✅ (التقط معادلة العمولة + زر Pay بدون onClick) |
| Settings | ❌ لم يفحص | ✅ (التقط رأس مكرر + colSpan) |
| AI Chat | ❌ لم يفحص | ✅ (تأكيد عمل + لاحظ "1 invoices") |
| فحص كود الـservices | ❌ | ✅ (التقط B1-B33, S1-S12, I1-I12, P1-P7) |
| فحص security | ❌ | ✅ (SHA-256 weak, API key plaintext, license tampering) |
| فحص a11y | ❌ | ✅ (مودالات بلا focus trap, aria-labels ناقصة) |
| فحص floating point | ❌ | ✅ (14 موقع) |
| فحص الـlint | ❌ | ✅ (تأكيد 2 errors) |

**خلاصة:** تقرير Antigravity **تشغيلي سطحي** جيد كـsmoke test. تقرير Super Z **كودي عميق** + تشغيلي. الاثنان معاً يعطيان صورة شاملة.

---

## 6. Phases — Prompts للحلول

> كل Phase هو prompt جاهز للصق في AI coding agent (Cursor / Claude / Gemini / Copilot).
> الترتيب مصمم بحيث كل Phase يعتمد على ما قبله، والأخطر أولاً.

---

### Phase 1 — إصلاحات تكامل البيانات المالية الحرجة (Critical Data Integrity)

```
أنت مهندس React 19 + TypeScript. لديك مشروع Fatora ERP في المجلد الحالي.
اقرأ src/context/AppContext.tsx, src/db/index.ts, src/pages/Purchases.tsx, src/pages/HR.tsx, src/pages/Sales.tsx, src/pages/Treasury.tsx, src/services/journal.ts قبل البدء.

نحتاج إصلاح 7 مشاكل تكامل مالي حرجة. لا تغيّر UI، فقط الـlogic:

1. أصلح generateInvoiceNumber في src/db/index.ts:265-267 بحيث:
   - تستخدم الـprefix المُمرَّر: `${prefix}-${String(count+1).padStart(5,'0')}`
   - count يجب أن يُشتق من `Math.max(...existingInvoiceNumbers.map(extractNumber)) + 1` وليس من length الـarray (لتجنّب التصادم عند الحذف).
   - مرِّر prefix صحيح من كل caller (INV- للـsales، PO- للـpurchases، RET- للـreturns، EX- للـexchanges).

2. في src/context/AppContext.tsx ADD_SALE (line 227-246): بدّل منطق تحديث الخزينة بحسب paymentMethod:
   - cash → safe account
   - card → bank account (إن لم يوجد، fallback لـsafe مع console.warn)
   - wallet → wallet account (نفس fallback)
   - credit → لا تحرّك خزينة (تُضاف للـcustomer balance فقط)
   احذف الشرط الميت `paymentMethod !== 'installment'`.

3. في src/pages/Purchases.tsx handlePayInvoice (line 103-121): بعد تحديث supplier.balance، أضف dispatch ADD_TRANSACTION:
   { type:'expense', amount:paidAmount, accountId: firstSafeAccount.id, category:'Purchases',
     description:`Payment to ${supplier.name} — PO ${po.orderNumber}`, referenceNumber: po.orderNumber }
   أضف مفتاح i18n `expenses.cat.Purchases` و`expenses.cat.Exchange` و`expenses.cat.Returns` في src/i18n.ts (في كلا en و ar).
   وأضفهم في DYNAMIC_ENUM_SOURCES في scripts/check-i18n.mjs.

4. في src/context/AppContext.tsx: أضف side-effect في ADD_PAYROLL، ADD_ADVANCE، REPAY_ADVANCE (أو في الـhandlers في HR.tsx) لإنشاء ADD_TRANSACTION:
   - payroll: { type:'expense', category:'Salaries', amount:netSalary, description:`Payroll ${month} ${year} — ${employeeName}` }
   - advance: { type:'expense', category:'Advances', amount:advanceAmount, description:`Advance to ${employeeName}` }
   - repay:  { type:'income',  category:'Advances', amount:repaidAmount, description:`Advance repayment from ${employeeName}` }
   أضف مفاتيح i18n expenses.cat.Purchases, .Advances, .Returns, .Exchange في en و ar.

5. في src/pages/Sales.tsx handleCollectPayment (line 244-266): بعد تحديث invoice.paid/remaining، أضف dispatch ADD_TRANSACTION:
   { type:'income', amount:collectedAmount, accountId: safe.id, category:'Sales',
     description:`Payment collected — INV ${inv.invoiceNumber}`, referenceNumber: inv.invoiceNumber }

6. في src/pages/HR.tsx:185 (handleGeneratePayroll): أصلح معادلة العمولة إلى:
   `const commission = Math.round(baseSalary * (emp.commissionRate / 100) * 100) / 100;`

7. في src/pages/Purchases.tsx:60,84 (handleSave): أصلح total ليشمل extraCharges:
   `const total = subtotal - discount + shippingCost + (extraCharges?.reduce((s,e)=>s+Number(e.amount||0),0) || 0);`
   وتأكد أن remaining = total - paid.

اكتب اختبارات vitest جديدة في src/context/ لتغطية:
- DELETE invoice ثم إضافة invoice جديد لا ينتج رقم مكرر.
- ADD_SALE بطريقة card تُحدِّث bank account وليس safe.
- ADD_PAYROLL يُنشئ treasury transaction بقيمة netSalary.
- دفع مورد يُنشئ expense transaction بقيمة الدفع.
- معادلة العمولة لراتب 5000 و rate 5% = 250 (وليس 2500).

شغّل npm run test, npm run typecheck, npm run lint. أصلح أي خطأ. لا تغيّر شكل UI.
```

---

### Phase 2 — إصلاحات Bug عالية الأولوية (High Bugs)

```
أنت مهندس React 19 + TypeScript على مشروع Fatora. اقرأ:
src/pages/Sales.tsx, src/pages/HR.tsx, src/pages/Treasury.tsx, src/pages/Expenses.tsx,
src/pages/Customers.tsx, src/context/AppContext.tsx, src/services/journal.ts,
src/components/invoice/invoicePrint.ts, src/services/license.ts.

أصلح المشاكل التالية بدون تغيير UI:

1. src/pages/Sales.tsx:292 — Pagination مكسور. استبدل:
   `salesInvoices.slice(-invoicesPerPage * currentPage).reverse()`
   بـ:
   `[...salesInvoices].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice((currentPage-1)*invoicesPerPage, currentPage*invoicesPerPage)`

2. src/pages/Treasury.tsx:45 — transactions.sort يُعدِّل state. غلّف بـ `[...transactions].sort(...)` داخل useMemo.

3. src/pages/Treasury.tsx:108-109 — استثنِ transfer_in من totalIncome و transfer_out من totalExpense:
   `totalIncome  = transactions.filter(t => t.type==='income' || t.type==='transfer_in').reduce(...)`  → أزل transfer_in
   `totalExpense = transactions.filter(t => t.type==='expense' || t.type==='transfer_out').reduce(...)` → أزل transfer_out

4. src/pages/Treasury.tsx:76-106 (handleTransfer): استبدل dispatchَين منفصلين بـaction واحد جديد `TRANSFER_FUNDS` في AppContext.tsx يُنشئ الـtransactionَين ذرياً. أضف toast.warning لو amount > fromAcc.balance وعطّل الزر.

5. src/services/journal.ts:44-48 — بدل console.warn، ارجع error result `{ ok:false, reason:'IMBALANCED', ... }` ولا تحفظ القيد. عدّل callers لتتعامل مع الـresult.

6. src/pages/HR.tsx:418 — زر "Pay" في payroll الموافق عليه: أضف onClick يستدعي handlePayPayroll(id) التي:
   - تُحدّث status لـ'paid' بتاريخ اليوم
   - تُنشئ ADD_TRANSACTION (type:'expense', category:'Salaries', amount:netSalary)

7. src/pages/HR.tsx:145-147 (handleRepayAdvance): أضف dispatch ADD_TRANSACTION (type:'income', category:'Advances', amount:repaidAmount).

8. src/pages/HR.tsx:201-203 — استبدل `payrollRecords.find(p => p.id === id)!` بـ guard:
   `const found = payrollRecords.find(p => p.id === id); if (!found) return;`

9. src/pages/HR.tsx:269 — استبدال hardcoded `[2024, 2025, 2026]` بـ:
   `Array.from({length:4}, (_,i) => new Date().getFullYear() - 2 + i)`

10. src/pages/HR.tsx:91 — اعمل map للأخطاء زي Login.tsx (errorMessage function) بدل `toast.error(t('settings.errEmailExists'))` الثابت.

11. src/pages/HR.tsx:164-169 (handleCheckOut): لو لا يوجد سجل check-in، toast.warning بدل الصمت.

12. src/pages/Expenses.tsx:90-93 — استبدل DELETE+ADD بـaction جديد `UPDATE_TRANSACTION` في AppContext.tsx.

13. src/pages/Customers.tsx:60-72 (saveCustomer edit branch): أضف dispatch ADD_AUDIT_LOG بنفس pattern الـdelete.

14. src/components/invoice/invoicePrint.ts:83 — احذف @import Google Fonts، استخدم font stack محلي:
    `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Tahoma', 'Cairo', sans-serif;`
    واستبدل setTimeout(400) بـ `w.onload = () => { w.print(); };`

15. src/components/invoice/invoicePrint.ts:222 — لو !w، toast.error "Please allow popups to print".

16. src/services/license.ts:154 — قبل atob، حوّل URL-safe → standard:
    `b64 = b64.replace(/-/g,'+').replace(/_/g,'/'); while (b64.length % 4) b64 += '=';`

17. src/services/license.ts:283-286 — غلّف `_resetTrialForTesting` بـ `if (import.meta.env.DEV)` export.

18. src/services/license.ts:159 — استبدل `!==` بـ constant-time comparison:
    `if (a.length !== b.length) return false; let r = 0; for (let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;`

19. src/context/AppContext.tsx:388 — احذف `.slice(0, 1000)` من audit log (احتفظ بكل السجل). أو ارشيف لـIndexedDB منفصل بعد 1000.

20. src/services/ai/localParser.ts:297 — استبدل `totalProfit = totalSales - totalPurchases` بـ:
    `totalProfit = totalSales - salesInvoices.reduce((s, inv) => s + inv.items.reduce((s2, it) => s2 + it.quantity * (items.find(i=>i.id===it.itemId)?.purchasePrice || 0), 0), 0)`

أضف اختبارات vitest لكل إصلاح. شغّل npm run test, typecheck, lint. أصلح أي شيء.
```

---

### Phase 3 — إصلاحات i18n + Reports + Dashboard

```
أنت مهندس React + i18next. مشروع Fatora. اقرأ src/i18n.ts, scripts/check-i18n.mjs, src/pages/Reports.tsx, src/pages/Dashboard.tsx, src/pages/Settings.tsx, src/components/Layout.tsx.

أصلح مشاكل الترجمة والـReports والـDashboard:

1. في src/i18n.ts، أضف في كلا en و ar تحت expenses.cat:
   - returns: 'Returns' / 'مرتجعات'
   - exchange: 'Exchange' / 'استبدال'
   - purchases: 'Purchases' / 'مشتريات'
   - salaries: (موجود) — فقط تحقق
   - advances: 'Advances' / 'سلف'

2. في scripts/check-i18n.mjs، عدّل السطر الخاص بـ `expenses.cat` ليشمل القيم الجديدة:
   `{ ns: 'expenses.cat', values: ['office','utilities','salaries','rent','supplies','marketing','maintenance','other','returns','exchange','purchases','advances'] }`

3. في src/pages/Reports.tsx:17-18 — استبدال hardcoded 2025 بـ:
   ```
   const y = new Date().getFullYear();
   const [dateFrom, setDateFrom] = useState(`${y}-01-01`);
   const [dateTo, setDateTo] = useState(`${y}-12-31`);
   ```

4. في src/pages/Reports.tsx:80 — استبدل `'الورش والصيانة'` بـ `t('reports.maintenance')`. وأضف المفتاح في src/i18n.ts (en: 'Workshops & Maintenance', ar: 'الورش والصيانة').

5. في src/pages/Dashboard.tsx:89 — احذف `change: '+12%'` الثابت واحسب النسبة الحقيقية:
   ```
   const yesterday = salesInvoices.filter(s => s.createdAt.startsWith(dayBeforeYesterday));
   const yesterdayRevenue = yesterday.reduce((s, x) => s + x.total, 0);
   const change = yesterdayRevenue > 0 ? `${Math.round((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100)}%` : '—';
   ```

6. في src/pages/Dashboard.tsx:166-170 — اجعل dropdown الـRevenue Overview فعّالاً:
   - أضف state `const [revenueRange, setRevenueRange] = useState<'week'|'month'|'year'>('week');`
   - اربط الـselect بـsetRevenueRange
   - استبدل `last7Days` بـfunction تعتمد على revenueRange (7 أيام / 30 يوم / 12 شهر)

7. في src/pages/Dashboard.tsx:287 — أضف onClick لزر "View All": `onClick={() => setModule('reports')}`.

8. في src/pages/Settings.tsx:547 — استبدل `t('hr.employeeName')` بـ `t('settings.linkedEmployee')`. أضف المفتاح في i18n (en: 'Linked Employee', ar: 'الموظف المرتبط').

9. في src/pages/Settings.tsx:554 — غيّر `colSpan={5}` إلى `colSpan={6}`.

10. في src/pages/Settings.tsx:487,514,521-525 — أصلح نصوص AI Settings المضللة:
    - placeholder: `t('settings.geminiKeyPlaceholder')` = "Paste your Gemini API key" / "ألصق مفتاح Gemini هنا"
    - status: بدل "System key active 🔒" أظهر الحقيقة:
      `const hasKey = Boolean(apiKey || state.data.company.geminiApiKey);`
      `hasKey ? t('settings.aiKeyActive') : t('settings.aiKeyMissing')`
    - model label: استبدل `gemini-flash-latest` بـ `gemini-2.5-flash` (model فعلي).

11. في src/pages/Settings.tsx:676-683,689-695,702-708 — استبدل العناوين العربية الثابتة في تبويب Backup بـ i18n keys:
    `t('settings.sectorInit')`, `t('settings.treasuryAudit')`, `t('settings.dbMaintenanceTools')`.

12. في src/components/Layout.tsx:253,260 — استبدل labels الثابتة بـ i18n:
    - `{isRTL ? 'English' : 'العربية'}` → `{isRTL ? t('common.english') : t('common.arabic')}`
    - `{darkMode ? 'Light' : 'Dark'}` → `{darkMode ? t('common.lightMode') : t('common.darkMode')}`
    أضف المفاتيح في i18n (en/ar).

13. في src/components/Layout.tsx:272 — أصلح layout RTL + collapsed sidebar. استبدل:
    ```
    className={`transition-all duration-300 ${
      sidebarCollapsed
        ? (isRTL ? 'md:mr-[72px] md:ml-0' : 'md:ml-[72px] md:mr-0')
        : (isRTL ? 'md:mr-[280px] md:ml-0' : 'md:ml-[280px] md:mr-0')
    }`}
    ```

14. في src/components/Layout.tsx:324-328 — أصلح notification badge:
    ```
    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-destructive rounded-full flex items-center justify-center">
      <span className="text-[10px] text-destructive-foreground font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
    </span>
    ```

15. شغّل `node scripts/check-i18n.mjs` ثم `npm run build` — يجب أن ينجحا بدون أخطاء.
```

---

### Phase 4 — تدويل المكونات العربية الثابتة (Hardcoded Arabic Modals)

```
أنت مهندس i18next. مشروع Fatora. اقرأ الملفات الأربعة التالية (كلها مكتوبة بالعربية فقط):
1. src/components/maintenance/MaintenanceView.tsx
2. src/components/cashAudit/CashAuditModal.tsx
3. src/components/database/DatabaseMaintenanceModal.tsx
4. src/components/einvoice/SimulatedEInvoiceModal.tsx

لكل ملف:

1. استخرج كل النصوص العربية الثابتة إلى مفاتيح i18n. استخدم namespace محدد لكل ملف:
   - maintenance.* (للـMaintenanceView)
   - cashAudit.* (للـCashAuditModal)
   - dbMaintenance.* (للـDatabaseMaintenanceModal)
   - einvoice.* (للـSimulatedEInvoiceModal)

2. أضف المفاتيح في src/i18n.ts في كلا en و ar. الترجمات الإنجليزية يجب أن تكون طبيعية (ليست ترجمة آلية حرفية).

3. استبدل كل نص hardcoded بـ `t('namespace.key')`.

4. استبدل كل `"ج.م"` بـ `state.data.company.currencySymbol`.

5. أضف `const { t, i18n } = useTranslation(); const isRTL = i18n.language === 'ar';` في كل مكون.
   استخدم isRTL لضبط direction (flex-row-reverse, text-right, dir='rtl') بدلاً من إجبار RTL دائماً.

6. في scripts/check-i18n.mjs، أضف enumerations للقيم الديناميكية الجديدة (status names, types, إلخ).

7. شغّل `node scripts/check-i18n.mjs` — يجب أن ينجح. ثم `npm run build`.

تأكد أن كل مكون يعمل صحيح في كلا الوضعين (EN/AR) بفتح الصفحة في المتصفح وتحويل اللغة.
```

---

### Phase 5 — إصلاحات Inventory UX + Sales Discounts + Floating Point

```
أنت مهندس React + UX. مشروع Fatora. اقرأ src/pages/Inventory.tsx, src/pages/Sales.tsx, src/pages/HR.tsx, src/pages/Treasury.tsx, src/pages/Reports.tsx, src/pages/Expenses.tsx, src/services/financials.ts, src/services/ai/localParser.ts, src/services/ai/actions.ts.

أصلح:

1. src/pages/Inventory.tsx — إعادة ترتيب حقول Add Item modal:
   الترتيب الحالي: Purchase Price, Sale Price, Profit Margin, Stock, Min Stock.
   الترتيب المطلوب: Stock, Min Stock Level, Purchase Price, Sale Price, Profit Margin (مع Apply).
   السبب: المستخدم يفكر "كم عندي؟ كم الحد الأدنى؟ ثم الأسعار". فصل الـStock عن الـPrices يمنع الخطأ.
   كذلك غيّر ترتيب حقول New Category: EN أولاً ثم AR (ليس العكس).

2. src/pages/Sales.tsx:144-151 — أضف input للـdiscount per cart line بجانب حقل الـprice override.
   حالياً discount = 0 دائماً. اجعله قابلاً للتعديل (0..unitPrice). عند تغييره، أعِد حساب line total = (price - discount) * qty.

3. src/pages/Sales.tsx:552 —Checkout disabled logic:
   - للـcash: require paidAmount >= cartTotal + previousBalance (الـgrandTotalDue)
   - للـcard/wallet: allow paidAmount >= cartTotal
   - للـcredit: allow paidAmount = 0 (يُضاف للـbalance)
   أضف toast.warning عند محاولة short-pay.

4. src/pages/Sales.tsx:218-222 — عند تعديل فاتورة بصنف محذوف، اعرض badge "Item deleted" بدلاً من إنشاء صنف وهمي صامت.

5. Floating point precision — أنشئ utility في src/lib/money.ts:
   ```ts
   export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
   export const sum2 = (arr: number[]) => round2(arr.reduce((s, n) => s + n, 0));
   ```
   ثم استبدل كل aggregations الـmoney غير المُدوَّرة في:
   - Treasury.tsx:42,105,106,108,109
   - HR.tsx:107,187,225
   - Reports.tsx:35,40,43,63,64,73
   - financials.ts (trial balance totals)
   - ai/localParser.ts:295-299
   - ai/actions.ts:145,149,152,154,210,212,214
   - Sales.tsx:62-64, Returns.tsx:35, Exchange.tsx:34,35, Expenses.tsx:54,55

6. src/pages/Inventory.tsx:122 — غلّف inventoryValue في useMemo.

7. src/pages/Sales.tsx:48-57 — أصلح useMemo لـfilteredProducts بأن تعتمد على activeItems memoized بدلاً من recompute.

8. src/pages/Dashboard.tsx:47-78 — غلّف salesByCategory وitemSalesMap في useMemo.

9. src/pages/Customers.tsx:32-38 — بدلاً من استدعاء stats() لكل عميل في كل render، memoize lookup map:
   ```ts
   const statsMap = useMemo(() => {
     const m = new Map<string, { totalPurchases: number; totalPayments: number; invoiceCount: number; lastPurchase: string; }>();
     salesInvoices.forEach(inv => { ... }); // build once
     return m;
   }, [salesInvoices, customers]);
   ```

10. src/pages/HR.tsx:39 — roleLabel: حفظ `const r = roles.find(...)` مرة واحدة.

11. src/pages/MaintenanceView.tsx:22-24 — أضف setter لـexpectedDeliveryDate، وحدّث الـinput ليكون editable.

12. src/pages/Customers.tsx:137-193 — Account statement running balance: ابدأ من `accountCustomer.balance - sum(debit-credit)` أو اعرض note "starting balance 0".

13. src/pages/Treasury.tsx:225 — استبدل `slice(0, 20)` بـpagination حقيقي (10 صفوف/صفحة + أزرار Previous/Next).

14. src/pages/Settings.tsx:84-90 — handleSaveApiKey: allow saving empty (= clear) أو toast.warning.

15. src/pages/Purchases.tsx:41, Treasury.tsx:31, HR.tsx:47, Reports.tsx:20 — أضف `maximumFractionDigits: 2` لكل formatCurrency.

شغّل npm run test, typecheck, lint. لا تكسر UI الحالي.
```

---

### Phase 6 — إصلاحات الأمن (Security Hardening)

```
أنت مهندس أمن تطبيقات. مشروع Fatora. اقرأ src/services/auth.ts, src/services/license.ts, src/services/ai/gemini.ts, src/db/index.ts, src/pages/Settings.tsx, src/services/einvoice.ts.

أصلح:

1. src/services/auth.ts:29-33 — استبدل SHA-256 بـ PBKDF2:
   ```ts
   async function hashPassword(password: string, salt: string): Promise<string> {
     const enc = new TextEncoder();
     const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
     const bits = await crypto.subtle.deriveBits(
       { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
       keyMaterial, 256
     );
     return toHex(bits);
   }
   ```
   ملاحظة: هذا سيُفسد الحسابات الموجودة. أضف migration: في getAccounts، إذا كان hash يطابق الـSHA-256 القديم (32 byte hex بدون prefix)، أعد hash بكلمة السر المُقدَّمة (تحتاج لتتبعها في login) وحدّث.

2. src/services/auth.ts:117,222 — استبدل `hash !== account.passwordHash` بـ constant-time comparison:
   ```ts
   function timingSafeEqual(a: string, b: string): boolean {
     if (a.length !== b.length) return false;
     let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
     return r === 0;
   }
   ```

3. src/services/auth.ts:119 — بدل تخزين `account.id` كـsession، استخدم random session token:
   - عند login: `const token = crypto.randomUUID(); await idbSet('auth_sessions', [...existing, { token, accountId: account.id, createdAt: Date.now(), expiresAt: Date.now() + 86400000 }])`
   - عند getCurrentUser: اقرأ الـtoken، تحقق من expiry، ثم ابحث عن account.
   - عند logout: احذف الـtoken من sessions.

4. src/services/auth.ts — أضف rate limiting:
   - بعد كل محاولة login فاشلة، سجّل timestamp في `idbSet('auth_attempts_' + email, [...])`.
   - إذا تجاوز 5 محاولات في 15 دقيقة، ارجع `{ ok:false, error:'rate_limited' }` وأضفه لـerrorMessage map في Login.tsx.

5. src/services/auth.ts:77 — ارفع الحد الأدنى لكلمة السر لـ8 أحرف. أضف فحص complexity (حرف كبير + رقم).

6. src/services/ai/gemini.ts:33,42,94 — بدل تمرير API key في URL query، استخدم header:
   ```ts
   const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
   const res = await fetch(url, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
     body: JSON.stringify(payload),
   });
   ```

7. src/services/ai/gemini.ts — بدل localStorage، خزّن API key في IndexedDB (أفضل قليلاً) أو في Tauri secure storage إن متاح. أضف helper `idbGet('gemini_key')` / `idbSet('gemini_key', value)`.

8. src/services/license.ts — نقل signing secret لـenv variable غير مُصدَّر في source:
   - استخدم `import.meta.env.VITE_LICENSE_SECRET` (يتطلب .env.local).
   - أضف fallback: لو السر غير موجود، عطّل التحقق من الـsignature واعتمد على expiry date فقط (مع console.warn).
   - للأمان الحقيقي: يجب أن يتم signature verification server-side. أضف TODO comment.

9. src/services/license.ts:28-29 — بدل localStorage، استخدم Tauri secure storage (إن متاح) أو على الأقل obscure الـvalue:
   - `await idbSet('license_trial', { start: Date.now(), obfuscated: true })`.

10. src/db/index.ts:248-256 (importState) — أضف schema validation:
    ```ts
    import { z } from 'zod'; // موجود في dependencies
    const AppStateSchema = z.object({ ... }); // عرّف schema كاملة
    export function importState(json: string): boolean {
      try {
        const raw = JSON.parse(json);
        const parsed = AppStateSchema.safeParse(raw);
        if (!parsed.success) { console.error('Invalid backup:', parsed.error); return false; }
        saveState(migrate(parsed.data));
        return true;
      } catch { return false; }
    }
    ```

11. src/services/einvoice.ts:70-91 — استخدم XML builder أو escape function:
    ```ts
    const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]!));
    ```
    طبّقها على كل قيمة مُدخَلة.

12. src/services/auth.ts:90,167 — استبدل ID generation بـ `crypto.randomUUID()`:
    ```ts
    id: `user-${crypto.randomUUID()}`
    ```

13. src/pages/Settings.tsx:161-170 — في handleImport، أضف تأكيد `window.confirm(t('settings.confirmImport'))` قبل الاستيراد.

14. احذف `_resetTrialForTesting` من production bundle (في Phase 2 غُلِّف بـDEV). تحقق بـ `npm run build` أن الدالة ليست في الـdist.

شغّل npm run test, typecheck, lint. اكتب اختبارات للـmigration من SHA-256 إلى PBKDF2.
```

---

### Phase 7 — إصلاحات Accessibility (A11Y)

```
أنت مهندس accessibility. مشروع Fatora. اقرأ src/components/Layout.tsx, src/pages/Sales.tsx, src/pages/Customers.tsx, src/pages/HR.tsx, src/pages/Purchases.tsx, src/components/invoice/invoicePrint.ts, وكل المودالات في src/pages/*.tsx.

أصلح:

1. في كل مودال (Sales, Purchases, Customers, HR, Settings, Inventory, Returns, Exchange, Expenses, Treasury) — استبدل الـdiv المودال بـ Dialog component الموجود في src/components/ui/dialog.tsx (الذي يوفّر focus trapping, Escape handler, backdrop click). لو Dialog لا يدعم كل الاحتياجات، أضف manually:
   - `<div role="dialog" aria-modal="true" aria-labelledby="modal-title-id">`
   - focus trap: عند فتح المودال، ركّز على أول input. احفظ الـelement السابق، وعند الإغلاق أعد التركيز عليه.
   - Escape handler: `useEffect(() => { const h = e => e.key==='Escape' && close(); window.addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [])`.
   - backdrop click: `onClick={e => e.target === e.currentTarget && close()}`.

2. src/components/Layout.tsx — أضف aria-label لكل icon-only button:
   - sidebar toggle: `aria-label={t('nav.toggleSidebar')}`
   - mobile menu open: `aria-label={t('nav.openMenu')}`
   - mobile menu close (X): `aria-label={t('nav.closeMenu')}`
   - help: `aria-label={t('common.help')}`
   - search: `aria-label={t('common.search')}`
   - notifications bell: `aria-label={t('notifications.title')}`
   - profile button: `aria-label={t('nav.profile')}`
   أضف المفاتيح في i18n.ts.

3. src/pages/Sales.tsx — أضف aria-label لكل icon-only buttons:
   - pagination prev/next: `aria-label={t('common.previousPage')}` / `t('common.nextPage')`
   - remove from cart (X): `aria-label={t('sales.removeFromCart')}`
   - action buttons (edit, view, print): `aria-label={t('...')}`

4. src/pages/Customers.tsx, HR.tsx, Purchases.tsx — استبدل `title=` بـ `aria-label=` (أو أضف aria-label بجانب title).

5. src/components/Layout.tsx:152,161 — استبدل `alt=""` بـ `alt={companyName}`.

6. src/components/invoice/invoicePrint.ts:161 — استبدل `<title>&nbsp;</title>` بـ `<title>${t('invoice.title')} ${inv.invoiceNumber}</title>`.

7. اجعل tooltips في sidebar collapsed keyboard-focusable: بدل `opacity-0 group-hover:opacity-100`، استخدم `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` وأضف `tabIndex={0}` للأزرار.

8. أضف skip-to-content link في بداية Layout:
   `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 bg-primary text-primary-foreground px-3 py-2 rounded">{t('common.skipToContent')}</a>`
   وأضف `id="main-content"` للـ<main>.

9. تأكد إن كل interactive elements لهم visible focus ring: أضف `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` لكل button/input/select.

10. شغّل axe-core (npm install --save-dev @axe-core/playwright) واكتب اختبار يفحص كل صفحة. يجب أن يكون 0 violations.

شغّل npm run test, typecheck, lint.
```

---

### Phase 8 — Code-Splitting + Performance + Lint Cleanup

```
أنت مهندس performance. مشروع Fatora. اقرأ vite.config.ts, src/pages/Inventory.tsx, src/pages/Sales.tsx, src/pages/Reports.tsx, src/pages/HR.tsx, src/pages/Settings.tsx, src/components/maintenance/MaintenanceView.tsx, src/services/financials.ts.

أصلح:

1. Code-splitting لتقليل Inventory chunk من 541 KB:
   - في src/pages/Inventory.tsx، استبدل:
     `import * as XLSX from 'xlsx';`
     بـ lazy import داخل handlers:
     ```ts
     const handleExport = async () => {
       const XLSX = await import('xlsx');
       ...
     };
     ```
   - نفس الشيء لـ `import JsBarcode from 'jsbarcode';` — lazy داخل handlePrintBarcodes.
   - في vite.config.ts، أضف manualChunks:
     ```ts
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
             'radix-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', /* ... */],
             'charts': ['recharts'],
             'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
           },
         },
       },
     },
     ```
   - الهدف: Inventory chunk أقل من 250 KB.

2. src/components/maintenance/MaintenanceView.tsx:23 — أصلح lint error:
   ```ts
   const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() =>
     new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
   );
   ```
   استخدام initializer function (لا يُستدعى أثناء render مباشرة، فقط عند first mount).

3. src/services/financials.ts:85 — أصلح lint error: استبدل `any` بـ type صحيح:
   ```ts
   // قبل
   function someFunc(arg: any) { ... }
   // بعد
   type SomeArg = { /* shape */ };
   function someFunc(arg: SomeArg) { ... }
   ```
   أو إن كان لا يمكن تحديده، استخدم `unknown` مع type guard.

4. src/services/financials.ts:140-143,213-215 — cache calculateAssetDepreciation في Map:
   ```ts
   const depCache = new Map<string, number>();
   const cachedDep = (asset) => {
     const key = asset.id;
     if (!depCache.has(key)) depCache.set(key, calculateAssetDepreciation(asset));
     return depCache.get(key)!;
   };
   ```

5. src/pages/HR.tsx:39 (roleLabel) — حفظ find مرة واحدة:
   ```ts
   const roleLabel = (roleId: UserRole) => {
     const r = roles.find(x => x.id === roleId);
     return r ? (isRTL ? r.nameAr : r.name) : roleId;
   };
   ```

6. src/components/maintenance/MaintenanceView.tsx:27-34 — useMemo:
   ```ts
   const technicianLedger = useMemo(() => getTechnicianLedger(state.data), [state.data]);
   const filteredReceipts = useMemo(() => receipts.filter(...), [receipts, /* filters */]);
   ```

7. شغّل `npm run build` — يجب ألا يوجد chunk > 500 KB.
8. شغّل `npm run lint` — يجب أن يكون 0 errors.
9. شغّل `npm run typecheck` — يجب أن ينجح.
10. شغّل `npm run test` — كل الاختبارات يجب أن تنجح.

أضف CI check في .github/workflows/ci.yml (إن لم يوجد) يشغّل typecheck + lint + test + build على كل PR.
```

---

## 7. خريطة الأولويات (الترتيب الزمني المقترح)

| Phase | المدة المقدّرة | الأولوية | التأثير |
|---|---|---|---|
| Phase 1 — Data Integrity حرج | 2-3 أيام | P0 | يحفظ دفاتر الحسابات من الفساد |
| Phase 2 — High Bugs | 3-4 أيام | P1 | يحفظ من فقدان بيانات + crashes |
| Phase 3 — i18n + Reports + Dashboard | 1-2 يوم | P1 | يصلح تجربة المستخدم الأولية |
| Phase 4 — تدويل المودالات | 2-3 أيام | P2 | يدعم المستخدم الإنجليزي بالكامل |
| Phase 5 — UX + Floating Point | 2-3 أيام | P2 | دقة مالية + راحة استخدام |
| Phase 6 — Security | 3-4 أيام | P1 (إن كان production) | حماية كلمات السر + API keys + license |
| Phase 7 — A11Y | 2-3 أيام | P2 | إتاحة كاملة + امتثال WCAG |
| Phase 8 — Performance + Lint | 1-2 يوم | P3 | تحسين سرعة + 0 lint errors |

**الإجمالي:** 16-24 يوم عمل (مطور واحد). يمكن تقليله بالتوازي بين Phase 4 (i18n) و Phase 6 (security) لأنهما مستقلتان.

---

## 8. ملاحظات ختامية

### إيجابيات المشروع
- ✅ بنية React 19 + TypeScript صارمة (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- ✅ 57 اختبار unit ينجحون
- ✅ سكريبت `check-i18n.mjs` يقفل الـbuild لو في مفاتيح ناقصة (يحتاج توسعة)
- ✅ دعم ثنائي اللغة كامل في معظم الصفحات
- ✅ نظام صلاحيات بـroles و permissions لكل module
- ✅ تكامل Gemini AI فعّال (تم اختباره تشغيلياً)
- ✅ Tauri جاهز للتغليف كـdesktop app
- ✅ Lazy loading للصفحات (`React.lazy`)
- ✅ مخزن بيانات atomic writes عبر IndexedDB + fileStore fallback

### نقاط ضعف هيكلية
- ❌ **لا يوجد backend** — كل البيانات في المتصفح.不适合 لـmulti-store أو multi-user حقيقي.
- ❌ **لا يوجد server-side validation** — أي client-side check يمكن تجاوزه من console.
- ❌ **audit log محدود بـ1000 entry** — غير مناسب للامتثال الضريبي المصري.
- ❌ ** treasury integration مكسور** — أبرز مشكلة، يجب إصلاحها أولاً.
- ❌ **floating point بدون rounding** — تراكم أخطاء بنس/قروش على المدى الطويل.
- ❌ **مكونات عربية فقط** — يحد من الانتشار خارج السوق المصري/الخليجي.

### خطوات تالية بعد الـ8 Phases
1. إضافة backend (Supabase / Pocketbase / custom) للمزامنة بين الأجهزة.
2. إضافة server-side license validation (إزالة signing secret من source).
3. إضافة printer integration عبر Tauri للـthermal printers.
4. إضافة Egypt e-invoice API integration حقيقية (بدل SimulatedEInvoiceModal).
5. إضافة offline-first sync لـmulti-device.
6. إضافة Arabic OCR لاستيراد الفواتير من صور.

---

*تم إعداد هذا التقرير بواسطة Super Z (GLM) في 24 يوليو 2026، كـmerged report يجمع بين فحص Antigravity التشغيلي وفحص Super Z الكودي العميق.*
