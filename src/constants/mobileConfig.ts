
/**
 * Tệp thiết lập riêng cho giao diện di động.
 * Chứa các hằng số về kích thước, khoảng cách và cấu hình đặc thù cho Mobile.
 */

export const MOBILE_CONFIG = {
  // Kích thước font chữ tối thiểu cho di động để tránh zoom tự động trên iOS
  minFontSize: '10px',
  
  // Khoảng cách lề an toàn cho các thiết bị có tai thỏ (notch)
  safeAreaPadding: 'env(safe-area-inset-bottom)',
  
  // Cấu hình thanh điều hướng di động
  navHeight: '64px',
  
  // Tỷ lệ thu nhỏ các thành phần UI so với Desktop
  uiScale: 0.85,
  
  // Các hiệu ứng animation nhẹ hơn cho di động để tiết kiệm pin/hiệu năng
  animationDuration: 0.3,
};

export type MobileTheme = typeof MOBILE_CONFIG;
