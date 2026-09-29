import { jsPDF } from 'jspdf';
import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry, LabResults } from '../types';
import { safeFormatDate } from './dateHelper';

export function generateMedicalReportPDF(
  personalData: PersonalData,
  events: MedicalEvent[],
  sideEffects: SideEffectEntry[],
  metrics: MetricEntry[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper para verificar desbordamiento de página
  const checkPageOverflow = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = 20;
      // Dibujar encabezado sutil en nueva página
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Historial Clínico Completo - Paciente: ${personalData.fullName}`, margin, 12);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, 14, pageWidth - margin, 14);
    }
  };

  // --- TÍTULO PRINCIPAL ---
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("HISTORIAL CLÍNICO Y EVOLUCIÓN", margin, y);
  y += 7;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  const currentDateStr = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generado el: ${currentDateStr}`, margin, y);
  y += 10;

  // Línea divisoria principal
  doc.setLineWidth(0.8);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // --- PERFIL DEL PACIENTE ---
  checkPageOverflow(40);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("1. Perfil del Paciente", margin, y);
  y += 6;

  // Fondo gris para el perfil
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(margin, y, contentWidth, 32, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600

  // Columnas de datos personales
  const col1X = margin + 5;
  const col2X = margin + (contentWidth / 2) + 5;
  let profileY = y + 7;

  doc.text("Nombre:", col1X, profileY);
  doc.setFont('Helvetica', 'normal');
  doc.text(personalData.fullName || "No especificado", col1X + 18, profileY);

  doc.setFont('Helvetica', 'bold');
  doc.text("Diagnóstico:", col2X, profileY);
  doc.setFont('Helvetica', 'normal');
  const diagLines = doc.splitTextToSize(personalData.diagnosis || "No especificado", (contentWidth / 2) - 30);
  doc.text(diagLines, col2X + 25, profileY);

  profileY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text("Edad:", col1X, profileY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${personalData.age || 0} años`, col1X + 18, profileY);

  doc.setFont('Helvetica', 'bold');
  doc.text("Tratamiento:", col2X, profileY);
  doc.setFont('Helvetica', 'normal');
  doc.text(personalData.treatment || "No especificado", col2X + 25, profileY);

  profileY += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text("Peso / Altura:", col1X, profileY);
  doc.setFont('Helvetica', 'normal');
  doc.text(`${personalData.weight || 0} kg / ${personalData.height || 0} cm`, col1X + 28, profileY);

  doc.setFont('Helvetica', 'bold');
  doc.text("Grupo Sanguíneo:", col2X, profileY);
  doc.setFont('Helvetica', 'normal');
  doc.text(personalData.bloodType || "No especificado", col2X + 32, profileY);

  y += 38;

  // --- CAPÍTULO 2.1: EVENTOS MÁS IMPORTANTES Y TRATAMIENTOS ---
  checkPageOverflow(20);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("2. Tratamientos e Hitos Clínicos Principales", margin, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Resumen de las intervenciones de alto impacto: Cirugías, Quimioterapias, Radioterapias e Inmunoterapias.", margin, y);
  y += 8;

  const majorEvents = events
    .filter(e => ['Cirugía', 'Quimioterapia', 'Radioterapia', 'Inmunoterapia'].includes(e.type))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (majorEvents.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registran tratamientos principales en la bitácora.", margin + 5, y);
    y += 10;
  } else {
    majorEvents.forEach((event) => {
      const descLines = doc.splitTextToSize(event.description || "", contentWidth - 10);
      const notesLines = doc.splitTextToSize(event.notes ? `Nota: ${event.notes}` : "", contentWidth - 10);
      const estimatedHeight = 25 + (descLines.length * 5) + (event.notes ? (notesLines.length * 5) : 0);
      
      checkPageOverflow(estimatedHeight);

      // Dibujar tarjeta/línea de tiempo del evento
      doc.setLineWidth(0.3);
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setFillColor(252, 253, 254);
      doc.rect(margin, y, contentWidth, estimatedHeight - 5, 'DF');

      // Tipo de Evento (Etiqueta de color)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      
      let typeColor = [71, 85, 105]; // Slate
      if (event.type === 'Cirugía') typeColor = [220, 38, 38]; // Red
      else if (event.type === 'Quimioterapia') typeColor = [147, 51, 234]; // Purple
      else if (event.type === 'Radioterapia') typeColor = [217, 119, 6]; // Amber
      else if (event.type === 'Inmunoterapia') typeColor = [13, 148, 136]; // Teal
      
      doc.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
      doc.rect(margin + 5, y + 4, 25, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(event.type.toUpperCase(), margin + 7, y + 7.8);

      // Fecha del evento
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const formattedDate = safeFormatDate(event.date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.text(formattedDate, margin + 35, y + 8);

      // Título
      y += 14;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(event.title, margin + 5, y);
      y += 5;

      // Profesional y Centro médico
      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const profStr = `Tratante: ${event.professional || "No indicado"} ${event.institution ? `en ${event.institution}` : ""}`;
      doc.text(profStr, margin + 5, y);
      y += 6;

      // Descripción
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(descLines, margin + 5, y);
      y += (descLines.length * 5);

      // Notas si existen
      if (event.notes) {
        y += 2;
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(notesLines, margin + 5, y);
        y += (notesLines.length * 5);
      }

      y += 10; // Espaciado entre tarjetas
    });
  }

  // --- CAPÍTULO 2.2: CONSULTAS, ESTUDIOS DE IMAGEN Y OTROS ---
  y += 5;
  checkPageOverflow(20);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("3. Historial de Consultas y Otros Eventos", margin, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Registro cronológico secundario que abarca visitas de control médico y estudios de diagnóstico por imágenes.", margin, y);
  y += 8;

  const secondaryEvents = events
    .filter(e => ['Consulta', 'Estudio', 'Otro'].includes(e.type))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (secondaryEvents.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registran visitas de control ni estudios en la bitácora.", margin + 5, y);
    y += 10;
  } else {
    secondaryEvents.forEach((event) => {
      const descLines = doc.splitTextToSize(event.description || "", contentWidth - 10);
      const notesLines = doc.splitTextToSize(event.notes ? `Nota: ${event.notes}` : "", contentWidth - 10);
      const estimatedHeight = 25 + (descLines.length * 5) + (event.notes ? (notesLines.length * 5) : 0);
      
      checkPageOverflow(estimatedHeight);

      doc.setLineWidth(0.3);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, estimatedHeight - 5, 'DF');

      // Tipo de Evento
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      
      let typeColor = [100, 116, 139]; // Slate
      if (event.type === 'Estudio') typeColor = [37, 99, 235]; // Blue (Diagnóstico)
      else if (event.type === 'Consulta') typeColor = [59, 130, 246]; // Light Blue
      
      doc.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
      doc.rect(margin + 5, y + 4, 25, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(event.type.toUpperCase(), margin + 7, y + 7.8);

      // Fecha
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const formattedDate = safeFormatDate(event.date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.text(formattedDate, margin + 35, y + 8);

      // Título
      y += 14;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(event.title, margin + 5, y);
      y += 5;

      // Profesional
      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const profStr = `Tratante: ${event.professional || "No indicado"} ${event.institution ? `en ${event.institution}` : ""}`;
      doc.text(profStr, margin + 5, y);
      y += 6;

      // Descripción
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(descLines, margin + 5, y);
      y += (descLines.length * 5);

      // Notas
      if (event.notes) {
        y += 2;
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(notesLines, margin + 5, y);
        y += (notesLines.length * 5);
      }

      y += 10;
    });
  }

  // --- CAPÍTULO 3: COMPARATIVA EVOLUTIVA DE LABORATORIO (UN SOLO CAPÍTULO) ---
  y += 5;
  checkPageOverflow(85);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("4. Comparativa Evolutiva de Estudios de Laboratorio", margin, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  const introTxt = "Este capítulo compara side-by-side (en paralelo) los resultados de sus análisis sanguíneos e inmunológicos para facilitar a sus médicos el análisis evolutivo del tumor pulmonar (a través del marcador CEA) y la tolerancia de la médula ósea a los fármacos aplicados.";
  const introLines = doc.splitTextToSize(introTxt, contentWidth);
  doc.text(introLines, margin, y);
  y += (introLines.length * 4.5) + 3;

  const labEvents = events
    .filter(e => e.type === 'Laboratorio' && e.labResults)
    .sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime()); // De más antiguo a más reciente para leer evolución natural

  if (labEvents.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registran análisis de laboratorio con valores numéricos estructurados.", margin + 5, y);
    y += 10;
  } else {
    // Tomamos los últimos 4 laboratorios para asegurar ajuste perfecto en A4 portrait sin overflow de columnas
    const displayLabs = labEvents.slice(-4);
    const numCols = displayLabs.length;
    
    const paramColWidth = 62;
    const dataColWidth = numCols > 0 ? 108 / numCols : 108;

    // Header de la tabla de laboratorios
    checkPageOverflow(10);
    doc.setFillColor(239, 246, 255); // azul muy suave (blue-50)
    doc.rect(margin, y, contentWidth, 8, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216); // blue-700
    
    doc.text("Parámetro Clínico (Rangos Ref.)", margin + 3, y + 5.5);
    
    displayLabs.forEach((lab, colIdx) => {
      const colX = margin + paramColWidth + (colIdx * dataColWidth);
      const formattedDate = safeFormatDate(lab.date, { month: 'short', day: 'numeric', year: '2-digit' });
      doc.text(formattedDate, colX + (dataColWidth / 2), y + 5.5, { align: 'center' });
    });
    
    y += 8;

    // Estructuras de filas de laboratorio
    interface RowDef {
      name: string;
      refRange: string;
      key: keyof LabResults;
      format: (val: number) => string;
      eval: (val: number) => string;
    }

    const rows: RowDef[] = [
      {
        name: "Antígeno CEA (Marcador Pulmón)",
        refRange: "Rango ref: < 3.0 ng/mL",
        key: 'cea',
        format: (val) => `${val.toFixed(1)} ng/mL`,
        eval: (val) => val > 3.0 ? " (H)" : ""
      },
      {
        name: "Glóbulos Blancos (WBC)",
        refRange: "Rango ref: 4.0 - 11.0 x10³/µL",
        key: 'wbc',
        format: (val) => `${val.toFixed(1)}`,
        eval: (val) => val < 4.0 ? " (L)" : val > 11.0 ? " (H)" : ""
      },
      {
        name: "Neutrófilos Absolutos",
        refRange: "Rango ref: 1.5 - 8.0 x10³/µL",
        key: 'neutrophils',
        format: (val) => `${val.toFixed(1)}`,
        eval: (val) => val < 1.5 ? " (L)" : ""
      },
      {
        name: "Hemoglobina",
        refRange: "Rango ref: 12.0 - 17.5 g/dL",
        key: 'hemoglobin',
        format: (val) => `${val.toFixed(1)}`,
        eval: (val) => val < 12.0 ? " (L)" : ""
      },
      {
        name: "Plaquetas",
        refRange: "Rango ref: 150 - 450 x10³/µL",
        key: 'platelets',
        format: (val) => `${Math.round(val)}`,
        eval: (val) => val < 150 ? " (L)" : val > 450 ? " (H)" : ""
      },
      {
        name: "Creatinina (Filtro Renal)",
        refRange: "Rango ref: 0.6 - 1.2 mg/dL",
        key: 'creatinine',
        format: (val) => `${val.toFixed(2)}`,
        eval: (val) => val > 1.2 ? " (H)" : ""
      },
      {
        name: "TGP / ALT (Hígado)",
        refRange: "Rango ref: < 41 U/L",
        key: 'alt_gpt',
        format: (val) => `${Math.round(val)}`,
        eval: (val) => val > 41 ? " (H)" : ""
      },
      {
        name: "TGO / AST (Hígado)",
        refRange: "Rango ref: < 40 U/L",
        key: 'ast_got',
        format: (val) => `${Math.round(val)}`,
        eval: (val) => val > 40 ? " (H)" : ""
      }
    ];

    rows.forEach((rowDef, rowIdx) => {
      checkPageOverflow(8);
      
      // Fondo cebra
      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, y, contentWidth, 7.5, 'F');
      }

      // Línea divisoria de fila sutil
      doc.setLineWidth(0.1);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 7.5, margin + contentWidth, y + 7.5);

      // Texto de etiqueta de parámetro
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(rowDef.name, margin + 3, y + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(rowDef.refRange, margin + 3, y + 6.8);

      // Datos por cada laboratorio
      displayLabs.forEach((lab, colIdx) => {
        const colX = margin + paramColWidth + (colIdx * dataColWidth);
        const val = lab.labResults?.[rowDef.key];
        
        if (val !== undefined) {
          const evalStr = rowDef.eval(val);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          
          if (evalStr) {
            // Fuera de rango: texto en rojo fuerte
            doc.setTextColor(220, 38, 38);
            doc.text(`${rowDef.format(val)}${evalStr}`, colX + (dataColWidth / 2), y + 5, { align: 'center' });
          } else {
            // Rango normal: texto en slate oscuro
            doc.setTextColor(71, 85, 105);
            doc.text(rowDef.format(val), colX + (dataColWidth / 2), y + 5, { align: 'center' });
          }
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(203, 213, 225);
          doc.text("-", colX + (dataColWidth / 2), y + 5, { align: 'center' });
        }
      });

      y += 7.5;
    });

    y += 4;
    checkPageOverflow(10);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("* Notación: (L) = Por debajo del rango referencial (Low). (H) = Por encima del rango referencial (High/Elevado).", margin + 3, y);
    y += 10;
  }

  // --- CAPÍTULO 4: EFECTOS SECUNDARIOS (INMUNOTERAPIA) ---
  y += 5;
  checkPageOverflow(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("5. Registro de Efectos Secundarios (Inmunoterapia)", margin, y);
  y += 8;

  const sortedEffects = [...sideEffects].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedEffects.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registran reportes de efectos secundarios en la bitácora.", margin + 5, y);
    y += 10;
  } else {
    sortedEffects.forEach((effect) => {
      const notesLines = doc.splitTextToSize(effect.notes || "", contentWidth - 40);
      const estimatedHeight = 15 + (notesLines.length * 5);
      checkPageOverflow(estimatedHeight);

      // Fondo coloreado según severidad
      let severityBgColor = [240, 253, 244]; // Verde claro (Leve)
      let severityTextColor = [22, 101, 52]; // Verde oscuro
      if (effect.severity === 'Moderado') {
        severityBgColor = [255, 251, 235]; // Amarillo
        severityTextColor = [146, 64, 14];
      } else if (effect.severity === 'Severo') {
        severityBgColor = [254, 242, 242]; // Rojo
        severityTextColor = [153, 27, 27];
      }

      doc.setFillColor(severityBgColor[0], severityBgColor[1], severityBgColor[2]);
      doc.rect(margin, y, contentWidth, estimatedHeight, 'F');

      doc.setFillColor(severityTextColor[0], severityTextColor[1], severityTextColor[2]);
      doc.rect(margin, y, 2, estimatedHeight, 'F');

      // Fecha
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      const effectDate = safeFormatDate(effect.date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.text(effectDate, margin + 5, y + 6);

      // Severidad
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(severityTextColor[0], severityTextColor[1], severityTextColor[2]);
      doc.text(`Severidad: ${effect.severity}`, margin + 40, y + 6);

      // Nivel de Energía
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Tolerabilidad/Energía: ${effect.energyLevel}/10`, margin + 85, y + 6);

      // Síntomas
      y += 12;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text("Síntomas:", margin + 5, y);

      doc.setFont('Helvetica', 'normal');
      const symptomList = effect.symptoms.join(", ") + (effect.customSymptoms ? `, ${effect.customSymptoms}` : "");
      doc.text(symptomList, margin + 25, y);
      
      // Notas
      if (effect.notes) {
        y += 5;
        doc.setFont('Helvetica', 'italic');
        doc.setTextColor(71, 85, 105);
        doc.text(notesLines, margin + 5, y);
        y += (notesLines.length * 5);
      }

      y += 8;
    });
  }

  // --- CAPÍTULO 5: HISTORIAL DE MÉTRICAS (TABLA) ---
  y += 5;
  checkPageOverflow(40);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("6. Historial de Métricas Corporales", margin, y);
  y += 8;

  const tableHeaders = ["Fecha", "Peso (kg)", "Presión Art.", "Frec. Card. (lpm)", "IMC", "Observación"];
  const colWidths = [28, 25, 28, 32, 18, 39]; 

  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(margin, y, contentWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  let curX = margin;
  tableHeaders.forEach((header, colIdx) => {
    doc.text(header, curX + 2, y + 5);
    curX += colWidths[colIdx];
  });
  y += 7;

  const sortedMetrics = [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedMetrics.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No hay métricas corporales registradas.", margin + 5, y + 5);
    y += 10;
  } else {
    sortedMetrics.forEach((metric, rowIdx) => {
      const notesTrimmed = metric.notes ? (metric.notes.length > 25 ? metric.notes.slice(0, 23) + "..." : metric.notes) : "";
      const rowData = [
        safeFormatDate(metric.date, { year: 'numeric', month: 'short', day: 'numeric' }),
        `${metric.weight} kg`,
        `${metric.systolic}/${metric.diastolic} mmHg`,
        `${metric.heartRate} lpm`,
        metric.bmi ? metric.bmi.toFixed(1) : "-",
        notesTrimmed
      ];

      checkPageOverflow(8);

      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }

      doc.setLineWidth(0.1);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      let rowX = margin;
      rowData.forEach((val, colIdx) => {
        doc.text(val, rowX + 2, y + 4.5);
        rowX += colWidths[colIdx];
      });

      y += 6.5;
    });
  }

  // --- PIE DE PÁGINA FINAL ---
  y += 12;
  checkPageOverflow(15);
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Este reporte contiene información médica personal provista por el paciente.", margin, y);
  doc.text("Consulte siempre a sus profesionales de salud de cabecera antes de tomar cualquier decisión médica.", margin, y + 4);

  // Descargar PDF
  doc.save(`Historial_Clinico_${personalData.fullName.replace(/\s+/g, '_') || 'Paciente'}.pdf`);
}
