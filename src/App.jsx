import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AprioriNetworkGraph from "./AprioriNetworkGraph";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudRain,
  CloudSun,
  Download,
  Droplets,
  FileSpreadsheet,
  Filter,
  Info,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Network,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Trophy,
  UploadCloud,
  Waves,
  Wind,
  X,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Leave VITE_API_BASE_URL empty for local development: Vite then proxies /api
// to Flask. In Vercel, set it to the public Render API origin.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_PREDICT_URL = `${API_BASE_URL}/api/predict`;
const API_APRIORI_ANALYZE_URL = `${API_BASE_URL}/api/apriori/analyze`;

const FEATURE_OPTIONS = {
  Outlook: ["None", "Sunny", "Overcast", "Rain"],
  Temperature: ["None", "Hot", "Mild", "Cool"],
  Humidity: ["None", "High", "Normal"],
  Wind: ["None", "Weak", "Strong"],
};

const FEATURE_META = {
  Outlook: { vi: "Thời tiết", hint: "Sunny, Overcast, Rain", icon: CloudSun },
  Temperature: { vi: "Nhiệt độ", hint: "Hot, Mild, Cool", icon: Waves },
  Humidity: { vi: "Độ ẩm", hint: "High, Normal", icon: Droplets },
  Wind: { vi: "Gió", hint: "Weak, Strong", icon: Wind },
};

const EMPTY_FEATURES = {
  Outlook: "None",
  Temperature: "None",
  Humidity: "None",
  Wind: "None",
};

const POS_COLOR = "#059669";
const NEG_COLOR = "#e11d48";

const APRIORI_CHART_GROUP_OPTIONS = [
  { id: "ALL", label: "Tất cả" },
  { id: "LOW", label: "Nhóm 1-3" },
  { id: "HIGH", label: "Nhóm 4-5" },
];

const SENTIMENT_TEXT = {
  POS: "tốt",
  NEG: "xấu",
  NEU: "trung lập",
};

const PREDICTION_SOURCE_TEXT = {
  none: "chưa có đầu vào",
  phobert: "PhoBERT trích feature từ phần mô tả",
  "manual combobox": "dùng feature chọn thủ công",
  "phobert + manual override": "PhoBERT trích từ mô tả, feature chọn thủ công ghi đè các ô khác None",
};

const DEFAULT_FORECAST_LOCATION = {
  id: "ho-chi-minh",
  name: "TP. Hồ Chí Minh",
  admin1: "Việt Nam",
  latitude: 10.8231,
  longitude: 106.6297,
};

const FORECAST_LOCATION_PRESETS = [
  DEFAULT_FORECAST_LOCATION,
  { id: "ha-noi", name: "Hà Nội", admin1: "Việt Nam", latitude: 21.0278, longitude: 105.8342 },
  { id: "da-nang", name: "Đà Nẵng", admin1: "Việt Nam", latitude: 16.0471, longitude: 108.2068 },
  { id: "hai-phong", name: "Hải Phòng", admin1: "Việt Nam", latitude: 20.8449, longitude: 106.6881 },
  { id: "can-tho", name: "Cần Thơ", admin1: "Việt Nam", latitude: 10.0452, longitude: 105.7469 },
  { id: "hue", name: "Huế", admin1: "Việt Nam", latitude: 16.4637, longitude: 107.5909 },
  { id: "nha-trang", name: "Nha Trang", admin1: "Khánh Hòa", latitude: 12.2388, longitude: 109.1967 },
  { id: "da-lat", name: "Đà Lạt", admin1: "Lâm Đồng", latitude: 11.9404, longitude: 108.4583 },
  { id: "vinh", name: "Vinh", admin1: "Nghệ An", latitude: 18.6796, longitude: 105.6813 },
  { id: "quy-nhon", name: "Quy Nhơn", admin1: "Bình Định", latitude: 13.782, longitude: 109.2197 },
  { id: "buon-ma-thuot", name: "Buôn Ma Thuột", admin1: "Đắk Lắk", latitude: 12.6662, longitude: 108.0382 },
  { id: "ha-long", name: "Hạ Long", admin1: "Quảng Ninh", latitude: 20.9712, longitude: 107.0448 },
  { id: "sa-pa", name: "Sa Pa", admin1: "Lào Cai", latitude: 22.3364, longitude: 103.8438 },
  { id: "phu-quoc", name: "Phú Quốc", admin1: "Kiên Giang", latitude: 10.2899, longitude: 103.984 },
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatPercent(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `0.${"0".repeat(digits)}%`;
  return `${number.toFixed(digits)}%`;
}

function formatPredictionSource(source, hasAnyInput) {
  if (!hasAnyInput) return "Nhập mô tả hoặc chọn feature để chạy dự đoán.";
  return PREDICTION_SOURCE_TEXT[source] || "đầu vào hiện tại";
}

function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "0.000";
}

function createLocationKey(location) {
  if (location?.id) return location.id;
  return `${formatCoordinate(location?.latitude)},${formatCoordinate(location?.longitude)}`;
}

function formatLocationDetail(location) {
  const admin = location?.admin1 && location.admin1 !== location.name ? `${location.admin1} · ` : "";
  return `${admin}${formatCoordinate(location?.latitude)}, ${formatCoordinate(location?.longitude)}`;
}

