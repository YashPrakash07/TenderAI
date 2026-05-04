import { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader, Play, Download, Bot } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:3001';

function App() {
  const [tenderFile, setTenderFile] = useState(null);
  const [bidderFiles, setBidderFiles] = useState([]);
  
  const [tenderStatus, setTenderStatus] = useState('idle'); // idle, loading, success, error
  const [bidderStatus, setBidderStatus] = useState('idle');
  
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTenderUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTenderFile(file);
    
    const formData = new FormData();
    formData.append('tenderDocument', file);
    
    setTenderStatus('loading');
    try {
      await axios.post(`${API_URL}/upload-tender`, formData);
      setTenderStatus('success');
    } catch (err) {
      console.error(err);
      setTenderStatus('error');
      setErrorMsg('Failed to process tender document.');
    }
  };

  const handleBidderUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setBidderFiles(files);
    
    const formData = new FormData();
    files.forEach(file => formData.append('bidderDocuments', file));
    
    setBidderStatus('loading');
    try {
      await axios.post(`${API_URL}/upload-bidder`, formData);
      setBidderStatus('success');
    } catch (err) {
      console.error(err);
      setBidderStatus('error');
      setErrorMsg('Failed to process bidder documents.');
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setErrorMsg('');
    try {
      const response = await axios.post(`${API_URL}/evaluate`);
      setEvaluationResults(response.data.results);
    } catch (err) {
      console.error(err);
      setErrorMsg('Evaluation failed. Please make sure both tender and bidder documents are uploaded.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleDownloadPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text('TenderAI Evaluation Report', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
        
        const tableColumn = ["Criterion", "Bidder Value", "Decision", "Explanation"];
        const tableRows = [];

        evaluationResults.forEach(result => {
          const rowData = [
            result.criterionName,
            `${result.bidderValue || 'Not Found'}\n(Source: ${result.source || 'N/A'})`,
            result.decision,
            result.reason
          ];
          tableRows.push(rowData);
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 40,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 45 },
            2: { cellWidth: 30, fontStyle: 'bold' },
            3: { cellWidth: 'auto' }
          },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
              if (data.cell.raw === 'Eligible') data.cell.styles.textColor = [16, 185, 129];
              else if (data.cell.raw === 'Not Eligible') data.cell.styles.textColor = [239, 68, 68];
              else data.cell.styles.textColor = [245, 158, 11];
            }
          }
        });
        
        doc.save('TenderAI_Evaluation_Report.pdf');
      });
    });
  };

  const getDecisionIcon = (decision) => {
    if (decision === 'Eligible') return <CheckCircle size={18} className="text-success" />;
    if (decision === 'Not Eligible') return <XCircle size={18} className="text-danger" />;
    return <AlertCircle size={18} className="text-warning" />;
  };

  const getBadgeClass = (decision) => {
    if (decision === 'Eligible') return 'badge eligible';
    if (decision === 'Not Eligible') return 'badge not-eligible';
    return 'badge needs-review';
  };

  return (
    <div className="app-container">
      {/* Background Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <header className="header">
        <h1><Bot size={54} className="title-icon" /> TenderAI</h1>
        <p>Automated Tender Eligibility Evaluation</p>
      </header>

      {errorMsg && (
        <div className="card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} /> {errorMsg}
          </p>
        </div>
      )}

      <div className="upload-section">
        {/* Tender Upload */}
        <div className="card">
          <h2><FileText className="text-primary" /> Tender Document</h2>
          <div className={`file-input-wrapper ${tenderStatus === 'loading' ? 'scanning-wrapper' : ''}`}>
            <input type="file" accept=".pdf" onChange={handleTenderUpload} />
            <Upload size={32} className="icon" />
            <p>{tenderFile ? tenderFile.name : 'Click or drag PDF to upload'}</p>
          </div>
          {tenderStatus === 'loading' && (
            <div className="loading" style={{ marginTop: '1rem' }}>
              <Loader className="spinner" size={18} /> Processing...
            </div>
          )}
          {tenderStatus === 'success' && (
            <p style={{ color: 'var(--success)', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} /> Criteria Extracted
            </p>
          )}
        </div>

        {/* Bidder Upload */}
        <div className="card">
          <h2><FileText className="text-primary" /> Bidder Documents</h2>
          <div className={`file-input-wrapper ${bidderStatus === 'loading' ? 'scanning-wrapper' : ''}`}>
            <input type="file" accept=".pdf,image/*" multiple onChange={handleBidderUpload} />
            <Upload size={32} className="icon" />
            <p>{bidderFiles.length > 0 ? `${bidderFiles.length} files selected` : 'Click or drag documents to upload'}</p>
          </div>
          {bidderStatus === 'loading' && (
            <div className="loading" style={{ marginTop: '1rem' }}>
              <Loader className="spinner" size={18} /> Processing...
            </div>
          )}
          {bidderStatus === 'success' && (
            <p style={{ color: 'var(--success)', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} /> Bidder Data Extracted
            </p>
          )}
        </div>
      </div>

      <button 
        className="btn evaluate-btn" 
        onClick={handleEvaluate}
        disabled={evaluating || tenderStatus !== 'success' || bidderStatus !== 'success'}
      >
        {evaluating ? (
          <><Loader className="spinner" /> Evaluating...</>
        ) : (
          <><Play /> Run Evaluation</>
        )}
      </button>

      {/* Results Section */}
      {evaluationResults && evaluationResults.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ marginBottom: 0 }}>Evaluation Results</h2>
            <button 
              className="btn" 
              style={{ width: 'auto', marginTop: 0, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)' }}
              onClick={handleDownloadPDF}
            >
              <Download size={18} /> Export PDF
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Bidder Value</th>
                  <th>Decision</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {evaluationResults.map((result, index) => (
                  <tr key={index}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{result.criterionName}</div>
                    </td>
                    <td>
                      <div>{result.bidderValue || 'Not Found'}</div>
                      <div className="reason">Source: {result.source || 'N/A'}</div>
                    </td>
                    <td>
                      <span className={getBadgeClass(result.decision)}>
                        {getDecisionIcon(result.decision)}
                        <span style={{ marginLeft: '4px' }}>{result.decision}</span>
                      </span>
                    </td>
                    <td>
                      <div className="reason" style={{ marginTop: 0 }}>{result.reason}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
