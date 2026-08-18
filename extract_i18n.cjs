const fs = require('fs');

function processMaintenance() {
    let content = fs.readFileSync('src/components/maintenance/MaintenanceView.tsx', 'utf8');
    
    if (!content.includes('useTranslation')) {
        content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { useTranslation } from 'react-i18next';");
    }
    
    if (!content.includes('const { t } = useTranslation()')) {
        content = content.replace('const { state, dispatch, showToast } = useApp();', "const { state, dispatch, showToast } = useApp();\n  const { t } = useTranslation();");
    }

    const replacements = {
        "'يرجى ملء البيانات الرئيسية لجهاز الصيانة'": "t('maintenance.fillData')",
        "'فني الصيانة'": "t('maintenance.technician')",
        "`تمت إضافة فاتورة استلام الصيانة ${receipt.receiptNumber} بنجاح`": "t('maintenance.receiptAdded', { number: receipt.receiptNumber })",
        "'تم تحديث حالة الصيانة بنجاح'": "t('maintenance.statusUpdated')",
        "مستلم": "{t('maintenance.status.received')}",
        "قيد الفحص": "{t('maintenance.status.inspecting')}",
        "جاهز للتسليم": "{t('maintenance.status.ready')}",
        "تم التسليم": "{t('maintenance.status.delivered')}",
        "ملغى": "{t('maintenance.status.cancelled')}",
        "إدارة ورشة الصيانة": "{t('maintenance.title')}",
        "متابعة الأجهزة المستلمة للصيانة وتوزيع المهام على الفنيين": "{t('maintenance.subtitle')}",
        "إضافة فاتورة صيانة جديدة": "{t('maintenance.addReceipt')}",
        "فواتير الصيانة": "{t('maintenance.receipts')}",
        "سجل الفنيين والعمولات": "{t('maintenance.techniciansLedger')}",
        "البحث برقم الإيصال، اسم العميل، أو الجهاز...": "{t('maintenance.searchPlaceholder')}",
        "رقم الإيصال": "{t('maintenance.receiptNumber')}",
        "العميل": "{t('common.customer')}",
        "الجهاز العطل": "{t('maintenance.deviceFault')}",
        "التكلفة المتوقعة": "{t('maintenance.expectedCost')}",
        "العربون المدفوع": "{t('maintenance.deposit')}",
        "الفني": "{t('maintenance.technician')}",
        "تحديث الحالة": "{t('maintenance.updateStatus')}",
        "لا توجد فواتير صيانة تطابق بحثك": "{t('maintenance.noReceiptsFound')}",
        "الجهاز:": "{t('maintenance.device')}:",
        "العطل:": "{t('maintenance.fault')}:",
        "العربون:": "{t('maintenance.depositLabel')}:",
        "إجمالي عمولات الفني:": "{t('maintenance.totalCommissions')}:",
        "بيانات الفني:": "{t('maintenance.technicianData')}:",
        "العمولات المستحقة:": "{t('maintenance.commissionsDue')}:",
        "إضافة فاتورة استلام صيانة جديدة": "{t('maintenance.addNewReceipt')}",
        "اسم العميل *": "{t('maintenance.customerName')} *",
        "رقم الهاتف": "{t('maintenance.customerPhone')}",
        "اسم الجهاز وموديله *": "{t('maintenance.deviceName')} *",
        "مثال: لابتوب ديل G15": "{t('maintenance.deviceExample')}",
        "العطل المبلغ عنه": "{t('maintenance.reportedFault')}",
        "وصف العطل...": "{t('maintenance.faultDescription')}",
        "التكلفة التقديرية للصيانة *": "{t('maintenance.estimatedCost')} *",
        "العربون المدفوع مقدماً": "{t('maintenance.paidDeposit')}",
        "الفني المسؤول": "{t('maintenance.assignedTechnician')}",
        "عمولة الفني": "{t('maintenance.technicianCommission')}",
        "إلغاء": "{t('common.cancel')}",
        "حفظ الفاتورة": "{t('common.save')}"
    };

    for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value);
    }

    fs.writeFileSync('src/components/maintenance/MaintenanceView.tsx', content);
}

processMaintenance();