function mapGeocodingLocation(result) {
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  return {
    id: `geo-${result.id || normalizeKey(`${result.name}-${result.admin1 || ""}-${latitude}-${longitude}`)}`,
    name: result.name,
    admin1: result.admin1 || result.admin2 || "Việt Nam",
    country: result.country || "Việt Nam",
    latitude,
    longitude,
  };
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function Panel({ children, className = "", as: Component = "section" }) {
  return (
    <Component className={classNames("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </Component>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };

  return (
    <span className={classNames("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function Button({ children, variant = "primary", className = "", disabled, ...props }) {
  const variants = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      disabled={disabled}
      className={classNames(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, icon: Icon, tone = "slate", detail }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && (
          <span className={classNames("flex h-9 w-9 items-center justify-center rounded-md", tones[tone])}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function SectionTitle({ eyebrow, title, description, icon: Icon, action }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
            <Icon size={19} />
          </div>
        )}
        <div>
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>}
          <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Header({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "demo", label: "Dự đoán", icon: Sparkles },
    { id: "calendar", label: "Lịch 15 ngày", icon: CalendarDays },
    { id: "apriori", label: "Apriori", icon: Network },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
            <Trophy size={22} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tennis AI Report</p>
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-950">Data mining workspace</h1>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                  active
                    ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                )}
              >
                <Icon size={17} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function SelectFeature({ name, value, onChange }) {
  const Icon = FEATURE_META[name].icon;

  return (
    <label className="block rounded-lg border border-slate-200 bg-slate-50 p-4">
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200">
            <Icon size={17} />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</span>
            <span className="block font-semibold text-slate-950">{FEATURE_META[name].vi}</span>
          </span>
        </span>
        <ChevronDown className="mt-2 text-slate-400" size={17} />
      </span>

      <select
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="mt-4 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        {FEATURE_OPTIONS[name].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProbabilityBar({ label, value, positive }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <span>{formatPercent(safeValue, 2)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={classNames("h-full rounded-full transition-all duration-500", positive ? "bg-emerald-500" : "bg-rose-500")}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function ResultPanel({ result, loading, error, features, text }) {
  const hasAnyInput = Boolean(text?.trim()) || Object.values(features || {}).some((value) => value !== "None");
  const decision = result?.decision ?? "None";
  const isYes = String(decision).toLowerCase() === "yes";
  const isNo = String(decision).toLowerCase() === "no";

  return (
    <Panel className="overflow-hidden">
      <SectionTitle
        eyebrow="Model output"
        title="Quyết định cuối cùng"
        description="Text được PhoBERT đọc thành feature; các ô chọn khác None sẽ ghi đè feature tương ứng trước khi CatBoost dự đoán."
        icon={BrainCircuit}
        action={
          loading ? (
            <Loader2 className="animate-spin text-blue-600" />
          ) : isYes ? (
            <CheckCircle2 className="text-emerald-600" />
          ) : isNo ? (
            <XCircle className="text-rose-600" />
          ) : (
            <AlertCircle className="text-slate-400" />
          )
        }
      />

      <div className="space-y-5 p-5">
        <div
          className={classNames(
            "rounded-lg border p-6",
            isYes
              ? "border-emerald-200 bg-emerald-50"
              : isNo
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prediction</p>
          <p
            className={classNames(
              "mt-2 text-4xl font-bold tracking-tight md:text-5xl",
              isYes ? "text-emerald-700" : isNo ? "text-rose-700" : "text-slate-500"
            )}
          >
            {loading ? "Đang tính" : isYes ? "Nên chơi" : isNo ? "Không nên" : "Chưa có dữ liệu"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {formatPredictionSource(result?.source, hasAnyInput)}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
            <b>Lỗi API:</b> {error}
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <ProbabilityBar label="Tỉ lệ khuyên đi (Yes)" value={result?.probability_yes ?? 0} positive />
          <ProbabilityBar label="Tỉ lệ khuyên ở nhà (No)" value={result?.probability_no ?? 0} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Object.keys(EMPTY_FEATURES).map((key) => (
            <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
              <p className="mt-1 truncate text-base font-bold text-slate-950">{result?.features?.[key] ?? features[key]}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function useSpeechRecognition({ onText }) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) onText(transcript);
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [onText]);

  const toggle = () => {
    if (!supported || !recognitionRef.current) return;
    if (listening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  return { listening, supported, toggle };
}

function DemoPage() {
  const [text, setText] = useState("");
  const [features, setFeatures] = useState({ ...EMPTY_FEATURES });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSpeechText = useCallback((transcript) => {
    setText((current) => (current ? `${current.trim()} ${transcript}` : transcript));
  }, []);

  const speech = useSpeechRecognition({ onText: handleSpeechText });

  async function predict() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(API_PREDICT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, features }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Không thể gọi API dự đoán.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetDemo() {
    setText("");
    setFeatures({ ...EMPTY_FEATURES });
    setResult(null);
    setError("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
      <div className="space-y-6">
        <Panel className="overflow-hidden">
          <SectionTitle
            eyebrow="PhoBERT + CatBoost"
            title="Dự đoán điều kiện chơi Tennis"
            description="Nhập mô tả thời tiết hoặc chọn trực tiếp 4 feature; feature khác None sẽ được ưu tiên."
            icon={Sparkles}
          />
          <div className="p-5">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ví dụ: Trời hôm nay âm u, se lạnh nhưng gió nhẹ..."
              className="min-h-44 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={predict} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Dự đoán
              </Button>
              <Button variant="secondary" onClick={speech.toggle} disabled={!speech.supported}>
                {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
                {speech.listening ? "Đang nghe" : "Thu âm"}
              </Button>
              <Button variant="ghost" onClick={resetDemo}>
                <RefreshCw size={16} />
                Xóa
              </Button>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Features</p>
                  <p className="text-sm text-slate-500">Bốn feature đang gửi vào CatBoost.</p>
                </div>
                <Button variant="secondary" onClick={() => setFeatures({ ...EMPTY_FEATURES })}>
                  <RefreshCw size={16} />
                  Reset features
                </Button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.keys(EMPTY_FEATURES).map((key) => (
                  <SelectFeature
                    key={key}
                    name={key}
                    value={features[key]}
                    onChange={(name, value) => setFeatures((current) => ({ ...current, [name]: value }))}
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <ResultPanel result={result} loading={loading} error={error} features={features} text={text} />
    </div>
  );
}

function LocationPicker({ selectedLocation, onSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const selectedPresetId = FORECAST_LOCATION_PRESETS.some((location) => location.id === selectedLocation.id)
    ? selectedLocation.id
    : "";

  async function searchVietnamLocation(event) {
    event.preventDefault();

    const term = query.trim();
    if (term.length < 2) {
      setSearchError("Nhập ít nhất 2 ký tự để tìm tỉnh/thành.");
      setResults([]);
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=20&language=vi&format=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Không thể tìm khu vực từ Open-Meteo.");
      const data = await response.json();
      const vietnamResults = (data.results || [])
        .filter((item) => item.country_code === "VN" || ["viet_nam", "vietnam"].includes(normalizeKey(item.country)))
        .map(mapGeocodingLocation)
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

      setResults(vietnamResults);
      if (!vietnamResults.length) {
        setSearchError("Không tìm thấy kết quả ở Việt Nam. Thử tên khác như Hà Nội, Đà Nẵng, Khánh Hòa.");
      }
    } catch (err) {
      setSearchError(err.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Panel className="overflow-hidden">
      <SectionTitle
        eyebrow="Weather location"
        title="Chọn khu vực dự báo"
        description="Chọn nhanh một khu vực phổ biến hoặc tìm bất kỳ tỉnh/thành, quận/huyện ở Việt Nam qua Open-Meteo."
        icon={MapPin}
      />

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Khu vực nhanh</span>
          <select
            value={selectedPresetId}
            disabled={disabled}
            onChange={(event) => {
              const preset = FORECAST_LOCATION_PRESETS.find((location) => location.id === event.target.value);
              if (preset) onSelect(preset);
            }}
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!selectedPresetId && <option value="">Khu vực từ tìm kiếm</option>}
            {FORECAST_LOCATION_PRESETS.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">{formatLocationDetail(selectedLocation)}</p>
        </label>

        <div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchVietnamLocation}>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Tìm tỉnh thành Việt Nam</span>
              <input
                value={query}
                disabled={disabled || searching}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm: Hà Nội, Cần Thơ, Lâm Đồng, Nha Trang..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={disabled || searching || query.trim().length < 2}>
              {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              Tìm
            </Button>
          </form>

          {searchError && <p className="mt-2 text-sm font-medium text-rose-600">{searchError}</p>}

          {results.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {results.slice(0, 6).map((location) => (
                <button
                  key={location.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(location)}
                  className={classNames(
                    "rounded-md border p-3 text-left text-sm transition",
                    createLocationKey(location) === createLocationKey(selectedLocation)
                      ? "border-blue-300 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  )}
                >
                  <span className="block font-semibold">{location.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{formatLocationDetail(location)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function CalendarPage({ forecastCache, setForecastCache }) {
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_FORECAST_LOCATION);
  const locationKey = createLocationKey(selectedLocation);
  const forecastData = forecastCache[locationKey]?.days || null;
  const [loading, setLoading] = useState(!forecastData);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);

  function handleLocationSelect(location) {
    const nextKey = createLocationKey(location);
    setSelectedLocation(location);
    setSelectedDay(null);
    setError("");
    setLoading(!forecastCache[nextKey]?.days);
  }

  useEffect(() => {
    if (forecastData) return undefined;

    let isMounted = true;

    async function fetch15DaysForecast() {
      try {
        setLoading(true);
        const lat = selectedLocation.latitude;
        const lon = selectedLocation.longitude;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_mean,wind_speed_10m_mean&hourly=relative_humidity_2m&timezone=Asia%2FBangkok&forecast_days=16`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Không thể lấy dữ liệu thời tiết Open-Meteo.");
        const rawData = await response.json();

        const dailyHumidity = [];
        for (let index = 0; index < 15; index += 1) {
          const start = index * 24;
          const end = start + 24;
          const dayHumidities = rawData.hourly.relative_humidity_2m.slice(start, end);
          const average = dayHumidities.reduce((sum, value) => sum + value, 0) / 24;
          dailyHumidity.push(average);
        }

        const parsedDays = rawData.daily.time.slice(0, 15).map((date, index) => {
          const temp = rawData.daily.temperature_2m_mean[index];
          const windKmh = rawData.daily.wind_speed_10m_mean[index];
          const wmo = rawData.daily.weather_code[index];
          const humid = dailyHumidity[index];

          const temperature = temp > 32 ? "Hot" : temp >= 27 ? "Mild" : "Cool";
          const humidity = humid >= 75 ? "High" : "Normal";
          const wind = windKmh >= 15 ? "Strong" : "Weak";
          let outlook = "Sunny";
          if ([3, 45, 48, 51].includes(wmo)) outlook = "Overcast";
          if (wmo >= 53) outlook = "Rain";

          return {
            id: index,
            date,
            isToday: index === 0,
            raw: { temp, windKmh, humid: Math.round(humid), wmo },
            features: { Outlook: outlook, Temperature: temperature, Humidity: humidity, Wind: wind },
          };
        });

        const daysWithPredictions = await Promise.all(
          parsedDays.map(async (day) => {
            try {
              const predictionResponse = await fetch(API_PREDICT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ features: day.features }),
              });
              const prediction = await predictionResponse.json();
              return { ...day, prediction };
            } catch {
              return { ...day, prediction: { decision: "Error", probability_yes: 0, probability_no: 0 } };
            }
          })
        );

        if (isMounted) {
          setForecastCache((current) => ({
            ...current,
            [locationKey]: {
              location: selectedLocation,
              days: daysWithPredictions,
              fetchedAt: new Date().toISOString(),
            },
          }));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetch15DaysForecast();
    return () => {
      isMounted = false;
    };
  }, [forecastData, locationKey, selectedLocation, setForecastCache]);

  const trendData = useMemo(
    () =>
      (forecastData || []).map((day) => ({
        day: new Date(day.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        yes: Number(day.prediction?.probability_yes || 0),
      })),
    [forecastData]
  );

  const playDays = useMemo(
    () => (forecastData || []).filter((day) => String(day.prediction?.decision).toLowerCase() === "yes").length,
    [forecastData]
  );

  function getWeatherIcon(outlook) {
    if (outlook === "Sunny") return <CloudSun className="text-amber-500" size={28} />;
    if (outlook === "Rain") return <CloudRain className="text-blue-600" size={28} />;
    return <Cloud className="text-slate-500" size={28} />;
  }

  return (
    <div className="space-y-6">
      <LocationPicker selectedLocation={selectedLocation} onSelect={handleLocationSelect} />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Khu vực" value={selectedLocation.name} detail={formatLocationDetail(selectedLocation)} icon={MapPin} tone="blue" />
        <Metric label="Ngày nên chơi" value={`${playDays}/15`} detail="Theo CatBoost" icon={CheckCircle2} tone="green" />
        <Metric label="Nguồn dự đoán" value="Live API" detail="Weather + local model" icon={Activity} tone="violet" />
      </div>

      <Panel className="overflow-hidden">
        <SectionTitle
          eyebrow="15-day forecast"
          title="Lịch dự báo Tennis"
          description={`Dữ liệu thời tiết tại ${selectedLocation.name} được ánh xạ sang Outlook, Temperature, Humidity, Wind rồi gửi qua pipeline dự đoán hiện tại.`}
          icon={CalendarDays}
        />

        {loading && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2 className="animate-spin text-blue-600" size={36} />
            <p className="text-base font-semibold text-slate-700">Đang tải thời tiết và chạy mô hình...</p>
          </div>
        )}

        {error && (
          <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-700">
            <AlertCircle className="mb-2" size={24} />
            <p className="font-semibold">Lỗi kết nối</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && forecastData && (
          <div className="space-y-5 p-5">
            <div className="h-64 rounded-lg border border-slate-200 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip formatter={(value) => formatPercent(value, 1)} labelFormatter={(label) => `Ngày ${label}`} />
                  <Area type="monotone" dataKey="yes" name="Tỉ lệ Yes" stroke="#059669" fill="url(#yesGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {forecastData.map((day) => {
                const isYes = String(day.prediction?.decision).toLowerCase() === "yes";
                const dateObject = new Date(day.date);
                const dateLabel = dateObject.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                const weekday = dateObject.toLocaleDateString("vi-VN", { weekday: "short" });
                const yesPercent = Number(day.prediction?.probability_yes || 0);

                return (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day)}
                    className={classNames(
                      "flex min-h-44 flex-col rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                      day.isToday ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200",
                      isYes ? "bg-emerald-50" : "bg-rose-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{weekday}</p>
                        <p className="mt-1 text-lg font-bold text-slate-950">{day.isToday ? "Hôm nay" : dateLabel}</p>
                      </div>
                      {getWeatherIcon(day.features.Outlook)}
                    </div>

                    <div className="mt-auto">
                      <p className={classNames("rounded-md px-2 py-1.5 text-center text-sm font-bold", isYes ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900")}>
                        {isYes ? "Nên chơi" : "Ở nhà"}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                        <div className={classNames("h-full", isYes ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${yesPercent}%` }} />
                      </div>
                      <p className="mt-1 text-center text-xs font-semibold text-slate-500">{formatPercent(yesPercent, 0)} Yes</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedDay(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <Badge tone={selectedDay.isToday ? "blue" : "slate"}>{selectedDay.isToday ? "Hôm nay" : "Chi tiết ngày"}</Badge>
                  <h3 className="mt-3 text-2xl font-bold text-slate-950">
                    {new Date(selectedDay.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chỉ số thời tiết</p>
                  {[
                    { icon: Thermometer, label: "Nhiệt độ", value: `${selectedDay.raw.temp}°C` },
                    { icon: Droplets, label: "Độ ẩm", value: `${selectedDay.raw.humid}%` },
                    { icon: Wind, label: "Sức gió", value: `${selectedDay.raw.windKmh} km/h` },
                    { icon: CloudSun, label: "WMO code", value: selectedDay.raw.wmo },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <Icon size={17} />
                          {item.label}
                        </span>
                        <span className="font-bold text-slate-950">{item.value}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feature gửi vào CatBoost</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(selectedDay.features).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-700">{key}</p>
                        <p className="mt-1 font-bold text-blue-950">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={classNames(
                  "m-5 rounded-lg p-5 text-white",
                  String(selectedDay.prediction?.decision).toLowerCase() === "yes" ? "bg-emerald-600" : "bg-rose-600"
                )}
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-white/75">Mô hình đề xuất</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-3xl font-bold">{String(selectedDay.prediction?.decision).toLowerCase() === "yes" ? "Có nên chơi" : "Ở nhà tốt hơn"}</p>
                  <p className="text-4xl font-bold">{formatPercent(selectedDay.prediction?.probability_yes || 0, 1)}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RatioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-emerald-700">Tốt (POS): {formatPercent(row.POS, 1)} ({row.posCount})</p>
      <p className="text-rose-700">Xấu (NEG): {formatPercent(row.NEG, 1)} ({row.negCount})</p>
    </div>
  );
}

function formatRuleItem(item) {
  const label = item?.aspect_label || String(item?.label || item?.key || "").replace(/\s+(POS|NEG|NEU)$/i, "");
  const sentiment = SENTIMENT_TEXT[item?.sentiment];
  return sentiment ? `${label} ${sentiment}` : label || "Không rõ";
}

function formatRuleItems(items) {
  if (!items?.length) return "Không có";
  return items.map(formatRuleItem).join(" + ");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportRules(rules) {
  const header = ["antecedents", "consequents", "support", "confidence", "lift", "rating_group"];
  const lines = [
    header.join(","),
    ...rules.map((rule) =>
      [
        formatRuleItems(rule.antecedents),
        formatRuleItems(rule.consequents),
        rule.support,
        rule.confidence,
        rule.lift,
        rule.rating_group,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "apriori_rules_export.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AprioriPage() {
  const [file, setFile] = useState(null);
  const [minSupport, setMinSupport] = useState(0.05);
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartGroup, setChartGroup] = useState("ALL");
  const [ruleFilter, setRuleFilter] = useState("ALL"); // Bộ lọc hiển thị: ALL, HIGH, LOW
  const [aspectFilter, setAspectFilter] = useState("ALL"); // LỌC KHÍA CẠNH
  const [sentimentFilter, setSentimentFilter] = useState("ALL"); // LỌC CẢM XÚC (TỐT)
  // Lưu ID của Node đang được chọn (VD: "Chat_Luong_Chat_Lieu_POS")
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  // Lưu mảng 2 IDs của Cạnh đang được chọn (VD: ["Chat_Luong_Chat_Lieu_POS", "Gia_Ca_NEG"])
  const [selectedGraphEdge, setSelectedGraphEdge] = useState(null);

  // Hàm gọi API xử lý file CSV upload từ người dùng
  async function analyzeUploadedCsv() {
    if (!file) {
      setError("Vui lòng chọn một file CSV trước khi chạy Apriori.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("min_support", minSupport);
      formData.append("min_confidence", minConfidence);

      const response = await fetch(API_APRIORI_ANALYZE_URL, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Không thể phân tích Apriori.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedChartGroup = APRIORI_CHART_GROUP_OPTIONS.find((option) => option.id === chartGroup) || APRIORI_CHART_GROUP_OPTIONS[0];

  const selectedAspectSummary = useMemo(() => {
    if (!result) return [];
    const groupedSummary = result?.aspect_summary_by_group;
    if (groupedSummary && Array.isArray(groupedSummary[chartGroup])) {
      return groupedSummary[chartGroup];
    }
    return chartGroup === "ALL" ? result?.aspect_summary || [] : [];
  }, [result, chartGroup]);

  const chartGroupMetrics = result?.aspect_summary_group_metrics?.[chartGroup] || (chartGroup === "ALL" ? result?.metrics : null) || {};
  const chartTotalComments = Number(chartGroupMetrics.comments || 0);

  // BIỂU ĐỒ 1 (MỚI): Tính % mật độ khía cạnh xuất hiện trên tổng số câu bình luận theo nhóm rating đã chọn
  const coverageData = useMemo(() => {
    const totalComments = chartTotalComments || 1; // Tránh lỗi chia cho 0
    return selectedAspectSummary.map((item) => ({
      name: item.label,
      percentage: Number(((item.total || 0) / totalComments * 100).toFixed(1)),
      count: item.total || 0,
    }));
  }, [selectedAspectSummary, chartTotalComments]);

  // BIỂU ĐỒ 2 (CŨ): Tỉ lệ phân phối POS / NEG trong nội bộ khía cạnh đó theo nhóm rating đã chọn
  const ratioData = useMemo(
    () =>
      selectedAspectSummary.map((item) => ({
        name: item.label,
        POS: Number(item.positive_rate || 0),
        NEG: Number(item.negative_rate || 0),
        posCount: item.POS || 0,
        negCount: item.NEG || 0,
      })),
    [selectedAspectSummary]
  );

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden">
        <SectionTitle
          eyebrow="Apriori setup"
          title="Thiết lập phân tích luật kết hợp"
          description="Tải CSV bình luận, chọn ngưỡng tối thiểu rồi chạy phân tích để cập nhật biểu đồ, danh sách luật và đồ thị tương tác phía dưới."
          icon={Network}
          action={
            <Button onClick={analyzeUploadedCsv} disabled={loading} className="h-11 w-full shrink-0 lg:w-auto">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
              Chạy Apriori
            </Button>
          }
        />

        {error && (
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold leading-6 text-rose-700" role="alert">
              Lỗi: {error}
            </div>
          </div>
        )}

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
          <div className="space-y-3">
            <label
              className={classNames(
                "flex min-h-[184px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition",
                file
                  ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-100"
                  : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
              )}
            >
              <span className={classNames("flex h-12 w-12 items-center justify-center rounded-md ring-1", file ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-500 ring-slate-200")}>
                <UploadCloud size={24} />
              </span>
              <span className="mt-3 max-w-[calc(100%-2rem)] truncate text-sm font-semibold text-slate-950">
                {file ? file.name : "Chọn file dữ liệu CSV comment"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Kéo thả hoặc click để duyệt file"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <p className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <Info className="mt-0.5 shrink-0 text-slate-400" size={14} />
              <span>
                CSV cần có cột <code className="rounded bg-white px-1 font-mono font-bold text-rose-600">comment</code> hoặc nội dung/text.
                Các cột <code className="rounded bg-white px-1 font-mono text-slate-700">comment_id</code> và <code className="rounded bg-white px-1 font-mono text-slate-700">rating</code> là tùy chọn.
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Ngưỡng sinh luật</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Điều chỉnh để kiểm soát độ phổ biến và độ tin cậy tối thiểu của luật.</p>
              </div>
              <SlidersHorizontal className="shrink-0 text-slate-400" size={18} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="rounded-lg border border-slate-200 bg-white p-4">
                <span className="flex items-start justify-between gap-3 text-xs font-bold text-slate-700">
                  <span>Support tối thiểu</span>
                  <span className="rounded-md bg-blue-50 px-2 py-1 font-mono text-blue-700 ring-1 ring-blue-100">{formatPercent(minSupport * 100, 0)}</span>
                </span>
                <input
                  type="range"
                  min="0.01"
                  max="0.95"
                  step="0.01"
                  value={minSupport}
                  onChange={(event) => setMinSupport(Number(event.target.value))}
                  className="apriori-range mt-4 w-full cursor-pointer"
                />
                <span className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
                  <span>1%</span>
                  <span>95%</span>
                </span>
              </label>

              <label className="rounded-lg border border-slate-200 bg-white p-4">
                <span className="flex items-start justify-between gap-3 text-xs font-bold text-slate-700">
                  <span>Confidence tối thiểu</span>
                  <span className="rounded-md bg-blue-50 px-2 py-1 font-mono text-blue-700 ring-1 ring-blue-100">{formatPercent(minConfidence * 100, 0)}</span>
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.01"
                  value={minConfidence}
                  onChange={(event) => setMinConfidence(Number(event.target.value))}
                  className="apriori-range mt-4 w-full cursor-pointer"
                />
                <span className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
                  <span>10%</span>
                  <span>95%</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </Panel>

      {/* KHỐI BIỂU ĐỒ TRỰC QUAN HÓA (CHỈ LÊN HÌNH KHI ĐÃ CÓ DATA PHÂN TÍCH) */}
      <Panel className="overflow-hidden">
        <SectionTitle
          eyebrow="Insights"
          title="Thống kê khía cạnh và cảm xúc"
          description="Hai biểu đồ cập nhật sau mỗi lần chạy Apriori để so sánh mật độ xuất hiện và sắc thái cảm xúc theo từng khía cạnh."
          icon={BarChart3}
          action={
            result && (
              <label className="block w-full sm:w-56">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Nhóm dữ liệu</span>
                <select
                  value={chartGroup}
                  onChange={(event) => setChartGroup(event.target.value)}
                  className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {APRIORI_CHART_GROUP_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        />

        {!result ? (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/50 p-14 text-center">
            <FileSpreadsheet className="text-slate-400" size={34} />
            <p className="text-base font-semibold text-slate-800">Chưa có kết quả phân tích</p>
            <p className="max-w-md text-sm leading-6 text-slate-500">Chọn CSV và bấm <b>Chạy Apriori</b> để hiển thị thống kê khía cạnh, cảm xúc và luật kết hợp.</p>
          </div>
        ) : (
          <div className="grid gap-5 border-t border-slate-100 bg-slate-50/20 p-5 xl:grid-cols-2">

            {/* 📊 BIỂU ĐỒ BÊN TRÁI (MỚI THÊM): TỶ LỆ KHÍA CẠNH / TỔNG SỐ CÂU */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 min-h-[54px]">
                <p className="text-sm font-semibold text-slate-950">Mật độ xuất hiện của khía cạnh trên tổng số câu</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Tỷ lệ mẫu số câu có gán nhãn (POS/NEG) thuộc khía cạnh này chia cho tổng số câu duy nhất của {selectedChartGroup.label.toLowerCase()} ({chartTotalComments} câu).
                </p>
              </div>

              <div className="h-[380px]">
                {coverageData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coverageData} layout="vertical" margin={{ top: 10, right: 30, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fontWeight: 500 }} stroke="#64748b" />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Mật độ xuất hiện"]}
                        contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '12px' }}
                      />
                      <Bar dataKey="percentage" name="Tỷ lệ xuất hiện" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">Không thu thập được dữ liệu khía cạnh.</div>
                )}
              </div>
            </div>

            {/* 📊 BIỂU ĐỒ BÊN PHẢI (CŨ): TỶ LỆ POS / NEG TRONG KHÍA CẠNH (ĐÃ LƯỢC BỎ BẢNG PHẦN TRĂM) */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 min-h-[54px]">
                <p className="text-sm font-semibold text-slate-950">Tỉ lệ phân phối Tốt / Xấu trong từng khía cạnh</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Phần trăm phân tách sắc thái cảm xúc tích cực và tiêu cực trong {selectedChartGroup.label.toLowerCase()}.
                </p>
              </div>

              <div className="mb-4 flex gap-3 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Tốt (POS)
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Xấu (NEG)
                </span>
              </div>

              <div className="h-[380px]">
                {ratioData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {/* Đồ thị chiếm toàn bộ không gian 100% cột phải */}
                    <BarChart data={ratioData} layout="vertical" margin={{ top: 10, right: 30, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fontWeight: 500 }} stroke="#64748b" />
                      <Tooltip content={<RatioTooltip />} />
                      <Bar dataKey="POS" name="Tốt (POS)" stackId="ratio" fill={POS_COLOR} radius={[4, 0, 0, 4]} barSize={18} />
                      <Bar dataKey="NEG" name="Xấu (NEG)" stackId="ratio" fill={NEG_COLOR} radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">Chưa có dữ liệu cảm xúc để vẽ biểu đồ.</div>
                )}
              </div>
            </div>

          </div>
        )}
      </Panel>

      <Panel className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <SectionTitle
          eyebrow="Association rules"
          title="Luật kết hợp và đồ thị tương tác"
          description="Bộ lọc, danh sách luật và đồ thị dùng chung một tập kết quả sau khi chạy phân tích."
          icon={BrainCircuit}
          action={
            <Button variant="secondary" onClick={() => exportRules(result?.rules || [])} disabled={!result?.rules?.length}>
              <Download size={14} />
              Xuất dữ liệu thô
            </Button>
          }
        />

        {/* Định nghĩa các hàm helper xử lý Logic dịch thuật và Khuyến nghị ngay trong UI */}
        {(() => {
          // 1. THUẬT TOÁN GỘP NHÓM TỔ HỢP (LOẠI BỎ LUẬT TRÙNG LẶP)
          const processRules = (rawRules) => {
            const signatureMap = new Map();

            rawRules.forEach(rule => {
              // Gộp tất cả vế trái và vế phải lại thành 1 mảng các yếu tố
              const allItems = [...rule.antecedents, ...rule.consequents].map(i => `${i.key}_${i.sentiment}`);
              allItems.sort(); // Sắp xếp Alphabet để tạo chữ ký (Signature) duy nhất
              const signature = allItems.join("|");

              // Nếu chưa có chữ ký này -> Thêm vào map
              // Nếu đã có -> Ưu tiên giữ lại luật có Vế trái (antecedents) NGẮN HƠN để thấy nguyên nhân gốc rễ
              if (!signatureMap.has(signature)) {
                signatureMap.set(signature, rule);
              } else {
                const existingRule = signatureMap.get(signature);
                if (rule.antecedents.length < existingRule.antecedents.length) {
                  signatureMap.set(signature, rule);
                }
              }
            });
            return Array.from(signatureMap.values());
          };

          // Chạy lọc dữ liệu
          const uniqueRules = processRules(result?.rules || []);
          const lowRules = uniqueRules.filter(r => r.rating_group === "LOW");
          const highRules = uniqueRules.filter(r => r.rating_group === "HIGH");

          // Lọc kết hợp 2 lớp: Khía Cạnh (Aspect) và Cảm Xúc (Sentiment)
          let filteredRules = ruleFilter === "ALL" ? uniqueRules : (ruleFilter === "LOW" ? lowRules : highRules);

          if (aspectFilter !== "ALL" || sentimentFilter !== "ALL") {
            filteredRules = filteredRules.filter(rule => {
              const allItems = [...rule.antecedents, ...rule.consequents];

              return allItems.some(item => {
                // Rút trích key và sentiment từ data (phòng hờ API trả về dạng object hoặc dạng string)
                const itemKey = typeof item === 'string' ? item : (item.key || "");
                const itemSentiment = typeof item === 'object' && item.sentiment ? item.sentiment : "";

                // TẠO CHUỖI GHÉP: Ghép key và sentiment thành dạng "Chat_Luong_Chat_Lieu_POS"
                const combinedItemStr = itemSentiment ? `${itemKey}_${itemSentiment}` : itemKey;

                // 1. NẾU CHỌN CẢ HAI: Ghép chuỗi filter và so sánh chính xác tuyệt đối
                if (aspectFilter !== "ALL" && sentimentFilter !== "ALL") {
                  const targetMatch = `${aspectFilter}_${sentimentFilter}`; // VD: Chat_Luong_Chat_Lieu_POS
                  return combinedItemStr === targetMatch || itemKey === targetMatch;
                }
                // 2. NẾU CHỈ CHỌN KHÍA CẠNH: Tìm các item bắt đầu bằng tên khía cạnh đó
                else if (aspectFilter !== "ALL") {
                  return combinedItemStr.startsWith(aspectFilter);
                }
                // 3. NẾU CHỈ CHỌN ĐÁNH GIÁ (Tốt/Xấu): Tìm các item có đuôi _POS hoặc _NEG
                else if (sentimentFilter !== "ALL") {
                  return combinedItemStr.endsWith(`_${sentimentFilter}`) || itemSentiment === sentimentFilter;
                }

                return true;
              });
            });
          }

          // -------------------------------------------------------------
          // 🚀 THÊM MỚI: BỘ LỌC TẦNG 2 - TỪ TƯƠNG TÁC ĐỒ THỊ
          // -------------------------------------------------------------
          let finalDisplayRules = filteredRules;

          if (selectedGraphNode) {
            finalDisplayRules = finalDisplayRules.filter(rule => {
              const allItems = [...rule.antecedents, ...rule.consequents].map(item => {
                const k = typeof item === 'string' ? item : (item.key || "");
                const s = typeof item === 'object' && item.sentiment ? item.sentiment : "";
                return s ? `${k}_${s}` : k;
              });
              return allItems.includes(selectedGraphNode);
            });
          } else if (selectedGraphEdge) {
            finalDisplayRules = finalDisplayRules.filter(rule => {
              const allItems = [...rule.antecedents, ...rule.consequents].map(item => {
                const k = typeof item === 'string' ? item : (item.key || "");
                const s = typeof item === 'object' && item.sentiment ? item.sentiment : "";
                return s ? `${k}_${s}` : k;
              });
              // Phải chứa cả 2 Node của cạnh thì mới giữ lại (bất kể xuôi/ngược)
              return allItems.includes(selectedGraphEdge[0]) && allItems.includes(selectedGraphEdge[1]);
            });
          }

          // FIX CỨNG 7 KHÍA CẠNH ĐỂ HIỂN THỊ LÊN COMBOBOX CHO ĐẸP
          const BASE_ASPECTS = [
            { id: "Giao_Hang", label: "Giao hàng" },
            { id: "CSKH_Hau_Mai", label: "Chăm sóc KH / Hậu mãi" },
            { id: "Chat_Luong_Chat_Lieu", label: "Chất lượng / Chất liệu" },
            { id: "Dong_Goi", label: "Đóng gói" },
            { id: "Gia_Ca", label: "Giá cả" },
            { id: "Mau_Sac_Mau_Ma", label: "Màu sắc / Mẫu mã" },
            { id: "Form_Size", label: "Form / Size" }
          ];

          const getAspectName = (item) => {
            const labelMap = { "Giao_Hang": "Giao hàng", "CSKH_Hau_Mai": "Chăm sóc KH", "Chat_Luong_Chat_Lieu": "Chất lượng", "Dong_Goi": "Đóng gói", "Gia_Ca": "Giá cả", "Mau_Sac_Mau_Ma": "Mẫu mã", "Form_Size": "Form/Size", "Tong_Quan": "Tổng quan" };
            return typeof item === 'object' ? (item.aspect_label || labelMap[item.key] || item.key) : item;
          };

          const formatGraphSelection = (id) => {
            const rawId = String(id || "");
            const sentiment = rawId.endsWith("_POS") ? "POS" : rawId.endsWith("_NEG") ? "NEG" : "";
            const key = sentiment ? rawId.slice(0, -(sentiment.length + 1)) : rawId;
            const name = getAspectName({ key, sentiment });
            return sentiment ? `${name} ${sentiment === "POS" ? "Tốt" : "Tệ"}` : name;
          };

          const selectedGraphFilterLabel = selectedGraphNode
            ? `Node: ${formatGraphSelection(selectedGraphNode)}`
            : selectedGraphEdge
              ? `Cạnh: ${selectedGraphEdge.map(formatGraphSelection).join(" → ")}`
              : "";

          const ratingFilterOptions = [
            { id: "ALL", label: "Tất cả", count: uniqueRules.length },
            { id: "LOW", label: "1-3 Sao", count: lowRules.length },
            { id: "HIGH", label: "4-5 Sao", count: highRules.length },
          ];

          if (!uniqueRules.length) {
            return (
              <div className="border-t border-slate-100 bg-slate-50/50 p-12 text-center">
                <p className="text-sm font-semibold text-slate-700">Chưa có luật kết hợp</p>
                <p className="mt-1 text-sm text-slate-500">Sau khi chạy phân tích, các luật thỏa ngưỡng support và confidence sẽ xuất hiện tại đây.</p>
              </div>
            );
          }

          return (
            <div className="space-y-5 border-t border-slate-100 bg-slate-50/40 p-5">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <Filter size={14} />
                      Bộ lọc luật
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {ratingFilterOptions.map((option) => {
                        const active = ruleFilter === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setRuleFilter(option.id)}
                            className={classNames(
                              "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-sm font-semibold transition",
                              active && option.id === "ALL" && "border-slate-900 bg-slate-950 text-white shadow-sm",
                              active && option.id === "LOW" && "border-rose-300 bg-rose-50 text-rose-800 shadow-sm",
                              active && option.id === "HIGH" && "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm",
                              !active && "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span>{option.label}</span>
                            <span
                              className={classNames(
                                "rounded-full px-2 py-0.5 text-xs font-bold",
                                active && option.id === "ALL" && "bg-white/15 text-white",
                                active && option.id === "LOW" && "bg-white text-rose-700",
                                active && option.id === "HIGH" && "bg-white text-emerald-700",
                                !active && "bg-slate-100 text-slate-500"
                              )}
                            >
                              {option.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[540px]">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-500">Khía cạnh</span>
                      <select
                        id="aspectFilter"
                        value={aspectFilter}
                        onChange={(e) => setAspectFilter(e.target.value)}
                        className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="ALL">Tất cả khía cạnh</option>
                        {BASE_ASPECTS.map((aspect) => (
                          <option key={aspect.id} value={aspect.id}>
                            {aspect.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-500">Đánh giá</span>
                      <select
                        id="sentimentFilter"
                        value={sentimentFilter}
                        onChange={(e) => setSentimentFilter(e.target.value)}
                        className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="ALL">Tất cả Tốt/Xấu</option>
                        <option value="POS">▲ Tốt</option>
                        <option value="NEG">▼ Tệ</option>
                      </select>
                    </label>
                  </div>
                </div>

                {(selectedGraphNode || selectedGraphEdge) && (
                  <div className="mt-4 flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-blue-800">Đang lọc từ đồ thị: {selectedGraphFilterLabel}</p>
                    <button
                      onClick={() => { setSelectedGraphNode(null); setSelectedGraphEdge(null); }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-100"
                    >
                      <X size={13} />
                      Bỏ lọc đồ thị
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Danh sách luật</p>
                      <h3 className="text-base font-bold text-slate-950">{finalDisplayRules.length} luật phù hợp bộ lọc hiện tại</h3>
                    </div>
                    {finalDisplayRules.length > 30 && (
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Hiển thị 30 luật đầu tiên</span>
                    )}
                  </div>

                  <div className="max-h-[620px] space-y-3 overflow-y-auto p-4 custom-scrollbar">
                      {finalDisplayRules.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-12 text-center text-sm font-medium text-slate-400">
                          Không tìm thấy tổ hợp nào thỏa mãn điều kiện lọc.
                        </div>
                      ) : (
                        finalDisplayRules.slice(0, 30).map((rule, index) => {
                          const isLow = rule.rating_group === "LOW";

                          const renderItem = (item, idx) => {
                            const sentiment = typeof item === 'object' ? item.sentiment : "";
                            const isPos = sentiment === 'POS';
                            const isNeg = sentiment === 'NEG';
                            const itemKey = typeof item === 'string' ? item : (item.key || "");
                            const combinedItemStr = sentiment ? `${itemKey}_${sentiment}` : itemKey;

                            let isHighlighted = false;
                            if (aspectFilter !== "ALL" && sentimentFilter !== "ALL") {
                              isHighlighted = combinedItemStr === `${aspectFilter}_${sentimentFilter}` || itemKey === `${aspectFilter}_${sentimentFilter}`;
                            } else if (aspectFilter !== "ALL") {
                              isHighlighted = combinedItemStr.startsWith(aspectFilter);
                            } else if (sentimentFilter !== "ALL") {
                              isHighlighted = combinedItemStr.endsWith(`_${sentimentFilter}`) || sentiment === sentimentFilter;
                            }

                            const highlightClasses = isHighlighted ? "ring-2 ring-blue-500 shadow-md" : "border shadow-sm";
                            const toneClasses = isPos
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isNeg
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-slate-50 text-slate-700 border-slate-200";

                            return (
                              <span key={idx} className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-bold transition-all ${highlightClasses} ${toneClasses}`}>
                                {sentiment && (
                                  <span className={`text-[10px] ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPos ? '▲ TỐT' : '▼ TỆ'}
                                  </span>
                                )}
                                {getAspectName(item)}
                              </span>
                            );
                          };

                          return (
                            <div
                              key={index}
                              className={`rounded-lg border bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/40 hover:shadow-sm ${isLow ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500'}`}
                            >
                              <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-center whitespace-nowrap">
                                <div className="px-3 py-2">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Độ tin cậy</div>
                                  <div className="text-[15px] font-black text-slate-800">{(rule.confidence * 100).toFixed(0)}%</div>
                                </div>
                                <div className="border-l border-slate-200 px-3 py-2">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Độ phủ</div>
                                  <div className="text-[15px] font-black text-slate-800">{(rule.support * 100).toFixed(1)}%</div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Vế nguồn</p>
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    {rule.antecedents.map((item, idx) => renderItem(item, idx))}
                                  </div>
                                </div>

                                <div className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm">
                                    <ArrowRight size={19} strokeWidth={3} />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Vế đích</p>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                      {rule.consequents.map((item, idx) => renderItem(item, idx))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                </div>

                <AprioriNetworkGraph
                  rules={filteredRules}
                  getAspectName={getAspectName}
                  selectedNodeId={selectedGraphNode}
                  selectedEdge={selectedGraphEdge}
                  onNodeClick={(nodeId) => {
                    setSelectedGraphNode(nodeId);
                    setSelectedGraphEdge(null);
                  }}
                  onEdgeClick={(sourceId, targetId) => {
                    setSelectedGraphEdge([sourceId, targetId]);
                    setSelectedGraphNode(null);
                  }}
                  onBackgroundClick={() => {
                    setSelectedGraphNode(null);
                    setSelectedGraphEdge(null);
                  }}
                />
              </div>
            </div>
          );
        })()}
      </Panel >
    </div >
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("demo");
  const [forecastCache, setForecastCache] = useState({});

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        <AnimatePresence mode="wait">
          <motion.main
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "demo" && <DemoPage />}
            {activeTab === "calendar" && <CalendarPage forecastCache={forecastCache} setForecastCache={setForecastCache} />}
            {activeTab === "apriori" && <AprioriPage />}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
