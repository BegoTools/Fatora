# Easy Store ERP — دليل شرح الكود (Project Documentation)

> هذا الملف يشرح كل جزء رئيسي في المشروع ليتمكّن أي مطوّر (أو الذكاء الاصطناعي) من تعديله لاحقًا بسهولة.
> آخر تحديث: بعد تطبيق هوية **Azimuth ERP** (تصميم أزرق داكن + أخضر) وإضافة وحدة **المصروفات** و**الاقتراح الذكي للصلاحيات**.

---

## 1) نظرة عامة (Overview)

تطبيق ERP متجر محلي (Offline-First) مبني بـ:
- **Vite + React 18 + TypeScript**
- **Tailwind CSS** للتنسيق + متغيرات CSS (HSL) لنظام التصميم.
- **i18next** لدعم العربية/الإنجليزية مع اتجاه RTL تلقائي.
- **IndexedDB** (عبر `idb.ts`) لتخزين كل البيانات محليًا بدون خادم.
- **Recharts** للرسوم البيانية في لوحة التحكم والتقارير.
- **Lucide-react** للأيقونات، و**shadcn/ui** (مكوّنات `components/ui`) كأساس للواجهة.

المجلد الجذر للتطبيق: `app/` والمشروع عام: `Kimi_Agent_Easy Store ERP Project/`.

---

## 2) بنية المجلدات (Folder Structure)

```
app/
├─ index.html                # نقطة الدخول + خطوط Google (IBM Plex Sans Arabic + Inter)
├─ tailwind.config.js        # ألوان Azimuth + الخطوط + نصف الأقطار
├─ vite.config.ts            # إعداد Vite + alias "@"
├─ src/
│  ├─ main.tsx               # تحميل React + i18n
│  ├─ App.tsx                # البوابة (AuthGate) + التوجيه (ModuleRouter)
│  ├─ App.css
│  ├─ index.css              # متغيرات التصميم (HSL) + الخطوط + شريط التمرير
│  ├─ i18n.ts                # كل نصوص الواجهة (en + ar) في كائن واحد
│  ├─ types/
│  │  ├─ index.ts            # كل الأنواع (Item, Customer, SaleInvoice, ModuleId, AppState...)
│  │  ├─ permissions.ts      # PermissionModule, RolePermissions, PERMISSION_MODULES
│  │  └─ ai.ts               # أنواع الذكاء الاصطناعي
│  ├─ db/
│  │  ├─ idb.ts              # غلاف IndexedDB بسيط (get/set/delete)
│  │  └─ index.ts            # getDefaultState, migrate, saveState, generateId...
│  ├─ context/
│  │  ├─ AppContext.tsx      # الحالة الرئيسية + الـ reducer + recalcCustomerBalances
│  │  └─ AuthContext.tsx     # المستخدمون، الأدوار، دالة can(module, action)
│  ├─ services/
│  │  ├─ auth.ts             # تسجيل الدخول/التسجيل/تشفير كلمة المرور
│  │  ├─ roles.ts            # الأدوار الافتراضية + إنشاء/تعديل/حذف الدور
│  │  └─ ai/                 # gemini.ts + index.ts (aiManager) + localParser
│  ├─ components/
│  │  ├─ Layout.tsx          # الشريط الجانبي + الشريط العلوي (الهوية البصرية)
│  │  ├─ ui/                 # مكوّنات shadcn (button, card, input, table...)
│  │  ├─ invoice/            # مصمم الفاتورة + InvoiceDocument + invoicePrint
│  │  └─ ai/AIChat.tsx       # مساعد الذكاء الاصطناعي العائم
│  └─ pages/                 # كل شاشة: Dashboard, Inventory, Sales, Customers,
│                              Returns, Exchange, Purchases, Expenses, Treasury,
│                              Reports, HR, Settings, Login
```

---

## 3) نظام البيانات (State & Persistence)

