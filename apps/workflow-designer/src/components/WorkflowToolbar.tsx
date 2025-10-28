import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, RotateCw, Download, Upload } from 'lucide-react';

export function WorkflowToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView();
  }, [fitView]);

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-xl shadow-xl border-2 border-gray-200 p-1.5 backdrop-blur-sm bg-opacity-95">
      <div className="flex items-center space-x-0.5">
        <button
          onClick={handleZoomIn}
          className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
          title="Zoom In (Ctrl +)"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
          title="Zoom Out (Ctrl -)"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleFitView}
          className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
          title="Fit View (Ctrl 0)"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2" />
        <button
          className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 cursor-not-allowed"
          title="Undo (Ctrl Z) - Coming Soon"
          disabled
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 cursor-not-allowed"
          title="Redo (Ctrl Y) - Coming Soon"
          disabled
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2" />
        <button
          className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 cursor-not-allowed"
          title="Export - Coming Soon"
          disabled
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 cursor-not-allowed"
          title="Import - Coming Soon"
          disabled
        >
          <Upload className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
