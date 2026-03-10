// GED Drop Zone - File upload area matching Pennylane design

interface GedDropZoneProps {
  onUpload: (files: FileList) => void
}

export default function GedDropZone({ onUpload }: GedDropZoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files)
    }
  }

  return (
    <div
      className="bg-white rounded-xl border-2 border-dashed p-8 mb-6 flex items-center gap-8"
      style={{ borderColor: '#D6D9DB' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Illustration - folder with document and green blobs */}
      <div className="flex-shrink-0">
        <svg className="w-32 h-32" viewBox="0 0 140 140">
          {/* Green blobs */}
          <ellipse cx="75" cy="115" rx="35" ry="12" fill="#A7E8BD" opacity="0.6" />
          <ellipse cx="95" cy="108" rx="18" ry="10" fill="#6FD89C" opacity="0.5" />
          {/* Folder back */}
          <path d="M25 40 L25 105 L115 105 L115 40 L70 40 L63 28 L32 28 L25 40Z" fill="#D9EFEB" stroke="#006666" strokeWidth="2" />
          {/* Document inside - white with lines */}
          <rect x="42" y="50" width="56" height="45" rx="3" fill="white" stroke="#006666" strokeWidth="1.5" />
          <line x1="50" y1="62" x2="90" y2="62" stroke="#006666" strokeWidth="1.5" />
          <line x1="50" y1="72" x2="84" y2="72" stroke="#006666" strokeWidth="1.5" />
          <line x1="50" y1="82" x2="76" y2="82" stroke="#006666" strokeWidth="1.5" />
          {/* Small green checkmark */}
          <circle cx="100" cy="48" r="10" fill="#006666" />
          <path d="M95 48 L99 52 L106 44" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#141A1F' }}>
          Déposez les documents ici
        </h3>
        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>
          Documents légaux, échéanciers, PV d'AG... Tout ce qui n'est pas une facture, c'est ici !
        </p>
        <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
          Formats acceptés : .PDF, .PNG ou .JPG
        </p>
        <label
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm cursor-pointer"
          style={{ backgroundColor: '#006666' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Ajouter
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </div>
    </div>
  )
}