### `src/db/index.ts`
- `getDefaultState()` يبني الحالة الأولى (شركة افتراضية، حساب خزينة واحد "Main Safe"، مصمم فاتورة افتراضي).
- `migrate(state)` يدمج البيانات القديمة مع الحقول الجديدة حتى لا تفقد البيانات عند الترقية.
- `saveState(data)` يكتب في IndexedDB (fire-and-forget).
- `generateId(prefix)` ينتج معرّفات فريدة.
- `generateInvoiceNumber(prefix, count)` يولّد رقم فاتورة تسلسليًا.

### `src/db/idb.ts`
غلاف KV بسيط على متجر `'kv'` داخل قاعدة `easy_store_erp`. لا يوجد استعلام/فهرسة؛ كل التصفية تتم في الذاكرة داخل الصفحات.

### `src/context/AppContext.tsx`
- يحتوي على **كل** بيانات التطبيق في `AppState` (مصفوفات: items, customers, salesInvoices, purchaseInvoices, returns, exchanges, transactions, employees, roles عبر AuthContext... إلخ).
- `reducer` يعالج كل الإجراءات (ADD/UPDATE/DELETE لكل كيان).
- دالة **`recalcCustomerBalances(data)`**: تحسب رصيد كل عميل = مجموع (الفاتورة − المدفوع) + المرتجعات + الاستبدالات + التسويات. تُستدعى عند `SET_STATE`.
- **القاعدة المحاسبية المهمة:** عند بيع (`ADD_SALE`) تُنقص كمية الصنف، ويُضاف `paid` لحساب الخزينة مع حركة `income`. المرتجع يعكس ذلك. المشتريات (`ADD_PURCHASE`) تزيد المخزون فقط (الخزينة تُحدّث يدويًا من صفحة المشتريات).

---

## 4) الصلاحيات (Permissions)

### `src/types/permissions.ts`
- `PermissionModule`: قائمة الوحدات (`dashboard, inventory, sales, customers, returns, exchange, purchases, expenses, treasury, reports, hr, settings, users`).
- `PermissionAction`: `view | create | edit | delete`.
- `RolePermissions = Record<ModuleModule, Record<Action, boolean>>`.
- `PERMISSION_MODULES` و`PERMISSION_ACTIONS` تُستخدم للمرور على كل الصلاحيات.
- أدوات: `emptyPermissions()`, `fullPermissions()`, `makePermissions(partial)`, `normalizePermissions(input)` (يملأ الفراغات).

### `src/services/roles.ts`
- `defaultRoles()` تُرجع 10 أدوار جاهزة (owner, admin, manager, sales, accountant, cashier, warehouse, purchasing, customer_service, employee).
- **المالك (owner)** دائمًا بصلاحيات كاملة ولا يمكن تخزينه أو تعديله (`getRoles` يدمج المخزّن فوق الافتراضي لكن owner يبقى كامل).
- `createRole / updateRole / deleteRole` تحمي الأدوار النظامية والمالك.

### `src/context/AuthContext.tsx`
- يوفر `can(module, action='view')`: ترجع `true` للمالك دائمًا، وإلا تفحص دور المستخدم عبر `roleCan`.
- تُستخدم هذه الدالة لإظهار/إخفاء أزرار التنقل والعمليات في كل الصفحات.

### الاقتراح الذكي للصلاحيات (AI Role Suggestions)
- `aiManager.suggestRolePermissions(roleName, description)` في `src/services/ai/index.ts` يرسل اسم الرتبة للنموذج (Gemini) ويُرجع كائن `RolePermissions` مُطبَّع.
- الزر موجود في نافذة الرتبة داخل `Settings.tsx` (يستخدم `Sparkles` + حالة تحميل `suggesting`).

---

## 5) التوجيه والواجهة (Routing & Layout)

### `src/App.tsx`
- `AuthGate`: إن لم يكن هناك مستخدم → `Login`، وإلا يلفّ التطبيق بـ `AppProvider`.
- `ModuleRouter()`: `switch` على `state.ui.currentModule` (قيمة من نوع `ModuleId`) ويعرض الصفحة المناسبة (كلها lazy-loaded).
- **لإضافة صفحة جديدة:** أضف lazy import + `case` هنا، وأضف المفتاح إلى `ModuleId`.

