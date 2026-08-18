const fs = require('fs');

const enTranslations = `
      maintenance: {
        fillData: 'Please fill main data for maintenance device',
        technician: 'Technician',
        receiptAdded: 'Maintenance receipt {{number}} added successfully',
        statusUpdated: 'Maintenance status updated successfully',
        status: {
          received: 'Received',
          inspecting: 'Under Inspection',
          ready: 'Ready for Delivery',
          delivered: 'Delivered',
          cancelled: 'Cancelled'
        },
        title: 'Maintenance Workshop Management',
        subtitle: 'Track received devices and technicians tasks',
        addReceipt: 'Issue New Receipt',
        receipts: 'Maintenance Receipts',
        techniciansLedger: 'Technicians Ledger & Commissions',
        searchPlaceholder: 'Search by receipt number, customer, device, or technician...',
        receiptNumber: 'Receipt Number',
        deviceFault: 'Device & Fault',
        expectedCost: 'Expected Cost',
        deposit: 'Deposit',
        updateStatus: 'Update Status',
        noReceiptsFound: 'No maintenance receipts match your search',
        device: 'Device',
        fault: 'Fault',
        depositLabel: 'Deposit',
        totalCommissions: 'Total Commissions',
        technicianData: 'Technician Data',
        commissionsDue: 'Commissions Due',
        addNewReceipt: 'Issue New Maintenance Receipt',
        customerName: 'Customer Name',
        customerPhone: 'Customer Phone',
        deviceName: 'Device Name & Model',
        deviceExample: 'Example: Dell G15 Laptop',
        reportedFault: 'Reported Fault',
        faultDescription: 'Fault description...',
        estimatedCost: 'Estimated Cost',
        paidDeposit: 'Paid Deposit',
        assignedTechnician: 'Assigned Technician',
        technicianCommission: 'Technician Commission',
        costAndPaid: 'Cost & Paid',
        changeStatus: 'Change Status',
        totalDevices: 'Total Devices',
        completedDevices: 'Completed Devices',
        totalDue: 'Total Due',
        technicianNamePlaceholder: 'Technician Name'
      },
      database: {
        confirmWord: 'CONFIRM',
        typeConfirmToStart: 'Please type "CONFIRM" to start the process',
        transactionsCleared: 'Financial transactions cleared successfully. Items, customers, and suppliers retained.',
        factoryResetSuccess: 'Factory reset completed. All data erased successfully.',
        maintenanceTools: 'Database Maintenance Tools',
        maintenanceSubtitle: 'Clear data or start a new accounting cycle',
        clearTransactionsOnly: 'Clear financial transactions only (New Fiscal Year)',
        clearTransactionsDesc: 'Deletes all sales, purchases, returns, and transactions while keeping items, customers, and suppliers.',
        factoryReset: 'Full Factory Reset (Delete All)',
        factoryResetDesc: 'Deletes all data entirely and starts with a completely clean database.',
        warningIrreversible: 'CRITICAL WARNING: This action is irreversible unless you restore a backup!',
        typeWord: 'Type',
        toContinue: 'to continue',
        typeConfirmHere: 'Type "CONFIRM" here',
        confirmExecution: 'Confirm Execution'
      },
      cashAudit: {
        matchedSuccess: 'Treasury matched successfully (No difference between book and actual balance)',
        deficitRecorded: 'Deficit of {{amount}} recorded and automatic settlement entry created',
        surplusRecorded: 'Surplus of {{amount}} recorded and automatic deposit entry created',
        title: 'Treasury Audit & Matching',
        subtitle: 'Compare actual cash with book balance and auto-settle differences',
        selectTreasury: 'Select Treasury / Safe',
        bookBalance: 'Book Balance',
        currentBookBalance: 'Current Book Balance',
        actualCashBalance: 'Actual Cash in Safe (After counting)',
        balanceMatched: 'Balance perfectly matched',
        deficitAmount: 'Deficit amount',
        surplusAmount: 'Unjustified surplus amount',
        auditNotes: 'Audit Notes',
        notesPlaceholder: 'Reason for deficit or surplus if any...',
        confirmAudit: 'Match Data and Confirm Audit'
      },
      einvoice: {
        xmlCopiedSuccess: 'XML file copied to clipboard successfully',
        previewTitle: 'E-Invoice Preview & Certified Receipt',
        invoiceNumber: 'Invoice Number',
        uuidLabel: 'Unique UUID',
        hashLabel: 'SHA-256 Hash',
        gs1Label: 'Unified GS1 / EGS Code',
        xmlLabel: 'ZATCA / ETA Compatible XML File',
        copied: 'Copied',
        copyXml: 'Copy XML',
        closePreview: 'Close Preview'
      },`;

