// ─────────────────────────────────────────────────────────────
// Warid (وريد) — Dashboard TypeScript Types
// ─────────────────────────────────────────────────────────────

import type {
  UserRole,
  PartnerStatus,
  OrderStatus,
  OrderSource,
  ServiceStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  AppointmentType,
  BloodType,
  EmployeeAvailability,
  NotificationChannel,
} from "@prisma/client";

// Re-export Prisma enums for use across the app
export type {
  UserRole,
  PartnerStatus,
  OrderStatus,
  OrderSource,
  ServiceStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  AppointmentType,
  BloodType,
  EmployeeAvailability,
  NotificationChannel,
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TYPES
// ═══════════════════════════════════════════════════════════════

/** KPI card data for Today's Summary section */
export interface KPICard {
  label: string;
  value: number;
  change?: number; // percentage change from yesterday
  icon?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}

/** Role-aware KPI configuration */
export interface RoleKPIs {
  role: UserRole;
  cards: [KPICard, KPICard, KPICard, KPICard]; // exactly 4 cards
}

/** Current task item for the main table */
export interface TaskItem {
  id: string;
  primaryLabel: string; // patient name, sample number, etc.
  secondaryLabel?: string;
  type?: string; // service type, appointment type
  status: string;
  time?: string;
  priority?: Priority;
}

/** Alert notification */
export interface Alert {
  id: string;
  type: "critical" | "delay" | "upcoming" | "missing" | "urgent";
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
}

/** Activity feed item */
export interface ActivityItem {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  timestamp: Date;
  userName?: string;
  details?: string;
}

/** Calendar appointment for today */
export interface CalendarItem {
  id: string;
  patientName: string;
  time: string;
  type: AppointmentType;
  status: string;
}

/** Earnings summary */
export interface EarningsSummary {
  today: number;
  month: number;
  upcoming: number; // مستحقات قادمة
  currency: string;
}

/** Quick action button */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  href?: string;
  action?: string;
}

/** Sidebar menu item */
export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  children?: SidebarItem[];
}

// ═══════════════════════════════════════════════════════════════
// ADMIN TYPES
// ═══════════════════════════════════════════════════════════════

/** Admin command center KPIs (8 total) */
export interface AdminKPIs {
  totalOrdersToday: number;
  activeOrders: number;
  delayedOrders: number;
  totalRevenue: number;
  netProfit: number;
  totalPatients: number;
  activeUsers: number;
  serviceStatus: ServiceStatusSummary;
}

/** Service status overview */
export interface ServiceStatusSummary {
  active: number;
  suspended: number;
  paused: number;
  total: number;
}

/** Partner list item for admin management */
export interface PartnerListItem {
  id: string;
  name: string;
  type: UserRole;
  phone: string;
  email?: string;
  governorate?: string;
  status: PartnerStatus;
  rating: number;
  totalTasks: number;
  isSanadLinked: boolean;
  complexName?: string;
  createdAt: Date;
}

/** Commission rule for the engine */
export interface CommissionRuleData {
  id: string;
  serviceType: string;
  partnerShare: number;
  complexShare: number;
  waridShare: number;
  nurseShare: number;
  driverShare: number;
}

/** Contract data */
export interface ContractData {
  id: string;
  partnerId: string;
  partnerName: string;
  startDate: Date;
  endDate: Date;
  services: string[];
  governorates: string[];
  workHours: Record<string, { start: string; end: string }>;
  minPrices: Record<string, number>;
  terms?: string;
  isActive: boolean;
  commissionRules: CommissionRuleData[];
}

/** Wallet summary for financial management */
export interface WalletSummary {
  partnerId: string;
  partnerName: string;
  partnerType: UserRole;
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
  debtsTotal: number;
  invoicesCount: number;
}

/** Report data types */
export interface RevenueReport {
  date: string;
  amount: number;
  serviceType: string;
}

export interface TopPerformer {
  id: string;
  name: string;
  type: string;
  revenue: number;
  rating: number;
  tasksCompleted: number;
}

/** System monitoring data */
export interface SystemMonitoring {
  serverSpeed: number; // ms response time
  activeUsers: number;
  liveRequests: number;
  errors: number;
  lastBackup: Date;
  securityLog: SecurityLogEntry[];
}