### `src/components/Layout.tsx` (الهوية البصرية)
- **الشريط الجانبي الأيمن** (للـ RTL) بعرض 280px بلون `bg-tertiary` (كحلي داكن `#003462`).
- يعرض **الشعار واسم الشركة ديناميكيًا** من `state.data.company` (إن وُجد `company.logo` يُعرض، وإلا الحرف الأول).
- زر **"فاتورة جديدة"** أخضر (`bg-success`) ينقل إلى المبيعات.
- عناصر التنقل: أيقونة + اسم من `t('nav.${mod}')`، والعنصر النشط يأخذ `bg-tertiary-container text-tertiary-on-container`.
- **الشريط العلوي:** عنوان الوحدة الحالية (`primary` كحلي) + بحث + إشعارات + قائمة المستخدم (اللغة/الثيم/تسجيل الخروج).

---

## 6) الوحدات الحالية (Modules)

| المفتاح (ModuleId) | الصفحة | الوصف |
|---|---|---|
| `dashboard` | Dashboard.tsx | بطاقات KPI + رسوم Recharts + تنبيهات |
| `customers` | Customers.tsx | إدارة العملاء + كشف الحساب + تسويات الرصيد |
| `inventory` | Inventory.tsx | الأصناف + التصنيفات + تعديل المخزون |
| `sales` | Sales.tsx | نقطة البيع + الفواتير + التحصيل + المرتجع/الاستبدال |
| `purchases` | Purchases.tsx | أوامر الشراء + الموردين + سداد الفواتير |
| `expenses` | Expenses.tsx | **مضافة حديثًا** — مصروفات من `transactions` بنوع `expense` |
| `treasury` | Treasury.tsx | حسابات الخزينة + الحركات + التحويلات + الأصول |
| `returns` | Returns.tsx | مرتجعات المبيعات |
| `exchange` | Exchange.tsx | استبدال صنف بآخر |
| `reports` | Reports.tsx | تقارير مالية/Mبيعات/مخزون |
| `hr` | HR.tsx | الموظفون + الحضور + الرواتب |
| `settings` | Settings.tsx | الشركة + مصمم الفاتورة + المستخدمون + الأدوار + النسخ الاحتياطي + الذكاء الاصطناعي |

> **الموردون (Suppliers)** يُدارون داخل تبويب المشتريات (ليس وحدة منفصلة في التنقل).

---

## 7) نظام التصميم Azimuth (Design Tokens)

كل الألوان معرّفة كمتغيرات CSS في `src/index.css` (وضع `:root` الفاتح و`.dark`)، ويقرأها Tailwind عبر `hsl(var(--x))` في `tailwind.config.js`.

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `--primary` | `#00355f` (كحلي) | الأزرار الأساسية + التنقل + التركيز |
| `--secondary` | `#006d37` (أخضر) | أزرار "النجاح"/الإجراءات الإيجابية |
| `--sidebar-background` | `#003462` | خلفية الشريط الجانبي |
| `--sidebar-accent` | `#004b89` | خلفية عنصر التنقل النشط |
| `success` (لون صريح) | `#006d37` | زر "فاتورة جديدة" والحفظ الأخضر |
| `tertiary` / `surface-container*` | ألوان Azimuth | تفاصيل الواجهة الدقيقة |

**الخطوط:**
- `IBM Plex Sans Arabic` للنصوص (محمّلة في `index.html` وفي `body`).
- `Inter` للأرقام عبر الكلاس `.font-numeric` أو `font-numeric` في Tailwind.

**نصف الأقطار:** `--radius: 0.5rem` (8px) للأزرار/المدخلات، و`xl = radius+4px` (12px) للبطاقات.

---

## 8) الفواتير (Invoice Designer)

