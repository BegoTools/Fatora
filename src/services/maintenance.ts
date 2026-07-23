// ============================================================
// Easy Store ERP - موديول الورش والصيانة (Workshops & Maintenance Module - Section 8)
// ------------------------------------------------------------
// - إيقاف وفواتير استلام الصيانة.
// - تتبع حالات الجهاز (مستلم / قيد الفحص / جاهز للتسليم / تم التسليم).
// - كشف حساب وأجر الفني/الصنايعي المسؤول.
// - تخصيص تذييل الفاتورة وشروط الضمان.
// ============================================================

import type { AppState, MaintenanceReceipt, MaintenanceStatus } from '@/types';
import { generateId } from '@/db';

export interface CreateMaintenanceInput {
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
  expectedDeliveryDate: string;
  notes?: string;
  footerTerms?: string;
  createdBy?: string;
}

export function createMaintenanceReceipt(
  state: AppState,
  input: CreateMaintenanceInput
): { updatedState: AppState; receipt: MaintenanceReceipt } {
  const existingReceipts = state.maintenanceReceipts || [];
  const receiptNumber = `MNT-${(existingReceipts.length + 1).toString().padStart(5, '0')}`;

  const receipt: MaintenanceReceipt = {
    id: generateId('mnt'),
    receiptNumber,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deviceName: input.deviceName,
    deviceModel: input.deviceModel,
    serialNumber: input.serialNumber,
    reportedFault: input.reportedFault,
    expectedCost: input.expectedCost,
    depositPaid: input.depositPaid,
    technicianName: input.technicianName,
    technicianCommission: input.technicianCommission,
    status: 'received',
    receivedDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: input.expectedDeliveryDate,
    notes: input.notes,
    footerTerms: input.footerTerms || 'الشركة غير مسؤولة عن الأجهزة التي يمر عليها أكثر من 30 يوماً من تاريخ التجهيز.',
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy || 'Staff',
  };

  return {
    updatedState: {
      ...state,
      maintenanceReceipts: [receipt, ...existingReceipts],
    },
    receipt,
  };
}

export function updateMaintenanceStatus(
  state: AppState,
  receiptId: string,
  newStatus: MaintenanceStatus
): AppState {
  const existingReceipts = state.maintenanceReceipts || [];
  const updated = existingReceipts.map(r => {
    if (r.id !== receiptId) return r;
    return {
      ...r,
      status: newStatus,
      deliveredDate: newStatus === 'delivered' ? new Date().toISOString().split('T')[0] : r.deliveredDate,
    };
  });

  return {
    ...state,
    maintenanceReceipts: updated,
  };
}

export interface TechnicianSummary {
  technicianName: string;
  totalJobs: number;
  completedJobs: number;
  totalCommissions: number;
}

export function getTechnicianLedger(state: AppState): TechnicianSummary[] {
  const receipts = state.maintenanceReceipts || [];
  const map = new Map<string, TechnicianSummary>();

  for (const r of receipts) {
    const tech = r.technicianName || 'غير محدد';
    const entry = map.get(tech) || {
      technicianName: tech,
      totalJobs: 0,
      completedJobs: 0,
      totalCommissions: 0,
    };

    entry.totalJobs += 1;
    if (r.status === 'delivered' || r.status === 'ready') {
      entry.completedJobs += 1;
      entry.totalCommissions += r.technicianCommission || 0;
    }
    map.set(tech, entry);
  }

  return Array.from(map.values());
}
