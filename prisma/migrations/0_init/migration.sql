-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'DOCTOR', 'LAB', 'PHARMACY', 'NURSE', 'DRIVER', 'RADIOLOGY', 'PATIENT');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING', 'PAUSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'ACCEPTED', 'ASSIGNED', 'IN_TRANSIT', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('COMPLEX', 'SANAD', 'DIRECT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('IN_PERSON_CONSULT', 'ONLINE_CONSULT', 'HOME_VISIT', 'HOME_BLOOD_DRAW', 'HOME_LAB_TEST', 'LAB_TEST', 'RADIOLOGY', 'PHARMACY_DISPENSE', 'MEDICINE_DELIVERY', 'NURSING', 'PHYSIOTHERAPY', 'SURGERY', 'BLOOD_BANK', 'TAXI');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PAUSED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('IN_PERSON', 'ONLINE', 'HOME_VISIT', 'SURGERY');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "EmployeeAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'ON_BREAK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTPCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTPCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "governorateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "governorateId" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "isSanadLinked" BOOLEAN NOT NULL DEFAULT false,
    "complexId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalComplex" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MedicalComplex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialtyId" TEXT,
    "complexId" TEXT,
    "isSanadLinked" BOOLEAN NOT NULL DEFAULT false,
    "experience" INTEGER,
    "gender" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availability" "EmployeeAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentTaskCount" INTEGER NOT NULL DEFAULT 0,
    "governorateId" TEXT,
    "area" TEXT,
    "vehicleInfo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Governorate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "areas" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Governorate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "services" JSONB NOT NULL DEFAULT '[]',
    "governorates" JSONB NOT NULL DEFAULT '[]',
    "workHours" JSONB NOT NULL DEFAULT '{}',
    "minPrices" JSONB NOT NULL DEFAULT '{}',
    "terms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "partnerShare" DECIMAL(18,3) NOT NULL,
    "complexShare" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "waridShare" DECIMAL(18,3) NOT NULL,
    "nurseShare" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "driverShare" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConfig" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "workHours" JSONB NOT NULL DEFAULT '{}',
    "governorates" JSONB NOT NULL DEFAULT '[]',
    "dailyCapacity" INTEGER,
    "isHomeService" BOOLEAN NOT NULL DEFAULT false,
    "isBloodDraw" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "source" "OrderSource" NOT NULL DEFAULT 'DIRECT',
    "governorateId" TEXT,
    "area" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "subtotal" DECIMAL(18,3),
    "discountTotal" DECIMAL(18,3),
    "totalAmount" DECIMAL(18,3),
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "assignedNurseId" TEXT,
    "assignedDriverId" TEXT,
    "assignedLabId" TEXT,
    "assignedPharmacyId" TEXT,
    "assignedRadiologyId" TEXT,
    "operationsEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimeline" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "complexId" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'IN_PERSON',
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "price" DECIMAL(18,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pharmacyId" TEXT,
    "orderId" TEXT,
    "medications" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSample" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "labId" TEXT NOT NULL,
    "nurseId" TEXT,
    "sampleType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "centerId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "equipmentType" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "report" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RadiologyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanadSession" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SanadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyEquipment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "balance" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "pendingAmount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(18,3) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(18,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "reason" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceConfig" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "basePrice" DECIMAL(18,3) NOT NULL,
    "sanadPrice" DECIMAL(18,3),
    "complexPrice" DECIMAL(18,3),
    "discountPercent" DECIMAL(18,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(18,3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetServices" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(18,3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMedicalRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "chronicDiseases" JSONB NOT NULL DEFAULT '[]',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "currentMedications" JSONB NOT NULL DEFAULT '[]',
    "latestLabResults" JSONB,
    "latestRadiology" JSONB,
    "previousPrescriptions" JSONB NOT NULL DEFAULT '[]',
    "treatingDoctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "receiverType" TEXT NOT NULL,
    "duration" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodBankRequest" (
    "id" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "governorateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "donorId" TEXT,
    "donorName" TEXT,
    "drawAppointment" TIMESTAMP(3),
    "testStatus" TEXT,
    "deliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodBankRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFeedback" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "OTPCode_phone_code_idx" ON "OTPCode"("phone", "code");

-- CreateIndex
CREATE INDEX "OTPCode_phone_createdAt_idx" ON "OTPCode"("phone", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OTPCode_expiresAt_idx" ON "OTPCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_governorateId_idx" ON "User"("governorateId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE INDEX "Partner_type_status_idx" ON "Partner"("type", "status");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Partner_governorateId_type_idx" ON "Partner"("governorateId", "type");

-- CreateIndex
CREATE INDEX "Partner_complexId_idx" ON "Partner"("complexId");

-- CreateIndex
CREATE INDEX "Partner_createdAt_idx" ON "Partner"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalComplex_partnerId_key" ON "MedicalComplex"("partnerId");

-- CreateIndex
CREATE INDEX "Department_complexId_idx" ON "Department"("complexId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeStatus_userId_key" ON "EmployeeStatus"("userId");

-- CreateIndex
CREATE INDEX "EmployeeStatus_availability_governorateId_idx" ON "EmployeeStatus"("availability", "governorateId");

-- CreateIndex
CREATE UNIQUE INDEX "Governorate_name_key" ON "Governorate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_partnerId_key" ON "Contract"("partnerId");

-- CreateIndex
CREATE INDEX "Contract_isActive_endDate_idx" ON "Contract"("isActive", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRule_contractId_serviceType_key" ON "CommissionRule"("contractId", "serviceType");

-- CreateIndex
CREATE INDEX "ServiceConfig_partnerId_status_idx" ON "ServiceConfig"("partnerId", "status");

-- CreateIndex
CREATE INDEX "ServiceConfig_serviceType_status_idx" ON "ServiceConfig"("serviceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConfig_partnerId_serviceType_key" ON "ServiceConfig"("partnerId", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_priority_status_idx" ON "Order"("priority", "status");

-- CreateIndex
CREATE INDEX "Order_serviceType_idx" ON "Order"("serviceType");

-- CreateIndex
CREATE INDEX "Order_governorateId_idx" ON "Order"("governorateId");

-- CreateIndex
CREATE INDEX "Order_patientId_idx" ON "Order"("patientId");

-- CreateIndex
CREATE INDEX "Order_assignedNurseId_status_idx" ON "Order"("assignedNurseId", "status");

-- CreateIndex
CREATE INDEX "Order_assignedDriverId_status_idx" ON "Order"("assignedDriverId", "status");

-- CreateIndex
CREATE INDEX "Order_assignedLabId_status_idx" ON "Order"("assignedLabId", "status");

-- CreateIndex
CREATE INDEX "Order_assignedPharmacyId_status_idx" ON "Order"("assignedPharmacyId", "status");

-- CreateIndex
CREATE INDEX "Order_assignedRadiologyId_status_idx" ON "Order"("assignedRadiologyId", "status");

-- CreateIndex
CREATE INDEX "Order_operationsEmployeeId_status_idx" ON "Order"("operationsEmployeeId", "status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "OrderTimeline_completedBy_idx" ON "OrderTimeline"("completedBy");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTimeline_orderId_step_key" ON "OrderTimeline"("orderId", "step");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_idx" ON "Appointment"("doctorId", "date");

-- CreateIndex
CREATE INDEX "Appointment_date_status_idx" ON "Appointment"("date", "status");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_complexId_idx" ON "Appointment"("complexId");

-- CreateIndex
CREATE INDEX "Prescription_pharmacyId_status_idx" ON "Prescription"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_createdAt_idx" ON "Prescription"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Prescription_patientId_createdAt_idx" ON "Prescription"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Prescription_status_createdAt_idx" ON "Prescription"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_orderId_idx" ON "Prescription"("orderId");

-- CreateIndex
CREATE INDEX "LabSample_status_createdAt_idx" ON "LabSample"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabSample_labId_status_idx" ON "LabSample"("labId", "status");

-- CreateIndex
CREATE INDEX "LabSample_orderId_idx" ON "LabSample"("orderId");

-- CreateIndex
CREATE INDEX "LabSample_nurseId_idx" ON "LabSample"("nurseId");

-- CreateIndex
CREATE INDEX "RadiologyRequest_centerId_status_idx" ON "RadiologyRequest"("centerId", "status");

-- CreateIndex
CREATE INDEX "RadiologyRequest_status_createdAt_idx" ON "RadiologyRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RadiologyRequest_appointmentDate_idx" ON "RadiologyRequest"("appointmentDate");

-- CreateIndex
CREATE INDEX "RadiologyRequest_orderId_idx" ON "RadiologyRequest"("orderId");

-- CreateIndex
CREATE INDEX "SanadSession_doctorId_appointmentTime_idx" ON "SanadSession"("doctorId", "appointmentTime");

-- CreateIndex
CREATE INDEX "SanadSession_status_appointmentTime_idx" ON "SanadSession"("status", "appointmentTime");

-- CreateIndex
CREATE INDEX "RadiologyEquipment_centerId_isActive_idx" ON "RadiologyEquipment"("centerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_partnerId_key" ON "Wallet"("partnerId");

-- CreateIndex
CREATE INDEX "Wallet_balance_idx" ON "Wallet"("balance" DESC);

-- CreateIndex
CREATE INDEX "Transaction_walletId_type_createdAt_idx" ON "Transaction"("walletId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_partnerId_status_idx" ON "Invoice"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Debt_partnerId_status_idx" ON "Debt"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Debt_dueDate_idx" ON "Debt"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PriceConfig_serviceType_key" ON "PriceConfig"("serviceType");

-- CreateIndex
CREATE INDEX "Campaign_isActive_startDate_endDate_idx" ON "Campaign"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientMedicalRecord_patientId_key" ON "PatientMedicalRecord"("patientId");

-- CreateIndex
CREATE INDEX "CallLog_orderId_createdAt_idx" ON "CallLog"("orderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CallLog_callerId_createdAt_idx" ON "CallLog"("callerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BloodBankRequest_status_createdAt_idx" ON "BloodBankRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BloodBankRequest_bloodType_governorateId_idx" ON "BloodBankRequest"("bloodType", "governorateId");

-- CreateIndex
CREATE INDEX "PatientFeedback_orderId_idx" ON "PatientFeedback"("orderId");

-- CreateIndex
CREATE INDEX "PatientFeedback_patientId_createdAt_idx" ON "PatientFeedback"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_dayOfWeek_key" ON "DoctorSchedule"("doctorId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "MedicalComplex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalComplex" ADD CONSTRAINT "MedicalComplex_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "MedicalComplex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatus" ADD CONSTRAINT "EmployeeStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatus" ADD CONSTRAINT "EmployeeStatus_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConfig" ADD CONSTRAINT "ServiceConfig_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedNurseId_fkey" FOREIGN KEY ("assignedNurseId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedLabId_fkey" FOREIGN KEY ("assignedLabId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedPharmacyId_fkey" FOREIGN KEY ("assignedPharmacyId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedRadiologyId_fkey" FOREIGN KEY ("assignedRadiologyId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanadSession" ADD CONSTRAINT "SanadSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodBankRequest" ADD CONSTRAINT "BloodBankRequest_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
