export type ApiSuccess<T> = {
  data: T;
};

export type ApiSuccessWithMeta<T, M> = {
  data: T;
  meta: M;
};

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  error: ApiError;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiTimestamp = string;
export type ResourceId = string;

export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type PlatformRole = 'INDIVIDUAL' | 'ADMIN';
export type OrganizationType = 'HOSPITAL' | 'BLOOD_CENTRE';
export type OrganizationMembershipRole =
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'BLOOD_CENTRE_ADMIN'
  | 'BLOOD_CENTRE_STAFF';

export type AuthUser = {
  id: ResourceId;
  email: string;
  status: UserStatus;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

export type AuthResponse = {
  user: AuthUser;
} & AuthTokens;

export type RegisterInput = {
  email: string;
  password: string;
};

export type LoginInput = RegisterInput;

export type RefreshInput = {
  refreshToken: string;
};

export type LogoutInput = RefreshInput;
