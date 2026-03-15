import { useCallback, useState, useRef } from 'react';

function FileUpload({
    title,
    icon,
    description,
    accept,
    file,
    onFileSelect,
    onFileRemove,
    fileInfo,
    disabled,
    disabledMessage
}) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (disabled) return;

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            onFileSelect(droppedFile);
        }
    }, [disabled, onFileSelect]);

    const handleClick = useCallback(() => {
        if (!disabled && inputRef.current) {
            inputRef.current.click();
        }
    }, [disabled]);

    const handleFileChange = useCallback((e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            onFileSelect(selectedFile);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    }, [onFileSelect]);

    const getFileExtension = (filename) => {
        return filename.split('.').pop().toUpperCase();
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="card fade-in">
            <h2 className="card-title">
                <span className="icon">{icon}</span>
                {title}
            </h2>

            <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''} ${disabled ? 'upload-zone-disabled' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={disabled}
                />

                {!file ? (
                    <>
                        <div className="upload-icon">{disabled ? '🔒' : '📁'}</div>
                        <p className="upload-text">
                            {disabled && disabledMessage ? (
                                <>
                                    <span style={{ color: 'var(--text-muted)' }}>{disabledMessage}</span>
                                    <br />
                                    <span style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block', color: 'var(--text-muted)', opacity: 0.7 }}>
                                        {description}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <strong>Drop file here</strong> or click to browse
                                    <br />
                                    <span style={{ fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                                        {description}
                                    </span>
                                </>
                            )}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="upload-icon">✅</div>
                        <p className="upload-text">
                            <strong style={{ color: 'var(--success)' }}>File uploaded successfully</strong>
                        </p>
                    </>
                )}
            </div>

            {file && (
                <div className="file-info">
                    <span className="file-icon">
                        {getFileExtension(file.name) === 'PDF' ? '📕' :
                            getFileExtension(file.name) === 'DOCX' ? '📘' : '📝'}
                    </span>
                    <div style={{ flex: 1 }}>
                        <div className="file-name">{file.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatFileSize(file.size)}
                            {fileInfo && ` • ${fileInfo}`}
                        </div>
                    </div>
                    <button className="remove-btn" onClick={(e) => { e.stopPropagation(); onFileRemove(); }}>
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}

export default FileUpload;