export interface SecurityLogEntry {
  id: string;
  action: string;
  userId: string;
  ip?: string;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════
// OPERATIONS TYPES
// ═══════════════════════════════════════════════════════════════

/** Operations header with 9 elements */
export interface OpsHeaderData {
  employeeName: string;
  role: string;
  availability: EmployeeAvailability;
  newOrdersCount: number;
  delayedOrdersCount: number;
  currentTime: Date;
}

/** Operations KPI cards (10 total) */
export interface OpsKPIs {
  newOrders: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  critical: number;
  fieldTasks: number;
  onlineConsultations: number;
  homeBloodDraw: number;
  labTestsInProgress: number;
  radiologyAwaitingReport: number;
}

/** New order card with 12 fields (map removed) */
export interface NewOrderCard {
  id: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  governorate: string;
  area: string;
  address: string;
  serviceType: string;
  priority: Priority;
  createdAt: Date;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes?: string;
}

/** Dispatch center: available nurse */
export interface DispatchNurse {
  id: string;
  name: string;
  rating: number;
  currentTasks: number;
  lastSeen: Date;
  governorate: string;
  area: string;
  status: EmployeeAvailability;
}

/** Dispatch center: available driver */
export interface DispatchDriver {
  id: string;
  name: string;
  vehicle: string;
  area: string;
  rating: number;
  isAvailable: boolean;
  currentTasks: number;
}

/** Dispatch center: available lab */
export interface DispatchLab {
  id: string;
  name: string;
  responseTime: string;
  currentOrders: number;
  qualityRating: number;
  workHours: string;
  sameArea: boolean; // Simplified from distance — same governorate/area proximity
}

/** Dispatch center: available radiology center */
export interface DispatchRadiology {
  id: string;
  name: string;
  equipmentTypes: string;
  nearestSlot: string;
  reportTime: string;
  rating: number;
}

/** Dispatch center: available pharmacy */
export interface DispatchPharmacy {
  id: string;
  medicationAvailable: boolean;
  hasDelivery: boolean;
  workHours: string;
  rating: number;
}

/** Execution timeline step (1 of 11) */
export interface TimelineStep {
  step: number;
  title: string;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: string;
}

/** Brief medical file (8 fields) */
export interface MedicalFile {
  patientId: string;
  medicalHistory?: string;
  chronicDiseases: string[];
  allergies: string[];
  currentMedications: string[];
  latestLabResults?: Record<string, unknown>;
  latestRadiology?: Record<string, unknown>;
  previousPrescriptions: string[];
  treatingDoctorName?: string;
}

/** Call log entry */
export interface CallLogEntry {
  id: string;
  receiverType: "PATIENT" | "NURSE" | "LAB" | "PHARMACY" | "RADIOLOGY";
  receiverName: string;
  duration?: number;
  notes?: string;
  createdAt: Date;
}

/** Blood bank request (8 fields) */
export interface BloodBankEntry {
  id: string;
  requestType: string;
  bloodType: BloodType;
  governorate: string;
  status: string;
  donorName?: string;
  drawAppointment?: Date;
  testStatus?: string;
  deliveryStatus?: string;
}

/** Sanad session for ops tracking */
export interface SanadSessionEntry {
  id: string;
  doctorName: string;
  appointmentTime: Date;
  status: "waiting" | "calling" | "in_session" | "ended";
}

/** Lab tracking (6 statuses) */
export interface LabTrackingEntry {
  id: string;
  sampleId: string;
  patientName: string;
  status:
    | "received"      // العينة استلمت
    | "in_lab"        // وصلت المختبر
    | "testing"       // قيد الفحص
    | "ready"         // النتيجة جاهزة
    | "sent_to_doctor" // أرسلت للطبيب
    | "sent_to_patient"; // أرسلت للمريض
}

/** Radiology tracking (5 statuses) */
export interface RadiologyTrackingEntry {
  id: string;
  patientName: string;
  status:
    | "scheduled"      // الموعد
    | "imaged"         // تم التصوير
    | "report_ready"   // التقرير الطبي
    | "images_attached" // الصور المرفقة
    | "sent_to_doctor"; // إرسال للطبيب
}

/** Pharmacy tracking (5 statuses) */
export interface PharmacyTrackingEntry {
  id: string;
  prescriptionId: string;
  patientName: string;
  status:
    | "received"   // الوصفة استلمت
    | "preparing"  // قيد التجهيز
    | "ready"      // جاهزة للتوصيل
    | "delivered"  // تم التوصيل
    | "returned";  // المرتجعات
}

// ═══════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Search results across entities */
export interface SearchResult {
  type: "order" | "patient" | "partner" | "service";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
