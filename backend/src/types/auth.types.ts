export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  profilePicture: string | null;
  roles: string[];
  permissions: string[];
}