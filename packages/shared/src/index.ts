export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  OPERATOR = 'OPERATOR',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum SalesRequestStatus {
  UNINVOICED = 'UNINVOICED',
  INVOICED = 'INVOICED',
}

export enum ShortageRequestStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum ActivityType {
  SALE_ITEM_ADDED = 'SALE_ITEM_ADDED',
  SALE_ITEM_EDITED = 'SALE_ITEM_EDITED',
  SALE_ITEM_DELETED = 'SALE_ITEM_DELETED',
  SALE_REQUEST_INVOICED = 'SALE_REQUEST_INVOICED',

  SHORTAGE_ITEM_ADDED = 'SHORTAGE_ITEM_ADDED',
  SHORTAGE_QUANTITY_INCREASED = 'SHORTAGE_QUANTITY_INCREASED',
  SHORTAGE_ITEM_EDITED = 'SHORTAGE_ITEM_EDITED',
  SHORTAGE_REQUEST_CLOSED = 'SHORTAGE_REQUEST_CLOSED',

  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  PRODUCT_IMPORTED = 'PRODUCT_IMPORTED',

  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',

  BRANCH_CREATED = 'BRANCH_CREATED',
  BRANCH_UPDATED = 'BRANCH_UPDATED',

  COMPANY_CREATED = 'COMPANY_CREATED',
  COMPANY_UPDATED = 'COMPANY_UPDATED',
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  errors?: any;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserPermissions {
  'products.view': boolean;
  'products.manage': boolean;
  'sales.view': boolean;
  'sales.create': boolean;
  'sales.edit': boolean;
  'sales.delete': boolean;
  'sales.invoice': boolean;
  'sales.amount.view': boolean;
  'shortages.view': boolean;
  'shortages.create': boolean;
  'shortages.edit': boolean;
  'shortages.delete': boolean;
  'shortages.close': boolean;
  'users.manage': boolean;
  'branches.manage': boolean;
  'companies.manage': boolean;
  'settings.view': boolean;
  'backup.view': boolean;
  'backup.create': boolean;
  'backup.download': boolean;
  'backup.restore': boolean;
  'backup.delete': boolean;
}

export function getRolePermissions(role: UserRole): UserPermissions {
  switch (role) {
    case UserRole.SYSTEM_ADMIN:
      return {
        'products.view': false,
        'products.manage': false,
        'sales.view': false,
        'sales.create': false,
        'sales.edit': false,
        'sales.delete': false,
        'sales.invoice': false,
        'sales.amount.view': false,
        'shortages.view': false,
        'shortages.create': false,
        'shortages.edit': false,
        'shortages.delete': false,
        'shortages.close': false,
        'users.manage': false,
        'branches.manage': false,
        'companies.manage': true,
        'settings.view': false,
        'backup.view': false,
        'backup.create': false,
        'backup.download': false,
        'backup.restore': false,
        'backup.delete': false,
      };
    case UserRole.COMPANY_ADMIN:
      return {
        'products.view': true,
        'products.manage': true,
        'sales.view': true,
        'sales.create': true,
        'sales.edit': true,
        'sales.delete': true,
        'sales.invoice': true,
        'sales.amount.view': true,
        'shortages.view': true,
        'shortages.create': true,
        'shortages.edit': true,
        'shortages.delete': true,
        'shortages.close': true,
        'users.manage': true,
        'branches.manage': true,
        'companies.manage': false,
        'settings.view': true,
        'backup.view': true,
        'backup.create': true,
        'backup.download': true,
        'backup.restore': true,
        'backup.delete': true,
      };
    case UserRole.OPERATOR:
      return {
        'products.view': false,
        'products.manage': false,
        'sales.view': true,
        'sales.create': true,
        'sales.edit': true,
        'sales.delete': false,
        'sales.invoice': false,
        'sales.amount.view': false,
        'shortages.view': true,
        'shortages.create': true,
        'shortages.edit': true,
        'shortages.delete': false,
        'shortages.close': false,
        'users.manage': false,
        'branches.manage': false,
        'companies.manage': false,
        'settings.view': false,
        'backup.view': false,
        'backup.create': false,
        'backup.download': false,
        'backup.restore': false,
        'backup.delete': false,
      };
    default:
      return {
        'products.view': false,
        'products.manage': false,
        'sales.view': false,
        'sales.create': false,
        'sales.edit': false,
        'sales.delete': false,
        'sales.invoice': false,
        'sales.amount.view': false,
        'shortages.view': false,
        'shortages.create': false,
        'shortages.edit': false,
        'shortages.delete': false,
        'shortages.close': false,
        'users.manage': false,
        'branches.manage': false,
        'companies.manage': false,
        'settings.view': false,
        'backup.view': false,
        'backup.create': false,
        'backup.download': false,
        'backup.restore': false,
        'backup.delete': false,
      };
  }
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  permissions?: UserPermissions;
  companyId: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
  branchIds: string[];
  branches?: { id: string; name: string; code: string }[];
  currentBranchId?: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface ProductAlternativeNumberDto {
  id: string;
  productId: string;
  number: string;
  normalizedNumber: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductDto {
  id: string;
  companyId: string;
  partNumber: string;
  partNumberNormalized: string;
  partName: string;
  brand: string;
  brandNormalized: string;
  status: EntityStatus;
  alternativeNumbers?: ProductAlternativeNumberDto[];
  matchedViaAlternative?: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizePartNumber(value: string): string {
  if (!value) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s\-_/\\.,;:~`!@#$%^&*()=+[\]{}|<>?'"’‘“”]/g, '');
}

export function normalizeBrand(value: string): string {
  if (!value) return 'عام';
  const trimmed = String(value).trim().toUpperCase().replace(/\s+/g, ' ');
  return trimmed || 'عام';
}

export interface SalesItemDto {
  id: string;
  salesRequestId: string;
  productId: string;
  partNumberSnapshot: string;
  partNameSnapshot: string;
  brandSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  soldTo: string;
  note?: string | null;
  createdByUserId: string;
  createdByFullName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesRequestDto {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  documentNumber: string;
  businessDate: string;
  status: SalesRequestStatus;
  officialInvoiceNumber?: string | null;
  officialInvoiceDate?: string | null;
  invoicedByUserId?: string | null;
  invoicedByFullName?: string | null;
  invoicedAt?: string | null;
  totalItemsCount: number;
  totalQuantity: number;
  totalAmount: number;
  items?: SalesItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ShortageItemEventDto {
  id: string;
  shortageItemId: string;
  userId: string;
  userFullName: string;
  previousQuantity: number;
  addedQuantity: number;
  newQuantity: number;
  createdAt: string;
}

export interface ShortageItemDto {
  id: string;
  shortageRequestId: string;
  productId: string;
  partNumberSnapshot: string;
  partNameSnapshot: string;
  brandSnapshot: string;
  quantity: number;
  note?: string | null;
  createdByUserId: string;
  createdByFullName: string;
  events?: ShortageItemEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ShortageRequestDto {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  documentNumber: string;
  businessDate: string;
  status: ShortageRequestStatus;
  closedByUserId?: string | null;
  closedByFullName?: string | null;
  closedAt?: string | null;
  totalItemsCount: number;
  totalQuantity: number;
  items?: ShortageItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogDto {
  id: string;
  companyId: string;
  branchId?: string | null;
  branchName?: string | null;
  type: ActivityType;
  referenceNumber?: string | null;
  description: string;
  userId: string;
  userFullName: string;
  createdAt: string;
}

export interface DashboardSummaryDto {
  uninvoicedSalesCount: number;
  uninvoicedSalesTotalAmount: number;
  openShortagesCount: number;
  openShortagesTotalQuantity: number;
  currentActiveSale?: SalesRequestDto | null;
  currentActiveShortage?: ShortageRequestDto | null;
  todayActivities: ActivityLogDto[];
}
