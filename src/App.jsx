import { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Users,
  Settings,
  Plus,
  Trash2,
  Download,
  Printer,
  RefreshCw,
  Upload,
  Search,
  Edit3,
  Loader2,
  X,
  ChevronRight,
  Building2,
  User,
  Briefcase,
  Hash,
  Camera,
  Database,
  MapPin,
  ShieldCheck,
  Lock,
  Unlock
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import './index.css';

// Identity Colors
const PRIMARY_COLOR = '#68c5bc';
const SECONDARY_COLOR = '#3e87c6';
const GOLD_COLOR = '#d9aa38';
const GOLD_SECONDARY = '#bb8d1e';

// Card dimensions in mm (actual print size)
const CARD_WIDTH_MM = 60;
const CARD_HEIGHT_MM = 85.6;

// Convert mm to pixels (3.78 px/mm at 96 DPI)
const MM_TO_PX = 3.78;

// Photo at 90px = ~23.8mm, text stays at 54mm
const PHOTO_TOP_MM = 23.8;
const PHOTO_WIDTH_MM = 24;
const PHOTO_HEIGHT_MM = 28;
const TEXT_TOP_MM = 54;

// Crop mark color
const CROP_MARK_COLOR = '#9ca3af';

function App() {
  const [leftTab, setLeftTab] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    idCode: '',
    department: '',
    photo: null
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [flippedCards, setFlippedCards] = useState({});
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [pdfFilename, setPdfFilename] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [cardType, setCardType] = useState('REGULAR'); // 'REGULAR' or 'SAFETY'
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mainCardFlipped, setMainCardFlipped] = useState(false);
  const SAFETY_PASSWORD = 'admin245';

  const [csvUrl, setCsvUrl] = useState('');
  const [csvData, setCsvData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [printSpacing, setPrintSpacing] = useState({ gap: 10, offset: -5.5 });

  const [settings, setSettings] = useState({
    REGULAR: {
      companyName: 'IMPACT ID Card Generator',
      themeColor: PRIMARY_COLOR,
      secondaryColor: SECONDARY_COLOR,
      frontBackground: null,
      backBackground: null
    },
    SAFETY: {
      companyName: 'SAFETY PASSPORT',
      themeColor: GOLD_COLOR,
      secondaryColor: GOLD_SECONDARY,
      frontBackground: null,
      backBackground: null
    }
  });
  const currentSettings = settings[cardType] || settings.REGULAR;

  const printRef = useRef(null);
  const photoInputRef = useRef(null);
  const frontBgInputRef = useRef(null);
  const backBgInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const formatExcelDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel serial date to JS Date
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return String(val);
  };

  const getDefaultFilename = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `ID Card ${day}${month}${year}`;
  };

  useEffect(() => {
    const savedUrl = localStorage.getItem('csvUrl');
    if (savedUrl) setCsvUrl(savedUrl);
    const savedSettings = localStorage.getItem('cardSettingsV2');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          REGULAR: { ...prev.REGULAR, ...(parsed.REGULAR || {}) },
          SAFETY: { ...prev.SAFETY, ...(parsed.SAFETY || {}) }
        }));
      } catch (e) { console.error('Error loading settings:', e); }
    }
  }, []);

  useEffect(() => { localStorage.setItem('csvUrl', csvUrl); }, [csvUrl]);
  useEffect(() => { localStorage.setItem('cardSettingsV2', JSON.stringify(settings)); }, [settings]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const verifyPassword = () => {
    if (passwordInput === SAFETY_PASSWORD) {
      setIsLocked(false);
      setShowPasswordModal(false);
      setCardType('SAFETY');
      setPasswordInput('');
    } else {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const switchCardType = (type) => {
    if (type === 'SAFETY' && isLocked) {
      setShowPasswordModal(true);
    } else {
      setCardType(type);
      setCsvData([]); // Clear database when switching types to avoid mapping bugs
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, photo: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundUpload = (type) => (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSettings(prev => ({
        ...prev,
        [cardType]: { ...prev[cardType], [type]: reader.result }
      }));
      reader.readAsDataURL(file);
    }
  };

  const handleLocalFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const parsed = jsonData.slice(1).filter(row => row.length > 0).map(cols => {
        if (cardType === 'SAFETY') {
          return {
            id: Date.now() + Math.random(),
            safetyId: cols[1] || '',
            name: cols[2] || '',
            issueDate: formatExcelDate(cols[3] || ''),
            trainingModule: formatExcelDate(cols[4] || ''),
            backDetails: cols[5] || '',
            expiryDate: '28/02/2028',
            cardType: 'SAFETY'
          };
        }
        return {
          branchCode: cols[3] || '', branchName: cols[4] || '', employeeCode: cols[5] || '',
          firstName: cols[9] || '', lastName: cols[10] || '', position: 'พนักงาน',
          name: `${cols[9] || ''} ${cols[10] || ''}`.trim(),
          department: cols[4] ? `${cols[4]} (${cols[3]})` : '',
          hasPrinted: String(cols[14]).toUpperCase() === 'TRUE',
          cardType: 'REGULAR'
        };
      });
      setCsvData(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const addEmployee = () => {
    if (!formData.name.trim()) return;
    setEmployees(prev => [...prev, { ...formData, id: Date.now() }]);
    resetForm();
  };

  const updateEmployee = () => {
    if (editingIndex === null) return;
    setEmployees(prev => prev.map((emp, idx) => idx === editingIndex ? { ...formData, id: emp.id } : emp));
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', position: '', idCode: '', department: '', photo: null });
    setEditingIndex(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const editEmployee = (index) => {
    setFormData(employees[index]);
    setEditingIndex(index);
  };

  const deleteEmployee = (e, index) => {
    e.stopPropagation();
    setEmployees(prev => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) resetForm();
  };

  const clearAll = () => { setEmployees([]); resetForm(); };

  const toggleCardFlip = (index) => {
    setFlippedCards(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const fetchCsvData = async () => {
    if (!csvUrl) return;
    setIsLoadingCsv(true);
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
        if (cardType === 'SAFETY') {
          return {
            id: Date.now() + Math.random(),
            safetyId: cols[1] || '', // Column B
            name: cols[2] || '', // Column C
            issueDate: formatExcelDate(cols[3] || ''), // Column D
            trainingModule: formatExcelDate(cols[4] || ''), // Column E
            backDetails: cols[5] || '', // Column F
            expiryDate: '28/02/2028',
            cardType: 'SAFETY'
          };
        }
        return {
          branchCode: cols[3] || '', branchName: cols[4] || '', employeeCode: cols[5] || '',
          firstName: cols[9] || '', lastName: cols[10] || '', position: 'พนักงาน',
          name: `${cols[9] || ''} ${cols[10] || ''}`.trim(),
          department: cols[4] ? `${cols[4]} (${cols[3]})` : '',
          hasPrinted: String(cols[14]).toUpperCase() === 'TRUE',
          cardType: 'REGULAR'
        };
      });
      setCsvData(parsed);
    } catch (error) { console.error('Error fetching CSV:', error); }
    setIsLoadingCsv(false);
  };

  const filteredCsvData = searchTerm
    ? csvData.filter(item => {
      const search = searchTerm.toLowerCase();
      const n = (item.name || '').toLowerCase();
      const bc = (item.branchCode || '').toLowerCase();
      const bn = (item.branchName || '').toLowerCase();
      const si = (item.safetyId || '').toLowerCase();
      return n.includes(search) || bc.includes(search) || bn.includes(search) || si.includes(search);
    }) : csvData;

  const selectAllFromCsv = () => {
    const toAdd = filteredCsvData.filter(emp => !isEmployeeSelected(emp));
    if (toAdd.length === 0) return;

    // Use a small delay between IDs to ensure uniqueness if needed, but random is enough
    const newEmployees = toAdd.map((emp, idx) => {
      const id = Date.now() + Math.random() + idx;
      if (cardType === 'SAFETY' || emp.cardType === 'SAFETY') {
        return { ...emp, id, photo: null };
      } else {
        return {
          id,
          name: emp.name,
          position: emp.position,
          idCode: emp.employeeCode,
          department: emp.department,
          photo: null,
          cardType: 'REGULAR'
        };
      }
    });

    setEmployees(prev => [...prev, ...newEmployees]);
  };

  useEffect(() => {
    if (filteredCsvData.length > 0) {
      const firstBranch = filteredCsvData[0];
      if (firstBranch.branchCode && firstBranch.branchName) {
        setSelectedBranch({ code: firstBranch.branchCode, name: firstBranch.branchName });
      } else {
        setSelectedBranch(null);
      }
    } else {
      setSelectedBranch(null);
    }
  }, [searchTerm, csvData]);

  const isEmployeeSelected = (emp) => employees.some(e => e.name === emp.name && e.idCode === emp.employeeCode);

  const addFromCsv = (emp) => {
    if (isEmployeeSelected(emp)) return;
    let newEmp;
    if (cardType === 'SAFETY') {
      newEmp = { ...emp, id: Date.now(), photo: null };
    } else {
      newEmp = { id: Date.now(), name: emp.name, position: emp.position, idCode: emp.employeeCode, department: emp.department, photo: null, cardType: 'REGULAR' };
    }
    setEmployees(prev => [...prev, newEmp]);
    setFormData(newEmp); // Populate form with the selected employee
  };

  const handleDownloadClick = () => { setPdfFilename(getDefaultFilename()); setShowFilenameModal(true); };

  const generatePdf = async () => {
    if (employees.length === 0) return;
    setShowFilenameModal(false);
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const printArea = printRef.current;
      if (!printArea) { setIsGeneratingPdf(false); return; }
      const pages = printArea.querySelectorAll('.print-page');
      if (pages.length === 0) { setIsGeneratingPdf(false); return; }
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i], { scale: 4, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0 });
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, 297, 210);
      }
      pdf.save(`${pdfFilename.trim() || getDefaultFilename()}.pdf`);
    } catch (error) { console.error('Error generating PDF:', error); }
    setIsGeneratingPdf(false);
  };

  const handlePrint = (mode = 'normal') => {
    if (mode === 'tight') {
      setPrintSpacing({ gap: 2, offset: -1.5 });
    } else {
      setPrintSpacing({ gap: 10, offset: -5.5 });
    }

    setTimeout(() => {
      const printContent = printRef.current;
      if (!printContent) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(`<!DOCTYPE html><html><head><title>ID Cards Print</title><style>@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@100;300;400;500;600;700&display=swap');*{font-family:'Kanit',sans-serif;box-sizing:border-box;margin:0;padding:0}@page{size:A4 landscape;margin:0}body{margin:0;padding:0}.print-page{page-break-after:always}img{max-width:100%}</style></head><body>${printContent.innerHTML}</body></html>`);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 1000);
    }, 100);
  };

  // Styles
  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
  };

  const inputStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    color: '#1f2937',
    borderRadius: '10px'
  };

  const buttonPrimary = {
    background: `linear-gradient(135deg, ${currentSettings.themeColor}, ${currentSettings.secondaryColor})`,
    color: '#ffffff',
    border: 'none',
    boxShadow: `0 4px 15px ${currentSettings.themeColor}40`
  };

  const buttonSecondary = {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    color: '#374151',
    border: '1px solid rgba(0, 0, 0, 0.1)'
  };

  const buttonDanger = {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
  };

  // Render Safety Card
  const renderSafetyCard = (data, options = {}) => {
    const { forPrint = false, scale = 1, showEditBorder = false, onClick = null, isFlipped = false } = options;
    const s = settings.SAFETY;
    const widthPx = forPrint ? `${CARD_WIDTH_MM}mm` : `${CARD_WIDTH_MM * MM_TO_PX * scale}px`;
    const heightPx = forPrint ? `${CARD_HEIGHT_MM}mm` : `${CARD_HEIGHT_MM * MM_TO_PX * scale}px`;

    const cardContent = (
      <div style={{
        width: widthPx, height: heightPx,
        transition: forPrint ? 'none' : 'transform 0.6s',
        transformStyle: forPrint ? 'flat' : 'preserve-3d',
        transform: isFlipped && !forPrint ? 'rotateY(180deg)' : 'rotateY(0deg)'
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: forPrint ? 'visible' : 'hidden',
          backgroundColor: '#ffffff',
          backgroundImage: s.frontBackground ? `url(${s.frontBackground})` : (s.frontBackground === undefined ? undefined : 'none'),
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: forPrint ? '0' : '10px',
          boxShadow: forPrint ? 'none' : '0 8px 32px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          background: s.frontBackground ? `url(${s.frontBackground}) center/cover no-repeat` : 'linear-gradient(to bottom, #d9aa38 0%, #ffffff 40%, #ffffff 60%, #465b73 60%, #465b73 65%, #ffffff 65%)'
        }}>
          {/* CP Logo and SAFETY PASSPORT */}
          {!s.frontBackground && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#00a651', fontSize: `${30 * scale}px`, fontWeight: 'bold', lineHeight: '1' }}>CP</div>
              <div style={{ marginLeft: `${10 * scale}px` }}>
                <div style={{ color: '#000', fontSize: `${14 * scale}px`, fontWeight: 'bold', lineHeight: '1' }}>SAFETY</div>
                <div style={{ color: '#000', fontSize: `${14 * scale}px`, fontWeight: 'bold', lineHeight: '1' }}>PASSPORT</div>
              </div>
            </div>
          )}

          {/* Photo at Top 58px, Size 90x105 */}
          <div style={{
            position: 'absolute', top: `${58 * scale}px`, left: '50%', transform: 'translateX(-50%)',
            width: `${90 * scale}px`, height: `${105 * scale}px`,
            border: `${2 * scale}px solid #ffffff`, borderRadius: `${8 * scale}px`, overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backgroundColor: '#f3f4f6', marginBottom: 0
          }}>
            {data.photo ? (
              <img src={data.photo} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={Math.round(40 * scale)} color="#9ca3af" />
              </div>
            )}
          </div>

          {/* ID Code at Top 170px */}
          <div style={{ position: 'absolute', top: `${170 * scale}px`, width: '100%', textAlign: 'center' }}>
            <p style={{ color: '#000', fontSize: `${14 * scale}px`, fontWeight: '300', marginBottom: 0 }}>{data.safetyId || 'CPAXT2311-1000-000001'}</p>
            <p style={{ color: '#000', fontSize: `${14 * scale}px`, fontWeight: '500' }}>{data.name || 'ชื่อ-นามสกุล'}</p>
          </div>

          {/* Dates at Top 218px */}
          <div style={{ position: 'absolute', top: `${218 * scale}px`, left: `${10 * scale}px`, right: `${10 * scale}px`, display: 'flex', justifyContent: 'space-between', marginBottom: 0 }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: `${10 * scale}px`, fontWeight: 'bold', margin: `0 ${6 * scale}px 0 ${6 * scale}px` }}>วันออกบัตร</p>
              <p style={{ fontSize: `${10 * scale}px`, margin: `0 ${6 * scale}px 0 ${6 * scale}px` }}>{data.issueDate || '01/01/2024'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: `${10 * scale}px`, fontWeight: 'bold', margin: `0 ${6 * scale}px 0 0` }}>วันหมดอายุ</p>
              <p style={{ fontSize: `${10 * scale}px`, margin: `0 ${6 * scale}px 0 0` }}>28/02/2028</p>
            </div>
          </div>

          <div style={{ position: 'absolute', top: `${261 * scale}px`, left: `${3 * scale}px`, right: `${3 * scale}px`, bottom: `${10 * scale}px`, borderRadius: `${5 * scale}px`, padding: `${4 * scale}px` }}>
            <div style={{ width: `${50 * scale}px`, height: `${32 * scale}px`, backgroundColor: '#a3ff4d', borderRadius: `${4 * scale}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: `${16 * scale}px`, fontWeight: 'bold', lineHeight: '1' }}>G</div>
              <div style={{ fontSize: `${8 * scale}px`, fontWeight: '400' }}>{data.trainingModule || '01/03/25'}</div>
            </div>
          </div>
        </div>

        {/* Back */}
        {!forPrint && (
          <div style={{
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)', backgroundColor: '#ffffff',
            backgroundImage: s.backBackground ? `url(${s.backBackground})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
          }}>
            <div style={{ marginLeft: 0, marginBottom: `${44 * scale}px`, fontSize: `${10 * scale}px`, color: '#000', textAlign: 'left' }}>
              {data.backDetails || 'ข้อมูลด้านหลังบัตร'}
            </div>
          </div>
        )}
      </div>
    );

    return (
      <div onClick={onClick} style={{ perspective: forPrint ? 'none' : '1000px', cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
        {cardContent}
      </div>
    );
  };

  // Render card - uses mm-based dimensions, matching print exactly
  const renderCard = (data, options = {}) => {
    const cType = data.cardType || cardType;
    if (cType === 'SAFETY') return renderSafetyCard(data, options);
    const { forPrint = false, scale = 1, showEditBorder = false, onClick = null, isFlipped = false } = options;
    const s = settings.REGULAR;

    // For preview: use same proportions as print
    const widthPx = forPrint ? `${CARD_WIDTH_MM}mm` : `${CARD_WIDTH_MM * MM_TO_PX * scale}px`;
    const heightPx = forPrint ? `${CARD_HEIGHT_MM}mm` : `${CARD_HEIGHT_MM * MM_TO_PX * scale}px`;
    const photoTopPx = forPrint ? `${PHOTO_TOP_MM}mm` : `${PHOTO_TOP_MM * MM_TO_PX * scale}px`;
    const photoWidthPx = forPrint ? `${PHOTO_WIDTH_MM}mm` : `${PHOTO_WIDTH_MM * MM_TO_PX * scale}px`;
    const photoHeightPx = forPrint ? `${PHOTO_HEIGHT_MM}mm` : `${PHOTO_HEIGHT_MM * MM_TO_PX * scale}px`;
    const textTopPx = forPrint ? `${TEXT_TOP_MM}mm` : `${TEXT_TOP_MM * MM_TO_PX * scale}px`;

    // Font sizes - match print sizes
    const nameFontSize = forPrint ? '15px' : `${15 * scale}px`;
    const positionFontSize = forPrint ? '12px' : `${12 * scale}px`;
    const detailFontSize = forPrint ? '10px' : `${10 * scale}px`;
    const userIconSize = forPrint ? 24 : Math.round(24 * scale);

    const cardContent = (
      <div style={{
        width: widthPx, height: heightPx,
        transition: forPrint ? 'none' : 'transform 0.6s',
        transformStyle: forPrint ? 'flat' : 'preserve-3d',
        transform: isFlipped && !forPrint ? 'rotateY(180deg)' : 'rotateY(0deg)'
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: forPrint ? 'visible' : 'hidden',
          backgroundColor: '#ffffff',
          backgroundImage: s.frontBackground ? `url(${s.frontBackground})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: forPrint ? '0' : '10px',
          boxShadow: forPrint ? 'none' : '0 8px 32px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: photoTopPx, left: '50%', transform: 'translateX(-50%)',
            width: photoWidthPx, height: photoHeightPx,
            border: forPrint ? '2px solid #ffffff' : '3px solid #ffffff',
            borderRadius: forPrint ? '6px' : '8px',
            overflow: 'hidden',
            boxShadow: forPrint ? '0 2px 8px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.2)',
            backgroundColor: '#f3f4f6'
          }}>
            {data.photo ? (
              <img src={data.photo} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={userIconSize} color="#9ca3af" />
              </div>
            )}
          </div>
          <div style={{
            position: 'absolute', top: textTopPx,
            left: forPrint ? '3mm' : '10px',
            right: forPrint ? '3mm' : '10px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#000000', fontSize: nameFontSize, fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: forPrint ? '2px' : '3px' }}>
              {data.name || 'ชื่อ-นามสกุล'}
            </p>
            <p style={{ color: '#374151', fontSize: positionFontSize, fontWeight: '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: forPrint ? '4px' : '6px' }}>
              {data.position || 'ตำแหน่ง'}
            </p>
            <p style={{ fontSize: detailFontSize, marginBottom: forPrint ? '2px' : '3px' }}>
              <span style={{ color: '#000000', fontWeight: '600' }}>รหัสพนักงาน : </span>
              <span style={{ color: '#374151', fontWeight: '400' }}>{data.idCode || 'xxxxxxx'}</span>
            </p>
            <p style={{ fontSize: detailFontSize }}>
              <span style={{ color: '#000000', fontWeight: '600' }}>ประจำสาขา : </span>
              <span style={{ color: '#374151', fontWeight: '400' }}>{data.department || 'xxxxxxxx'}</span>
            </p>
          </div>
        </div>
        {/* Back */}
        {!forPrint && (
          <div style={{
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)', backgroundColor: s.themeColor,
            backgroundImage: s.backBackground ? `url(${s.backBackground})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }} />
        )}
      </div>
    );

    return (
      <div onClick={onClick} style={{
        perspective: forPrint ? 'none' : '1000px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}>
        {showEditBorder && !forPrint && (
          <div style={{
            position: 'absolute', top: '-6px', left: '-6px', right: '-6px', bottom: '-6px',
            border: `3px solid ${currentSettings.themeColor}`, borderRadius: '14px', zIndex: 10, pointerEvents: 'none',
            boxShadow: `0 0 20px ${currentSettings.themeColor}50`
          }}>
            <div style={{
              position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
              background: `linear-gradient(135deg, ${currentSettings.themeColor}, ${currentSettings.secondaryColor})`,
              color: '#ffffff', fontSize: '11px', padding: '3px 12px', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: '500'
            }}>กำลังแก้ไข</div>
          </div>
        )}
        {cardContent}
      </div>
    );
  };

  const renderAllCardsPreview = () => {
    if (employees.length === 0) {
      return (
        <div className="text-center p-8" style={{ color: '#9ca3af' }}>
          <CreditCard size={80} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">ยังไม่มีรายการบัตร</p>
          <p className="text-sm mt-2 opacity-70">เพิ่มพนักงานจากแบบฟอร์มด้านล่าง</p>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-6 justify-center p-6">
        {employees.map((emp, index) => (
          <div key={emp.id} className="text-center">
            {renderCard(editingIndex === index ? { ...emp, ...formData } : emp, {
              scale: 1,
              isFlipped: flippedCards[index] || false,
              onClick: () => toggleCardFlip(index),
              showEditBorder: editingIndex === index
            })}
            <p className="mt-3 text-xs" style={{ color: '#9ca3af' }}>คลิกเพื่อพลิกบัตร</p>
          </div>
        ))}
      </div>
    );
  };

  const renderCardFrame = () => (
    <div style={{
      position: 'absolute',
      top: `${printSpacing.offset}px`, left: `${printSpacing.offset}px`, right: `${printSpacing.offset}px`, bottom: `${printSpacing.offset}px`,
      border: '0.05mm solid #ddd',
      pointerEvents: 'none',
      zIndex: 5
    }} />
  );

  const renderPrintBackCard = (emp) => {
    const cType = emp.cardType || cardType;
    const s = settings[cType];

    // For Safety Passport, include the back details correctly for print
    if (cType === 'SAFETY') {
      const backScale = 1; // 1:1 for print
      return (
        <div style={{
          width: `${CARD_WIDTH_MM}mm`, height: `${CARD_HEIGHT_MM}mm`, backgroundColor: '#ffffff',
          backgroundImage: s.backBackground ? `url(${s.backBackground})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: 0,
          padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ marginLeft: 0, marginBottom: `${44 * backScale}px`, fontSize: `${10 * backScale}px`, color: '#000', textAlign: 'left' }}>
            {emp.backDetails || 'ข้อมูลด้านหลังบัตร'}
          </div>
        </div>
      );
    }

    return (
      <div style={{
        width: `${CARD_WIDTH_MM}mm`, height: `${CARD_HEIGHT_MM}mm`, backgroundColor: s.themeColor,
        backgroundImage: s.backBackground ? `url(${s.backBackground})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
    );
  };

  const renderPrintableCards = () => {
    const itemsPerPage = 4;
    const pages = [];
    for (let i = 0; i < employees.length; i += itemsPerPage) pages.push(employees.slice(i, i + itemsPerPage));

    return (
      <div ref={printRef} className="print-area" style={{ position: 'absolute', left: '0', top: '0' }}>
        {pages.map((pageEmployees, pageIndex) => (
          <div key={pageIndex} className="print-page" style={{
            width: '297mm', height: '210mm', backgroundColor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pageBreakAfter: 'always', position: 'relative'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: `${printSpacing.gap}px` }}>
              {[0, 2, 1, 3].map((orderIndex) => {
                const emp = pageEmployees[orderIndex];
                if (!emp) return <div key={orderIndex} style={{ gridColumn: orderIndex < 2 ? 1 : 2, gridRow: orderIndex % 2 === 0 ? 1 : 2 }} />;
                return (
                  <div key={emp.id} style={{ gridColumn: orderIndex < 2 ? 1 : 2, gridRow: orderIndex % 2 === 0 ? 1 : 2, position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      {renderCardFrame()}
                      <div style={{ display: 'flex', gap: '0' }}>
                        {renderCard(emp, { forPrint: true })}
                        {renderPrintBackCard(emp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Left sidebar - Database tab (full height extending to bottom)
  const renderDatabaseTab = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex gap-2 mb-3">
        <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)}
          className="flex-1 px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="Google Sheet CSV URL..." />
        <button onClick={fetchCsvData} disabled={isLoadingCsv}
          className="px-3 py-2 rounded-xl transition-all hover:brightness-105" style={buttonPrimary}>
          {isLoadingCsv ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleLocalFileUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 px-3 rounded-xl text-sm transition-all hover:brightness-105 flex items-center justify-center gap-2"
          style={buttonSecondary}>
          <Upload size={14} /> อัพโหลดไฟล์ CSV/Excel
        </button>
      </div>
      <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 text-sm focus:outline-none mb-2" style={inputStyle} placeholder="ค้นหาสาขา..." />

      {selectedBranch && searchTerm && (
        <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ backgroundColor: `${currentSettings.themeColor}20`, border: `1px solid ${currentSettings.themeColor}40` }}>
          <MapPin size={14} style={{ color: currentSettings.themeColor }} />
          <span className="text-sm font-medium" style={{ color: '#1f2937' }}>{selectedBranch.name}</span>
          <span className="text-xs" style={{ color: '#6b7280' }}>({selectedBranch.code})</span>
        </div>
      )}

      <div className="flex-1 rounded-xl overflow-hidden flex flex-col" style={glassStyle}>
        <div className="p-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          <span className="text-xs font-bold" style={{ color: '#6b7280' }}>
            {filteredCsvData.length} รายการ
          </span>
          {filteredCsvData.length > 0 && (
            <button onClick={selectAllFromCsv}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all hover:bg-black/5"
              style={{ color: currentSettings.themeColor, border: `1px solid ${currentSettings.themeColor}40` }}>
              เลือกทั้งหมด
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredCsvData.length === 0 ? (
            <div className="p-6 text-center h-full flex items-center justify-center" style={{ color: '#9ca3af' }}>ไม่พบข้อมูล</div>
          ) : (
            filteredCsvData.map((emp, index) => {
              const isSelected = isEmployeeSelected(emp);
              return (
                <div key={index} onClick={() => !isSelected && addFromCsv(emp)}
                  className={`p-3 border-b transition-all ${isSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-black/5'}`}
                  style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <p style={{ color: '#1f2937', fontWeight: '500', fontSize: '13px' }}>{emp.name}</p>
                    {emp.hasPrinted && <ShieldCheck size={14} className="text-green-500" title="เคยทำบัตรแล้ว" />}
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '11px' }}>{(emp.position || emp.safetyId || 'N/A')} • {(emp.employeeCode || emp.department || 'ID')}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-4 p-4">
      <div className="px-3 py-2 rounded-xl mb-2 flex items-center gap-2" style={{ backgroundColor: `${currentSettings.themeColor}15`, border: `1px solid ${currentSettings.themeColor}30` }}>
        {cardType === 'SAFETY' ? <ShieldCheck size={16} style={{ color: currentSettings.themeColor }} /> : <CreditCard size={16} style={{ color: currentSettings.themeColor }} />}
        <span className="text-sm font-bold" style={{ color: '#1f2937' }}>ตั้งค่า: {cardType === 'SAFETY' ? 'SAFETY PASSPORT' : 'บัตรพนักงาน'}</span>
      </div>
      <div>
        <label className="block text-xs mb-1 font-medium" style={{ color: '#6b7280' }}>ชื่อบริษัท</label>
        <input type="text" value={currentSettings.companyName} onChange={(e) => setSettings(prev => ({ ...prev, [cardType]: { ...prev[cardType], companyName: e.target.value } }))}
          className="w-full px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1 font-medium" style={{ color: '#6b7280' }}>สีธีม</label>
        <div className="flex items-center gap-2">
          <input type="color" value={currentSettings.themeColor} onChange={(e) => setSettings(prev => ({ ...prev, [cardType]: { ...prev[cardType], themeColor: e.target.value } }))}
            className="w-10 h-10 rounded-lg cursor-pointer" style={{ border: '1px solid rgba(0,0,0,0.1)' }} />
          <span className="text-sm" style={{ color: '#6b7280' }}>{currentSettings.themeColor}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: '#6b7280' }}>พื้นหลังหน้า</label>
          <div className="relative">
            <input ref={frontBgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload('frontBackground')} className="hidden" />
            <button onClick={() => frontBgInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-xl text-sm transition-all hover:brightness-105 flex items-center justify-center gap-2"
              style={buttonSecondary}>
              <Upload size={14} /> {currentSettings.frontBackground ? 'เปลี่ยน' : 'เลือก'}
            </button>
            {currentSettings.frontBackground && (
              <button onClick={() => setSettings(prev => ({ ...prev, [cardType]: { ...prev[cardType], frontBackground: null } }))}
                className="absolute -top-2 -right-2 p-1 rounded-full" style={{ backgroundColor: '#ef4444' }}>
                <X size={10} color="#fff" />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: '#6b7280' }}>พื้นหลังหลัง</label>
          <div className="relative">
            <input ref={backBgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload('backBackground')} className="hidden" />
            <button onClick={() => backBgInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-xl text-sm transition-all hover:brightness-105 flex items-center justify-center gap-2"
              style={buttonSecondary}>
              <Upload size={14} /> {currentSettings.backBackground ? 'เปลี่ยน' : 'เลือก'}
            </button>
            {currentSettings.backBackground && (
              <button onClick={() => setSettings(prev => ({ ...prev, [cardType]: { ...prev[cardType], backBackground: null } }))}
                className="absolute -top-2 -right-2 p-1 rounded-full" style={{ backgroundColor: '#ef4444' }}>
                <X size={10} color="#fff" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const leftTabs = [
    { icon: Database, label: 'ฐานข้อมูล', content: renderDatabaseTab },
    { icon: Settings, label: 'ตั้งค่า', content: renderSettingsTab }
  ];

  // Bottom panel - Create/Edit form with card preview on left
  const renderCreateForm = () => {
    return (
      <div className="flex flex-col sm:flex-row gap-6 w-full p-2 h-full">
        {/* Photo upload - Left Side */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={18} style={{ color: currentSettings.themeColor }} />
            <span className="font-semibold" style={{ color: '#1f2937' }}>Picture</span>
          </div>
          <div onClick={() => photoInputRef.current?.click()}
            className="cursor-pointer relative overflow-hidden transition-all hover:brightness-95"
            style={{ width: '90px', height: '110px', ...glassStyle, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {formData.photo ? (
              <>
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, photo: null })); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                  className="absolute top-1 right-1 p-1 rounded-full shadow-lg" style={{ backgroundColor: '#ef4444' }}>
                  <X size={10} color="#ffffff" />
                </button>
              </>
            ) : (
              <div className="text-center">
                <Camera size={24} color="#9ca3af" />
                <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>รูปภาพ</p>
              </div>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </div>

        {/* Form Fields - 2 Column Grid */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Edit3 size={18} style={{ color: currentSettings.themeColor }} />
            <span className="font-semibold" style={{ color: '#1f2937' }}>Edit Data</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {cardType === 'SAFETY' ? (
              <>
                <div className="space-y-2">
                  <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="ชื่อ-นามสกุล" />
                  <input type="text" name="safetyId" value={formData.safetyId || ''} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="รหัสบัตร" />
                  <input type="text" name="issueDate" value={formData.issueDate || ''} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="วันออกบัตร" />
                </div>
                <div className="space-y-2">
                  <input type="text" name="trainingModule" value={formData.trainingModule || ''} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="Module (G)" />
                  <textarea name="backDetails" value={formData.backDetails || ''} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none h-[78px] resize-none" style={inputStyle} placeholder="ข้อมูลหลังบัตร" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="ชื่อ-นามสกุล" />
                  <input type="text" name="position" value={formData.position} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="ตำแหน่ง" />
                </div>
                <div className="space-y-2">
                  <input type="text" name="idCode" value={formData.idCode} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="รหัสพนักงาน" />
                  <input type="text" name="department" value={formData.department} onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} placeholder="สาขา" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {editingIndex === null ? (
              <button onClick={addEmployee} className="flex-1 py-2 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-105" style={buttonPrimary}>
                <Plus size={16} /> บันทึกข้อมูล
              </button>
            ) : (
              <>
                <button onClick={updateEmployee} className="flex-1 py-2 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#ffffff', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)' }}>
                  <Edit3 size={16} /> อัปเดตรายการ
                </button>
                <button onClick={resetForm} className="px-6 py-2 rounded-xl font-bold text-sm transition-all hover:brightness-105" style={buttonSecondary}>ตัวเลือกอื่น</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSelectedList = () => (
    <div className="h-full overflow-y-auto">
      {employees.length === 0 ? (
        <div className="text-center py-8" style={{ color: '#9ca3af' }}><p className="text-sm">ยังไม่มีรายการ</p></div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp, index) => {
            const isEditing = editingIndex === index;
            return (
              <div key={emp.id} onClick={() => editEmployee(index)}
                className="p-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2"
                style={{
                  ...glassStyle,
                  backgroundColor: isEditing ? `${currentSettings.themeColor}20` : 'rgba(255,255,255,0.5)',
                  border: isEditing ? `2px solid ${currentSettings.themeColor}` : '1px solid rgba(0,0,0,0.05)'
                }}>
                <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                  {emp.photo ? (
                    <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><User size={16} color="#9ca3af" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm" style={{ color: '#1f2937' }}>{emp.name || 'ไม่ระบุชื่อ'}</p>
                  <p className="truncate text-xs" style={{ color: '#6b7280' }}>{emp.position || 'ไม่ระบุตำแหน่ง'}</p>
                </div>
                {isEditing && (
                  <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${currentSettings.themeColor}, ${currentSettings.secondaryColor})`, color: '#ffffff' }}>แก้ไข</span>
                )}
                <button onClick={(e) => deleteEmployee(e, index)} className="p-1.5 rounded-lg transition-all flex-shrink-0 hover:brightness-105" style={buttonDanger}>
                  <Trash2 size={14} color="#ffffff" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 50%, #e0f2fe 100%)' }}>
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 flex items-center justify-between" style={{ ...glassStyle, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ ...buttonPrimary }}>
            <CreditCard size={22} color="#ffffff" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1f2937' }}>IMPACT ID Card Generator</h1>
        </div>
        <div className="flex bg-black/5 p-1 rounded-xl gap-1">
          <button onClick={() => switchCardType('REGULAR')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${cardType === 'REGULAR' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            style={{ color: cardType === 'REGULAR' ? settings.REGULAR.themeColor : undefined }}>
            <div className="flex items-center gap-2"><CreditCard size={16} /> บัตรพนักงาน</div>
          </button>
          <button onClick={() => switchCardType('SAFETY')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${cardType === 'SAFETY' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            style={{ color: cardType === 'SAFETY' ? settings.SAFETY.themeColor : undefined }}>
            <div className="flex items-center gap-2"><ShieldCheck size={16} /> SAFETY PASSPORT</div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handlePrint('normal')} disabled={employees.length === 0}
            className="px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={buttonPrimary}><Printer size={16} /> พิมพ์เว้นขอบขาว</button>
          <button onClick={() => handlePrint('tight')} disabled={employees.length === 0}
            className="px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={buttonPrimary}><Printer size={16} /> พิมพ์</button>
          <button onClick={clearAll} disabled={employees.length === 0}
            className="px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={buttonSecondary}><Trash2 size={16} /> ล้าง</button>
        </div>
      </header>

      {/* Main Layout with full-height sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - extends to bottom */}
        <aside className="w-72 flex-shrink-0 flex flex-col absolute top-0 bottom-0 left-0 z-10"
          style={{ ...glassStyle, borderRadius: 0, borderLeft: 'none', borderTop: 'none' }}>
          <div className="flex" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            {leftTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = leftTab === index;
              return (
                <button key={index} onClick={() => setLeftTab(index)}
                  className="flex-1 py-3 px-2 flex items-center justify-center gap-2 transition-all text-sm font-medium"
                  style={{
                    color: isActive ? currentSettings.themeColor : '#6b7280',
                    backgroundColor: isActive ? `${currentSettings.themeColor}15` : 'transparent',
                    borderBottom: isActive ? `2px solid ${currentSettings.themeColor}` : '2px solid transparent'
                  }}>
                  <Icon size={16} /><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-hidden">{leftTabs[leftTab].content()}</div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col ml-72">
          {/* Preview Area */}
          <main className="flex-1 overflow-auto p-6">
            <div className="h-full flex items-start justify-center">{renderAllCardsPreview()}</div>
          </main>

          {/* Bottom Panel - fixed height to allow internal scrollbars */}
          <div className="flex-shrink-0 flex" style={{ height: '35vh', ...glassStyle, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
            <div className="flex-1 flex items-start p-4" style={{ borderRight: '1px solid rgba(0,0,0,0.05)' }}>
              {renderCreateForm()}
            </div>
            <div className="w-80 flex flex-col p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} style={{ color: currentSettings.themeColor }} />
                <span className="font-semibold" style={{ color: '#1f2937' }}>รายการที่เลือก ({employees.length})</span>
              </div>
              {renderSelectedList()}
            </div>
          </div>
        </div>
      </div>

      {/* Filename Modal */}
      {showFilenameModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-96" style={{ ...glassStyle, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <h3 className="font-semibold mb-4 text-lg" style={{ color: '#1f2937' }}>ตั้งชื่อไฟล์ PDF</h3>
            <input type="text" value={pdfFilename} onChange={(e) => setPdfFilename(e.target.value)}
              className="w-full px-4 py-3 rounded-xl mb-4 focus:outline-none" style={inputStyle} placeholder="ชื่อไฟล์..." autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowFilenameModal(false)} className="flex-1 py-2.5 px-4 rounded-xl font-medium transition-all hover:brightness-105" style={buttonSecondary}>ยกเลิก</button>
              <button onClick={generatePdf} className="flex-1 py-2.5 px-4 rounded-xl font-medium transition-all hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#ffffff' }}>ดาวน์โหลด</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl p-6 w-96 text-center" style={{ ...glassStyle, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={30} className="text-red-500" />
            </div>
            <h3 className="font-semibold mb-2 text-lg" style={{ color: '#1f2937' }}>ACCESS RESTRICTED</h3>
            <p className="text-sm text-gray-500 mb-6">กรุณาใส่รหัสผ่านเพื่อเข้าถึงโหมด SAFETY PASSPORT</p>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
              className="w-full px-4 py-3 rounded-xl mb-4 text-center focus:outline-none text-lg tracking-widest" style={inputStyle} placeholder="••••••••" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 px-4 rounded-xl font-medium transition-all hover:brightness-105" style={buttonSecondary}>ยกเลิก</button>
              <button onClick={verifyPassword} className="flex-1 py-2.5 px-4 rounded-xl font-medium transition-all hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#ffffff' }}>เข้าสู่ระบบ</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>{renderPrintableCards()}</div>
    </div>
  );
}

export default App;
