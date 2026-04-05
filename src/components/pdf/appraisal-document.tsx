import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'

// ── Types ───────────────────────────────────────────────────────────────────
export interface AppraisalPdfData {
  cycleName: string
  generatedAt: string
  employee: {
    fullName: string
    designation: string | null
    department: string | null
    managerName: string | null
    empCode: string | null
  }
  kras: Array<{
    title: string
    weight: number | null
    kpis: Array<{
      title: string
      unit: string | null
      target: number | null
      selfRating: number | null
      managerRating: number | null
      weight: number | null
      score: number | null
    }>
  }>
  competencies: Array<{
    name: string
    category: string
    rating: number | null
    proficiencyLabel: string | null
  }>
  finalRating: string | null
  compositeScore: number | null
  variablePay: number
  multiplier: number
  payoutAmount: number
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:        { fontSize: 9, fontFamily: 'Helvetica', padding: 36, color: '#1a1a2e' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1.5pt solid #4f46e5' },
  headerTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#4f46e5' },
  headerSub:   { fontSize: 8, color: '#6b7280', marginTop: 2 },
  section:     { marginBottom: 12 },
  sectionTitle:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, paddingBottom: 3, borderBottom: '0.5pt solid #e5e7eb' },
  row:         { flexDirection: 'row', marginBottom: 2 },
  label:       { width: 120, color: '#6b7280' },
  value:       { flex: 1, fontFamily: 'Helvetica-Bold' },
  table:       { marginTop: 4 },
  th:          { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '4pt 6pt', borderBottom: '0.5pt solid #d1d5db' },
  td:          { flexDirection: 'row', padding: '3pt 6pt', borderBottom: '0.5pt solid #f3f4f6' },
  col1:        { flex: 3 },
  col2:        { flex: 1, textAlign: 'center' },
  colHeader:   { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#374151' },
  kraTitle:    { fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2, backgroundColor: '#eff6ff', padding: '3pt 6pt', fontSize: 8.5 },
  finalBox:    { backgroundColor: '#f0fdf4', border: '1pt solid #86efac', borderRadius: 4, padding: 10, marginTop: 8 },
  finalLabel:  { fontSize: 8, color: '#15803d' },
  finalValue:  { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#15803d', marginTop: 1 },
  footer:      { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#9ca3af', borderTop: '0.5pt solid #e5e7eb', paddingTop: 4 },
})

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toFixed(1)
}

function fmtCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}

// ── Document ────────────────────────────────────────────────────────────────
export function AppraisalDocument({ data }: { data: AppraisalPdfData }) {
  return (
    <Document title={`Appraisal — ${data.employee.fullName} — ${data.cycleName}`}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.headerTitle}>Performance Appraisal</Text>
            <Text style={S.headerSub}>{data.cycleName}</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#9ca3af' }}>CONFIDENTIAL</Text>
        </View>

        {/* Employee Info */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Employee Details</Text>
          <View style={S.row}><Text style={S.label}>Name</Text><Text style={S.value}>{data.employee.fullName}</Text></View>
          {data.employee.empCode && <View style={S.row}><Text style={S.label}>Employee Code</Text><Text style={S.value}>{data.employee.empCode}</Text></View>}
          {data.employee.designation && <View style={S.row}><Text style={S.label}>Designation</Text><Text style={S.value}>{data.employee.designation}</Text></View>}
          {data.employee.department && <View style={S.row}><Text style={S.label}>Department</Text><Text style={S.value}>{data.employee.department}</Text></View>}
          {data.employee.managerName && <View style={S.row}><Text style={S.label}>Reporting Manager</Text><Text style={S.value}>{data.employee.managerName}</Text></View>}
        </View>

        {/* KRA / KPI Breakdown */}
        {data.kras.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>KRA / KPI Breakdown</Text>
            <View style={S.table}>
              <View style={S.th}>
                <Text style={[S.col1, S.colHeader]}>KPI</Text>
                <Text style={[S.col2, S.colHeader]}>Target</Text>
                <Text style={[S.col2, S.colHeader]}>Weight</Text>
                <Text style={[S.col2, S.colHeader]}>Self</Text>
                <Text style={[S.col2, S.colHeader]}>Manager</Text>
                <Text style={[S.col2, S.colHeader]}>Score</Text>
              </View>
              {data.kras.map((kra, ki) => (
                <View key={ki}>
                  <Text style={S.kraTitle}>{kra.title}{kra.weight != null ? ` (${kra.weight}% weight)` : ''}</Text>
                  {kra.kpis.map((kpi, pi) => (
                    <View key={pi} style={S.td}>
                      <Text style={S.col1}>{kpi.title}</Text>
                      <Text style={S.col2}>{kpi.target != null ? `${kpi.target}${kpi.unit === 'percent' ? '%' : ''}` : '—'}</Text>
                      <Text style={S.col2}>{kpi.weight != null ? `${kpi.weight}%` : '—'}</Text>
                      <Text style={S.col2}>{fmt(kpi.selfRating)}</Text>
                      <Text style={S.col2}>{fmt(kpi.managerRating)}</Text>
                      <Text style={S.col2}>{fmt(kpi.score)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Competencies */}
        {data.competencies.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Competency Assessment</Text>
            <View style={S.table}>
              <View style={S.th}>
                <Text style={[S.col1, S.colHeader]}>Competency</Text>
                <Text style={[S.col2, S.colHeader]}>Category</Text>
                <Text style={[S.col2, S.colHeader]}>Proficiency</Text>
                <Text style={[S.col2, S.colHeader]}>Rating</Text>
              </View>
              {data.competencies.map((c, i) => (
                <View key={i} style={S.td}>
                  <Text style={S.col1}>{c.name}</Text>
                  <Text style={S.col2}>{c.category}</Text>
                  <Text style={S.col2}>{c.proficiencyLabel ?? '—'}</Text>
                  <Text style={S.col2}>{fmt(c.rating)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Final Result */}
        <View style={S.finalBox}>
          <Text style={[S.sectionTitle, { color: '#15803d', borderBottomColor: '#86efac' }]}>Final Result</Text>
          <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
            <View>
              <Text style={S.finalLabel}>Composite Score</Text>
              <Text style={S.finalValue}>{data.compositeScore != null ? `${data.compositeScore.toFixed(1)}%` : '—'}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Rating</Text>
              <Text style={S.finalValue}>{data.finalRating ?? '—'}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Variable Pay</Text>
              <Text style={S.finalValue}>{fmtCurrency(data.variablePay)}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Multiplier</Text>
              <Text style={S.finalValue}>{data.multiplier.toFixed(2)}x</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Payout</Text>
              <Text style={[S.finalValue, { fontSize: 15 }]}>{fmtCurrency(data.payoutAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text>Generated: {data.generatedAt}</Text>
          <Text>CONFIDENTIAL — For internal use only</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
