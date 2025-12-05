import React, { useCallback, useRef, useState } from 'react';
import { profileApi } from '../../services/api';
import { adaptiveCompress, formatBytes, processImage, cropImage } from '../../utils/imageProcessing';
import ReactCrop, { Crop } from 'react-image-crop';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import 'react-image-crop/dist/ReactCrop.css';

interface FinePaymentProofModalProps {
  loanIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

// Backend currently enforces 5MB; we target a tighter post-processing size (<= 1MB ideally)
const RAW_MAX_SIZE = 5 * 1024 * 1024; // raw file limit before processing (frontend early reject)
const TARGET_MAX_BYTES = 1024 * 1024; // strive for <=1MB after compression

const humanSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(2) + ' MB';
};

const FinePaymentProofModal: React.FC<FinePaymentProofModalProps> = ({ loanIds, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [rotDeg, setRotDeg] = useState(0);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  
  // Webcam states
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const validateFile = (f: File) => {
    if (!f.type.startsWith('image/')) return 'File harus berupa gambar (jpeg/png/webp).';
    if (f.size > RAW_MAX_SIZE) return 'Ukuran file melebihi 5MB.';
    return null;
  };

  const handleSelect = async (f: File) => {
    const msg = validateFile(f);
    if (msg) { setError(msg); setFile(null); setPreview(null); return; }
    setError(null);
    // Process (max dimension 1600, compress adaptively to <=1MB if possible)
    let processed = f;
    try {
      processed = await adaptiveCompress(f, {
        maxWidth: 1600,
        maxHeight: 1600,
        outputType: f.type === 'image/png' ? 'image/png' : 'image/jpeg',
        preserveTransparency: f.type === 'image/png',
        maxBytes: TARGET_MAX_BYTES,
        qualitySteps: [0.8, 0.7, 0.6, 0.5, 0.4]
      });
      if (processed.size > TARGET_MAX_BYTES) {
        // Not fatal; just warn user
        setError(`Peringatan: Bukti masih ${formatBytes(processed.size)} (>1MB). Lanjutkan jika tetap ingin.`);
      }
    } catch (err) {
      console.warn('Compression failed, using original proof file:', err);
    }
    setFile(processed);
    const url = URL.createObjectURL(processed);
    setPreview(url);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      stopCamera(); // Stop camera when file is selected
      handleSelect(f);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const resetFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setError(null); setRotDeg(0);
  };

  // Webcam functions
  const startCamera = async (mode?: 'user' | 'environment') => {
    try {
      const targetMode = mode || facingMode;
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: targetMode }, 
        audio: false 
      });
      setStream(mediaStream);
      setShowCamera(true);
      setFacingMode(targetMode);
    } catch (err) {
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
      console.error('Camera error:', err);
    }
  };

  const switchCamera = async () => {
    stopCamera();
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera(newMode);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const takePicture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0);
    
    // Prepare overlay text
    let overlayText: string[] = [];
    const now = new Date();
    overlayText.push(format(now, 'dd MMM yyyy HH:mm:ss', { locale: id }));
    overlayText.push('Bukti Pembayaran Denda');

    // Try to get GPS location
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        
        overlayText.push(`GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
        overlayText.push(`Akurasi: ±${position.coords.accuracy.toFixed(0)}m`);
      } catch (err) {
        console.warn('Failed to get location for fine payment:', err);
        overlayText.push('GPS: Tidak tersedia');
      }
    } else {
      overlayText.push('GPS: Tidak tersedia');
    }

    // Draw overlay text on canvas (bottom-right corner)
    ctx.save();
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    
    const padding = 15;
    const lineHeight = 20;
    const boxPadding = 10;
    const textX = canvas.width - padding;
    let textY = canvas.height - padding;
    
    // Calculate background box dimensions
    const maxWidth = Math.max(...overlayText.map(text => ctx.measureText(text).width));
    const boxWidth = maxWidth + (boxPadding * 2);
    const boxHeight = (overlayText.length * lineHeight) + (boxPadding * 2);
    const boxX = canvas.width - boxWidth - padding + boxPadding;
    const boxY = canvas.height - boxHeight - padding + boxPadding;
    
    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Draw text lines
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    
    for (let i = overlayText.length - 1; i >= 0; i--) {
      ctx.fillText(overlayText[i], textX, textY);
      textY -= lineHeight;
    }
    
    ctx.restore();
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await handleSelect(file);
    }, 'image/jpeg', 0.9);
  };

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const rotateImage = async () => {
    if (!file) return;
    try {
      const nextRot = (rotDeg + 90) % 360;
      // Rotate based on original chain each time by applying additional 90°
      const rotated = await processImage(file, {
        maxWidth: 4000,
        maxHeight: 4000,
        outputType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        preserveTransparency: file.type === 'image/png',
        quality: 0.9,
        rotateDeg: 90
      });
      setRotDeg(nextRot);
      setFile(rotated);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(rotated);
      setPreview(url);
    } catch (err) {
      console.warn('Gagal memutar gambar:', err);
      setError('Gagal memutar gambar.');
    }
  };

  const toggleCropMode = () => {
    if (!preview) return;
    if (!cropMode) {
      // initialize crop to full image (will adjust once image loads)
      setCrop(undefined);
      setCompletedCrop(null);
    }
    setCropMode(m => !m);
  };

  const applyCrop = async () => {
    if (!file || !completedCrop || !imgRef.current || !completedCrop.width || !completedCrop.height) { setCropMode(false); return; }
    try {
      const naturalW = imgRef.current.naturalWidth;
      const naturalH = imgRef.current.naturalHeight;
      const displayW = imgRef.current.width;
      const displayH = imgRef.current.height;
      const scaleX = naturalW / displayW;
      const scaleY = naturalH / displayH;
      const cropRect = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY
      };
      const cropped = await cropImage(file, cropRect, {
        outputType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        preserveTransparency: file.type === 'image/png',
        quality: 0.9,
        rotateDeg: 0,
        targetMaxWidth: 1600,
        targetMaxHeight: 1600
      });
      const finalFile = await adaptiveCompress(cropped, {
        maxWidth: 1600,
        maxHeight: 1600,
        outputType: (['image/jpeg','image/png','image/webp'].includes(cropped.type) ? cropped.type : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
        preserveTransparency: cropped.type === 'image/png',
        maxBytes: TARGET_MAX_BYTES,
        qualitySteps: [0.85,0.75,0.65,0.55,0.45]
      });
      setFile(finalFile);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(finalFile));
    } catch (err) {
      console.warn('Crop gagal:', err);
      setError('Gagal memotong gambar');
    } finally {
      setCropMode(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) { setError('Pilih / drop file bukti terlebih dahulu.'); return; }
    setSubmitting(true); 
    setError(null);
    setUploadProgress(0);
    setShowUploadModal(true);
    
    // Simulasi progress upload
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 150);
    
    try {
      await profileApi.uploadFineProof(loanIds, file);
      setUploadProgress(100);
      clearInterval(progressInterval);
      
      // Tunggu sebentar untuk show 100%
      setTimeout(() => {
        resetFile();
        setShowUploadModal(false);
        onSuccess();
        onClose();
      }, 500);
    } catch (e: any) {
      clearInterval(progressInterval);
      setShowUploadModal(false);
      setError(e?.response?.data?.message || 'Gagal mengunggah bukti.');
    } finally { 
      setSubmitting(false); 
    }
  };

  // Auto-start camera when modal opens
  React.useEffect(() => {
    if (!preview && !file) {
      startCamera();
    }
  }, []);

  // Connect stream to video element
  React.useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="modal-backdrop fine-proof-modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal fine-proof-modal">
        <h3>Bukti Pembayaran Denda</h3>
        <p className="fine-proof-subtitle">{loanIds.length} denda akan dikirim bukti pembayarannya.</p>
        
        {showCamera && !preview ? (
          <div className="fine-camera-container">
            <div className="camera-header">
              <button type="button" className="camera-switch-btn" onClick={switchCamera}>
                🔄 {facingMode === 'environment' ? 'Depan' : 'Belakang'}
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="fine-camera-video" />
            <canvas ref={canvasRef} style={{display: 'none'}} />
            <div className="fine-camera-controls">
              <button type="button" className="fine-btn-capture" onClick={takePicture}>
                📸 Take Picture
              </button>
              <button type="button" className="fine-btn-file" onClick={() => { stopCamera(); inputRef.current?.click(); }}>
                📁 Upload File
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="fine-upload-choice">
            <p className="fine-choice-text">Memuat kamera...</p>
          </div>
        ) : (
          <div
            className="fine-drop-zone has-file"
            onClick={() => inputRef.current?.click()}
            aria-label="Area unggah bukti (klik atau drag & drop)"
            tabIndex={0}
          >
          <div className="fine-preview-wrapper">
              <div className={`fine-preview-stage ${cropMode ? 'crop-mode': ''}`}>
                {cropMode ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop as any)}
                    onComplete={(c)=> setCompletedCrop(c)}
                    aspect={undefined}
                    keepSelection
                  >
                    <img 
                      ref={imgRef}
                      src={preview} 
                      alt="Preview Bukti" 
                      className="fine-preview-image" 
                      onLoad={(e)=>{
                        if(!crop){
                          const target = e.currentTarget;
                          setCrop({ unit:'px', x:10, y:10, width: Math.min( target.naturalWidth-20, target.naturalWidth*0.8), height: Math.min(target.naturalHeight-20, target.naturalHeight*0.8) });
                        }
                      }}
                    />
                  </ReactCrop>
                ) : (
                  <img ref={imgRef} src={preview} alt="Preview Bukti" className="fine-preview-image" />
                )}
              </div>
              <div className="fine-file-meta">
                <strong>{file?.name}</strong>
                <span>{file ? formatBytes(file.size) : ''}</span>
              </div>
              <div className="fine-proof-actions-inline">
                <button type="button" className="fine-btn-secondary small" onClick={(e)=>{ e.stopPropagation(); rotateImage(); }}>Putar 90°</button>
                <button type="button" className="fine-btn-secondary small" onClick={(e)=>{ e.stopPropagation(); toggleCropMode(); }}>{cropMode ? 'Batal Crop' : 'Crop'}</button>
                {cropMode && <button type="button" className="fine-btn-secondary small" onClick={(e)=>{ e.stopPropagation(); applyCrop(); }} disabled={!completedCrop}>Terapkan</button>}
                <button 
                  type="button" 
                  className="fine-btn-secondary small" 
                  onClick={(e)=>{ 
                    e.stopPropagation(); 
                    resetFile(); 
                    startCamera(); 
                  }}
                >
                  Ganti Foto
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden file inputs */}
        <input id="fine-proof-input" ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="visually-hidden-file" />
        <input id="fine-proof-camera" ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} className="visually-hidden-file" />
        
        {error && <p className="status-message error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button onClick={() => { if(!submitting) { resetFile(); onClose(); }}} disabled={submitting}>Batal</button>
          <button onClick={handleSubmit} disabled={submitting || !file}>{submitting ? 'Mengunggah...' : 'Kirim Bukti'}</button>
        </div>
      </div>
      
      {/* Upload Progress Modal */}
      {showUploadModal && (
        <div className="modal-backdrop upload-progress-backdrop" style={{zIndex: 1100}}>
          <div className="modal upload-progress-modal">
            <h3>Mengunggah Bukti Pembayaran</h3>
            <div className="upload-progress-container">
              <div className="upload-progress-bar-bg">
                <div 
                  className="upload-progress-bar-fill" 
                  style={{
                    width: `${uploadProgress}%`,
                    backgroundColor: uploadProgress === 100 ? '#4caf50' : '#2196f3'
                  }}
                />
              </div>
              <div className="upload-progress-text">{uploadProgress}%</div>
            </div>
            {uploadProgress === 100 && <p className="upload-success-text">✓ Upload berhasil!</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinePaymentProofModal;
