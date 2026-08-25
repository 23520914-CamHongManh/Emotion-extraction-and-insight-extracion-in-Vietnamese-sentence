# Hướng Dẫn Cài Đặt - Tennis AI Report

## Yêu Cầu Hệ Thống
- Python 3.8 trở lên
- Node.js 16 trở lên
- npm 8 trở lên

## Các Bước Cài Đặt

### 1. Clone hoặc Giải Nén Dự Án
Nếu tệp được nén, hãy giải nén vào một thư mục:
```bash
unzip tennis-ai-report.zip
cd tennis-ai-report
```

### 2. Tạo và Kích Hoạt Virtual Environment Python
Tạo virtual environment để cách ly các gói Python:

**Trên Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Trên Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Trên Windows (Command Prompt):**
```bash
python -m venv venv
venv\Scripts\activate.bat
```

### 3. Cài Đặt Các Thư Viện Python
Cài đặt tất cả các thư viện Python cần thiết bằng cách chạy:
```bash
pip install -r requirements.txt
```

Quá trình này sẽ cài đặt các thư viện sau:
- Flask (web framework backend)
- Flask-CORS (hỗ trợ CORS cho API)
- pandas, numpy (xử lý dữ liệu)
- torch (deep learning framework)
- catboost (mô hình phân loại)
- transformers (mô hình PhoBERT)
- underthesea (xử lý văn bản tiếng Việt)
- scikit-learn, scipy (machine learning utilities)

### 4. Cài Đặt Node.js Dependencies (Frontend)
Cài đặt các gói npm cho frontend React:
```bash
npm install
```

### 5. Khởi Động Backend (API Server)
Trong một terminal/command prompt, chạy server Flask:
```bash
python api_server.py
```

Máy chủ sẽ chạy ở `http://127.0.0.1:8000`

### 6. Khởi Động Frontend (React Development Server)
Mở một terminal/command prompt mới (giữ terminal backend chạy), kích hoạt lại venv nếu cần, sau đó chạy:
```bash
npm run dev
```

Frontend sẽ được phục vụ ở `http://localhost:5173` (hoặc port khác nếu 5173 đã được sử dụng)

## Các Lệnh Hữu Ích

### Phát Triển
```bash
# Terminal 1 - Backend API
python api_server.py

# Terminal 2 - Frontend
npm run dev
```

### Build Production
```bash
# Build frontend
npm run build

# Output sẽ ở thư mục dist/
```

### Kiểm Tra Chất Lượng Code
```bash
# Lint code frontend
npm run lint
```

## Khắc Phục Sự Cố

### Python không được tìm thấy
Đảm bảo Python được cài đặt và thêm vào PATH. Kiểm tra bằng:
```bash
python --version
```

### pip install thất bại
- Cập nhật pip: `pip install --upgrade pip`
- Thử cài lại: `pip install --force-reinstall -r requirements.txt`

### npm install thất bại
- Xóa package-lock.json và thử lại: `rm package-lock.json && npm install`
- Cập nhật npm: `npm install -g npm@latest`

### CUDA/GPU không được tìm thấy (torch)
Nếu bạn không có GPU NVIDIA, PyTorch sẽ tự động sử dụng CPU. Điều này bình thường và ứng dụng vẫn sẽ chạy.

## Cấu Trúc Dự Án

```
tennis-ai-report/
├── api_server.py              # Backend Flask API
├── package.json               # Frontend dependencies
├── vite.config.js             # Cấu hình Vite
├── requirements.txt           # Python dependencies
├── README.md                  # Tài liệu dự án
├── src/                       # Mã nguồn React frontend
├── public/                    # Tài sản tĩnh (CSS, hình ảnh, v.v.)
├── Apriori/                   # Mô-đun Apriori algorithm
├── phobert_tennis_saved/      # Mô hình PhoBERT đã lưu
├── catboost_tennis.cbm        # Mô hình CatBoost
└── tennis_label_encoder.pkl   # Label encoder cho mô hình
```

## Xác Minh Cài Đặt

Sau khi khởi động backend, kiểm tra xem API có chạy bình thường không:
```bash
curl http://127.0.0.1:8000/api/health
```

Bạn sẽ nhận được phản hồi JSON xác nhận các mô hình được tải thành công.
