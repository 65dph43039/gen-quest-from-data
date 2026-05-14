# gen-quest-from-data

Scaffold website trắc nghiệm (React + Vite + Node.js/Express) theo hướng import ngân hàng câu hỏi từ CSV.

## Tính năng đã có

- **Admin**
  - Import câu hỏi từ CSV chuẩn bằng `papaparse`
  - Quản lý câu hỏi: xem, chỉnh sửa, xóa
  - Lọc câu hỏi theo `topic` và `difficulty`
- **Làm bài**
  - Chọn bộ đề (`setName`) hoặc tất cả chủ đề, nhập số lượng câu hỏi
  - Tạo đề ngẫu nhiên từ ngân hàng
  - Đáp án được trộn ngẫu nhiên mỗi lần tạo đề
  - Nộp bài để chấm điểm tự động
- **Kết quả & lịch sử**
  - Hiển thị đúng/sai, đáp án đúng, giải thích (nếu có)
  - Lưu lịch sử làm bài theo `userId`

## Cấu trúc dự án

- `/frontend`: React + Vite UI (Admin, Làm bài, Kết quả)
- `/backend`: Express API + lưu trữ JSON (`backend/data/db.json`)
- `/question_bank_template.csv`: template CSV đầu vào
- `/data.csv`: bộ câu hỏi MHXBP mẫu để import nhanh

## CSV format (hỗ trợ)

Các cột bắt buộc:

- `question`
- `option_a`
- `option_b`
- `option_c`
- `option_d`
- `correct_option` (`A/B/C/D`)

Các cột khuyến nghị:

- `id`
- `explanation`
- `topic`
- `difficulty`
- `set_name` (nếu không có, backend tự lấy từ `topic`)

### Quy ước dữ liệu trong `data.csv`

- Mã hóa: UTF-8
- `difficulty`:
  - `1`: dễ
  - `2`: trung bình
  - `3`: khó

## Chạy dự án

### 1) Cài dependencies

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2) Chạy local

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

### 3) Build/Test

```bash
npm run lint
npm run test
npm run build
```

## API chính (backend)

- `POST /api/questions/import-csv` – import CSV
- `GET /api/questions` – danh sách câu hỏi
- `PUT /api/questions/:id` – cập nhật câu hỏi
- `DELETE /api/questions/:id` – xóa câu hỏi
- `GET /api/sets` – danh sách bộ đề
- `POST /api/quiz` – tạo đề theo bộ đề + số lượng
- `POST /api/attempts` – nộp bài/chấm điểm
- `GET /api/attempts?userId=...` – lịch sử làm bài

## Gợi ý mở rộng

- Thêm đăng nhập (JWT/session)
- Thêm phân quyền admin/user
- Chuyển JSON storage sang SQLite/PostgreSQL
- Thêm timer, chống gian lận, xuất báo cáo