- `src/components/invoice/invoiceModel.ts`: نموذج الفاتورة + التسميات القابلة للتخصيص (`LabelKey`).
- `src/components/invoice/InvoiceDocument.tsx`: عرض الفاتورة (معاينة + حساب السابق/المطلوب/المتبقي).
- `src/components/invoice/invoicePrint.ts`: نسخة الطباعة (A4).
- `src/pages/Settings.tsx` (تبويب "تصميم الفاتورة"): رفع الشعار، تعديل الترويسة/التذييل، تسميات الحقول، معاينة حية.
- المنطق المحاسبي: `إجمالي المطلوب = الحساب السابق + إجمالي الفاتورة`، `المتبقي = المطلوب − المدفوع`.

---

## 9) الذكاء الاصطناعي (AI)

- `src/services/ai/gemini.ts`: `GeminiProvider` يستدعي Gemini عبر `fetch`، مع نماذج احتياطية تلقائية ومفتاح من `localStorage` أو `VITE_GEMINI_API_KEY`.
- `src/services/ai/index.ts`: `AIAssistantManager` (singleton `aiManager`) — `sendMessage` ينفّذ خططًا (PLAN) من إجراءات مثل `CREATE_SALE`, `CREATE_PURCHASE`, `ADD_ITEM`... و`suggestRolePermissions` لاقتراح الصلاحيات.
- `src/components/ai/AIChat.tsx`: زر عائم يفتح نافذة المحادثة.

---

## 10) كيف تضيف وحدة/ميزة جديدة (Step-by-Step)

لإضافة وحدة مثل "المصروفات" تمت بالخطوات التالية (طبّقها لأي وحدة جديدة):

1. **النوع:** أضف المفتاح إلى `ModuleId` في `src/types/index.ts`.
2. **الصلاحيات:** أضفه إلى `PermissionModule` و`PERMISSION_MODULES` في `src/types/permissions.ts`، ووزّعه على الأدوار في `src/services/roles.ts`.
3. **التنقل:** أضف الأيقونة في `moduleIcons` والترتيب في `moduleOrder` داخل `Layout.tsx`.
4. **التوجيه:** lazy import + `case` في `App.tsx` (`ModuleRouter`).
5. **النصوص:** أضف `nav.<module>` ومساحة `<module>: {...}` في `src/i18n.ts` (en + ar).
6. **الصفحة:** أنشئ `src/pages/<Module>.tsx` (انسخ نمط `Customers.tsx` كمرجع: state + dispatch + modal + gating بـ `can()`).
7. **المنطق:** إن لزم تخزين، أضف الحقل إلى `AppState` + `getDefaultState` + `migrate`، وأضف إجراءً في `AppContext.tsx` (reducer).
8. **التصميم:** استخدم ألوان Azimuth (`bg-primary`, `bg-success`, `bg-tertiary-container`...) والكلاس `.font-numeric` للأرقام.
9. **البناء:** شغّل `npm run build` للتأكد من خلوّه من أخطاء TypeScript.

---

## 11) إعدادات التشغيل (Commands)

من داخل مجلد `app/`:
- `npm install` — تثبيت الحزم.
- `npm run dev` — خادم التطوير.
- `npm run build` — بناء للإنتاج (يتحقق من الأنواع).
- `npm run preview` — معاينة البناء.

---

## 12) ملاحظات للمطوّر

- **لا تغيّر ألوان المتجر مباشرة في المكوّنات**؛ عدّل متغيرات `index.css` أو ألوان `tailwind.config.js` لتوحيد الهوية.
- **كل الحفظ محلي** (IndexedDB)؛ لا يوجد خادم خلفي. لعمل نسخة احتياطية استخدم تبويب "النسخ الاحتياطي" في الإعدادات.
- **رصيد العميل** يُحسب مركزيًا في `recalcCustomerBalances` — لا تعدّله يدويًا في الصفحات.
- الملفات كلها غير مُلتزمة (uncommitted) على الفرع `main`؛ التزمها عبر git عند الرغبة.