const arTranslations = `
      maintenance: {
        fillData: 'يرجى ملء البيانات الرئيسية لجهاز الصيانة',
        technician: 'فني الصيانة',
        receiptAdded: 'تمت إضافة فاتورة استلام الصيانة {{number}} بنجاح',
        statusUpdated: 'تم تحديث حالة الصيانة بنجاح',
        status: {
          received: 'مستلم',
          inspecting: 'قيد الفحص',
          ready: 'جاهز للتسليم',
          delivered: 'تم التسليم',
          cancelled: 'ملغى'
        },
        title: 'إدارة ورشة الصيانة',
        subtitle: 'متابعة الأجهزة المستلمة للصيانة وتوزيع المهام على الفنيين',
        addReceipt: 'إضافة فاتورة صيانة جديدة',
        receipts: 'فواتير الصيانة',
        techniciansLedger: 'سجل الفنيين والعمولات',
        searchPlaceholder: 'البحث برقم الإيصال، اسم العميل، أو الجهاز...',
        receiptNumber: 'رقم الإيصال',
        deviceFault: 'الجهاز العطل',
        expectedCost: 'التكلفة المتوقعة',
        deposit: 'العربون المدفوع',
        updateStatus: 'تحديث الحالة',
        noReceiptsFound: 'لا توجد فواتير صيانة تطابق بحثك',
        device: 'الجهاز',
        fault: 'العطل',
        depositLabel: 'العربون',
        totalCommissions: 'إجمالي عمولات الفني',
        technicianData: 'بيانات الفني',
        commissionsDue: 'العمولات المستحقة',
        addNewReceipt: 'إضافة فاتورة استلام صيانة جديدة',
        customerName: 'اسم العميل',
        customerPhone: 'رقم الهاتف',
        deviceName: 'اسم الجهاز وموديله',
        deviceExample: 'مثال: لابتوب ديل G15',
        reportedFault: 'العطل المبلغ عنه',
        faultDescription: 'وصف العطل...',
        estimatedCost: 'التكلفة التقديرية للصيانة',
        paidDeposit: 'العربون المدفوع مقدماً',
        assignedTechnician: 'الفني المسؤول',
        technicianCommission: 'عمولة الفني',
        costAndPaid: 'التكلفة والمدفوع',
        changeStatus: 'تغيير الحالة',
        totalDevices: 'إجمالي الأجهزة',
        completedDevices: 'الأجهزة المكتملة',
        totalDue: 'مجموع المستحقات',
        technicianNamePlaceholder: 'اسم الصنايعي'
      },
      database: {
        confirmWord: 'تأكيد',
        typeConfirmToStart: 'يرجى كتابة كلمة "تأكيد" للبدء بالعملية',
        transactionsCleared: 'تم مسح الحركات المالية بنجاح مع الحفاظ على الأصناف والعملاء والموردين لبداية سنة مالية جديدة',
        factoryResetSuccess: 'تم إعادة ضبط المصنع ومسح جميع البيانات بنجاح',
        maintenanceTools: 'أدوات تنظيف وصيانة قاعدة البيانات',
        maintenanceSubtitle: 'إلغاء البيانات أو بدء دورة محاسبية وسنة مالية جديدة',
        clearTransactionsOnly: 'مسح الحركات والعمليات المالية فقط (سنة مالية جديدة)',
        clearTransactionsDesc: 'يحذف جميع فواتير المبيعات، المشتريات، المرتجعات، والعمليات مع الحفاظ على الأصناف والعملاء والموردين.',
        factoryReset: 'تصفير وإعادة ضبط المصنع الشامل (حذف الكل)',
        factoryResetDesc: 'يقوم بحذف جميع البيانات من قاعدة البيانات بالكامل والبدء بنسخة نظيفة تمامًا.',
        warningIrreversible: 'تحذير هام: هذه العملية نهائية ولا يمكن التراجع عنها إلا باستعادة نسخة احتياطية سابقة!',
        typeWord: 'اكتب كلمة',
        toContinue: 'للمتابعة',
        typeConfirmHere: 'اكتب "تأكيد" هنا',
        confirmExecution: 'تأكيد التنفيذ'
      },
      cashAudit: {
        matchedSuccess: 'تم مطابقة الخزينة بنجاح (لا يوجد فرق بين الرصيد الدفتري والفعلي)',
        deficitRecorded: 'تم تسجيل عجز بقيمة {{amount}} ج.م وإنشاء قيد تسوية تلقائي',
        surplusRecorded: 'تم تسجيل زيادة بقيمة {{amount}} ج.م وإنشاء قيد إيداع تلقائي',
        title: 'شاشة جرد ومطابقة الخزينة',
        subtitle: 'مقارنة النقدية الفعلية بالرصيد الدفتري وتسوية الفروقات آليًا',
        selectTreasury: 'اختر الخزينة / الصندوق',
        bookBalance: 'الرصيد الدفتري',
        currentBookBalance: 'الرصيد الدفتري الحالي',
        actualCashBalance: 'النقدية الفعلية بالصندوق (بعد العد)',
        balanceMatched: 'الرصيد متطابق تمامًا',
        deficitAmount: 'عجز في الخزينة بمقدار',
        surplusAmount: 'زيادة غير مبررة في الخزينة بمقدار',
        auditNotes: 'ملاحظات الجرد',
        notesPlaceholder: 'سبب العجز أو الزيادة إن وجد...',
        confirmAudit: 'تطابق البيانات وتأكيد الجرد'
      },
      einvoice: {
        xmlCopiedSuccess: 'تم نسخ ملف XML إلى الحافظة بنجاح',
        previewTitle: 'معاينة الفوترة والإيصال الإلكتروني المعتمد',
        invoiceNumber: 'الفاتورة رقم',
        uuidLabel: 'معرّف UUID الفريد',
        hashLabel: 'تشفير HASH SHA-256',
        gs1Label: 'كود التكويد الموحد GS1 / EGS',
        xmlLabel: 'ملف XML المتوافق مع معيار ZATCA / ETA',
        copied: 'تم النسخ',
        copyXml: 'نسخ XML',
        closePreview: 'إغلاق المعاينة'
      },`;

let content = fs.readFileSync('src/i18n.ts', 'utf8');

// The file has translations object:
// const resources = {
//   en: {
//     translation: {
//       // EN strings here
//     }
//   },
//   ar: {
//     translation: {
//       // AR strings here
//     }
//   }
// };

// Find where to insert EN translations. After "notifications: {" block.
// Wait, safer to replace "notifications: {" with our new block + "notifications: {"
content = content.replace(/notifications: \{/, enTranslations + '\n      notifications: {');

// Find where to insert AR translations. The second "notifications: {" block.
// Wait, replace will only replace the first occurrence.
// We can use a trick: split and join.
let parts = content.split('notifications: {');
if (parts.length === 3) {
    // parts[0] is before first notifications (EN)
    // parts[1] is between first and second (EN body... AR before notifications)
    // parts[2] is after second notifications (AR body...)
    content = parts[0] + enTranslations + '\n      notifications: {' + parts[1] + arTranslations + '\n      notifications: {' + parts[2];
}

fs.writeFileSync('src/i18n.ts', content);
