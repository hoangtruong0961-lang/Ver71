
/**
 * Hệ thống thời gian Lịch Vạn Niên cho Game
 */

export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export const INITIAL_GAME_TIME: GameTime = {
  year: 2024,
  month: 1,
  day: 1,
  hour: 8,
  minute: 0
};

/**
 * Lấy tên Thứ trong tuần
 */
export const getDayOfWeek = (time: GameTime): string => {
  const { year, month, day } = time;
  
  // Sử dụng đối tượng Date của JavaScript để tính toán chính xác cho mọi năm
  // Lưu ý: month trong Date là 0-indexed (0 = Tháng 1)
  const date = new Date(year, month - 1, day);
  const dayIndex = date.getDay(); // 0 = Chủ Nhật, 1 = Thứ Hai, ...
  
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  return days[dayIndex];
};

/**
 * Định dạng thời gian hiển thị
 */
export const formatGameTime = (time: GameTime): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dayOfWeek = getDayOfWeek(time);
  return `${dayOfWeek}, Ngày ${pad(time.day)} tháng ${pad(time.month)} năm ${time.year} - ${pad(time.hour)}:${pad(time.minute)}`;
};

/**
 * Tiến triển thời gian
 */
export const advanceTime = (time: GameTime, minutesToAdd: number): GameTime => {
  let { year, month, day, hour, minute } = { ...time };
  
  minute += minutesToAdd;
  
  while (minute >= 60) {
    minute -= 60;
    hour += 1;
  }
  
  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }
  
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const getDaysInMonth = (m: number, y: number) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m === 2 && isLeap(y)) return 29;
    return days[m - 1];
  };

  // Đảm bảo month hợp lệ (1-12)
  if (month < 1) month = 1;
  if (month > 12) month = 12;

  while (day > getDaysInMonth(month, year)) {
    day -= getDaysInMonth(month, year);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  
  return { year, month, day, hour, minute };
};
