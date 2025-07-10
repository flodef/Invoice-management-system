import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { IconChevronLeft, IconChevronRight, IconLoader2 } from '@tabler/icons-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfUrl: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  // Load the PDF document
  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const document = await loadingTask.promise;
        setPdf(document);
        setTotalPages(document.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Impossible de charger le PDF. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();

    // Cleanup function
    return () => {
      if (pdf) {
        pdf.destroy();
      }
    };
  }, [pdfUrl]);

  // Render the current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      try {
        setLoading(true);
        const page = await pdf.getPage(currentPage);
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate viewport dimensions to fit width while maintaining aspect ratio
        const viewport = page.getViewport({ scale });
        
        // Set canvas dimensions to match viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
        setError('Erreur lors du rendu de la page.');
      } finally {
        setLoading(false);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale]);

  // Adjust scale on window resize to ensure PDF fits well on all devices
  useEffect(() => {
    const handleResize = () => {
      const containerWidth = document.querySelector('.pdf-container')?.clientWidth || window.innerWidth;
      // Adjust scale based on container width (with some padding)
      const newScale = Math.min(1.2, (containerWidth - 32) / 595); // 595 is standard A4 width in points
      setScale(newScale);
    };

    window.addEventListener('resize', handleResize);
    // Initial calculation
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Go to previous page
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Go to next page
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page navigation controls */}
      <div className="flex items-center justify-between bg-gray-100 px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Page précédente"
          >
            <IconChevronLeft size={20} />
          </button>
          <span className="text-sm">
            Page {currentPage} sur {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages || loading}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Page suivante"
          >
            <IconChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* PDF viewer container */}
      <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center pdf-container">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <IconLoader2 className="animate-spin text-blue-500" size={36} />
          </div>
        )}

        {error ? (
          <div className="p-4 text-red-500 text-center">{error}</div>
        ) : (
          <canvas ref={canvasRef} className="bg-white shadow-md" />
        )}
      </div>
    </div>
  );
};
