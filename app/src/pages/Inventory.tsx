import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle, X, ChevronRight, ChevronLeft,
  Barcode, Download, Upload, Layers, Tag, Ruler, Boxes, Printer,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId } from '@/db';
import type { Item, Category, ItemSubUnit } from '@/types';
import { PageAIInput } from '@/components/ai/PageAIInput';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';

const NEW_CATEGORY_VALUE = '__new__';
const CATEGORY_COLORS = ['#00355f', '#304054', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'];

type FilterStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type StockAction = 'receipt' | 'issue' | 'damage' | 'adjust';

const emptyForm = (defaultCat: string): Partial<Item> => ({
  name: '', nameAr: '', barcode: '', barcodes: [], categoryId: defaultCat,
  unit: 'piece', purchasePrice: 0, salePrice: 0, wholesalePrice: 0,
  stockQuantity: 0, minStockLevel: 0, description: '', isActive: true,
  subUnits: [], size: '', color: '', manufacturer: '', profitMargin: 0, supplierId: '',
});

export function Inventory() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { can } = useAuth();
  const { items, categories, suppliers } = state.data;
  const currency = state.data.company.currencySymbol || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState<Partial<Item>>(emptyForm(categories[0]?.id || NEW_CATEGORY_VALUE));
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameAr, setNewCategoryNameAr] = useState('');

  // stock operations
  const [stockModal, setStockModal] = useState<{ action: StockAction; item: Item | null }>({ action: 'receipt', item: null });
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');

  // bulk variants
  const [variantsModal, setVariantsModal] = useState<Item | null>(null);
  const [variantSizes, setVariantSizes] = useState('');
  const [variantColors, setVariantColors] = useState('');

  // bulk price
  const [priceModal, setPriceModal] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [priceMode, setPriceMode] = useState<'margin' | 'increase'>('margin');
  const [priceCategory, setPriceCategory] = useState<string>('all');

  // excel import
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Partial<Item>[]>([]);

  // barcode printing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [barcodeModal, setBarcodeModal] = useState(false);

  const rootCategories = categories.filter(c => !c.parentId);

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return isRTL ? 'بدون فئة' : 'Uncategorized';
    return isRTL ? cat.nameAr : cat.name;
  };

  const unitOptions = [
    { value: 'piece', label: isRTL ? 'قطعة' : 'Piece' },
    { value: 'box', label: isRTL ? 'صندوق' : 'Box' },
    { value: 'kg', label: isRTL ? 'كيلو جرام' : 'Kilogram' },
    { value: 'liter', label: isRTL ? 'لتر' : 'Liter' },
    { value: 'meter', label: isRTL ? 'متر' : 'Meter' },
    { value: 'carton', label: isRTL ? 'كرتونة' : 'Carton' },
  ];

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.nameAr.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        (i.barcodes || []).some(b => b.toLowerCase().includes(q)),
      );
    }
    if (selectedCategory !== 'all') {
      const catIds = [selectedCategory, ...categories.filter(c => c.parentId === selectedCategory).map(c => c.id)];
      result = result.filter(i => catIds.includes(i.categoryId));
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => {
        if (filterStatus === 'in_stock') return i.stockQuantity > i.minStockLevel;
        if (filterStatus === 'low_stock') return i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel;
        if (filterStatus === 'out_of_stock') return i.stockQuantity === 0;
        return true;
      });
    }
    return result;
  }, [items, searchQuery, selectedCategory, filterStatus, categories]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel).length;
  const outOfStockCount = items.filter(i => i.stockQuantity === 0).length;
  const inventoryValue = items.reduce((sum, i) => sum + (i.purchasePrice * i.stockQuantity), 0);

  const formatMoney = (n: number) =>
    `${currency} ${n.toLocaleString(isRTL ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── Item form ───────────────────────────────────────────────
  const handleAdd = () => {
    setEditingItem(null);
    setNewCategoryName('');
    setNewCategoryNameAr('');
    setFormData(emptyForm(categories[0]?.id || NEW_CATEGORY_VALUE));
    setShowAddModal(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setNewCategoryName('');
    setNewCategoryNameAr('');
    setFormData({ ...emptyForm(''), ...item, barcodes: item.barcodes || [], subUnits: item.subUnits || [] });
    setShowAddModal(true);
  };

  const handleDelete = (itemId: string) => {
    if (window.confirm(t('notifications.confirmDelete'))) {
      dispatch({ type: 'DELETE_ITEM', payload: itemId });
    }
  };

  const resolveCategoryId = (): string => {
    if (formData.categoryId !== NEW_CATEGORY_VALUE) return formData.categoryId || '';
    const en = newCategoryName.trim();
    const ar = newCategoryNameAr.trim();
    if (!en && !ar) return '';
    const newCategory: Category = {
      id: generateId('cat'),
      name: en || ar,
      nameAr: ar || en,
      parentId: null,
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CATEGORY', payload: newCategory });
    return newCategory.id;
  };

  const applyMargin = () => {
    const m = Number(formData.profitMargin) || 0;
    const pp = Number(formData.purchasePrice) || 0;
    setFormData({ ...formData, salePrice: Math.round(pp * (1 + m / 100) * 100) / 100 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode) return;
    if (formData.categoryId === NEW_CATEGORY_VALUE && !newCategoryName.trim() && !newCategoryNameAr.trim()) {
      alert(isRTL ? 'يرجى كتابة اسم الفئة الجديدة' : 'Please enter the new category name');
      return;
    }
    const categoryId = resolveCategoryId();
    const payload: Item = {
      ...emptyForm(categoryId),
      ...formData,
      categoryId,
      barcodes: formData.barcodes || [],
      subUnits: formData.subUnits || [],
    } as Item;
    if (editingItem) {
      dispatch({ type: 'UPDATE_ITEM', payload: { ...editingItem, ...payload } });
    } else {
      dispatch({ type: 'ADD_ITEM', payload: { ...payload, id: generateId('item'), createdAt: new Date().toISOString() } });
    }
    setShowAddModal(false);
  };

  const handleGenerateBarcode = () => {
    const random = Math.floor(Math.random() * 9000000000000) + 1000000000000;
    setFormData({ ...formData, barcode: random.toString() });
  };

  const addSubUnit = () => setFormData({ ...formData, subUnits: [...(formData.subUnits || []), { name: '', factor: 1 }] });
  const updateSubUnit = (idx: number, patch: Partial<ItemSubUnit>) =>
    setFormData({ ...formData, subUnits: (formData.subUnits || []).map((s, i) => i === idx ? { ...s, ...patch } : s) });
  const removeSubUnit = (idx: number) => setFormData({ ...formData, subUnits: (formData.subUnits || []).filter((_, i) => i !== idx) });

  const addBarcode = () => setFormData({ ...formData, barcodes: [...(formData.barcodes || []), ''] });
  const updateBarcode = (idx: number, val: string) =>
    setFormData({ ...formData, barcodes: (formData.barcodes || []).map((b, i) => i === idx ? val : b) });
  const removeBarcode = (idx: number) => setFormData({ ...formData, barcodes: (formData.barcodes || []).filter((_, i) => i !== idx) });

  // ─── Stock operations ───────────────────────────────────────
  const openStock = (action: StockAction, item: Item) => {
    setStockModal({ action, item });
    setStockQty('');
    setStockNote('');
  };
  const submitStock = () => {
    const qty = Number(stockQty);
    if (!stockModal.item || !qty || qty <= 0) return;
    const { action, item } = stockModal;
    if (action === 'receipt') dispatch({ type: 'STOCK_RECEIPT', payload: { itemId: item!.id, quantity: qty, note: stockNote } });
    else if (action === 'issue') dispatch({ type: 'STOCK_ISSUE', payload: { itemId: item!.id, quantity: qty, note: stockNote } });
    else if (action === 'damage') dispatch({ type: 'STOCK_DAMAGE', payload: { itemId: item!.id, quantity: qty, note: stockNote } });
    else if (action === 'adjust') dispatch({ type: 'STOCK_ADJUST', payload: { itemId: item!.id, newQuantity: qty, note: stockNote } });
    setStockModal({ action: 'receipt', item: null });
  };

  // ─── Bulk variants ──────────────────────────────────────────
  const generateVariants = () => {
    if (!variantsModal) return;
    const base = variantsModal;
    const sizes = variantSizes.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const colors = variantColors.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const combos: { size?: string; color?: string }[] = [];
    if (sizes.length && colors.length) sizes.forEach(s => colors.forEach(c => combos.push({ size: s, color: c })));
    else if (sizes.length) sizes.forEach(s => combos.push({ size: s }));
    else if (colors.length) colors.forEach(c => combos.push({ color: c }));
    combos.forEach(combo => {
      const name = [base.name, combo.size, combo.color].filter(Boolean).join(' ');
      const nameAr = [base.nameAr, combo.size, combo.color].filter(Boolean).join(' ');
      const newItem: Item = {
        ...emptyForm(base.categoryId),
        ...base,
        id: generateId('item'),
        name, nameAr,
        size: combo.size, color: combo.color,
        barcode: Math.floor(Math.random() * 9000000000000 + 1000000000000).toString(),
        barcodes: [], subUnits: base.subUnits || [],
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_ITEM', payload: newItem });
    });
    setVariantsModal(null);
    setVariantSizes('');
    setVariantColors('');
  };

  // ─── Bulk price ─────────────────────────────────────────────
  const applyBulkPrice = () => {
    const val = Number(priceValue) || 0;
    if (val <= 0) return;
    const targets = items.filter(i => priceCategory === 'all' || i.categoryId === priceCategory);
    targets.forEach(i => {
      if (priceMode === 'margin') {
        dispatch({ type: 'UPDATE_ITEM', payload: { ...i, profitMargin: val, salePrice: Math.round(i.purchasePrice * (1 + val / 100) * 100) / 100 } });
      } else {
        dispatch({ type: 'UPDATE_ITEM', payload: { ...i, salePrice: Math.round((i.salePrice + val) * 100) / 100 } });
      }
    });
    setPriceModal(false);
  };

  // ─── Excel ──────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = items.map(i => ({
      barcode: i.barcode,
      name: i.name, nameAr: i.nameAr,
      category: getCategoryName(i.categoryId),
      unit: i.unit,
      purchasePrice: i.purchasePrice,
      salePrice: i.salePrice,
      wholesalePrice: i.wholesalePrice,
      stockQuantity: i.stockQuantity,
      minStockLevel: i.minStockLevel,
      size: i.size || '', color: i.color || '',
      manufacturer: i.manufacturer || '',
      profitMargin: i.profitMargin || '',
      barcodes: (i.barcodes || []).join(';'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, 'items.xlsx');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result as ArrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      const parsed: Partial<Item>[] = rows.map(r => ({
        barcode: String(r.barcode || ''),
        name: String(r.name || ''),
        nameAr: String(r.nameAr || r.name || ''),
        categoryId: '',
        unit: String(r.unit || 'piece'),
        purchasePrice: Number(r.purchasePrice) || 0,
        salePrice: Number(r.salePrice) || 0,
        wholesalePrice: Number(r.wholesalePrice) || 0,
        stockQuantity: Number(r.stockQuantity) || 0,
        minStockLevel: Number(r.minStockLevel) || 0,
        size: r.size ? String(r.size) : '',
        color: r.color ? String(r.color) : '',
        manufacturer: r.manufacturer ? String(r.manufacturer) : '',
        profitMargin: r.profitMargin ? Number(r.profitMargin) : 0,
        barcodes: r.barcodes ? String(r.barcodes).split(';').map((s: string) => s.trim()).filter(Boolean) : [],
        subUnits: [],
      }));
      setImportRows(parsed.filter(r => r.name && r.barcode));
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = () => {
    importRows.forEach(r => {
      const cat = categories.find(c => getCategoryName(c.id) === String((r as Record<string, unknown>).category ?? ''));
      dispatch({ type: 'ADD_ITEM', payload: { ...emptyForm(cat?.id || categories[0]?.id || NEW_CATEGORY_VALUE), ...r, categoryId: cat?.id || categories[0]?.id || NEW_CATEGORY_VALUE, id: generateId('item'), createdAt: new Date().toISOString() } as Item });
    });
    setImportRows([]);
    setImportModal(false);
  };

  // ─── Barcode selection / printing ───────────────────────────
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setSelectedIds(next);
  };
  const allPageSelected = paginatedItems.every(i => selectedIds.has(i.id));
  const togglePage = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) paginatedItems.forEach(i => next.delete(i.id));
    else paginatedItems.forEach(i => next.add(i.id));
    setSelectedIds(next);
  };

  const selectedItems = items.filter(i => selectedIds.has(i.id));

  const StatCard = ({ label, value, icon, bg, color }: { label: string; value: string | number; icon: React.ReactNode; bg: string; color: string }) => (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold font-numeric ${color}`}>{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageAIInput contextType={isRTL ? 'المخزون' : 'Inventory'} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('common.total')} value={totalItems} icon={<Package size={20} className="text-primary" />} bg="bg-primary/10" color="text-foreground" />
        <StatCard label={t('inventory.filters.lowStock')} value={lowStockCount} icon={<AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />} bg="bg-amber-50 dark:bg-amber-950/50" color="text-amber-600 dark:text-amber-400" />
        <StatCard label={t('inventory.filters.outOfStock')} value={outOfStockCount} icon={<X size={20} className="text-red-600 dark:text-red-400" />} bg="bg-red-50 dark:bg-red-950/50" color="text-red-600 dark:text-red-400" />
        <StatCard label={t('common.inventoryValue')} value={`${(inventoryValue / 1000).toFixed(1)}k`} icon={<Package size={20} className="text-emerald-600 dark:text-emerald-400" />} bg="bg-emerald-50 dark:bg-emerald-950/50" color="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className={`bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
          />
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
          <option value="all">{t('inventory.filters.allCategories')}</option>
          {rootCategories.map(cat => (<option key={cat.id} value={cat.id}>{isRTL ? cat.nameAr : cat.name}</option>))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
          <option value="all">{t('common.all')}</option>
          <option value="in_stock">{t('inventory.filters.inStock')}</option>
          <option value="low_stock">{t('inventory.filters.lowStock')}</option>
          <option value="out_of_stock">{t('inventory.filters.outOfStock')}</option>
        </select>
        <div className={`flex gap-2 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"><Download size={14} /> <span className="hidden sm:inline">{t('common.export')}</span></button>
          <button onClick={() => setImportModal(true)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"><Upload size={14} /> <span className="hidden sm:inline">{t('common.import')}</span></button>
          <button onClick={() => setPriceModal(true)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"><Tag size={14} /> <span className="hidden sm:inline">{t('inventory.bulkPrice')}</span></button>
          <button onClick={() => setBarcodeModal(true)} disabled={selectedIds.size === 0} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"><Printer size={14} /> <span className="hidden sm:inline">{t('inventory.printBarcodes')}</span></button>
          {can('inventory', 'create') && (
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus size={16} /> {t('inventory.addItem')}</button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className={`px-3 py-3 ${isRTL ? 'text-right' : 'text-left'}`}><input type="checkbox" checked={allPageSelected} onChange={togglePage} className="w-4 h-4 accent-primary" /></th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.barcode')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.name')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.category')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.price')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.stock')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedItems.map(item => {
                const isLow = item.stockQuantity <= item.minStockLevel && item.stockQuantity > 0;
                const isOut = item.stockQuantity === 0;
                return (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 accent-primary" /></td>
                    <td className="px-4 py-3 font-numeric text-xs text-muted-foreground">{item.barcode}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{isRTL ? item.nameAr : item.name}</p>
                        <p className="text-xs text-muted-foreground/60">{isRTL ? item.name : item.nameAr}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.size && <span className="text-[10px] bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded">{t('inventory.size')}: {item.size}</span>}
                        {item.color && <span className="text-[10px] bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded">{t('inventory.color')}: {item.color}</span>}
                        {(item.subUnits || []).map((s, i) => <span key={i} className="text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded">{s.name} ×{s.factor}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{getCategoryName(item.categoryId)}</td>
                    <td className="px-4 py-3 font-numeric">
                      <p className="text-foreground font-medium">{formatMoney(item.salePrice)}</p>
                      <p className="text-xs text-muted-foreground/60">{formatMoney(item.purchasePrice)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-numeric font-medium ${isOut ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{item.stockQuantity}</span>
                      <span className="text-xs text-muted-foreground/60"> / {item.minStockLevel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400' : isLow ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'}`}>
                        {isOut ? t('common.outOfStock') : isLow ? t('common.lowStock') : t('common.inStock')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {can('inventory', 'edit') && (<>
                          <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => openStock('receipt', item)} title={t('inventory.stockReceipt')} className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600"><Boxes size={14} /></button>
                          <button onClick={() => openStock('issue', item)} title={t('inventory.stockIssue')} className="p-1.5 rounded hover:bg-amber-100 text-amber-600"><Layers size={14} /></button>
                          <button onClick={() => openStock('damage', item)} title={t('inventory.stockDamage')} className="p-1.5 rounded hover:bg-red-100 text-red-600"><AlertTriangle size={14} /></button>
                          <button onClick={() => setVariantsModal(item)} title={t('inventory.bulkVariants')} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Ruler size={14} /></button>
                        </>)}
                        {can('inventory', 'delete') && (<button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400 transition-colors"><Trash2 size={14} /></button>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={`px-4 py-3 border-t border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-xs text-muted-foreground">{filteredItems.length} {t('common.items')}</p>
            <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded text-xs font-medium transition-colors ${currentPage === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Item Add/Edit Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{editingItem ? t('inventory.editItem') : t('inventory.addItem')}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.name')} (EN)</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.name')} (AR)</label>
                  <input value={formData.nameAr} onChange={e => setFormData({ ...formData, nameAr: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.barcode')}</label>
                  <div className="flex gap-2">
                    <input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-numeric" required />
                    <button type="button" onClick={handleGenerateBarcode} className="px-3 py-2 border border-border rounded-lg hover:bg-accent text-muted-foreground"><Barcode size={16} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.category')}</label>
                  <select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{isRTL ? cat.nameAr : cat.name}</option>))}
                    <option value={NEW_CATEGORY_VALUE}>{isRTL ? '➕ فئة جديدة...' : '➕ New category...'}</option>
                  </select>
                </div>
                {formData.categoryId === NEW_CATEGORY_VALUE && (<>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{isRTL ? 'اسم الفئة الجديدة (AR)' : 'New category name (AR)'}</label>
                    <input value={newCategoryNameAr} onChange={e => setNewCategoryNameAr(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{isRTL ? 'اسم الفئة الجديدة (EN)' : 'New category name (EN)'}</label>
                    <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </>)}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.fields.purchasePrice')}</label>
                  <input type="number" value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" min={0} step={0.01} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.fields.salePrice')}</label>
                  <div className="flex gap-2">
                    <input type="number" value={formData.salePrice} onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" min={0} step={0.01} />
                    <button type="button" onClick={applyMargin} className="px-2 py-2 border border-border rounded-lg text-xs hover:bg-accent whitespace-nowrap">{t('inventory.applyMargin')}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.profitMargin')} %</label>
                  <input type="number" value={formData.profitMargin} onChange={e => setFormData({ ...formData, profitMargin: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.stock')}</label>
                  <input type="number" value={formData.stockQuantity} onChange={e => setFormData({ ...formData, stockQuantity: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.fields.minStockLevel')}</label>
                  <input type="number" value={formData.minStockLevel} onChange={e => setFormData({ ...formData, minStockLevel: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.unit')}</label>
                  <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
                    {unitOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.size')}</label>
                  <input value={formData.size} onChange={e => setFormData({ ...formData, size: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder={isRTL ? 'مثال: كبير' : 'e.g. Large'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.color')}</label>
                  <input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder={isRTL ? 'مثال: أحمر' : 'e.g. Red'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.manufacturer')}</label>
                  <input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.supplier')}</label>
                  <select value={formData.supplierId} onChange={e => setFormData({ ...formData, supplierId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
                    <option value="">—</option>
                    {suppliers.map(s => (<option key={s.id} value={s.id}>{isRTL ? s.nameAr : s.name}</option>))}
                  </select>
                </div>
              </div>

              {/* sub-units */}
              <div>
                <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <label className="text-xs font-medium text-muted-foreground">{t('inventory.subUnits')}</label>
                  <button type="button" onClick={addSubUnit} className="text-xs text-primary hover:underline">{t('inventory.addSubUnit')}</button>
                </div>
                {(formData.subUnits || []).map((s, idx) => (
                  <div key={idx} className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <input value={s.name} onChange={e => updateSubUnit(idx, { name: e.target.value })} placeholder={isRTL ? 'الوحدة' : 'Unit'} className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm" />
                    <span className="text-xs text-muted-foreground">×</span>
                    <input type="number" value={s.factor} onChange={e => updateSubUnit(idx, { factor: Number(e.target.value) })} className="w-20 px-2 py-1.5 border border-border rounded-lg text-sm font-numeric" />
                    <button type="button" onClick={() => removeSubUnit(idx)} className="text-red-500"><X size={14} /></button>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">{t('inventory.subUnitsHint')}</p>
              </div>

              {/* additional barcodes */}
              <div>
                <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <label className="text-xs font-medium text-muted-foreground">{t('inventory.additionalBarcodes')}</label>
                  <button type="button" onClick={addBarcode} className="text-xs text-primary hover:underline">{t('inventory.addBarcode')}</button>
                </div>
                {(formData.barcodes || []).map((b, idx) => (
                  <div key={idx} className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <input value={b} onChange={e => updateBarcode(idx, e.target.value)} className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm font-numeric" />
                    <button type="button" onClick={() => removeBarcode(idx)} className="text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('inventory.fields.description')}</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
              </div>
              <div className={`flex items-center justify-end gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock Operation Modal ── */}
      {stockModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-foreground mb-1">{t(`inventory.${stockModal.action}`)}</h3>
            <p className="text-sm text-muted-foreground mb-4">{isRTL ? stockModal.item.nameAr : stockModal.item.name} — {t('common.stock')}: {stockModal.item.stockQuantity}</p>
            <label className="block text-xs text-muted-foreground mb-1">{t('inventory.quantity')}</label>
            <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary font-numeric mb-3" min={0} />
            <label className="block text-xs text-muted-foreground mb-1">{t('inventory.note')}</label>
            <input value={stockNote} onChange={e => setStockNote(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary mb-4" />
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={submitStock} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.confirm')}</button>
              <button onClick={() => setStockModal({ action: 'receipt', item: null })} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Variants Modal ── */}
      {variantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-1">{t('inventory.bulkVariants')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{isRTL ? variantsModal.nameAr : variantsModal.name}</p>
            <label className="block text-xs text-muted-foreground mb-1">{t('inventory.variantSizes')}</label>
            <textarea value={variantSizes} onChange={e => setVariantSizes(e.target.value)} rows={2} placeholder={isRTL ? 'مفصولة بفاصلة: S,M,L' : 'comma separated: S,M,L'} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary mb-3" />
            <label className="block text-xs text-muted-foreground mb-1">{t('inventory.variantColors')}</label>
            <textarea value={variantColors} onChange={e => setVariantColors(e.target.value)} rows={2} placeholder={isRTL ? 'مفصولة بفاصلة: أحمر,أزرق' : 'comma separated: Red,Blue'} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary mb-4" />
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={generateVariants} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('inventory.generateVariants')}</button>
              <button onClick={() => setVariantsModal(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Price Modal ── */}
      {priceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('inventory.bulkPrice')}</h3>
            <div className="space-y-3">
              <select value={priceCategory} onChange={e => setPriceCategory(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                <option value="all">{t('common.all')}</option>
                {rootCategories.map(cat => (<option key={cat.id} value={cat.id}>{isRTL ? cat.nameAr : cat.name}</option>))}
              </select>
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setPriceMode('margin')} className={`flex-1 py-2 rounded-lg text-sm ${priceMode === 'margin' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>{t('inventory.byMargin')}</button>
                <button onClick={() => setPriceMode('increase')} className={`flex-1 py-2 rounded-lg text-sm ${priceMode === 'increase' ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>{t('inventory.byIncrease')}</button>
              </div>
              <input type="number" value={priceValue} onChange={e => setPriceValue(e.target.value)} placeholder={priceMode === 'margin' ? '%' : currency} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary font-numeric" />
            </div>
            <div className={`flex gap-2 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={applyBulkPrice} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.apply')}</button>
              <button onClick={() => setPriceModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('common.import')} ({t('common.items')})</h3>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="w-full text-sm mb-4" />
            {importRows.length > 0 && (
              <p className="text-sm text-muted-foreground mb-4">{importRows.length} {t('common.items')} {isRTL ? 'جاهزة للاستيراد' : 'ready to import'}</p>
            )}
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={confirmImport} disabled={importRows.length === 0} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40">{t('common.import')}</button>
              <button onClick={() => { setImportRows([]); setImportModal(false); }} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barcode Print Modal ── */}
      {barcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-bold text-foreground">{t('inventory.printBarcodes')} ({selectedItems.length})</h3>
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => window.print()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.print')}</button>
                <button onClick={() => setBarcodeModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.close')}</button>
              </div>
            </div>
            <div className="print-barcodes grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedItems.map(item => (
                <div key={item.id} className="border border-border rounded-lg p-3 text-center">
                  <BarcodeLabel value={item.barcode} />
                  <p className="text-xs font-medium mt-1">{isRTL ? item.nameAr : item.name}</p>
                  <p className="text-[10px] text-muted-foreground font-numeric">{item.barcode}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarcodeLabel({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: 'CODE128', width: 1.5, height: 40, displayValue: false }); } catch { /* invalid barcode */ }
    }
  }, [value]);
  return <svg ref={ref} className="w-full" />;
}
