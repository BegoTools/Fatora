// ============================================================
// Easy Store ERP - محرك تهيئة وتخصيص القطاعات (Sector Configuration Engine)
// ------------------------------------------------------------
// - يقدم 6 بروفايلات جاهزة (ملابس، سوبرماركت، إلكترونيات، ورش صيانة، توزيع، عطور).
// - يسمح بتحميل وتعيين بروفايل قطاع جديد عبر ملف JSON إعدادات دون تعديل الكود.
// - يتحكم في إظهار وإخفاء الحقول والموديلات في الـ UI دون تغيير Schema البيانات.
// ============================================================

import type { SectorProfile, SectorTypeId } from '@/types';

export const BUILTIN_SECTORS: Record<SectorTypeId, SectorProfile> = {
  general: {
    id: 'general',
    name: 'General Retail & Wholesale',
    nameAr: 'عام / تجارة ومتنوعات',
    descriptionAr: 'قطاع تجاري عام يناسب المتاجر المتنوعة والأنشطة العامة',
    showColorSize: false,
    showWeightScaleBarcode: false,
    showSerialTracking: false,
    showInstallments: true,
    showExpiryDate: false,
    showMaintenanceModule: false,
    defaultModule: 'dashboard',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
  clothing: {
    id: 'clothing',
    name: 'Clothing, Shoes & Textiles',
    nameAr: 'ملابس وأحذية ومنسوجات',
    descriptionAr: 'مخصص لمتاجر الملابس والأحذية مع تفعيل المقاسات والألوان',
    showColorSize: true,
    showWeightScaleBarcode: false,
    showSerialTracking: false,
    showInstallments: true,
    showExpiryDate: false,
    showMaintenanceModule: false,
    defaultModule: 'inventory',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
  supermarket: {
    id: 'supermarket',
    name: 'Supermarket & Grocery',
    nameAr: 'سوبرماركت ومواد غذائية',
    descriptionAr: 'تفعيل باركود الميزان الإلكتروني وتنبيهات الاستحقاق والتوقف السريع',
    showColorSize: false,
    showWeightScaleBarcode: true,
    showSerialTracking: false,
    showInstallments: false,
    showExpiryDate: true,
    showMaintenanceModule: false,
    defaultModule: 'sales',
    allowNegativeStock: true,
    autoItemCoding: true,
  },
  electronics: {
    id: 'electronics',
    name: 'Electronics & Home Appliances',
    nameAr: 'أجهزة إلكترونية ومقاولات',
    descriptionAr: 'تتبع سيريالات الأجهزة والأقساط الشهرية وضمان المنتجات',
    showColorSize: false,
    showWeightScaleBarcode: false,
    showSerialTracking: true,
    showInstallments: true,
    showExpiryDate: false,
    showMaintenanceModule: true,
    defaultModule: 'sales',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
  maintenance: {
    id: 'maintenance',
    name: 'Workshops & Maintenance Centers',
    nameAr: 'ورش وصيانة وخدمات',
    descriptionAr: 'تركيز كامل على استلام وعثرات وأجور فنيي الصيانة',
    showColorSize: false,
    showWeightScaleBarcode: false,
    showSerialTracking: true,
    showInstallments: true,
    showExpiryDate: false,
    showMaintenanceModule: true,
    defaultModule: 'reports',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
  distribution: {
    id: 'distribution',
    name: 'Distribution & Trade',
    nameAr: 'تجارة وتوزيع ومصانع',
    descriptionAr: 'إدارة المناديب، أسعار الدولار، والمخازن المتعددة',
    showColorSize: false,
    showWeightScaleBarcode: false,
    showSerialTracking: false,
    showInstallments: true,
    showExpiryDate: false,
    showMaintenanceModule: false,
    defaultModule: 'purchases',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
  cosmetics: {
    id: 'cosmetics',
    name: 'Cosmetics & Perfumes',
    nameAr: 'عطور ومستحضرات تجميل',
    descriptionAr: 'إدارة التواريخ والباكجات والتجميع والعروض الحصرية',
    showColorSize: true,
    showWeightScaleBarcode: false,
    showSerialTracking: false,
    showInstallments: false,
    showExpiryDate: true,
    showMaintenanceModule: false,
    defaultModule: 'inventory',
    allowNegativeStock: false,
    autoItemCoding: true,
  },
};

/**
 * الحصول على بروفايل القطاع (إما المدمج أو التكيفي)
 */
export function getSectorProfile(sectorId: SectorTypeId = 'general'): SectorProfile {
  return BUILTIN_SECTORS[sectorId] || BUILTIN_SECTORS.general;
}

/**
 * استيراد بروفايل قطاع جديد من سلسلة JSON
 */
export function parseCustomSectorProfile(jsonString: string): SectorProfile | null {
  try {
    const parsed = JSON.parse(jsonString) as SectorProfile;
    if (!parsed.id || !parsed.nameAr) return null;
    return parsed;
  } catch {
    return null;
  }
}
