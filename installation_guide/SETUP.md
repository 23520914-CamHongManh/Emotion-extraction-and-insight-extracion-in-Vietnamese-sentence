# Hướng Dẫn Cài Đặt Tennis AI Report

Dự án này là một ứng dụng AI phân tích các yếu tố ảnh hưởng đến quần vợt kết hợp Frontend React/Vite với Backend Python Flask.

## 📋 Yêu Cầu Hệ Thống

- **Node.js**: v16.0.0 hoặc cao hơn
- **Python**: v3.8 hoặc cao hơn
- **NPM**: v7.0.0 hoặc cao hơn (đi kèm với Node.js)
- **pip**: Package manager của Python (đi kèm với Python)

## 🚀 Các Bước Cài Đặt

### 1. Clone Repository

```bash
git clone <repository-url>
cd tennis-ai-report
```

### 2. Cài Đặt Node.js Dependencies (Frontend)

```bash
npm install
```

Lệnh này sẽ cài đặt tất cả các package từ `package.json`:
- **React** (v19.2.6) - Framework UI
- **Vite** (v8.0.12) - Build tool
- **Tailwind CSS** (v4.3.0) - Styling
- **D3.js** (v7.9.0) - Data visualization
- **Recharts** (v3.8.1) - Chart library
- **Framer Motion** (v12.39.0) - Animation
- **React Force Graph** (v1.29.1) - Network graph
- **PapaParse** (v5.5.3) - CSV parsing
- Và các dependencies khác

### 3. Cài Đặt Python Dependencies (Backend)

```bash
# Tạo virtual environment (khuyến cáo)
python -m venv venv

# Kích hoạt virtual environment
# Trên Windows:
venv\Scripts\activate
# Trên macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

**Lưu ý**: File `requirements.txt` chưa tồn tại, cần tạo với nội dung sau:

```
Flask==2.3.0
Flask-CORS==4.0.0
pandas==2.0.0
numpy==1.24.0
torch==2.0.0
catboost==1.2.0
transformers==4.30.0
underthesea==1.3.3
```

Các thư viện chính:
- **Flask** - Web framework cho backend API
- **Flask-CORS** - Hỗ trợ CORS
- **pandas & numpy** - Data manipulation
- **torch** - Deep learning framework
- **catboost** - Gradient boosting cho classification
- **transformers** - PHoBERT model cho sentiment analysis
- **underthesea** - Vietnamese NLP tokenization

### 4. Cấu Trúc Dự Án

```
tennis-ai-report/
├── src/                          # Frontend source code
│   ├── App.jsx                   # Main React component
│   ├── App.css                   # Styling
│   ├── main.jsx                  # Entry point
│   ├── index.css                 # Global styles
│   ├── AprioriNetworkGraph.jsx   # Network visualization
│   └── assets/                   # Static assets
├── public/                       # Public files
│   └── David_Tennis.csv          # Training data
├── Apriori/                      # ML models & algorithms
│   ├── apriori_core.py           # Apriori algorithm implementation
│   ├── clean_dual.py             # Data cleaning & PHoBERT integration
│   ├── apriori_rules.csv         # Generated association rules
│   ├── phobert_predictions.csv   # PHoBERT predictions
│   └── phobert_absa_model/       # Pre-trained model directory
├── phobert_tennis_saved/         # Fine-tuned PHoBERT model
├── api_server.py                 # Flask backend
├── catboost_tennis.cbm           # Pre-trained CatBoost model
├── tennis_label_encoder.pkl      # Label encoder pickle file
├── package.json                  # Frontend dependencies
├── vite.config.js                # Vite configuration
├── eslint.config.js              # ESLint configuration
├── index.html                    # HTML entry point
├── .gitignore                    # Git ignore rules
├── SETUP.md                      # This file
└── README.md                     # Project information
```

## 🏃 Chạy Ứng Dụng

### Development Mode (Cùng lúc chạy Frontend và Backend)

**Terminal 1 - Frontend (React + Vite):**
```bash
npm run dev
```
- Frontend sẽ chạy tại: http://localhost:5173
- Vite sẽ tự động reload khi có thay đổi code

**Terminal 2 - Backend (Flask):**
```bash
# Đảm bảo virtual environment đã được kích hoạt
python api_server.py
```
- Backend sẽ chạy tại: http://127.0.0.1:8000
- Frontend sẽ proxy API requests đến backend qua `/api` endpoint

### Production Build

```bash
npm run build
```

Lệnh này sẽ:
- Biên dịch React code thành static files
- Tối ưu hóa bundle size
- Lưu output vào thư mục `dist/`

Preview production build:
```bash
npm run preview
```

## 🔍 Linting & Code Quality

```bash
npm run lint
```

Kiểm tra code style sử dụng ESLint dựa trên cấu hình trong `eslint.config.js`

## 📁 Key Files

| File | Mục Đích |
|------|----------|
| `api_server.py` | Flask API server chính |
| `Apriori/apriori_core.py` | Apriori algorithm implementation |
| `Apriori/clean_dual.py` | Dữ liệu cleaning & PHoBERT sentiment analysis |
| `src/App.jsx` | Main React application |
| `src/AprioriNetworkGraph.jsx` | Network graph visualization |
| `catboost_tennis.cbm` | Trained CatBoost model |
| `phobert_tennis_saved/` | Fine-tuned PHoBERT model |
| `tennis_label_encoder.pkl` | Label encoding mapping |

## 🔧 Troubleshooting

### Python Import Errors
```bash
# Nếu thiếu thư viện, cài lại toàn bộ dependencies
pip install -r requirements.txt --upgrade
```

### Frontend Build Issues
```bash
# Xóa node_modules và package-lock.json, rồi cài lại
rm -r node_modules package-lock.json
npm install
```

### Port Conflicts
- Nếu port 5173 (Vite) đã dùng: `npm run dev -- --port 3000`
- Nếu port 8000 (Flask) đã dùng: Thay đổi port trong `api_server.py` và `vite.config.js`

### Virtual Environment Issues
```bash
# Xóa và tạo lại virtual environment
rm -r venv
python -m venv venv
venv\Scripts\activate  # Windows
# hoặc
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

## 📝 Environment Variables

Tạo file `.env.local` nếu cần configuration đặc biệt:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## 🔐 Git Configuration

Đảm bảo `.gitignore` đã được cập nhật để loại bỏ:
- `node_modules/` - Frontend dependencies
- `__pycache__/` - Python cache
- `.venv/`, `venv/` - Virtual environment
- `.env.local` - Local environment variables
- Generated CSV files (trừ dữ liệu gốc)
- IDE configuration files

## 📚 Thêm Thông Tin

- **Vite Documentation**: https://vitejs.dev
- **React Documentation**: https://react.dev
- **Flask Documentation**: https://flask.palletsprojects.com
- **PHoBERT**: https://github.com/VinAIResearch/PhoBERT
- **CatBoost**: https://catboost.ai

## 💡 Tips

1. Luôn sử dụng virtual environment cho Python development
2. Chạy `npm install` sau khi pull code mới có thay đổi `package.json`
3. Chạy `npm run lint` trước khi commit
4. Đảm bảo cả frontend và backend đều chạy để test full functionality
5. Kiểm tra `.gitignore` trước khi commit để tránh push nhầm file lớn

---

**Cập nhật lần cuối**: May 26, 2026
