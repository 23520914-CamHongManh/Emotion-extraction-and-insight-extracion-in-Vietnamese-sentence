# Tennis AI Report - Cấu Trúc Dự Án

## 📊 Tổng Quan

Tennis AI Report là một ứng dụng web AI-powered phân tích các yếu tố ảnh hưởng đến quần vợt. Dự án kết hợp:
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Flask + Python ML models
- **ML Models**: CatBoost, PHoBERT, Apriori Algorithm

## 🗂️ Cấu Trúc Chi Tiết

```
tennis-ai-report/
│
├── 📁 src/                          # Frontend source code (React)
│   ├── App.jsx                      # Main React component
│   ├── App.css                      # Component styling
│   ├── main.jsx                     # React entry point
│   ├── index.css                    # Global styles
│   ├── AprioriNetworkGraph.jsx      # Network graph visualization component
│   └── 📁 assets/                   # Static assets (images, etc.)
│
├── 📁 public/                       # Public static files
│   ├── David_Tennis.csv             # Main training dataset
│   ├── favicon.svg                  # Website favicon
│   └── icons.svg                    # Icon definitions
│
├── 📁 Apriori/                      # ML algorithms & models
│   ├── apriori_core.py              # Apriori algorithm implementation
│   ├── clean_dual.py                # Data cleaning & PHoBERT integration
│   ├── apriori_rules.csv            # Generated association rules (output)
│   ├── phobert_predictions.csv      # PHoBERT predictions (output)
│   └── 📁 phobert_absa_model/       # Pre-trained PHoBERT ABSA model
│
├── 📁 phobert_tennis_saved/         # Fine-tuned PHoBERT model for tennis
│   ├── config.json
│   ├── pytorch_model.bin
│   ├── tokenizer.json
│   └── ... (other model files)
│
├── 📁 node_modules/                 # Frontend dependencies (auto-generated)
│
├── 📁 .venv/ or venv/               # Python virtual environment (auto-created)
│
├── 📄 api_server.py                 # Flask backend API server
│                                    # Endpoints: /api/predict, /api/analyze
│
├── 📄 catboost_tennis.cbm           # Pre-trained CatBoost classification model
│
├── 📄 tennis_label_encoder.pkl      # Label encoder for classification output
│
├── 📄 package.json                  # Frontend dependencies configuration
│                                    # Scripts: dev, build, lint, preview
│
├── 📄 package-lock.json             # Locked frontend dependency versions
│
├── 📄 vite.config.js                # Vite build tool configuration
│                                    # Proxy setup for /api -> Flask backend
│
├── 📄 eslint.config.js              # Code quality linting rules
│
├── 📄 index.html                    # HTML entry point for React app
│
├── 📄 tailwind.config.js            # Tailwind CSS configuration (if exists)
│
├── 📄 requirements.txt               # Python dependencies list
│                                     # Flask, pandas, torch, transformers, etc.
│
├── 📄 .gitignore                    # Git ignore rules
│                                    # Excludes: node_modules, __pycache__, .venv
│
├── 📄 SETUP.md                      # Installation & setup guide (NEW)
│
├── 📄 README.md                     # Project documentation
│
└── 📄 DIRECTORY_STRUCTURE.md        # This file
```

## 🔑 Key Components

### Frontend (React + Vite)
- **App.jsx**: Main application component with data visualization
- **AprioriNetworkGraph.jsx**: Network graph showing associations
- **Tailwind CSS**: Utility-first CSS framework
- **D3.js & Recharts**: Data visualization libraries
- **Framer Motion**: Smooth animations

### Backend (Flask)
- **api_server.py**: 
  - Loads pre-trained models (CatBoost, PHoBERT)
  - Provides REST API endpoints
  - Handles CORS for frontend requests
  - Processes predictions and analysis

### ML Models
- **CatBoost** (catboost_tennis.cbm):
  - Gradient boosting classifier
  - Trained on tennis data for feature importance

- **PHoBERT** (phobert_tennis_saved):
  - Vietnamese BERT model
  - Fine-tuned for sentiment/aspect analysis
  - Helps extract insights from text data

- **Apriori** (Apriori/apriori_core.py):
  - Association rule mining
  - Finds patterns in weather-tennis relationships
  - Generates itemsets and rules

## 📦 Main Dependencies

### JavaScript/Frontend
```json
{
  "react": "^19.2.6",              # UI library
  "vite": "^8.0.12",               # Build tool
  "tailwindcss": "^4.3.0",         # CSS framework
  "d3": "^7.9.0",                  # Data visualization
  "recharts": "^3.8.1",            # Chart library
  "framer-motion": "^12.39.0",     # Animation
  "react-force-graph-2d": "^1.29.1" # Graph visualization
}
```

### Python/Backend
```
Flask==2.3.0                  # Web framework
Flask-CORS==4.0.0            # CORS support
pandas==2.0.0                # Data manipulation
torch==2.0.0                 # Deep learning
catboost==1.2.0              # Gradient boosting
transformers==4.30.0         # PHoBERT model
underthesea==1.3.3           # Vietnamese NLP
```

## 🚀 Workflow

```
Browser (React Frontend)
    ↓ (User interactions)
    ↓
Vite Dev Server (Port 5173)
    ↓ (API calls to /api/*)
    ↓ (Proxy configured)
    ↓
Flask Backend (Port 8000)
    ↓ (Load models & process)
    ↓ (CatBoost, PHoBERT, Apriori)
    ↓
Returns JSON predictions/analysis
    ↓
Frontend renders results with D3/Recharts
```

## 📋 Development Commands

```bash
# Frontend
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Check code quality

# Backend
pip install -r requirements.txt  # Install Python dependencies
python api_server.py             # Start Flask server
```

## 🎯 Important Notes

1. **Models**: Pre-trained models are large files, should NOT be committed to git
2. **Virtual Environment**: Always use Python venv for dependency isolation
3. **API Proxy**: Vite proxies `/api` calls to Flask backend at localhost:8000
4. **CSV Files**: Generated CSV files are ignored by git to keep repo clean
5. **VSCode Extensions**: Recommended extensions are preserved in `.vscode/extensions.json`

## 📝 File Sizes Reference

Large files in the project:
- `phobert_tennis_saved/`: ~400-500 MB (model weights)
- `catboost_tennis.cbm`: ~20-50 MB (model file)
- `node_modules/`: ~500 MB+ (frontend dependencies)
- `David_Tennis.csv`: Size depends on data

**These should be in .gitignore or use Git LFS for version control**

---

**Cập nhật**: May 26, 2026
