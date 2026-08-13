/**
 * @file: API配置文件 (离线版本)
 */

export const API_CONFIG = {
  // 浏览器内核下载地址（dev/prod 分别读取 .env 中的 VITE_DEV_URL / VITE_PROD_URL）
  BASE_URL: import.meta.env.DEV
    ? import.meta.env.VITE_DEV_URL
    : import.meta.env.VITE_PROD_URL
}
