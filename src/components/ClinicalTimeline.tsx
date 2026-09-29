import React, { useState, useRef } from 'react';
import { MedicalEvent, EventType, MedicalFile } from '../types';
import { safeFormatDate } from '../utils/dateHelper';
import { 
  Search, 
  Calendar, 
  User, 
  Plus, 
  Filter, 
  Upload, 
  FileText, 
  X, 
  Eye, 
  TrendingUp, 
  Clock,
  ArrowUpDown,
  Download,
  Building2,
  Trash2,
  Edit,
  Check,
  Sparkles
} from 'lucide-react';

interface ClinicalTimelineProps {
  events: MedicalEvent[];
  onAddEvent: (newEvent: MedicalEvent) => void;
  onUpdateEvent: (updatedEvent: MedicalEvent) => void;
  onDeleteEvent: (id: string) => void;
  onOpenPdfParser?: () => void;
}

export default function ClinicalTimeline({ events, onAddEvent, onUpdateEvent, onDeleteEvent, onOpenPdfParser }: ClinicalTimelineProps) {
  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<EventType | 'Todos'>('Todos');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAddForm, setShowAddForm] = useState(false);

  // Estados para modal de previsualización de imágenes/documentos
  const [previewFile, setPreviewFile] = useState<MedicalFile | null>(null);

  // Estado para expandir filas de la tabla clínica
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Estados para edición de un evento existente
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<EventType>('Estudio');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProfessional, setEditProfessional] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFiles, setEditFiles] = useState<MedicalFile[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Estados para valores de laboratorio (Edición)
  const [editLabWbc, setEditLabWbc] = useState('');
  const [editLabNeutrophils, setEditLabNeutrophils] = useState('');
  const [editLabHemoglobin, setEditLabHemoglobin] = useState('');
  const [editLabPlatelets, setEditLabPlatelets] = useState('');
  const [editLabCea, setEditLabCea] = useState('');
  const [editLabCreatinine, setEditLabCreatinine] = useState('');
  const [editLabAltGpt, setEditLabAltGpt] = useState('');
  const [editLabAstGot, setEditLabAstGot] = useState('');

  // Estado para confirmación de eliminación segura sin confirm() bloqueados por iframes
  const [deleteConfirmEventId, setDeleteConfirmEventId] = useState<string | null>(null);

  const startEditingEvent = (event: MedicalEvent) => {
    setEditingEventId(event.id);
    setEditDate(event.date);
    setEditType(event.type);
    setEditTitle(event.title);
    setEditDescription(event.description);
    setEditProfessional(event.professional);
    setEditInstitution(event.institution || '');
    setEditNotes(event.notes || '');
    setEditFiles(event.files || []);
    setDeleteConfirmEventId(null); // Cancelar confirmación de eliminación si estuviera activa

    if (event.labResults) {
      setEditLabWbc(event.labResults.wbc !== undefined ? event.labResults.wbc.toString() : '');
      setEditLabNeutrophils(event.labResults.neutrophils !== undefined ? event.labResults.neutrophils.toString() : '');
      setEditLabHemoglobin(event.labResults.hemoglobin !== undefined ? event.labResults.hemoglobin.toString() : '');
      setEditLabPlatelets(event.labResults.platelets !== undefined ? event.labResults.platelets.toString() : '');
      setEditLabCea(event.labResults.cea !== undefined ? event.labResults.cea.toString() : '');
      setEditLabCreatinine(event.labResults.creatinine !== undefined ? event.labResults.creatinine.toString() : '');
      setEditLabAltGpt(event.labResults.alt_gpt !== undefined ? event.labResults.alt_gpt.toString() : '');
      setEditLabAstGot(event.labResults.ast_got !== undefined ? event.labResults.ast_got.toString() : '');
    } else {
      setEditLabWbc('');
      setEditLabNeutrophils('');
      setEditLabHemoglobin('');
      setEditLabPlatelets('');
      setEditLabCea('');
      setEditLabCreatinine('');
      setEditLabAltGpt('');
      setEditLabAstGot('');
    }
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setEditUploadProgress(true);
    const fileArray: Promise<MedicalFile>[] = Array.from(files).map((item) => {
      const file = item as File;
      return new Promise<MedicalFile>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: 'file-' + Math.random().toString(36).substring(2, 11),
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result as string
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(fileArray).then((completedFiles) => {
      setEditFiles((prev) => [...prev, ...completedFiles]);
      setEditUploadProgress(false);
    });
  };

  const handleRemoveEditFile = (id: string) => {
    setEditFiles((prev) => prev.filter(f => f.id !== id));
  };

  const handleSaveEdit = (eventId: string) => {
    if (!editDate || !editTitle || !editDescription || !editProfessional) {
      setEditFormErrors(prev => ({ ...prev, [eventId]: 'Por favor complete todos los campos obligatorios (*)' }));
      return;
    }

    const labResults = editType === 'Laboratorio' ? {
      wbc: editLabWbc ? parseFloat(editLabWbc) : undefined,
      neutrophils: editLabNeutrophils ? parseFloat(editLabNeutrophils) : undefined,
      hemoglobin: editLabHemoglobin ? parseFloat(editLabHemoglobin) : undefined,
      platelets: editLabPlatelets ? parseFloat(editLabPlatelets) : undefined,
      cea: editLabCea ? parseFloat(editLabCea) : undefined,
      creatinine: editLabCreatinine ? parseFloat(editLabCreatinine) : undefined,
      alt_gpt: editLabAltGpt ? parseFloat(editLabAltGpt) : undefined,
      ast_got: editLabAstGot ? parseFloat(editLabAstGot) : undefined,
    } : undefined;

    const updatedEvent: MedicalEvent = {
      id: eventId,
      date: editDate,
      type: editType,
      title: editTitle,
      description: editDescription,
      professional: editProfessional,
      institution: editInstitution || undefined,
      notes: editNotes || undefined,
      files: editFiles.length > 0 ? editFiles : undefined,
      labResults: labResults,
      createdAt: new Date().toISOString()
    };

    setEditFormErrors(prev => {
      const copy = { ...prev };
      delete copy[eventId];
      return copy;
    });
    onUpdateEvent(updatedEvent);
    setEditingEventId(null);
  };

  // Formulario nuevo evento
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<EventType>('Estudio');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProfessional, setNewProfessional] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<MedicalFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para valores de laboratorio (Añadir)
  const [labWbc, setLabWbc] = useState('');
  const [labNeutrophils, setLabNeutrophils] = useState('');
  const [labHemoglobin, setLabHemoglobin] = useState('');
  const [labPlatelets, setLabPlatelets] = useState('');
  const [labCea, setLabCea] = useState('');
  const [labCreatinine, setLabCreatinine] = useState('');
  const [labAltGpt, setLabAltGpt] = useState('');
  const [labAstGot, setLabAstGot] = useState('');

  // Estados de validación de formularios
  const [addFormError, setAddFormError] = useState('');
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Categorías de eventos médicos
  const eventTypes: EventType[] = [
    'Cirugía', 
    'Quimioterapia', 
    'Radioterapia', 
    'Inmunoterapia', 
    'Estudio', 
    'Consulta', 
    'Laboratorio',
    'Otro'
  ];

  // Manejador de subida de archivo (con conversión a Base64 real)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(true);
    const fileArray: Promise<MedicalFile>[] = Array.from(files).map((item) => {
      const file = item as File;
      return new Promise<MedicalFile>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: 'file-' + Math.random().toString(36).substring(2, 11),
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result as string // Base64 string
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(fileArray).then((completedFiles) => {
      setUploadedFiles((prev) => [...prev, ...completedFiles]);
      setUploadProgress(false);
    });
  };

  const handleRemoveUploadedFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter(f => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTitle || !newDescription || !newProfessional) {
      setAddFormError('Por favor complete todos los campos obligatorios (*)');
      return;
    }

    const labResults = newType === 'Laboratorio' ? {
      wbc: labWbc ? parseFloat(labWbc) : undefined,
      neutrophils: labNeutrophils ? parseFloat(labNeutrophils) : undefined,
      hemoglobin: labHemoglobin ? parseFloat(labHemoglobin) : undefined,
      platelets: labPlatelets ? parseFloat(labPlatelets) : undefined,
      cea: labCea ? parseFloat(labCea) : undefined,
      creatinine: labCreatinine ? parseFloat(labCreatinine) : undefined,
      alt_gpt: labAltGpt ? parseFloat(labAltGpt) : undefined,
      ast_got: labAstGot ? parseFloat(labAstGot) : undefined,
    } : undefined;

    const eventToAdd: MedicalEvent = {
      id: 'event-' + Math.random().toString(36).substr(2, 9),
      date: newDate,
      type: newType,
      title: newTitle,
      description: newDescription,
      professional: newProfessional,
      institution: newInstitution || undefined,
      notes: newNotes || undefined,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      labResults: labResults,
      createdAt: new Date().toISOString()
    };

    onAddEvent(eventToAdd);
    setAddFormError('');
    
    // Resetear formulario
    setNewDate('');
    setNewType('Estudio');
    setNewTitle('');
    setNewDescription('');
    setNewProfessional('');
    setNewInstitution('');
    setNewNotes('');
    setUploadedFiles([]);
    setLabWbc('');
    setLabNeutrophils('');
    setLabHemoglobin('');
    setLabPlatelets('');
    setLabCea('');
    setLabCreatinine('');
    setLabAltGpt('');
    setLabAstGot('');
    setShowAddForm(false);
  };

  // Filtrado y Ordenamiento
  const filteredEvents = events
    .filter((event) => {
      const matchesSearch = 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.professional.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (event.institution && event.institution.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = selectedType === 'Todos' || event.type === selectedType;
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Estilo de badge del tipo de evento
  const getBadgeStyle = (type: EventType) => {
    switch (type) {
      case 'Cirugía':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Quimioterapia':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Radioterapia':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Inmunoterapia':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Estudio':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Consulta':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6" id="clinical-timeline-section">
      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h2 className="font-sans font-bold text-xl text-slate-800">Cronología e Informes</h2>
            <p className="text-xs text-slate-500">Ordena, filtra y consulta informes y estudios de tu historial.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            {onOpenPdfParser && (
              <button
                onClick={onOpenPdfParser}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto justify-center"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Leer PDF Examen con IA</span>
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto justify-center"
              id="btn-add-event-toggle"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? 'Cancelar' : 'Agregar Evento Manual'}
            </button>
          </div>
        </div>

        {/* Formulario para añadir evento */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4" id="form-add-event">
            <h3 className="font-sans font-semibold text-sm text-slate-800 border-b border-slate-200 pb-2">Nuevo Registro Médico</h3>
            
            {addFormError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold animate-pulse">
                ⚠️ {addFormError}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del Evento *</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Evento *</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EventType)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                >
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Título / Procedimiento *</label>
                <input
                  type="text"
                  placeholder="Ej: TAC de Control, Segunda Quimio, Consulta general"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Médico / Profesional Tratante *</label>
                <input
                  type="text"
                  placeholder="Ej: Dra. Nombre Apellido (Especialidad)"
                  value={newProfessional}
                  onChange={(e) => setNewProfessional(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Centro Médico / Institución</label>
                <input
                  type="text"
                  placeholder="Ej: Hospital o sanatorio"
                  value={newInstitution}
                  onChange={(e) => setNewInstitution(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción de lo realizado *</label>
              <textarea
                placeholder="Detalle los hallazgos, dosis de medicamentos o detalles de la intervención..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            {newType === 'Laboratorio' && (
              <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 space-y-3">
                <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Resultados del Análisis de Laboratorio (Opcional)
                </h4>
                <p className="text-[10.5px] text-slate-500">
                  Ingrese los valores numéricos de su estudio para poder visualizarlos comparativamente y ver su evolución.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Glóbulos Blancos</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="x10³/µL (4.0-11.0)"
                      value={labWbc}
                      onChange={(e) => setLabWbc(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Neutrófilos</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="x10³/µL (1.5-8.0)"
                      value={labNeutrophils}
                      onChange={(e) => setLabNeutrophils(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Hemoglobina</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="g/dL (12.0-17.5)"
                      value={labHemoglobin}
                      onChange={(e) => setLabHemoglobin(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Plaquetas</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="x10³/µL (150-450)"
                      value={labPlatelets}
                      onChange={(e) => setLabPlatelets(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5" title="Antígeno Carcinoembrionario">Marcador CEA</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="ng/mL (< 3.0)"
                      value={labCea}
                      onChange={(e) => setLabCea(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Creatinina</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="mg/dL (0.6-1.2)"
                      value={labCreatinine}
                      onChange={(e) => setLabCreatinine(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">TGP / ALT</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="U/L (< 41)"
                      value={labAltGpt}
                      onChange={(e) => setLabAltGpt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">TGO / AST</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="U/L (< 40)"
                      value={labAstGot}
                      onChange={(e) => setLabAstGot(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas personales o aclaraciones adicionales</label>
              <textarea
                placeholder="Ej: Tuve dificultad para tragar o me sentí muy mareado después..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Subida de Archivos Real */}
            <div className="border border-dashed border-slate-200 bg-white rounded-lg p-4">
              <div className="flex flex-col items-center justify-center text-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Adjuntar Informes o Imágenes Médicas</p>
                <p className="text-xs text-slate-400 mb-3">Sube radiografías, estudios o PDF de anatomía patológica.</p>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Seleccionar Archivos
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                />
              </div>

              {/* Lista de archivos adjuntados temporales */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600">Archivos Cargados ({uploadedFiles.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-xs text-slate-700 truncate font-mono">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedFile(file.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Confirmar y Registrar Evento
            </button>
          </form>
        )}

        {/* Buscador e Interruptores de Filtro */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Campo búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por médico, descripción, centro o estudio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              id="input-search-events"
            />
          </div>

          {/* Selector de Tipo */}
          <div className="flex gap-2 shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as EventType | 'Todos')}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden"
              id="select-filter-type"
            >
              <option value="Todos">Todos los tipos</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Alternar Orden */}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors cursor-pointer"
              title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
              id="btn-sort-order"
            >
              <ArrowUpDown className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Reciente' : 'Antiguo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Renderizado de la Línea de Tiempo en Formato Tabla de Alta Densidad */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center shadow-sm">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-bold">No se encontraron registros clínicos</p>
          <p className="text-sm text-slate-400 mt-1">Prueba cambiando los filtros o agrega un nuevo estudio.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cronología de Tratamientos</h2>
            <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
              {filteredEvents.length} Registros Totales
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-200 bg-white sticky top-0">
                  <th className="px-4 py-3 w-[110px]">Fecha</th>
                  <th className="px-4 py-3">Estudio / Evento</th>
                  <th className="px-4 py-3">Profesional (Centro)</th>
                  <th className="px-4 py-3">Resumen de Diagnóstico</th>
                  <th className="px-4 py-3 text-right">Archivos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((event, index) => {
                  const isExpanded = expandedEvents[event.id];
                  return (
                    <React.Fragment key={event.id}>
                      {/* Fila principal */}
                      <tr 
                        onClick={() => toggleExpand(event.id)}
                        className={`hover:bg-blue-50/50 transition-colors cursor-pointer select-none ${index % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {safeFormatDate(event.date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${getBadgeStyle(event.type)}`}>
                              {event.type}
                            </span>
                            <span className="font-bold text-slate-800 text-[13px]">{event.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="font-semibold text-slate-700">{event.professional}</span>
                          {event.institution && (
                            <span className="text-[10px] text-slate-400 block">{event.institution}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={event.description}>
                          {event.description}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {event.files && event.files.length > 0 && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100">
                                ⓘ {event.files.length}
                              </span>
                            )}
                            <button
                              onClick={() => toggleExpand(event.id)}
                              className="text-blue-600 hover:text-blue-800 font-bold p-1"
                              title="Ver detalles completos"
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Fila expandida de detalles */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-5 py-4 bg-slate-50/70 border-l-2 border-blue-500">
                            {editingEventId === event.id ? (
                              /* FORMULARIO DE EDICIÓN DEL EVENTO INLINE */
                              <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-left" onClick={(e) => e.stopPropagation()}>
                                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 mb-2 flex items-center gap-1.5">
                                  <Edit className="w-4 h-4 text-blue-600" />
                                  Modificar Registro Médico
                                </h4>

                                {editFormErrors[event.id] && (
                                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold animate-pulse">
                                    ⚠️ {editFormErrors[event.id]}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fecha *</label>
                                    <input
                                      type="date"
                                      value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                      required
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo de Evento *</label>
                                    <select
                                      value={editType}
                                      onChange={(e) => setEditType(e.target.value as EventType)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                      required
                                    >
                                      {eventTypes.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Título / Procedimiento *</label>
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                      required
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Médico / Profesional *</label>
                                    <input
                                      type="text"
                                      value={editProfessional}
                                      onChange={(e) => setEditProfessional(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                      required
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Centro Médico / Institución</label>
                                    <input
                                      type="text"
                                      value={editInstitution}
                                      onChange={(e) => setEditInstitution(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Descripción de lo realizado *</label>
                                  <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                    required
                                  />
                                </div>

                                {editType === 'Laboratorio' && (
                                  <div className="bg-blue-50/40 rounded-lg p-3 border border-blue-100 space-y-2 mb-3">
                                    <h4 className="text-[11px] font-bold text-blue-800 flex items-center gap-1.5 uppercase tracking-wide">
                                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                                      Valores de Laboratorio (Editar)
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Glóbulos Blancos</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="x10³/µL"
                                          value={editLabWbc}
                                          onChange={(e) => setEditLabWbc(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Neutrófilos</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="x10³/µL"
                                          value={editLabNeutrophils}
                                          onChange={(e) => setEditLabNeutrophils(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Hemoglobina</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="g/dL"
                                          value={editLabHemoglobin}
                                          onChange={(e) => setEditLabHemoglobin(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Plaquetas</label>
                                        <input
                                          type="number"
                                          step="1"
                                          placeholder="x10³/µL"
                                          value={editLabPlatelets}
                                          onChange={(e) => setEditLabPlatelets(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Marcador CEA</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="ng/mL"
                                          value={editLabCea}
                                          onChange={(e) => setEditLabCea(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">Creatinina</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="mg/dL"
                                          value={editLabCreatinine}
                                          onChange={(e) => setEditLabCreatinine(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">TGP / ALT</label>
                                        <input
                                          type="number"
                                          step="1"
                                          placeholder="U/L"
                                          value={editLabAltGpt}
                                          onChange={(e) => setEditLabAltGpt(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-slate-500">TGO / AST</label>
                                        <input
                                          type="number"
                                          step="1"
                                          placeholder="U/L"
                                          value={editLabAstGot}
                                          onChange={(e) => setEditLabAstGot(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notas personales o aclaraciones adicionales</label>
                                  <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                  />
                                </div>

                                {/* Adjuntos en edición */}
                                <div className="border border-dashed border-slate-200 p-3 rounded-lg bg-slate-50/50">
                                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Archivos Adjuntos de este Registro</span>
                                  
                                  {editFiles.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                      {editFiles.map((file) => (
                                        <div key={file.id} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg">
                                          <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="text-[11px] text-slate-700 truncate font-mono">{file.name}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveEditFile(file.id)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="Eliminar archivo"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => editFileInputRef.current?.click()}
                                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      Adjuntar más archivos
                                    </button>
                                    <input
                                      type="file"
                                      ref={editFileInputRef}
                                      onChange={handleEditFileUpload}
                                      multiple
                                      accept="image/*,application/pdf"
                                      className="hidden"
                                    />
                                    {editUploadProgress && (
                                      <span className="text-[10px] text-slate-400 animate-pulse">Cargando archivo...</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(event.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-all"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Guardar Cambios
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEventId(null)}
                                    className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer transition-all border border-slate-200"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* VISTA NORMAL DE DETALLES DEL EVENTO */
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descripción detallada:</h4>
                                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                                </div>

                                {event.labResults && (
                                  <div className="bg-blue-50/30 border border-blue-100 p-3 rounded-lg space-y-2">
                                    <span className="font-bold font-sans block text-[10px] uppercase text-blue-700 tracking-wider">
                                      🧬 Resultados Analíticos de Laboratorio:
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {event.labResults.wbc !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">Glóbulos Blancos</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.wbc} <span className="text-[9px] font-normal text-slate-400">x10³/µL</span>
                                            {event.labResults.wbc < 4.0 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-bold">Bajo</span>
                                            ) : event.labResults.wbc > 11.0 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Alto</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.neutrophils !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">Neutrófilos</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.neutrophils} <span className="text-[9px] font-normal text-slate-400">x10³/µL</span>
                                            {event.labResults.neutrophils < 1.5 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Bajo</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.hemoglobin !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">Hemoglobina</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.hemoglobin} <span className="text-[9px] font-normal text-slate-400">g/dL</span>
                                            {event.labResults.hemoglobin < 12.0 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-bold">Bajo</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.platelets !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">Plaquetas</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.platelets} <span className="text-[9px] font-normal text-slate-400">x10³/µL</span>
                                            {event.labResults.platelets < 150 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-bold">Bajo</span>
                                            ) : event.labResults.platelets > 450 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Alto</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.cea !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase" title="Antígeno Carcinoembrionario">Marcador CEA</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.cea} <span className="text-[9px] font-normal text-slate-400">ng/mL</span>
                                            {event.labResults.cea > 3.0 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Elevado</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.creatinine !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">Creatinina</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.creatinine} <span className="text-[9px] font-normal text-slate-400">mg/dL</span>
                                            {event.labResults.creatinine > 1.2 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Alto</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.alt_gpt !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">TGP / ALT</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.alt_gpt} <span className="text-[9px] font-normal text-slate-400">U/L</span>
                                            {event.labResults.alt_gpt > 41 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Alto</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                      {event.labResults.ast_got !== undefined && (
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">TGO / AST</p>
                                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {event.labResults.ast_got} <span className="text-[9px] font-normal text-slate-400">U/L</span>
                                            {event.labResults.ast_got > 40 ? (
                                              <span className="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-bold">Alto</span>
                                            ) : (
                                              <span className="ml-1 text-[9px] px-1 bg-green-100 text-green-800 rounded font-bold">Normal</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {event.notes && (
                                  <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-xs text-amber-900 italic">
                                    <span className="font-bold font-sans not-italic block mb-0.5 text-[10px] uppercase text-amber-700">Nota personal del paciente:</span>
                                    {event.notes}
                                  </div>
                                )}

                                {event.files && event.files.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200">
                                    <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Adjuntos médicos cargados:</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {event.files.map((file) => (
                                        <div 
                                          key={file.id} 
                                          onClick={() => setPreviewFile(file)}
                                          className="flex items-center gap-2 p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg cursor-pointer transition-all max-w-xs"
                                        >
                                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                          <div className="text-left shrink min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 truncate font-mono">{file.name}</p>
                                            <p className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                                          </div>
                                          <Eye className="w-3.5 h-3.5 text-slate-400 ml-2" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-slate-200/50" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-[9px] text-slate-400 font-mono">ID de Evento: {event.id}</span>
                                  
                                  {deleteConfirmEventId === event.id ? (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                                      <span className="text-xs font-semibold text-red-700">¿Deseas eliminar este registro médico?</span>
                                      <button
                                        onClick={() => {
                                          onDeleteEvent(event.id);
                                          setDeleteConfirmEventId(null);
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer"
                                      >
                                        Sí, eliminar
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmEventId(null)}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer border border-slate-300"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => startEditingEvent(event)}
                                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                        Editar Registro
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmEventId(event.id)}
                                        className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-bold transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Eliminar Registro
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX DE CONSULTA DE ARCHIVOS */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs" id="lightbox-file-preview">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="font-sans font-bold text-slate-800 text-sm md:text-base truncate">{previewFile.name}</h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visualizador de Contenido */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 rounded-xl p-4 min-h-[300px]">
              {previewFile.data ? (
                previewFile.type.startsWith('image/') || previewFile.name.endsWith('.jpg') || previewFile.name.endsWith('.jpeg') || previewFile.name.endsWith('.png') ? (
                  <img
                    src={previewFile.data}
                    alt={previewFile.name}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="text-center p-6">
                    <FileText className="w-16 h-16 text-blue-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700">Documento PDF o Estudio de Texto</p>
                    <p className="text-xs text-slate-400 mb-4">El visualizador interactivo está restringido para archivos embebidos en el navegador.</p>
                    <a
                      href={previewFile.data}
                      download={previewFile.name}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-xs hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      Descargar para Consultar
                    </a>
                  </div>
                )
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <FileText className="w-16 h-16 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">Archivo Adjunto de Demostración</p>
                  <p className="text-xs mt-1">Este archivo forma parte del registro histórico inicial. Puedes cargar nuevos estudios reales para ver sus previsualizaciones completas.</p>
                </div>
              )}
            </div>

            {/* Descargar / Cerrar */}
            <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-3">
              {previewFile.data && (
                <a
                  href={previewFile.data}
                  download={previewFile.name}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Descargar Archivo
                </a>
              )}
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cerrar Consulta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
