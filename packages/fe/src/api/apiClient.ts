// State: Shared API client instances using the authenticated axiosInstance
// Why here: All API calls route through these instances to pick up auth interceptors
// Updates: Instances are created once; auth is handled by axiosInstance interceptor

import {
  AdminApi,
  AppInfoApi,
  AuthApi,
  CampaignsApi,
  Configuration,
  LabsApi,
  NotificationsApi,
  TestsApi,
  UsersApi,
  WalletApi,
} from 'api-client';
import axiosInstance from './axiosInstance';
import { config } from '../config';

const configuration = new Configuration({ basePath: config.apiUrl });

export const authApi = new AuthApi(configuration, config.apiUrl, axiosInstance);
export const campaignsApi = new CampaignsApi(configuration, config.apiUrl, axiosInstance);
export const walletApi = new WalletApi(configuration, config.apiUrl, axiosInstance);
export const adminApi = new AdminApi(configuration, config.apiUrl, axiosInstance);
export const labsApi = new LabsApi(configuration, config.apiUrl, axiosInstance);
export const notificationsApi = new NotificationsApi(configuration, config.apiUrl, axiosInstance);
export const testsApi = new TestsApi(configuration, config.apiUrl, axiosInstance);
export const usersApi = new UsersApi(configuration, config.apiUrl, axiosInstance);
export const appInfoApi = new AppInfoApi(configuration, config.apiUrl, axiosInstance);
